const std = @import("std");
const cache = @import("cache.zig");
const redis_cmd = @import("redis_cmd.zig");

pub fn serve(
    allocator: std.mem.Allocator,
    listen_addr: []const u8,
    auth_cache: *cache.AuthCache,
    rcmd: *redis_cmd.RedisCmd,
) !void {
    const addr = try parseAddr(listen_addr);
    var server = try addr.listen(.{ .reuse_address = true });
    defer server.deinit();

    while (true) {
        const conn = server.accept() catch |err| {
            std.log.err("accept failed: {}", .{err});
            continue;
        };
        handleConnection(allocator, conn, auth_cache, rcmd) catch |err| {
            std.log.warn("connection error: {}", .{err});
        };
        conn.stream.close();
    }
}

fn parseAddr(s: []const u8) !std.net.Address {
    const colon = std.mem.indexOfScalar(u8, s, ':') orelse return error.InvalidAddr;
    const host = s[0..colon];
    const port = try std.fmt.parseInt(u16, s[colon + 1 ..], 10);
    return std.net.Address.parseIp(host, port);
}

fn handleConnection(
    allocator: std.mem.Allocator,
    conn: std.net.Server.Connection,
    auth_cache: *cache.AuthCache,
    rcmd: *redis_cmd.RedisCmd,
) !void {
    var buf: [4096]u8 = undefined;
    const n = try conn.stream.read(&buf);
    if (n == 0) return;
    const request = buf[0..n];

    const line_end = std.mem.indexOfScalar(u8, request, '\r') orelse return error.MalformedRequest;
    const line = request[0..line_end];

    var it = std.mem.tokenizeScalar(u8, line, ' ');
    _ = it.next() orelse return error.MalformedRequest;
    const target = it.next() orelse return error.MalformedRequest;

    if (std.mem.startsWith(u8, target, "/healthz")) {
        try writeResp(conn.stream, 200, "ok\n", "text/plain");
        return;
    }
    if (std.mem.startsWith(u8, target, "/authorize")) {
        const ip_raw = extractQueryParam(target, "ip") orelse {
            try writeResp(conn.stream, 400, "{\"error\":\"missing ip\"}\n", "application/json");
            return;
        };
        const a_raw = extractQueryParam(target, "a") orelse {
            try writeResp(conn.stream, 400, "{\"error\":\"missing a\"}\n", "application/json");
            return;
        };
        const b_raw = extractQueryParam(target, "b") orelse {
            try writeResp(conn.stream, 400, "{\"error\":\"missing b\"}\n", "application/json");
            return;
        };

        const ip = try urlDecode(allocator, ip_raw);
        defer allocator.free(ip);
        const a = try urlDecode(allocator, a_raw);
        defer allocator.free(a);
        const b = try urlDecode(allocator, b_raw);
        defer allocator.free(b);

        // .active   → credential matches, stripped B is owned DID, no block hit.
        //             Then runs per-range daily-minute quota check.
        // .unknown  → 403/21 permanent.
        // .inactive → 503/34 (carrier may retry).
        // .blocked  → 503/34 block-list hit.
        const result = auth_cache.lookup(ip, a, b);

        var body_buf: [1024]u8 = undefined;
        var body: []const u8 = undefined;
        var outcome_tag: []const u8 = @tagName(result);

        switch (result) {
            .active => |m| {
                // Quota check — only hit Redis if range has any cap set.
                const range_id = m.rangeId();
                const trunk_id = m.trunkId();
                const quotas_opt = auth_cache.getRangeQuotas(range_id);
                if (quotas_opt) |q| {
                    if (q.anyEnforced()) {
                        const date_buf = utcDate();
                        var k_total_buf: [128]u8 = undefined;
                        var k_a_buf: [256]u8 = undefined;
                        var k_b_buf: [256]u8 = undefined;
                        var k_ab_buf: [320]u8 = undefined;
                        const k_total = try std.fmt.bufPrint(&k_total_buf, "quota:range:{s}:total:{s}", .{ range_id, &date_buf });
                        const k_a = try std.fmt.bufPrint(&k_a_buf, "quota:range:{s}:a:{s}:{s}", .{ range_id, a, &date_buf });
                        const k_b = try std.fmt.bufPrint(&k_b_buf, "quota:range:{s}:b:{s}:{s}", .{ range_id, m.stripped_b, &date_buf });
                        const k_ab = try std.fmt.bufPrint(&k_ab_buf, "quota:range:{s}:ab:{s}:{s}:{s}", .{ range_id, a, m.stripped_b, &date_buf });

                        const rr = rcmd.quotaReserve(
                            k_total,
                            k_a,
                            k_b,
                            k_ab,
                            q.max_total_sec,
                            q.max_a_sec,
                            q.max_b_sec,
                            q.max_ab_sec,
                        );
                        switch (rr) {
                            .ok, .redis_error => {}, // redis_error → fail-open
                            .blocked_total => {
                                outcome_tag = "quota_total";
                                body = "{\"allowed\":0,\"status\":503,\"cause\":34}\n";
                                try writeResp(conn.stream, 200, body, "application/json");
                                std.log.info("authorize ip={s} a={s} b={s} result=quota_total range_id={s}", .{ ip, a, b, range_id });
                                return;
                            },
                            .blocked_a => {
                                outcome_tag = "quota_a";
                                body = "{\"allowed\":0,\"status\":503,\"cause\":34}\n";
                                try writeResp(conn.stream, 200, body, "application/json");
                                std.log.info("authorize ip={s} a={s} b={s} result=quota_a range_id={s}", .{ ip, a, b, range_id });
                                return;
                            },
                            .blocked_b => {
                                outcome_tag = "quota_b";
                                body = "{\"allowed\":0,\"status\":503,\"cause\":34}\n";
                                try writeResp(conn.stream, 200, body, "application/json");
                                std.log.info("authorize ip={s} a={s} b={s} result=quota_b range_id={s}", .{ ip, a, b, range_id });
                                return;
                            },
                            .blocked_ab => {
                                outcome_tag = "quota_ab";
                                body = "{\"allowed\":0,\"status\":503,\"cause\":34}\n";
                                try writeResp(conn.stream, 200, body, "application/json");
                                std.log.info("authorize ip={s} a={s} b={s} result=quota_ab range_id={s}", .{ ip, a, b, range_id });
                                return;
                            },
                        }
                    }
                }
                // b_dialed = original B-number from carrier (pre-strip).
                // FreeSWITCH CDR listener uses these IDs for attribution.
                body = try std.fmt.bufPrint(
                    &body_buf,
                    "{{\"allowed\":1,\"b\":\"{s}\",\"b_dialed\":\"{s}\",\"range_id\":\"{s}\",\"trunk_id\":\"{s}\"}}\n",
                    .{ m.stripped_b, b, range_id, trunk_id },
                );
            },
            .unknown => body = "{\"allowed\":0,\"status\":403,\"cause\":21}\n",
            .inactive => body = "{\"allowed\":0,\"status\":503,\"cause\":34}\n",
            .blocked => body = "{\"allowed\":0,\"status\":503,\"cause\":34}\n",
        }
        try writeResp(conn.stream, 200, body, "application/json");

        const stripped: []const u8 = switch (result) {
            .active => |m| m.stripped_b,
            else => "",
        };
        std.log.info("authorize ip={s} a={s} b={s} result={s} stripped_b={s}", .{ ip, a, b, outcome_tag, stripped });
        return;
    }
    try writeResp(conn.stream, 404, "{\"error\":\"not found\"}\n", "application/json");
}

