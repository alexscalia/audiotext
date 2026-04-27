import { z } from "zod";

export const HealthSchema = z.object({
  ok: z.boolean(),
  ts: z.string().datetime(),
});
export type Health = z.infer<typeof HealthSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const CreateUserInput = z.object({
  email: z.string().email(),
});
export type CreateUserInput = z.infer<typeof CreateUserInput>;

export const RoleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(64),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type Role = z.infer<typeof RoleSchema>;

export const CreateRoleInput = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(512).optional(),
});
export type CreateRoleInput = z.infer<typeof CreateRoleInput>;

export const PermissionKey = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9_]+(\.[a-z0-9_]+)+$/, "use dot.notation, e.g. transcript.create");

export const PermissionSchema = z.object({
  id: z.string().uuid(),
  key: PermissionKey,
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type Permission = z.infer<typeof PermissionSchema>;

export const CreatePermissionInput = z.object({
  key: PermissionKey,
  description: z.string().max(512).optional(),
});
export type CreatePermissionInput = z.infer<typeof CreatePermissionInput>;

export const AssignRoleInput = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});
export type AssignRoleInput = z.infer<typeof AssignRoleInput>;

export const GrantPermissionInput = z.object({
  roleId: z.string().uuid(),
  permissionId: z.string().uuid(),
});
export type GrantPermissionInput = z.infer<typeof GrantPermissionInput>;

export const UserWithRolesSchema = UserSchema.extend({
  roles: z.array(
    RoleSchema.extend({
      permissions: z.array(PermissionSchema),
    }),
  ),
});
export type UserWithRoles = z.infer<typeof UserWithRolesSchema>;
