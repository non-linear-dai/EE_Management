import { z } from "zod";
import {
  actor,
  checkOrigin,
  database,
  workspace,
  errorResponse,
} from "@/lib/ee/server";
import { parseBomImport } from "@/lib/ee/csv";
import { wouldCycle } from "@/lib/ee/relations";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await actor();
    const text = await req.text();
    if (text.length > 2000000) throw new Error("导入内容不能超过 2 MB");
    const { bomId, csv } = z
      .object({ bomId: z.string().min(1), csv: z.string().max(1800000) })
      .parse(JSON.parse(text));
    const w = await workspace(),
      bom = w.boms.find((b) => b.id === bomId && b.status === "生效");
    if (!bom) throw new Error("生效 BOM 不存在");
    const rows = parseBomImport(csv, w);
    for (const row of rows)
      if (
        row.childAssemblyId &&
        wouldCycle(w, bom.assemblyId, row.childAssemblyId)
      )
        throw new Error("导入将导致循环总成关系：" + row.number);
    const db = database();
    const stmts = [];
    for (let i = 0; i < rows.length; i += 10) {
      const chunk = rows.slice(i, i + 10);
      stmts.push(
        db
          .prepare(
            'INSERT INTO bom_lines (id,bom_id,material_id,child_assembly_id,quantity,scrap_rate,"references",notes) VALUES ' +
              chunk.map(() => "(?,?,?,?,?,?,?,?)").join(","),
          )
          .bind(
            ...chunk.flatMap((r) => [
              crypto.randomUUID(),
              bom.id,
              r.materialId,
              r.childAssemblyId,
              r.quantity,
              r.scrapRate,
              r.references,
              r.notes,
            ]),
          ),
      );
    }
    stmts.push(
      db
        .prepare(
          "INSERT INTO audit_logs (id,actor,action,entity,created_at) VALUES (?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          user,
          "批量追加 BOM",
          `${w.assemblies.find((a) => a.id === bom.assemblyId)?.number} · ${rows.length} 行`,
          new Date().toISOString(),
        ),
    );
    await db.batch(stmts);
    return Response.json(await workspace());
  } catch (e) {
    return errorResponse(e);
  }
}
