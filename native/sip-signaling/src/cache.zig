const std = @import("std");

pub const Entry = struct {
    active: bool,
};

pub const LookupResult = enum { unknown, inactive, active };

pub const AuthCache = struct {
    allocator: std.mem.Allocator,
    map: std.StringHashMap(Entry),
    mutex: std.Thread.Mutex = .{},

    pub fn init(allocator: std.mem.Allocator) AuthCache {
        return .{
            .allocator = allocator,
            .map = std.StringHashMap(Entry).init(allocator),
        };
    }

    pub fn deinit(self: *AuthCache) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        self.freeMap();
    }

    fn freeMap(self: *AuthCache) void {
        var it = self.map.keyIterator();
        while (it.next()) |k| self.allocator.free(k.*);
        self.map.deinit();
    }

    pub fn swap(self: *AuthCache, new_map: *std.StringHashMap(Entry)) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        self.freeMap();
        self.map = new_map.*;
        new_map.* = std.StringHashMap(Entry).init(self.allocator);
    }

    pub fn lookup(self: *AuthCache, ip: []const u8) LookupResult {
        self.mutex.lock();
        defer self.mutex.unlock();
        const entry = self.map.get(ip) orelse return .unknown;
        return if (entry.active) .active else .inactive;
    }

    pub fn count(self: *AuthCache) usize {
        self.mutex.lock();
        defer self.mutex.unlock();
        return self.map.count();
    }
};
