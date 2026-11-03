import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import * as tables from "@/db/schema";
import type { Workspace } from "./types";
export async function actor() {
  const u = await getChatGPTUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u.email;
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new Error("FORBIDDEN");
}
export async function workspace(): Promise<Workspace> {
  const db = getDb();
  const names = [
    "materials",
    "mpns",
    "sites",
    "mpnSites",
    "products",
    "assemblies",
    "productAssemblies",
    "boms",
    "bomLines",
    "auditLogs",
  ] as const;
  const entries = await Promise.all(
    names.map(async (k) => [k, await db.select().from(tables[k])]),
  );
  return Object.fromEntries(entries) as Workspace;
}
export function database() {
  if (!env.DB) throw new Error("DATABASE_UNAVAILABLE");
  return env.DB;
}
export function errorResponse(e: unknown) {
  const m = e instanceof Error ? e.message : "未知错误";
  const unauthorized = m === "UNAUTHORIZED";
  return Response.json(
    {
      error: unauthorized
        ? "请先登录"
        : m === "FORBIDDEN"
          ? "请求来源不允许"
          : m.includes("UNIQUE")
            ? "该编号或关联已存在，请检查后重试"
            : m.includes("FOREIGN KEY")
              ? "关联对象不存在，请刷新后重试"
              : m.includes("DATABASE")
                ? "数据库连接暂不可用，请稍后重试"
                : m,
    },
    { status: unauthorized ? 401 : m === "FORBIDDEN" ? 403 : 400 },
  );
}
