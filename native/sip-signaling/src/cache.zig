const std = @import("std");

pub const Credential = struct {
    prefix: []const u8,
    active: bool,
};

pub const Match = struct {
    stripped_b: []const u8,
};

pub const LookupResult = union(enum) {
    active: Match,
    inactive,
    unknown,
};

pub const Map = std.StringHashMap(std.ArrayList(Credential));
pub const NumberSet = std.StringHashMap(void);

pub fn deinitMap(m: *Map, allocator: std.mem.Allocator) void {
    var it = m.iterator();
    while (it.next()) |e| {
        for (e.value_ptr.items) |c| allocator.free(c.prefix);
        e.value_ptr.deinit();
        allocator.free(e.key_ptr.*);
    }
    m.deinit();
}

pub fn deinitNumberSet(s: *NumberSet, allocator: std.mem.Allocator) void {
    var it = s.keyIterator();
    while (it.next()) |k| allocator.free(k.*);
    s.deinit();
}

pub const AuthCache = struct {
    allocator: std.mem.Allocator,
    map: Map,
    numbers: NumberSet,
    mutex: std.Thread.Mutex = .{},

    pub fn init(allocator: std.mem.Allocator) AuthCache {
        return .{
            .allocator = allocator,
            .map = Map.init(allocator),
            .numbers = NumberSet.init(allocator),
        };
    }

    pub fn deinit(self: *AuthCache) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        deinitMap(&self.map, self.allocator);
        deinitNumberSet(&self.numbers, self.allocator);
    }

    pub fn swap(self: *AuthCache, new_map: *Map, new_numbers: *NumberSet) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        deinitMap(&self.map, self.allocator);
        deinitNumberSet(&self.numbers, self.allocator);
        self.map = new_map.*;
        self.numbers = new_numbers.*;
        new_map.* = Map.init(self.allocator);
        new_numbers.* = NumberSet.init(self.allocator);
    }

    pub fn lookup(self: *AuthCache, ip: []const u8, b: []const u8) LookupResult {
        self.mutex.lock();
        defer self.mutex.unlock();

        const list_ptr = self.map.getPtr(ip) orelse return .unknown;
        const items = list_ptr.items;

        var best_idx: ?usize = null;
        var best_len: usize = 0;
        var saw_inactive_match = false;

        for (items, 0..) |c, i| {
            if (c.prefix.len == 0) {
                // Catch-all: matches any B-number. Used only as fallback when
                // no specific prefix wins.
                if (c.active) {
                    if (best_idx == null) {
                        best_idx = i;
                        best_len = 0;
                    }
                } else {
                    saw_inactive_match = true;
                }
                continue;
            }
            if (std.mem.startsWith(u8, b, c.prefix)) {
                if (c.active) {
                    if (c.prefix.len > best_len) {
                        best_idx = i;
                        best_len = c.prefix.len;
                    }
                } else if (c.prefix.len >= best_len) {
                    saw_inactive_match = true;
                }
            }
        }

        if (best_idx) |i| {
            const c = items[i];
            const stripped = b[c.prefix.len..];
            // Stripped B-number must be a DID we own (at_voice_numbers).
            // If absent → SIP 503 cause 34 (temporary; carrier may retry).
            if (!self.numbers.contains(stripped)) return .inactive;
            return .{ .active = .{ .stripped_b = stripped } };
        }
        if (saw_inactive_match) return .inactive;
        return .unknown;
    }

    pub fn rowCount(self: *AuthCache) usize {
        self.mutex.lock();
        defer self.mutex.unlock();
        var n: usize = 0;
        var it = self.map.valueIterator();
        while (it.next()) |v| n += v.items.len;
        return n;
    }
};
