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

    // Every (ip, prefix) credential. Empty string in `prefix` means
    // "no tech prefix expected" (catch-all). `active` = ip-row and
    // parent-trunk both eligible.
    const sql =
        \\SELECT vti.ip,
        \\       COALESCE(vti.prefix, '')                  AS prefix,
        \\       (vti.status = 'active'
        \\        AND vt.status IN ('active', 'testing')) AS active
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

        const gop = try new_map.getOrPut(ip);
        if (!gop.found_existing) {
            gop.key_ptr.* = try allocator.dupe(u8, ip);
            gop.value_ptr.* = std.ArrayList(cache.Credential).init(allocator);
        }
        const owned_prefix = try allocator.dupe(u8, prefix);
        errdefer allocator.free(owned_prefix);
        try gop.value_ptr.append(.{
            .prefix = owned_prefix,
            .active = active,
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

    std.log.info("loaded {} trunk_ip rows ({} active, {} distinct IPs), {} active DIDs", .{
        n,
        active_count,
        new_map.count(),
        new_numbers.count(),
    });
    target.swap(&new_map, &new_numbers);
}
