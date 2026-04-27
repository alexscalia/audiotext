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
