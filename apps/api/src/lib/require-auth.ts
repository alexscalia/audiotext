import { createMiddleware } from "hono/factory";
import { auth } from "./auth";

export type AuthVariables = {
  user: {
    id: string;
    email: string;
  };
};

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return c.json({ error: "unauthorized" }, 401);
    }
    c.set("user", { id: session.user.id, email: session.user.email });
    await next();
  },
);
