const std = @import("std");
const cache = @import("cache.zig");
const redis_cmd = @import("redis_cmd.zig");

// Per-worker context. Each worker thread owns one Redis connection so
// EVALSHAs don't serialize through a global mutex.
pub const Worker = struct {
    id: usize,
    cache: *cache.AuthCache,
    rcmd: *redis_cmd.RedisCmd,
    allocator: std.mem.Allocator,
    server: *std.net.Server,
};

pub fn serve(
    allocator: std.mem.Allocator,
    listen_addr: []const u8,
    auth_cache: *cache.AuthCache,
    rcmds: []redis_cmd.RedisCmd,
) !void {
    const addr = try parseAddr(listen_addr);
    var server = try addr.listen(.{ .reuse_address = true });
    defer server.deinit();

    // Spawn N-1 worker threads; main thread is the Nth worker. All workers
    // call accept() on the shared listening socket — kernel serializes the
    // accept and hands one TCP socket to one worker.
    const n = rcmds.len;
    const workers = try allocator.alloc(Worker, n);
    defer allocator.free(workers);
    for (workers, 0..) |*w, i| {
        w.* = .{
            .id = i,
            .cache = auth_cache,
            .rcmd = &rcmds[i],
            .allocator = allocator,
            .server = &server,
        };
    }

    var threads = try allocator.alloc(std.Thread, if (n > 1) n - 1 else 0);
    defer allocator.free(threads);
    var i: usize = 0;
    while (i < threads.len) : (i += 1) {
        threads[i] = try std.Thread.spawn(.{}, workerLoop, .{&workers[i + 1]});
    }
    std.log.info("started {d} HTTP worker(s)", .{n});
    workerLoop(&workers[0]);
}

