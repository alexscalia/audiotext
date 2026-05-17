const std = @import("std");
const cache = @import("cache.zig");

const c = @cImport({
    @cInclude("libpq-fe.h");
});

pub fn loadIntoCache(
    allocator: std.mem.Allocator,
    database_url: [:0]const u8,
    target: *cache.AuthCache,
) !void {
    const conn = c.PQconnectdb(database_url.ptr);
    defer c.PQfinish(conn);

    if (c.PQstatus(conn) != c.CONNECTION_OK) {
        const msg = std.mem.sliceTo(c.PQerrorMessage(conn), 0);
        std.log.err("postgres connect failed: {s}", .{msg});
        return error.PostgresConnectFailed;
    }

    // Every (ip, prefix, trunk_id) credential. Empty string in `prefix` means
    // "no tech prefix expected" (catch-all). `active` = ip-row and
    // parent-trunk both eligible. trunk_id needed to scope per-trunk block
    // lookups later.
    const sql =
        \\SELECT vti.ip,
        \\       COALESCE(vti.prefix, '')                  AS prefix,
        \\       (vti.status = 'active'
        \\        AND vt.status IN ('active', 'testing')) AS active,
        \\       vt.id::text                               AS trunk_id
        \\FROM voice_trunk_ips vti
        \\JOIN voice_trunks    vt ON vt.id = vti.voice_trunk_id
        \\WHERE vti.deleted_at IS NULL
        \\  AND vt.deleted_at  IS NULL
    ;

    const res = c.PQexec(conn, sql);
    defer c.PQclear(res);

    if (c.PQresultStatus(res) != c.PGRES_TUPLES_OK) {
        const msg = std.mem.sliceTo(c.PQerrorMessage(conn), 0);
        std.log.err("postgres query failed: {s}", .{msg});
        return error.PostgresQueryFailed;
    }

    const n = c.PQntuples(res);

    var new_map = cache.Map.init(allocator);
    defer cache.deinitMap(&new_map, allocator);

    var active_count: usize = 0;
    var i: c_int = 0;
    while (i < n) : (i += 1) {
        const ip_raw = c.PQgetvalue(res, i, 0);
        const ip = std.mem.sliceTo(ip_raw, 0);
        const prefix_raw = c.PQgetvalue(res, i, 1);
        const prefix = std.mem.sliceTo(prefix_raw, 0);
        const active_raw = c.PQgetvalue(res, i, 2);
        const active = active_raw[0] == 't';
        const trunk_id_raw = c.PQgetvalue(res, i, 3);
        const trunk_id = std.mem.sliceTo(trunk_id_raw, 0);

        const gop = try new_map.getOrPut(ip);
        if (!gop.found_existing) {
            gop.key_ptr.* = try allocator.dupe(u8, ip);
            gop.value_ptr.* = std.ArrayList(cache.Credential).init(allocator);
        }
        const owned_prefix = try allocator.dupe(u8, prefix);
        errdefer allocator.free(owned_prefix);
        const owned_trunk_id = try allocator.dupe(u8, trunk_id);
        errdefer allocator.free(owned_trunk_id);
        try gop.value_ptr.append(.{
            .prefix = owned_prefix,
            .active = active,
            .trunk_id = owned_trunk_id,
        });
        if (active) active_count += 1;
    }

    // Active DIDs owned by us, AND whose owning user is active + not deleted.
    // Stripped B-number must hit this set or signaling returns 503 cause 34.
    const numbers_sql =
        \\SELECT n.number
        \\FROM at_voice_numbers n
        \\JOIN users u ON u.id = n.user_id
        \\WHERE n.deleted_at IS NULL
        \\  AND u.deleted_at IS NULL
        \\  AND u.status = 'active'
    ;
    const nres = c.PQexec(conn, numbers_sql);
    defer c.PQclear(nres);

    if (c.PQresultStatus(nres) != c.PGRES_TUPLES_OK) {
        const msg = std.mem.sliceTo(c.PQerrorMessage(conn), 0);
        std.log.err("at_voice_numbers query failed: {s}", .{msg});
        return error.PostgresQueryFailed;
    }

    var new_numbers = cache.NumberSet.init(allocator);
    defer cache.deinitNumberSet(&new_numbers, allocator);

    const nn = c.PQntuples(nres);
    var j: c_int = 0;
    while (j < nn) : (j += 1) {
        const num_raw = c.PQgetvalue(nres, j, 0);
        const num = std.mem.sliceTo(num_raw, 0);
        const gop = try new_numbers.getOrPut(num);
        if (!gop.found_existing) {
            gop.key_ptr.* = try allocator.dupe(u8, num);
        }
    }

    // Inbound (trunk-side) blocked prefixes.
    // voice_trunk_id NULL → global block (applies to every trunk).
    // expires_at honored at load time; soft-deleted rows skipped.
    const trunk_blocks_sql =
        \\SELECT COALESCE(voice_trunk_id::text, '') AS trunk_id, party, prefix
        \\FROM voice_trunk_blocked_prefixes
        \\WHERE deleted_at IS NULL
        \\  AND (expires_at IS NULL OR expires_at > now())
    ;
    const tbres = c.PQexec(conn, trunk_blocks_sql);
    defer c.PQclear(tbres);
    if (c.PQresultStatus(tbres) != c.PGRES_TUPLES_OK) {
        const msg = std.mem.sliceTo(c.PQerrorMessage(conn), 0);
        std.log.err("voice_trunk_blocked_prefixes query failed: {s}", .{msg});
        return error.PostgresQueryFailed;
    }

    var new_trunk_blocks = cache.BlockMap.init(allocator);
    defer cache.deinitBlockMap(&new_trunk_blocks, allocator);
    var new_global_trunk_blocks = cache.BlockSet.init(allocator);
    defer new_global_trunk_blocks.deinit(allocator);

    const tbn = c.PQntuples(tbres);
    var k: c_int = 0;
    while (k < tbn) : (k += 1) {
        const trunk_id_raw = c.PQgetvalue(tbres, k, 0);
        const trunk_id = std.mem.sliceTo(trunk_id_raw, 0);
        const party_raw = c.PQgetvalue(tbres, k, 1);
        const party = std.mem.sliceTo(party_raw, 0);
        const prefix_raw = c.PQgetvalue(tbres, k, 2);
        const prefix = std.mem.sliceTo(prefix_raw, 0);

        const owned_prefix = try allocator.dupe(u8, prefix);
        errdefer allocator.free(owned_prefix);

        var target_set: *cache.BlockSet = undefined;
        if (trunk_id.len == 0) {
            target_set = &new_global_trunk_blocks;
        } else {
            const gop = try new_trunk_blocks.getOrPut(trunk_id);
            if (!gop.found_existing) {
                gop.key_ptr.* = try allocator.dupe(u8, trunk_id);
                gop.value_ptr.* = cache.BlockSet.init(allocator);
            }
            target_set = gop.value_ptr;
        }
        if (party.len > 0 and party[0] == 'a') {
            try target_set.a_prefixes.append(owned_prefix);
        } else {
            try target_set.b_prefixes.append(owned_prefix);
        }
    }

    // Outbound (termination-side) blocked prefixes.
    // Signaling doesn't pick a termination yet (no LCR), so per-termination
    // and global rows are flattened into one set and checked against every
    // call's A and stripped-B.
    const term_blocks_sql =
        \\SELECT party, prefix
        \\FROM at_voice_termination_blocked_prefixes
        \\WHERE deleted_at IS NULL
        \\  AND (expires_at IS NULL OR expires_at > now())
    ;
    const tmres = c.PQexec(conn, term_blocks_sql);
    defer c.PQclear(tmres);
    if (c.PQresultStatus(tmres) != c.PGRES_TUPLES_OK) {
        const msg = std.mem.sliceTo(c.PQerrorMessage(conn), 0);
        std.log.err("at_voice_termination_blocked_prefixes query failed: {s}", .{msg});
        return error.PostgresQueryFailed;
    }

    var new_term_blocks = cache.BlockSet.init(allocator);
    defer new_term_blocks.deinit(allocator);

    const tmn = c.PQntuples(tmres);
    var l: c_int = 0;
    while (l < tmn) : (l += 1) {
        const party_raw = c.PQgetvalue(tmres, l, 0);
        const party = std.mem.sliceTo(party_raw, 0);
        const prefix_raw = c.PQgetvalue(tmres, l, 1);
        const prefix = std.mem.sliceTo(prefix_raw, 0);

        const owned_prefix = try allocator.dupe(u8, prefix);
        errdefer allocator.free(owned_prefix);
        if (party.len > 0 and party[0] == 'a') {
            try new_term_blocks.a_prefixes.append(owned_prefix);
        } else {
            try new_term_blocks.b_prefixes.append(owned_prefix);
        }
    }

    std.log.info(
        "loaded {} trunk_ip rows ({} active, {} distinct IPs), {} active DIDs, {} per-trunk block sets, {} global trunk-block prefixes (a={} b={}), {} term-block prefixes (a={} b={})",
        .{
            n,
            active_count,
            new_map.count(),
            new_numbers.count(),
            new_trunk_blocks.count(),
            new_global_trunk_blocks.a_prefixes.items.len + new_global_trunk_blocks.b_prefixes.items.len,
            new_global_trunk_blocks.a_prefixes.items.len,
            new_global_trunk_blocks.b_prefixes.items.len,
            new_term_blocks.a_prefixes.items.len + new_term_blocks.b_prefixes.items.len,
            new_term_blocks.a_prefixes.items.len,
            new_term_blocks.b_prefixes.items.len,
        },
    );
    target.swap(&new_map, &new_numbers, &new_trunk_blocks, &new_global_trunk_blocks, &new_term_blocks);
}
