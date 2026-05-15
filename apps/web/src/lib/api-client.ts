import { hc } from "hono/client";
import type { AppType } from "../../../api/src/index";

export const api = hc<AppType>("/");
export type ApiClient = typeof api;