fn workerLoop(w: *Worker) void {
    while (true) {
        const conn = w.server.accept() catch |err| {
            std.log.err("worker {d} accept failed: {}", .{ w.id, err });
            std.time.sleep(10 * std.time.ns_per_ms);
            continue;
        };
        handleConnection(w, conn) catch |err| {
            std.log.warn("worker {d} connection error: {}", .{ w.id, err });
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

// Reads HTTP/1.1 requests on a single TCP connection until peer closes,
// requests Connection: close, or we hit an error. Kamailio's http_client
// keeps connections (modparam keep_connections=1), so this saves the
// TCP handshake on every authorize.
fn handleConnection(w: *Worker, conn: std.net.Server.Connection) !void {
    var arena_state = std.heap.ArenaAllocator.init(w.allocator);
    defer arena_state.deinit();

    var buf: [4096]u8 = undefined;
    var len: usize = 0;

    while (true) {
        // Find end-of-headers in current buffer; read more if needed.
        var header_end: ?usize = null;
        while (header_end == null) {
            if (len > 0) {
                if (std.mem.indexOf(u8, buf[0..len], "\r\n\r\n")) |idx| {
                    header_end = idx;
                    break;
                }
            }
            if (len == buf.len) return error.HeaderTooLarge;
            const n = conn.stream.read(buf[len..]) catch |err| switch (err) {
                error.ConnectionResetByPeer, error.BrokenPipe => return,
                else => return err,
            };
            if (n == 0) return; // peer closed
            len += n;
        }

        const he = header_end.?;
        const request = buf[0..he];

        // Default to keep-alive (HTTP/1.1). Carrier closes when done.
        var close_after = false;
        if (std.mem.indexOf(u8, request, "Connection: close")) |_| close_after = true;
        if (std.mem.indexOf(u8, request, "connection: close")) |_| close_after = true;
        if (std.mem.indexOf(u8, request, "HTTP/1.0")) |_| close_after = true;

        // Parse request line.
        const line_end = std.mem.indexOfScalar(u8, request, '\r') orelse return error.MalformedRequest;
        const line = request[0..line_end];

        var it = std.mem.tokenizeScalar(u8, line, ' ');
        _ = it.next() orelse return error.MalformedRequest;
        const target = it.next() orelse return error.MalformedRequest;

        _ = arena_state.reset(.retain_capacity);
        try handleRequest(w, conn.stream, target, arena_state.allocator(), close_after);

        // Shift buffer: drop processed bytes (headers + \r\n\r\n). GET has no body.
        const consumed = he + 4;
        const remaining = len - consumed;
        if (remaining > 0) std.mem.copyForwards(u8, buf[0..remaining], buf[consumed..len]);
        len = remaining;

        if (close_after) return;
    }
}

fn handleRequest(
    w: *Worker,
    stream: std.net.Stream,
    target: []const u8,
    allocator: std.mem.Allocator,
    close_after: bool,
) !void {
    if (std.mem.startsWith(u8, target, "/healthz")) {
        try writeResp(stream, 200, "ok\n", "text/plain", close_after);
        return;
    }
    if (std.mem.startsWith(u8, target, "/authorize")) {
        const ip_raw = extractQueryParam(target, "ip") orelse {
            try writeResp(stream, 400, "{\"error\":\"missing ip\"}\n", "application/json", close_after);
            return;
        };
        const a_raw = extractQueryParam(target, "a") orelse {
            try writeResp(stream, 400, "{\"error\":\"missing a\"}\n", "application/json", close_after);
            return;
        };
        const b_raw = extractQueryParam(target, "b") orelse {
            try writeResp(stream, 400, "{\"error\":\"missing b\"}\n", "application/json", close_after);
            return;
        };

        const ip = try urlDecode(allocator, ip_raw);
        const a = try urlDecode(allocator, a_raw);
        const b = try urlDecode(allocator, b_raw);

        const result = w.cache.lookup(ip, a, b);

        var body_buf: [1024]u8 = undefined;
        var body: []const u8 = undefined;
        var outcome_tag: []const u8 = @tagName(result);

        switch (result) {
            .active => |m| {
                const range_id = m.rangeId();
                const trunk_id = m.trunkId();
                const quotas_opt = w.cache.getRangeQuotas(range_id);
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

                        const rr = w.rcmd.quotaReserve(
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
                            .ok, .redis_error => {},
                            .blocked_total => {
                                outcome_tag = "quota_total";
                                body = "{\"allowed\":0,\"status\":503,\"cause\":34}\n";
                                try writeResp(stream, 200, body, "application/json", close_after);
                                std.log.info("authorize ip={s} a={s} b={s} result=quota_total range_id={s}", .{ ip, a, b, range_id });
                                return;
                            },
                            .blocked_a => {
                                outcome_tag = "quota_a";
                                body = "{\"allowed\":0,\"status\":503,\"cause\":34}\n";
                                try writeResp(stream, 200, body, "application/json", close_after);
                                std.log.info("authorize ip={s} a={s} b={s} result=quota_a range_id={s}", .{ ip, a, b, range_id });
                                return;
                            },
                            .blocked_b => {
                                outcome_tag = "quota_b";
                                body = "{\"allowed\":0,\"status\":503,\"cause\":34}\n";
                                try writeResp(stream, 200, body, "application/json", close_after);
                                std.log.info("authorize ip={s} a={s} b={s} result=quota_b range_id={s}", .{ ip, a, b, range_id });
                                return;
                            },
                            .blocked_ab => {
                                outcome_tag = "quota_ab";
                                body = "{\"allowed\":0,\"status\":503,\"cause\":34}\n";
                                try writeResp(stream, 200, body, "application/json", close_after);
                                std.log.info("authorize ip={s} a={s} b={s} result=quota_ab range_id={s}", .{ ip, a, b, range_id });
                                return;
                            },
                        }
                    }
                }
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
        try writeResp(stream, 200, body, "application/json", close_after);

        const stripped: []const u8 = switch (result) {
            .active => |m| m.stripped_b,
            else => "",
        };
        std.log.info("authorize ip={s} a={s} b={s} result={s} stripped_b={s}", .{ ip, a, b, outcome_tag, stripped });
        return;
    }
    try writeResp(stream, 404, "{\"error\":\"not found\"}\n", "application/json", close_after);
}

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
    return out[0..oi];
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

fn writeResp(stream: std.net.Stream, status: u16, body: []const u8, ctype: []const u8, close_after: bool) !void {
    var buf: [256]u8 = undefined;
    const reason: []const u8 = switch (status) {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        else => "Error",
    };
    const conn_hdr: []const u8 = if (close_after) "close" else "keep-alive";
    const head = try std.fmt.bufPrint(
        &buf,
        "HTTP/1.1 {d} {s}\r\nContent-Type: {s}\r\nContent-Length: {d}\r\nConnection: {s}\r\n\r\n",
        .{ status, reason, ctype, body.len, conn_hdr },
    );
    try stream.writeAll(head);
    try stream.writeAll(body);
}
