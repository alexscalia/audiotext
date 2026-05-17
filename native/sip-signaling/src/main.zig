const std = @import("std");
const cache = @import("cache.zig");
const db = @import("db.zig");
const http = @import("http.zig");
const redis = @import("redis.zig");
const redis_cmd = @import("redis_cmd.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const env = try loadEnv(allocator);
    defer freeEnv(allocator, env);

    var auth_cache = cache.AuthCache.init(allocator);
    defer auth_cache.deinit();

    std.log.info("loading authorized IPs from postgres", .{});
    try db.loadIntoCache(allocator, env.database_url, &auth_cache);

    // One Redis connection per HTTP worker — eliminates the EVALSHA
    // serialization choke. Pool size defaults to cpu count, override
    // via SIGNALING_WORKERS env.
    const n_workers = try resolveWorkerCount(allocator);
    const rcmds = try allocator.alloc(redis_cmd.RedisCmd, n_workers);
    defer allocator.free(rcmds);
    for (rcmds) |*r| {
        r.* = try redis_cmd.RedisCmd.init(allocator, env.redis_url);
        r.loadScript() catch |err| {
            std.log.warn("initial SCRIPT LOAD failed (will retry on demand): {}", .{err});
        };
    }
    defer for (rcmds) |*r| r.deinit();

    const reload_ctx = redis.ReloadCtx{
        .allocator = allocator,
        .database_url = env.database_url,
        .redis_url = env.redis_url,
        .cache = &auth_cache,
    };
    const redis_thread = try std.Thread.spawn(.{}, redis.subscribeLoop, .{reload_ctx});
    redis_thread.detach();

    std.log.info("listening on {s} with {d} HTTP workers", .{ env.listen_addr, n_workers });
    try http.serve(allocator, env.listen_addr, &auth_cache, rcmds);
}

fn resolveWorkerCount(allocator: std.mem.Allocator) !usize {
    if (std.process.getEnvVarOwned(allocator, "SIGNALING_WORKERS")) |raw| {
        defer allocator.free(raw);
        const n = std.fmt.parseInt(usize, raw, 10) catch 0;
        if (n > 0) return n;
    } else |_| {}
    const cpu = std.Thread.getCpuCount() catch 2;
    return @max(cpu, 2);
}

const Env = struct {
    database_url: [:0]u8,
    redis_url: []u8,
    listen_addr: []u8,
};

fn loadEnv(allocator: std.mem.Allocator) !Env {
    const database_url_raw = try std.process.getEnvVarOwned(allocator, "DATABASE_URL");
    defer allocator.free(database_url_raw);
    const database_url = try allocator.dupeZ(u8, database_url_raw);

    const redis_url = try std.process.getEnvVarOwned(allocator, "REDIS_URL");
    const listen_addr = std.process.getEnvVarOwned(allocator, "LISTEN_ADDR") catch
        try allocator.dupe(u8, "0.0.0.0:8080");

    return .{
        .database_url = database_url,
        .redis_url = redis_url,
        .listen_addr = listen_addr,
    };
}

fn freeEnv(allocator: std.mem.Allocator, env: Env) void {
    allocator.free(env.database_url);
    allocator.free(env.redis_url);
    allocator.free(env.listen_addr);
}
