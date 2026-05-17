const std = @import("std");

pub const Credential = struct {
    prefix: []const u8,
    active: bool,
    trunk_id: []const u8,
};

pub const Match = struct {
    stripped_b: []const u8,
};

pub const LookupResult = union(enum) {
    active: Match,
    inactive,
    unknown,
    blocked,
};

pub const Map = std.StringHashMap(std.ArrayList(Credential));
pub const NumberSet = std.StringHashMap(void);

pub const BlockSet = struct {
    a_prefixes: std.ArrayList([]const u8),
    b_prefixes: std.ArrayList([]const u8),

    pub fn init(allocator: std.mem.Allocator) BlockSet {
        return .{
            .a_prefixes = std.ArrayList([]const u8).init(allocator),
            .b_prefixes = std.ArrayList([]const u8).init(allocator),
        };
    }

    pub fn deinit(self: *BlockSet, allocator: std.mem.Allocator) void {
        for (self.a_prefixes.items) |p| allocator.free(p);
        for (self.b_prefixes.items) |p| allocator.free(p);
        self.a_prefixes.deinit();
        self.b_prefixes.deinit();
    }
};

pub const BlockMap = std.StringHashMap(BlockSet);

pub fn deinitMap(m: *Map, allocator: std.mem.Allocator) void {
    var it = m.iterator();
    while (it.next()) |e| {
        for (e.value_ptr.items) |c| {
            allocator.free(c.prefix);
            allocator.free(c.trunk_id);
        }
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

pub fn deinitBlockMap(m: *BlockMap, allocator: std.mem.Allocator) void {
    var it = m.iterator();
    while (it.next()) |e| {
        e.value_ptr.deinit(allocator);
        allocator.free(e.key_ptr.*);
    }
    m.deinit();
}

fn anyPrefixMatch(prefixes: []const []const u8, s: []const u8) bool {
    for (prefixes) |p| {
        if (p.len == 0) continue;
        if (std.mem.startsWith(u8, s, p)) return true;
    }
    return false;
}

pub const AuthCache = struct {
    allocator: std.mem.Allocator,
    map: Map,
    numbers: NumberSet,
    trunk_blocks: BlockMap,
    global_trunk_blocks: BlockSet,
    range_blocks: BlockSet,
    mutex: std.Thread.Mutex = .{},

    pub fn init(allocator: std.mem.Allocator) AuthCache {
        return .{
            .allocator = allocator,
            .map = Map.init(allocator),
            .numbers = NumberSet.init(allocator),
            .trunk_blocks = BlockMap.init(allocator),
            .global_trunk_blocks = BlockSet.init(allocator),
            .range_blocks = BlockSet.init(allocator),
        };
    }

    pub fn deinit(self: *AuthCache) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        deinitMap(&self.map, self.allocator);
        deinitNumberSet(&self.numbers, self.allocator);
        deinitBlockMap(&self.trunk_blocks, self.allocator);
        self.global_trunk_blocks.deinit(self.allocator);
        self.range_blocks.deinit(self.allocator);
    }

    pub fn swap(
        self: *AuthCache,
        new_map: *Map,
        new_numbers: *NumberSet,
        new_trunk_blocks: *BlockMap,
        new_global_trunk_blocks: *BlockSet,
        new_range_blocks: *BlockSet,
    ) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        deinitMap(&self.map, self.allocator);
        deinitNumberSet(&self.numbers, self.allocator);
        deinitBlockMap(&self.trunk_blocks, self.allocator);
        self.global_trunk_blocks.deinit(self.allocator);
        self.range_blocks.deinit(self.allocator);

        self.map = new_map.*;
        self.numbers = new_numbers.*;
        self.trunk_blocks = new_trunk_blocks.*;
        self.global_trunk_blocks = new_global_trunk_blocks.*;
        self.range_blocks = new_range_blocks.*;

        new_map.* = Map.init(self.allocator);
        new_numbers.* = NumberSet.init(self.allocator);
        new_trunk_blocks.* = BlockMap.init(self.allocator);
        new_global_trunk_blocks.* = BlockSet.init(self.allocator);
        new_range_blocks.* = BlockSet.init(self.allocator);
    }

    pub fn lookup(self: *AuthCache, ip: []const u8, a: []const u8, b: []const u8) LookupResult {
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

            // Block-list scan — first hit wins, returns .blocked (SIP 503 cause 34).
            // Order: global trunk blocks → per-trunk blocks for this credential's
            // trunk → range blocks (flat: per-range + global merged).
            if (anyPrefixMatch(self.global_trunk_blocks.a_prefixes.items, a)) return .blocked;
            if (anyPrefixMatch(self.global_trunk_blocks.b_prefixes.items, stripped)) return .blocked;
            if (self.trunk_blocks.getPtr(c.trunk_id)) |bs| {
                if (anyPrefixMatch(bs.a_prefixes.items, a)) return .blocked;
                if (anyPrefixMatch(bs.b_prefixes.items, stripped)) return .blocked;
            }
            if (anyPrefixMatch(self.range_blocks.a_prefixes.items, a)) return .blocked;
            if (anyPrefixMatch(self.range_blocks.b_prefixes.items, stripped)) return .blocked;

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
