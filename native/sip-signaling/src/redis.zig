const std = @import("std");
const cache = @import("cache.zig");
const db = @import("db.zig");

const c = @cImport({
    @cInclude("hiredis/hiredis.h");
});

pub const ReloadCtx = struct {
    allocator: std.mem.Allocator,
    database_url: [:0]const u8,
    redis_url: []const u8,
    cache: *cache.AuthCache,
};

pub fn subscribeLoop(ctx: ReloadCtx) void {
    while (true) {
        runOnce(ctx) catch |err| {
            std.log.warn("redis subscriber error: {}, retrying in 3s", .{err});
        };
        std.time.sleep(3 * std.time.ns_per_s);
    }
}

fn runOnce(ctx: ReloadCtx) !void {
    const host_port = try parseRedisUrl(ctx.redis_url);
    const host_z = try ctx.allocator.dupeZ(u8, host_port.host);
    defer ctx.allocator.free(host_z);

    const conn = c.redisConnect(host_z.ptr, host_port.port) orelse return error.RedisConnectFailed;
    defer c.redisFree(conn);

    if (conn.*.err != 0) {
        const msg = std.mem.sliceTo(@as([*:0]const u8, @ptrCast(&conn.*.errstr)), 0);
        std.log.err("redis connect: {s}", .{msg});
        return error.RedisConnectFailed;
    }

    const sub_reply = c.redisCommand(conn, "SUBSCRIBE lcr:reload");
    if (sub_reply == null) return error.RedisSubscribeFailed;
    c.freeReplyObject(sub_reply);

    std.log.info("subscribed to lcr:reload", .{});

    while (true) {
        var reply_ptr: ?*anyopaque = null;
        if (c.redisGetReply(conn, &reply_ptr) != c.REDIS_OK) {
            return error.RedisGetReplyFailed;
        }
        defer c.freeReplyObject(reply_ptr);

        std.log.info("reload triggered", .{});
        db.loadIntoCache(ctx.allocator, ctx.database_url, ctx.cache) catch |err| {
            std.log.err("reload failed: {}", .{err});
        };
    }
}

const HostPort = struct {
    host: []const u8,
    port: c_int,
};

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
