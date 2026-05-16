const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        .name = "sip-signaling",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    exe.linkLibC();
    exe.linkSystemLibrary("pq");
    exe.linkSystemLibrary("hiredis");
    // libpq-fe.h lives under /usr/include/postgresql on Debian; expose it for @cImport.
    exe.addIncludePath(.{ .cwd_relative = "/usr/include/postgresql" });

    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    const run_step = b.step("run", "Run sip-signaling");
    run_step.dependOn(&run_cmd.step);
}
