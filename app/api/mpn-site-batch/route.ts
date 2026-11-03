import {
  actor,
  checkOrigin,
  database,
  workspace,
  errorResponse,
} from "@/lib/ee/server";
import { validateMpnSiteBatch } from "@/lib/ee/mpn-site-batch";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await actor();
    const raw = await req.text();
    if (raw.length > 250000) throw new Error("提交内容过长");
    const db = database();
    const [sites, mpns] = await Promise.all([
      db
        .prepare("SELECT id,name FROM manufacturing_sites")
        .all<{ id: string; name: string }>(),
      db.prepare("SELECT id FROM mpns").all<{ id: string }>(),
    ]);
    const data = validateMpnSiteBatch(
      JSON.parse(raw),
      new Set(sites.results.map((s) => s.id)),
      new Set(mpns.results.map((m) => m.id)),
    );
    const statements = [];
    // Each group uses at most 90 bind parameters. NOT EXISTS is checked inside
    // the write statement, so concurrent repeats cannot create duplicate links.
    for (let i = 0; i < data.mpnIds.length; i += 10) {
      const group = data.mpnIds.slice(i, i + 10);
      statements.push(
        db
          .prepare(
            "INSERT INTO mpn_sites (id,mpn_id,site_id,stage,source,verified_at) " +
              group
                .map(
                  () =>
                    `SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM mpn_sites WHERE mpn_id=? AND site_id=? AND stage=?)`,
                )
                .join(" UNION ALL "),
          )
          .bind(
            ...group.flatMap((id) => [
              crypto.randomUUID(),
              id,
              data.siteId,
              data.stage,
              data.source,
              data.verifiedAt,
              id,
              data.siteId,
              data.stage,
            ]),
          ),
      );
    }
    statements.push(
      db
        .prepare(
          "INSERT INTO audit_logs (id,actor,action,entity,created_at) VALUES (?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          user,
          "批量关联制造来源",
          `工厂 ${sites.results.find((s) => s.id === data.siteId)!.name} · ${data.stage} · ${data.mpnIds.length} 个 MPN（跳过已有关系）`,
          new Date().toISOString(),
        ),
    );
    const results = await db.batch(statements);
    const added = results
      .slice(0, -1)
      .reduce((n, r) => n + (r.meta.changes || 0), 0);
    return Response.json({
      ...(await workspace()),
      linkSummary: {
        requested: data.mpnIds.length,
        added,
        skipped: data.mpnIds.length - added,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
