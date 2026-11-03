import { z } from "zod";
import {
  actor,
  checkOrigin,
  database,
  workspace,
  errorResponse,
} from "@/lib/ee/server";
const rule = z
  .object({
    kind: z.enum(["product", "PCBA", "TLA", "material"]),
    prefix: z
      .string()
      .max(24)
      .regex(/^[\p{L}\p{N}._/-]*$/u),
    suffix: z
      .string()
      .max(12)
      .regex(/^[\p{L}\p{N}._/-]*$/u),
    digits: z.coerce.number().int().min(1).max(12),
    start: z.coerce.number().int().min(0).max(999999999999),
  })
  .refine((r) => r.start < 10 ** r.digits, "起始值超出流水号位数");
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await actor();
    const rules = z
      .array(rule)
      .length(4)
      .parse(await req.json());
    if (new Set(rules.map((r) => r.kind)).size !== 4)
      throw new Error("请为四种零件类型分别配置规则");
    const db = database();
    await db.batch([
      ...rules.map((r) =>
        db
          .prepare(
            "INSERT INTO numbering_rules (kind,prefix,suffix,digits,start) VALUES (?,?,?,?,?) ON CONFLICT(kind) DO UPDATE SET prefix=excluded.prefix,suffix=excluded.suffix,digits=excluded.digits,start=excluded.start",
          )
          .bind(r.kind, r.prefix, r.suffix, r.digits, r.start),
      ),
      db
        .prepare(
          "INSERT INTO audit_logs (id,actor,action,entity,created_at) VALUES (?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          user,
          "更新编码规则",
          "企业内部零件号",
          new Date().toISOString(),
        ),
    ]);
    return Response.json(await workspace());
  } catch (e) {
    return errorResponse(e);
  }
}
