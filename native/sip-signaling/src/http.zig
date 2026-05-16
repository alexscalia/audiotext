const std = @import("std");
const cache = @import("cache.zig");

pub fn serve(
    allocator: std.mem.Allocator,
    listen_addr: []const u8,
    auth_cache: *cache.AuthCache,
) !void {
    const addr = try parseAddr(listen_addr);
    var server = try addr.listen(.{ .reuse_address = true });
    defer server.deinit();

    while (true) {
        const conn = server.accept() catch |err| {
            std.log.err("accept failed: {}", .{err});
            continue;
        };
        handleConnection(allocator, conn, auth_cache) catch |err| {
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
        const a_raw = extractQueryParam(target, "a") orelse "";
        const b_raw = extractQueryParam(target, "b") orelse "";

        const ip = try urlDecode(allocator, ip_raw);
        defer allocator.free(ip);
        const a = try urlDecode(allocator, a_raw);
        defer allocator.free(a);
        const b = try urlDecode(allocator, b_raw);
        defer allocator.free(b);

        // Three-state decision:
        //   .active   → allow, no SIP rejection
        //   .unknown  → peer not in voice_trunk_ips → permanent (likely
        //               spoof/scanner) → SIP 403 Forbidden, Q.850;cause=21
        //   .inactive → peer known but disabled (ip or trunk inactive) →
        //               temporary → SIP 503, Q.850;cause=34 (encourages
        //               upstream LCR retry on alternate carrier).
        const result = auth_cache.lookup(ip);
        const body: []const u8 = switch (result) {
            .active => "{\"allowed\":1}\n",
            .unknown => "{\"allowed\":0,\"status\":403,\"cause\":21}\n",
            .inactive => "{\"allowed\":0,\"status\":503,\"cause\":34}\n",
        };
        try writeResp(conn.stream, 200, body, "application/json");
        std.log.info("authorize ip={s} a={s} b={s} result={s}", .{ ip, a, b, @tagName(result) });
        return;
    }
    try writeResp(conn.stream, 404, "{\"error\":\"not found\"}\n", "application/json");
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
