import type { Workspace } from "./types";
export function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [],
    row: string[] = [];
  let val = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        val += '"';
        i++;
      } else if (quoted || !val) quoted = !quoted;
      else throw new Error("CSV 引号格式错误");
    } else if (c === "," && !quoted) {
      row.push(val);
      val = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(val);
      if (row.some((v) => v.trim())) rows.push([...row]);
      row.length = 0;
      val = "";
    } else val += c;
  }
  if (quoted) throw new Error("CSV 引号未闭合");
  row.push(val);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
export type BomImportRow = {
  number: string;
  quantity: number;
  references: string;
  notes: string;
  scrapRate: number;
  materialId: string | null;
  childAssemblyId: string | null;
};
export function parseBomImport(text: string, d: Workspace): BomImportRow[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("CSV 至少需要表头和一条物料记录");
  if (rows.length > 2001) throw new Error("单次最多导入 2,000 行");
  const heads = rows.shift()!.map((s) => s.trim().toLowerCase());
  const find = (keys: string[]) => heads.findIndex((h) => keys.includes(h));
  const n = find([
      "内部零件号",
      "企业内部零件号",
      "零件号",
      "number",
      "part number",
    ]),
    q = find(["单级用量", "数量", "quantity"]),
    r = find(["位号", "references"]),
    s = find(["损耗加成%", "损耗加成 %", "损耗加成", "scraprate"]),
    notes = find(["说明", "notes"]);
  if (n < 0 || q < 0) throw new Error("缺少必需表头：内部零件号、数量");
  return rows.map((row, i) => {
    const number = row[n]?.trim();
    const qty = Number(row[q]);
    const scrap = s < 0 || !row[s]?.trim() ? 0 : Number(row[s]);
    if (!number) throw new Error(`第 ${i + 2} 行缺少内部零件号`);
    if (
      !Number.isFinite(qty) ||
      qty <= 0 ||
      qty > 1000000 ||
      Math.abs(qty * 1e6 - Math.round(qty * 1e6)) > 0.001
    )
      throw new Error(
        `第 ${i + 2} 行数量须大于 0，最多六位小数，且不超过 1,000,000`,
      );
    if (!Number.isFinite(scrap) || scrap < 0 || scrap > 100)
      throw new Error(`第 ${i + 2} 行损耗加成应为 0–100%`);
    const m = d.materials.find((m) => m.number === number),
      a = d.assemblies.find((a) => a.number === number);
    if (!m && !a)
      throw new Error(`第 ${i + 2} 行零件号 ${number} 不存在，请先建档`);
    if (m && a) throw new Error(`第 ${i + 2} 行零件号跨类型重复，请先清理编号`);
    return {
      number,
      quantity: qty,
      references: r >= 0 ? row[r]?.trim() || "" : "",
      notes: notes >= 0 ? row[notes]?.trim() || "" : "",
      scrapRate: scrap,
      materialId: m?.id || null,
      childAssemblyId: a?.id || null,
    };
  });
}
