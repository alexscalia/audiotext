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

    var rcmd = try redis_cmd.RedisCmd.init(allocator, env.redis_url);
    defer rcmd.deinit();
    rcmd.loadScript() catch |err| {
        // Non-fatal — quota check fails open until the script is reloaded
        // on first successful EVALSHA reconnection.
        std.log.warn("initial SCRIPT LOAD failed: {} (fail-open until next reload)", .{err});
    };

    const reload_ctx = redis.ReloadCtx{
        .allocator = allocator,
        .database_url = env.database_url,
        .redis_url = env.redis_url,
        .cache = &auth_cache,
    };
    const redis_thread = try std.Thread.spawn(.{}, redis.subscribeLoop, .{reload_ctx});
    redis_thread.detach();

    std.log.info("listening on {s}", .{env.listen_addr});
    try http.serve(allocator, env.listen_addr, &auth_cache, &rcmd);
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
