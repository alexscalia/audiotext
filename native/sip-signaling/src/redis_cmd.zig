const std = @import("std");

const c = @cImport({
    @cInclude("hiredis/hiredis.h");
});

// Lua source for atomic check-and-reserve. Loaded via SCRIPT LOAD at startup,
// called via EVALSHA on every quota-bearing INVITE.
//
// KEYS[1..4] = total, a, b, ab counters (UTC-date scoped, 48h TTL)
// ARGV       = cap_total_sec, cap_a_sec, cap_b_sec, cap_ab_sec,
//              reserve_sec, ttl_sec
// Caps: -1 = unlimited (NULL in DB). Returns:
//   "OK"            — reserved on all four (skipping unlimited)
//   "BLOCKED:total" — total cap would be exceeded
//   "BLOCKED:a"     — per-A cap would be exceeded
//   "BLOCKED:b"     — per-B cap would be exceeded
//   "BLOCKED:ab"    — per-A→B cap would be exceeded
// Reservation is all-or-nothing: if any dim would block, no INCRBY runs.
pub const LUA_QUOTA_RESERVE: []const u8 =
    \\local function check(idx, dim)
    \\  local cap = tonumber(ARGV[idx])
    \\  if cap < 0 then return nil end
    \\  local cur = tonumber(redis.call('GET', KEYS[idx]) or '0')
    \\  if cur + tonumber(ARGV[5]) > cap then return 'BLOCKED:' .. dim end
    \\  return nil
    \\end
    \\local r = check(1, 'total'); if r then return r end
    \\r = check(2, 'a');           if r then return r end
    \\r = check(3, 'b');           if r then return r end
    \\r = check(4, 'ab');          if r then return r end
    \\for i = 1, 4 do
    \\  if tonumber(ARGV[i]) >= 0 then
    \\    redis.call('INCRBY', KEYS[i], ARGV[5])
    \\    redis.call('EXPIRE', KEYS[i], ARGV[6])
    \\  end
    \\end
    \\return 'OK'
;

pub const TTL_SEC: u64 = 172800; // 48h — daily key rollover with slack
pub const RESERVE_SEC: u64 = 60;

pub const ReserveResult = enum {
    ok,
    blocked_total,
    blocked_a,
    blocked_b,
    blocked_ab,
    redis_error, // fail-open: caller should allow
};

