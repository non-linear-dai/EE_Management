import {
  actor,
  checkOrigin,
  database,
  workspace,
  errorResponse,
} from "@/lib/ee/server";
import { DEMO } from "@/lib/ee/demo";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await actor();
    const db = database();
    const current = await workspace();
    if (
      current.materials.length ||
      current.products.length ||
      current.assemblies.length
    )
      return Response.json(
        { error: "当前工作区已有数据，不能载入示例。" },
        { status: 409 },
      );
    const stmts = [];
    const mapping = {
      materials: "materials",
      mpns: "mpns",
      sites: "manufacturing_sites",
      mpnSites: "mpn_sites",
      products: "products",
      assemblies: "assemblies",
      productAssemblies: "product_assemblies",
      boms: "boms",
      bomLines: "bom_lines",
    };
    for (const [key, table] of Object.entries(mapping)) {
      for (const row of DEMO[key as keyof typeof mapping]) {
        const cols = Object.keys(row).map((k) =>
          k.replace(/[A-Z]/g, (s) => "_" + s.toLowerCase()),
        );
        stmts.push(
          db
            .prepare(
              `INSERT INTO ${table} (${cols.map((c) => '"' + c + '"').join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
            )
            .bind(...Object.values(row)),
        );
      }
    }
    stmts.push(
      db
        .prepare(
          "INSERT INTO audit_logs (id,actor,action,entity,created_at) VALUES (?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          user,
          "载入示例工作区",
          "示例数据",
          new Date().toISOString(),
        ),
    );
    await db.batch(stmts);
    return Response.json(await workspace());
  } catch (e) {
    return errorResponse(e);
  }
}
