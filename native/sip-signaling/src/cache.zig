const std = @import("std");

pub const Credential = struct {
    prefix: []const u8,
    active: bool,
    trunk_id: []const u8,
};

// UUID textual form = 36 chars (8-4-4-4-12). Inline buffers keep Match
// self-contained so the result survives a cache reload that frees the
// underlying NumberMap / Credential entries.
pub const UUID_TEXT_LEN: usize = 36;

pub const Match = struct {
    stripped_b: []const u8,
    range_id_buf: [UUID_TEXT_LEN]u8,
    range_id_len: u8,
    trunk_id_buf: [UUID_TEXT_LEN]u8,
    trunk_id_len: u8,

    pub fn rangeId(self: *const Match) []const u8 {
        return self.range_id_buf[0..self.range_id_len];
    }
    pub fn trunkId(self: *const Match) []const u8 {
        return self.trunk_id_buf[0..self.trunk_id_len];
    }
};

pub const LookupResult = union(enum) {
    active: Match,
    inactive,
    unknown,
    blocked,
};

// Daily-minute quotas for one range. Values in seconds.
// -1 sentinel = NULL in DB (unlimited).
pub const RangeQuotas = struct {
    max_total_sec: i64,
    max_a_sec: i64,
    max_b_sec: i64,
    max_ab_sec: i64,

    pub fn anyEnforced(self: RangeQuotas) bool {
        return self.max_total_sec >= 0 or
            self.max_a_sec >= 0 or
            self.max_b_sec >= 0 or
            self.max_ab_sec >= 0;
    }
};

pub const Map = std.StringHashMap(std.ArrayList(Credential));
// number → range_id (range_id is owned-copy string)
pub const NumberMap = std.StringHashMap([]const u8);
pub const RangeMap = std.StringHashMap(RangeQuotas);

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

pub fn deinitNumberMap(m: *NumberMap, allocator: std.mem.Allocator) void {
    var it = m.iterator();
    while (it.next()) |e| {
        allocator.free(e.key_ptr.*);
        allocator.free(e.value_ptr.*);
    }
    m.deinit();
}

pub fn deinitRangeMap(m: *RangeMap, allocator: std.mem.Allocator) void {
    var it = m.keyIterator();
    while (it.next()) |k| allocator.free(k.*);
    m.deinit();
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
    numbers: NumberMap,
    ranges: RangeMap,
    trunk_blocks: BlockMap,
    global_trunk_blocks: BlockSet,
    range_blocks: BlockSet,
    mutex: std.Thread.Mutex = .{},

    pub fn init(allocator: std.mem.Allocator) AuthCache {
        return .{
            .allocator = allocator,
            .map = Map.init(allocator),
            .numbers = NumberMap.init(allocator),
            .ranges = RangeMap.init(allocator),
            .trunk_blocks = BlockMap.init(allocator),
            .global_trunk_blocks = BlockSet.init(allocator),
            .range_blocks = BlockSet.init(allocator),
        };
    }

    pub fn deinit(self: *AuthCache) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        deinitMap(&self.map, self.allocator);
        deinitNumberMap(&self.numbers, self.allocator);
        deinitRangeMap(&self.ranges, self.allocator);
        deinitBlockMap(&self.trunk_blocks, self.allocator);
        self.global_trunk_blocks.deinit(self.allocator);
        self.range_blocks.deinit(self.allocator);
    }

    pub fn swap(
        self: *AuthCache,
        new_map: *Map,
        new_numbers: *NumberMap,
        new_ranges: *RangeMap,
        new_trunk_blocks: *BlockMap,
        new_global_trunk_blocks: *BlockSet,
        new_range_blocks: *BlockSet,
    ) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        deinitMap(&self.map, self.allocator);
        deinitNumberMap(&self.numbers, self.allocator);
        deinitRangeMap(&self.ranges, self.allocator);
        deinitBlockMap(&self.trunk_blocks, self.allocator);
        self.global_trunk_blocks.deinit(self.allocator);
        self.range_blocks.deinit(self.allocator);

        self.map = new_map.*;
        self.numbers = new_numbers.*;
        self.ranges = new_ranges.*;
        self.trunk_blocks = new_trunk_blocks.*;
        self.global_trunk_blocks = new_global_trunk_blocks.*;
        self.range_blocks = new_range_blocks.*;

        new_map.* = Map.init(self.allocator);
        new_numbers.* = NumberMap.init(self.allocator);
        new_ranges.* = RangeMap.init(self.allocator);
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
            if (anyPrefixMatch(self.global_trunk_blocks.a_prefixes.items, a)) return .blocked;
            if (anyPrefixMatch(self.global_trunk_blocks.b_prefixes.items, stripped)) return .blocked;
            if (self.trunk_blocks.getPtr(c.trunk_id)) |bs| {
                if (anyPrefixMatch(bs.a_prefixes.items, a)) return .blocked;
                if (anyPrefixMatch(bs.b_prefixes.items, stripped)) return .blocked;
            }
            if (anyPrefixMatch(self.range_blocks.a_prefixes.items, a)) return .blocked;
            if (anyPrefixMatch(self.range_blocks.b_prefixes.items, stripped)) return .blocked;

            // Stripped B-number must be a DID we own.
            const range_id = self.numbers.get(stripped) orelse return .inactive;
            var m: Match = .{
                .stripped_b = stripped,
                .range_id_buf = undefined,
                .range_id_len = 0,
                .trunk_id_buf = undefined,
                .trunk_id_len = 0,
            };
            const rlen = @min(range_id.len, UUID_TEXT_LEN);
            @memcpy(m.range_id_buf[0..rlen], range_id[0..rlen]);
            m.range_id_len = @intCast(rlen);
            const tlen = @min(c.trunk_id.len, UUID_TEXT_LEN);
            @memcpy(m.trunk_id_buf[0..tlen], c.trunk_id[0..tlen]);
            m.trunk_id_len = @intCast(tlen);
            return .{ .active = m };
        }
        if (saw_inactive_match) return .inactive;
        return .unknown;
    }

    pub fn getRangeQuotas(self: *AuthCache, range_id: []const u8) ?RangeQuotas {
        self.mutex.lock();
        defer self.mutex.unlock();
        return self.ranges.get(range_id);
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
