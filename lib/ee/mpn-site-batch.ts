import { z } from "zod";
export const MANUFACTURING_STAGES = [
  "晶圆制造",
  "封装",
  "测试",
  "封装测试",
  "PCB 制造",
  "无源器件制造",
  "器件制造",
] as const;
export const mpnSiteBatchSchema = z.object({
  siteId: z.string().trim().min(1, "请选择制造工厂").max(200),
  mpnIds: z
    .array(z.string().trim().min(1).max(200))
    .min(1, "请至少选择一个 MPN")
    .max(1000, "每次最多关联 1,000 个 MPN"),
  stage: z.enum(MANUFACTURING_STAGES),
  source: z.string().trim().min(1, "请填写信息来源 / 证据").max(1000),
  verifiedAt: z
    .string()
    .default("")
    .refine(
      (v) =>
        !v ||
        (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
          !Number.isNaN(Date.parse(v)) &&
          new Date(v).toISOString().slice(0, 10) === v),
      "核验日期无效",
    ),
});
export function validateMpnSiteBatch(
  input: unknown,
  siteIds: ReadonlySet<string>,
  mpnIds: ReadonlySet<string>,
) {
  const parsed = mpnSiteBatchSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const data = { ...parsed.data, mpnIds: [...new Set(parsed.data.mpnIds)] };
  if (!siteIds.has(data.siteId))
    throw new Error("制造工厂不存在，请刷新后重试");
  if (data.mpnIds.some((id) => !mpnIds.has(id)))
    throw new Error("所选 MPN 中有记录已失效，本次关联未保存，请刷新后重试");
  return data;
}