pub const RedisCmd = struct {
    allocator: std.mem.Allocator,
    host: []const u8,
    port: c_int,
    conn: ?*c.redisContext = null,
    script_sha: [40]u8 = undefined,
    script_sha_len: u8 = 0,
    mutex: std.Thread.Mutex = .{},

    pub fn init(allocator: std.mem.Allocator, redis_url: []const u8) !RedisCmd {
        const hp = try parseRedisUrl(redis_url);
        return .{
            .allocator = allocator,
            .host = try allocator.dupe(u8, hp.host),
            .port = hp.port,
        };
    }

    pub fn deinit(self: *RedisCmd) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.conn) |ctx| c.redisFree(ctx);
        self.conn = null;
        self.allocator.free(self.host);
    }

    fn ensureConn(self: *RedisCmd) !void {
        if (self.conn != null) return;
        const host_z = try self.allocator.dupeZ(u8, self.host);
        defer self.allocator.free(host_z);
        const ctx = c.redisConnect(host_z.ptr, self.port) orelse return error.RedisConnectFailed;
        if (ctx.*.err != 0) {
            const msg = std.mem.sliceTo(@as([*:0]const u8, @ptrCast(&ctx.*.errstr)), 0);
            std.log.warn("redis cmd connect: {s}", .{msg});
            c.redisFree(ctx);
            return error.RedisConnectFailed;
        }
        self.conn = ctx;
    }

    fn dropConn(self: *RedisCmd) void {
        if (self.conn) |ctx| c.redisFree(ctx);
        self.conn = null;
    }

    pub fn loadScript(self: *RedisCmd) !void {
        self.mutex.lock();
        defer self.mutex.unlock();
        try self.loadScriptLocked();
    }

    // Internal: caller must hold self.mutex.
    fn loadScriptLocked(self: *RedisCmd) !void {
        try self.ensureConn();
        const ctx = self.conn.?;
        const reply_opt = c.redisCommand(ctx, "SCRIPT LOAD %b", LUA_QUOTA_RESERVE.ptr, LUA_QUOTA_RESERVE.len);
        const reply = @as(?*c.redisReply, @ptrCast(@alignCast(reply_opt))) orelse {
            self.dropConn();
            return error.RedisScriptLoadFailed;
        };
        defer c.freeReplyObject(reply);
        if (reply.*.type != c.REDIS_REPLY_STRING) {
            std.log.err("SCRIPT LOAD unexpected reply type {}", .{reply.*.type});
            return error.RedisScriptLoadFailed;
        }
        const sha = std.mem.sliceTo(reply.*.str, 0);
        if (sha.len != 40) return error.RedisScriptLoadFailed;
        @memcpy(self.script_sha[0..40], sha[0..40]);
        self.script_sha_len = 40;
        std.log.info("quota_reserve loaded, sha={s}", .{self.script_sha[0..40]});
    }

    // Atomic check-reserve. Returns ReserveResult.
    // Caller passes caps in seconds (-1 = unlimited) and pre-formatted keys.
    pub fn quotaReserve(
        self: *RedisCmd,
        key_total: []const u8,
        key_a: []const u8,
        key_b: []const u8,
        key_ab: []const u8,
        cap_total: i64,
        cap_a: i64,
        cap_b: i64,
        cap_ab: i64,
    ) ReserveResult {
        self.mutex.lock();
        defer self.mutex.unlock();
        self.ensureConn() catch return .redis_error;
        // Script may be missing on first call after startup, or after Redis
        // flushed/restarted. Reload on demand instead of fail-open.
        if (self.script_sha_len != 40) {
            self.loadScriptLocked() catch {
                return .redis_error;
            };
        }
        const ctx = self.conn.?;

        // EVALSHA sha 4 KEY1 KEY2 KEY3 KEY4 ARG1..ARG6
        var buf_total: [24]u8 = undefined;
        var buf_a: [24]u8 = undefined;
        var buf_b: [24]u8 = undefined;
        var buf_ab: [24]u8 = undefined;
        var buf_res: [24]u8 = undefined;
        var buf_ttl: [24]u8 = undefined;
        const s_total = std.fmt.bufPrint(&buf_total, "{d}", .{cap_total}) catch return .redis_error;
        const s_a = std.fmt.bufPrint(&buf_a, "{d}", .{cap_a}) catch return .redis_error;
        const s_b = std.fmt.bufPrint(&buf_b, "{d}", .{cap_b}) catch return .redis_error;
        const s_ab = std.fmt.bufPrint(&buf_ab, "{d}", .{cap_ab}) catch return .redis_error;
        const s_res = std.fmt.bufPrint(&buf_res, "{d}", .{RESERVE_SEC}) catch return .redis_error;
        const s_ttl = std.fmt.bufPrint(&buf_ttl, "{d}", .{TTL_SEC}) catch return .redis_error;

        const reply_opt = c.redisCommand(
            ctx,
            "EVALSHA %b 4 %b %b %b %b %b %b %b %b %b %b",
            &self.script_sha,
            @as(usize, 40),
            key_total.ptr,
            key_total.len,
            key_a.ptr,
            key_a.len,
            key_b.ptr,
            key_b.len,
            key_ab.ptr,
            key_ab.len,
            s_total.ptr,
            s_total.len,
            s_a.ptr,
            s_a.len,
            s_b.ptr,
            s_b.len,
            s_ab.ptr,
            s_ab.len,
            s_res.ptr,
            s_res.len,
            s_ttl.ptr,
            s_ttl.len,
        );
        const reply = @as(?*c.redisReply, @ptrCast(@alignCast(reply_opt))) orelse {
            std.log.warn("redis EVALSHA: null reply", .{});
            self.dropConn();
            return .redis_error;
        };
        defer c.freeReplyObject(reply);

        if (reply.*.type == c.REDIS_REPLY_ERROR) {
            const err_msg = std.mem.sliceTo(reply.*.str, 0);
            // NOSCRIPT → reload + signal caller to retry next time; treat this
            // INVITE as redis_error (fail-open). Subsequent calls succeed.
            if (std.mem.startsWith(u8, err_msg, "NOSCRIPT")) {
                std.log.warn("EVALSHA NOSCRIPT, reloading + retrying next call", .{});
                self.script_sha_len = 0;
                // Reload immediately so the next call doesn't fail-open.
                self.loadScriptLocked() catch {};
                return .redis_error;
            }
            std.log.warn("EVALSHA error: {s}", .{err_msg});
            return .redis_error;
        }
        if (reply.*.type != c.REDIS_REPLY_STATUS and reply.*.type != c.REDIS_REPLY_STRING) {
            std.log.warn("EVALSHA unexpected reply type {}", .{reply.*.type});
            return .redis_error;
        }
        const s = std.mem.sliceTo(reply.*.str, 0);
        if (std.mem.eql(u8, s, "OK")) return .ok;
        if (std.mem.eql(u8, s, "BLOCKED:total")) return .blocked_total;
        if (std.mem.eql(u8, s, "BLOCKED:a")) return .blocked_a;
        if (std.mem.eql(u8, s, "BLOCKED:b")) return .blocked_b;
        if (std.mem.eql(u8, s, "BLOCKED:ab")) return .blocked_ab;
        std.log.warn("EVALSHA unknown reply: {s}", .{s});
        return .redis_error;
    }
};

const HostPort = struct { host: []const u8, port: c_int };

fn parseRedisUrl(url: []const u8) !HostPort {
    const prefix = "redis://";
    if (!std.mem.startsWith(u8, url, prefix)) return error.InvalidRedisUrl;
    const rest = url[prefix.len..];
    const colon = std.mem.indexOfScalar(u8, rest, ':') orelse {
        return .{ .host = rest, .port = 6379 };
    };
    const port = try std.fmt.parseInt(c_int, rest[colon + 1 ..], 10);
    return .{ .host = rest[0..colon], .port = port };
}
