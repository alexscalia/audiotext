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

    // Load every non-deleted (ip,trunk) pair. `active` collapses both the
    // ip-row status and the parent-trunk status into a single boolean — a
    // peer is `active` only when ip.status='active' AND trunk.status is
    // 'active' or 'testing'. Soft-deleted rows on either side are excluded
    // entirely and surface as `unknown` on lookup.
    const sql =
        \\SELECT vti.ip,
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

    var new_map = std.StringHashMap(cache.Entry).init(allocator);
    defer {
        var it = new_map.keyIterator();
        while (it.next()) |k| allocator.free(k.*);
        new_map.deinit();
    }

    var i: c_int = 0;
    var active_count: usize = 0;
    while (i < n) : (i += 1) {
        const ip_raw = c.PQgetvalue(res, i, 0);
        const ip = std.mem.sliceTo(ip_raw, 0);
        const active_raw = c.PQgetvalue(res, i, 1);
        const active = active_raw[0] == 't';

        const owned = try allocator.dupe(u8, ip);
        errdefer allocator.free(owned);
        try new_map.put(owned, .{ .active = active });
        if (active) active_count += 1;
    }

    std.log.info("loaded {} trunk_ip rows from postgres ({} active)", .{ n, active_count });
    target.swap(&new_map);
}
