import { z } from "zod";
import {
  actor,
  checkOrigin,
  database,
  workspace,
  errorResponse,
} from "@/lib/ee/server";
import { nextPartNumber, rulesFor, matchesRule } from "@/lib/ee/numbering";
import type { NumberingKind } from "@/lib/ee/types";
import { wouldCycle } from "@/lib/ee/relations";
const str = z.string().trim().min(1, "请填写必填项").max(200);
const schemas = {
  material: z.object({
    number: z.string().trim().max(80),
    name: str,
    category: z.enum([
      "微控制器",
      "电源管理",
      "电阻",
      "电容",
      "接口器件",
      "存储器",
      "PCB",
      "模拟器件",
      "晶振",
      "分立器件",
      "连接器",
      "电感",
      "传感器",
      "其他",
    ]),
    package: str,
    unit: z.enum(["pcs", "m", "g", "kg", "L", "set"]).default("pcs"),
    lifecycle: z.enum(["量产", "评估中", "不推荐新设计", "停产"]),
    description: z.string().max(3000),
    parameters: z
      .string()
      .max(10000)
      .refine((v) => {
        try {
          const p = JSON.parse(v);
          return (
            typeof p === "object" &&
            p !== null &&
            !Array.isArray(p) &&
            Object.values(p).every(
              (x) => typeof x === "string" || typeof x === "number",
            )
          );
        } catch {
          return false;
        }
      }, "参数须为 JSON 键值对象"),
  }),
  mpn: z.object({
    materialId: str,
    manufacturer: str,
    mpn: str,
    approval: z.enum(["已批准", "待验证", "已拒绝"]),
    lifecycle: z.enum(["在产", "NRND", "停产"]),
    datasheet: z.union([
      z.literal(""),
      z
        .string()
        .url()
        .refine((v) => /^https?:\/\//.test(v), "仅支持 HTTP(S) 文档链接"),
    ]),
    notes: z.string().max(3000),
  }),
  product: z.object({
    number: z.string().trim().max(80),
    name: str,
    family: str,
    status: z.enum(["量产", "试产", "研发", "停产"]),
  }),
  assembly: z.object({
    number: z.string().trim().max(80),
    name: str,
    type: z.enum(["PCBA", "TLA"]),
    revision: str,
  }),
  productAssembly: z.object({
    productId: str,
    assemblyId: str,
    quantity: z.coerce.number().int().positive().max(1000000),
  }),
  bomLine: z
    .object({
      bomId: str,
      materialId: z.string().nullable(),
      childAssemblyId: z.string().nullable(),
      quantity: z.coerce
        .number()
        .finite()
        .positive()
        .max(1000000)
        .refine(
          (v) => Math.abs(v * 1e6 - Math.round(v * 1e6)) < 0.001,
          "数量最多支持六位小数",
        ),
      scrapRate: z.coerce.number().finite().min(0).max(100).default(0),
      references: z.string().max(3000),
      notes: z.string().max(3000),
    })
    .refine(
      (v) => !!v.materialId !== !!v.childAssemblyId,
      "请选择一个物料或子总成",
    ),
  site: z
    .object({
      name: str,
      operator: str,
      country: str,
      city: str,
      address: z.string().max(1000).default(""),
      latitude: z.number().finite().min(-90).max(90).nullable().default(null),
      longitude: z
        .number()
        .finite()
        .min(-180)
        .max(180)
        .nullable()
        .default(null),
      locationPrecision: z
        .enum(["未定位", "城市级", "厂区级", "手动标点（待核验）"])
        .default("未定位"),
      locationSource: z.string().max(1000).default(""),
    })
    .superRefine((v, c) => {
      if ((v.latitude === null) !== (v.longitude === null))
        c.addIssue({ code: "custom", message: "纬度与经度必须成对填写" });
      if (
        v.latitude !== null &&
        (v.locationPrecision === "未定位" || !v.locationSource.trim())
      )
        c.addIssue({
          code: "custom",
          message: "有坐标时需填写定位精度和坐标来源",
        });
      if (v.latitude === null && v.locationPrecision !== "未定位")
        c.addIssue({ code: "custom", message: "没有坐标时请选择未定位" });
    }),
  mpnSite: z.object({
    mpnId: str,
    siteId: str,
    stage: z.enum([
      "晶圆制造",
      "封装",
      "测试",
      "封装测试",
      "PCB 制造",
      "无源器件制造",
      "器件制造",
    ]),
    source: z.string().trim().min(1, "请填写信息来源").max(1000),
    verifiedAt: z
      .string()
      .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "核验日期格式错误"),
  }),
};
const tableNames = {
  material: "materials",
  mpn: "mpns",
  product: "products",
  assembly: "assemblies",
  productAssembly: "product_assemblies",
  bomLine: "bom_lines",
  site: "manufacturing_sites",
  mpnSite: "mpn_sites",
};
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await actor();
    if (Number(req.headers.get("content-length")) > 50000)
      throw new Error("提交内容过长");
    const body = z
      .object({
        kind: z.string(),
        id: z.string().optional(),
        data: z.unknown(),
      })
      .parse(await req.json());
    const kind = body.kind as keyof typeof schemas;
    if (!schemas[kind]) throw new Error("不支持的记录类型");
    const parsed = schemas[kind].safeParse(body.data);
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    const d: Record<string, unknown> = { ...parsed.data };
    const db = database();
    const id = body.id ? str.parse(body.id) : crypto.randomUUID();
    if (kind === "assembly" && body.id) {
      const w = await workspace();
      const a = w.assemblies.find((a) => a.id === id);
      if (!a) throw new Error("总成不存在");
      if (a.revision !== d.revision)
        throw new Error("当前仅支持维护生效版本，不能直接修改 BOM 版本号");
    }
    if (kind === "bomLine") {
      const w = await workspace();
      const bom = w.boms.find((b) => b.id === d.bomId);
      if (!bom) throw new Error("BOM 不存在");
      if (
        d.childAssemblyId &&
        wouldCycle(w, bom.assemblyId, String(d.childAssemblyId))
      )
        throw new Error("不能建立循环总成关系");
    }
    if (kind === "material") d.updatedAt = new Date().toISOString();
    const numbered =
      kind === "material" || kind === "product" || kind === "assembly";
    const numberingKind: NumberingKind =
      kind === "assembly" ? (d.type as NumberingKind) : (kind as NumberingKind);
    const automatic = numbered && !body.id && !d.number;
    const now = new Date().toISOString();
    for (let attempt = 0; attempt < 5; attempt++) {
      if (numbered) {
        const w = await workspace();
        if (automatic) d.number = nextPartNumber(w, numberingKind);
        if (!d.number) throw new Error("内部零件号不能为空");
        const prior =
          kind === "material"
            ? w.materials.find((x) => x.id === id)
            : kind === "product"
              ? w.products.find((x) => x.id === id)
              : w.assemblies.find((x) => x.id === id);
        if (!prior || prior.number !== d.number) {
          const rule = rulesFor(w).find((r) => r.kind === numberingKind)!;
          if (!matchesRule(String(d.number), rule))
            throw new Error(
              "内部零件号不符合当前规则：" +
                rule.prefix +
                "0".repeat(rule.digits) +
                rule.suffix,
            );
        }
      }
      const cols = Object.keys(d).map((k) =>
        k.replace(/[A-Z]/g, (s) => "_" + s.toLowerCase()),
      );
      const values = Object.values(d);
      const table = tableNames[kind];
      const stmts = [];
      if (body.id)
        stmts.push(
          db
            .prepare(
              `UPDATE ${table} SET ${cols.map((c) => '"' + c + '"=?').join(",")} WHERE id=?`,
            )
            .bind(...values, id),
        );
      else
        stmts.push(
          db
            .prepare(
              `INSERT INTO ${table} (id,${cols.map((c) => '"' + c + '"').join(",")}) VALUES (?,${cols.map(() => "?").join(",")})`,
            )
            .bind(id, ...values),
        );
      if (kind === "assembly" && !body.id)
        stmts.push(
          db
            .prepare(
              "INSERT INTO boms (id,assembly_id,revision,status) VALUES (?,?,?,?)",
            )
            .bind(crypto.randomUUID(), id, d.revision, "生效"),
        );
      stmts.push(
        db
          .prepare(
            "INSERT INTO audit_logs (id,actor,action,entity,created_at) VALUES (?,?,?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            user,
            body.id ? "更新" : "新增",
            String(d.number || d.mpn || d.name || kind),
            now,
          ),
      );
      try {
        await db.batch(stmts);
        break;
      } catch (e) {
        const m = String(e);
        if (
          automatic &&
          attempt < 4 &&
          (m.includes("UNIQUE") || m.includes("GLOBAL_PART_NUMBER_CONFLICT"))
        )
          continue;
        throw e;
      }
    }
    return Response.json({
      ...(await workspace()),
      savedRecord: { kind, id, number: d.number || null },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(req: Request) {
  try {
    checkOrigin(req);
    const user = await actor();
    const { kind, id } = z
      .object({
        kind: z.enum(["bomLine", "productAssembly", "mpnSite"]),
        id: str,
      })
      .parse(await req.json());
    if (!["bomLine", "productAssembly", "mpnSite"].includes(kind))
      throw new Error("该记录不可直接删除，请通过生命周期管理");
    const db = database();
    await db.batch([
      db
        .prepare(
          `DELETE FROM ${tableNames[kind as keyof typeof tableNames]} WHERE id=?`,
        )
        .bind(str.parse(id)),
      db
        .prepare(
          "INSERT INTO audit_logs (id,actor,action,entity,created_at) VALUES (?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          user,
          "移除关联",
          kind,
          new Date().toISOString(),
        ),
    ]);
    return Response.json(await workspace());
  } catch (e) {
    return errorResponse(e);
  }
}