// Returns "YYYY-MM-DD" in UTC for today's quota key scope.
// Uses pod clock — fine in practice; NTP-synced pods + 48h key TTL leave plenty
// of slack across midnight boundary.
fn utcDate() [10]u8 {
    var out: [10]u8 = undefined;
    const es = std.time.epoch.EpochSeconds{ .secs = @intCast(std.time.timestamp()) };
    const day = es.getEpochDay();
    const yd = day.calculateYearDay();
    const md = yd.calculateMonthDay();
    _ = std.fmt.bufPrint(&out, "{d:0>4}-{d:0>2}-{d:0>2}", .{
        yd.year,
        md.month.numeric(),
        md.day_index + 1,
    }) catch unreachable;
    return out;
}

fn urlDecode(allocator: std.mem.Allocator, s: []const u8) ![]u8 {
    var out = try allocator.alloc(u8, s.len);
    errdefer allocator.free(out);
    var oi: usize = 0;
    var i: usize = 0;
    while (i < s.len) {
        const ch = s[i];
        if (ch == '%' and i + 2 < s.len) {
            const hi = std.fmt.charToDigit(s[i + 1], 16) catch {
                out[oi] = ch;
                oi += 1;
                i += 1;
                continue;
            };
            const lo = std.fmt.charToDigit(s[i + 2], 16) catch {
                out[oi] = ch;
                oi += 1;
                i += 1;
                continue;
            };
            out[oi] = (hi << 4) | lo;
            oi += 1;
            i += 3;
        } else {
            out[oi] = ch;
            oi += 1;
            i += 1;
        }
    }
    return allocator.realloc(out, oi);
}

fn extractQueryParam(target: []const u8, key: []const u8) ?[]const u8 {
    const q = std.mem.indexOfScalar(u8, target, '?') orelse return null;
    const query = target[q + 1 ..];
    var it = std.mem.tokenizeScalar(u8, query, '&');
    while (it.next()) |pair| {
        const eq = std.mem.indexOfScalar(u8, pair, '=') orelse continue;
        if (std.mem.eql(u8, pair[0..eq], key)) {
            return pair[eq + 1 ..];
        }
    }
    return null;
}

fn writeResp(stream: std.net.Stream, status: u16, body: []const u8, ctype: []const u8) !void {
    var buf: [256]u8 = undefined;
    const reason: []const u8 = switch (status) {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        else => "Error",
    };
    const head = try std.fmt.bufPrint(&buf, "HTTP/1.1 {d} {s}\r\nContent-Type: {s}\r\nContent-Length: {d}\r\nConnection: close\r\n\r\n", .{ status, reason, ctype, body.len });
    try stream.writeAll(head);
    try stream.writeAll(body);
}
