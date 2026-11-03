import type { Workspace, BomLine } from "./types";
import {
  quantity,
  multiply,
  allowance,
  asNumber,
  add,
  subtract,
  positive,
  type Quantity,
} from "./quantities.ts";
export type BomTreeRow = {
  key: string;
  parentKey: string | null;
  depth: number;
  line: BomLine;
  ownerId: string;
  itemId: string;
  number: string;
  name: string;
  kind: "material" | "assembly";
  unit: string;
  perParent: number;
  cumulative: number;
  warning: string;
  hasChildren: boolean;
  path: string[];
};
function index(d: Workspace) {
  const assemblies = new Map(d.assemblies.map((a) => [a.id, a]));
  const materials = new Map(d.materials.map((m) => [m.id, m]));
  const boms = new Map<string, string>();
  for (const b of d.boms.filter((b) => b.status === "生效")) {
    if (boms.has(b.assemblyId))
      throw new Error("总成有多个生效 BOM：" + b.assemblyId);
    boms.set(b.assemblyId, b.id);
  }
  const lines = new Map<string, BomLine[]>();
  for (const l of d.bomLines) {
    const arr = lines.get(l.bomId) || [];
    arr.push(l);
    lines.set(l.bomId, arr);
  }
  return { assemblies, materials, boms, lines };
}
export function bomTree(
  d: Workspace,
  rootId: string,
  rootQuantity = 1,
): BomTreeRow[] {
  if (!Number.isFinite(rootQuantity) || rootQuantity <= 0)
    throw new Error("计划数量必须大于 0");
  const ix = index(d),
    out: BomTreeRow[] = [];
  const walk = (
    id: string,
    total: Quantity,
    path: string[],
    keys: string[],
    ancestors: Set<string>,
  ) => {
    if (ancestors.has(id))
      throw new Error("发现循环 BOM：" + (ix.assemblies.get(id)?.number || id));
    if (ancestors.size >= 100)
      throw new Error("BOM 超过 100 层安全上限，请检查结构");
    const next = new Set(ancestors);
    next.add(id);
    const bid = ix.boms.get(id);
    for (const line of ix.lines.get(bid || "") || []) {
      if (out.length >= 20000)
        throw new Error("展开路径超过 20,000 行，请选择更小的子总成查看");
      const item = line.materialId
        ? ix.materials.get(line.materialId)
        : ix.assemblies.get(line.childAssemblyId || "");
      const key = [...keys, line.id].join("/");
      const childLines = ix.lines.get(ix.boms.get(item?.id || "") || "") || [];
      const cum = multiply(
        total,
        multiply(quantity(line.quantity), allowance(line.scrapRate)),
      );
      const row: BomTreeRow = {
        key,
        parentKey: keys.length ? keys.join("/") : null,
        depth: keys.length,
        line,
        ownerId: id,
        itemId: item?.id || "",
        number: item?.number || "关联失效",
        name: item?.name || "对象不存在",
        kind: line.materialId ? "material" : "assembly",
        unit: line.materialId
          ? ix.materials.get(line.materialId)?.unit || "pcs"
          : "pcs",
        perParent: line.quantity,
        cumulative: asNumber(cum),
        warning: !item
          ? "关联对象不存在"
          : !line.materialId && !childLines.length
            ? "子总成缺少生效 BOM 或用料"
            : "",
        hasChildren: !!line.childAssemblyId && !!childLines.length,
        path: [...path, item?.number || "?"],
      };
      out.push(row);
      if (line.childAssemblyId && item)
        walk(item.id, cum, row.path, [...keys, line.id], next);
    }
  };
  walk(
    rootId,
    quantity(rootQuantity),
    [ix.assemblies.get(rootId)?.number || rootId],
    [],
    new Set(),
  );
  return out;
}
export type Demand = {
  kind: "product" | "assembly";
  id: string;
  quantity: number;
};
export type StockInput = { onHand: number; receipts: number; safety: number };
export type MrpRow = {
  materialId: string;
  number: string;
  name: string;
  unit: string;
  gross: number;
  onHand: number;
  receipts: number;
  safety: number;
  net: number;
  sourceBoms: number;
};
export function calculateMrp(
  d: Workspace,
  demands: Demand[],
  stock: Record<string, StockInput> = {},
): MrpRow[] {
  const ix = index(d),
    roots = new Map<string, Quantity>();
  const bump = (m: Map<string, Quantity>, id: string, v: Quantity) =>
    m.set(id, add(m.get(id) || quantity(0), v));
  if (!demands.length) throw new Error("请添加至少一项生产需求");
  for (const demand of demands) {
    if (
      !Number.isInteger(demand.quantity) ||
      demand.quantity <= 0 ||
      demand.quantity > 1000000
    )
      throw new Error("计划数量须为 1–1,000,000 的整数");
    if (demand.kind === "product") {
      const p = d.products.find((p) => p.id === demand.id);
      if (!p) throw new Error("计划中的产品不存在");
      const links = d.productAssemblies.filter((l) => l.productId === p.id);
      if (!links.length) throw new Error(p.number + " 尚未关联总成");
      for (const l of links)
        bump(
          roots,
          l.assemblyId,
          multiply(quantity(demand.quantity), quantity(l.quantity)),
        );
    } else bump(roots, demand.id, quantity(demand.quantity));
  }
  const ordered: string[] = [],
    state = new Map<string, number>();
  const visit = (id: string, depth: number) => {
    if (state.get(id) === 1)
      throw new Error("发现循环 BOM：" + (ix.assemblies.get(id)?.number || id));
    if (state.get(id) === 2) return;
    if (depth >= 100) throw new Error("BOM 超过 100 层安全上限");
    const a = ix.assemblies.get(id);
    if (!a) throw new Error("关联总成不存在：" + id);
    const lines = ix.lines.get(ix.boms.get(id) || "");
    if (!lines?.length)
      throw new Error(a.number + " 缺少生效 BOM 或 BOM 为空，无法完成 MRP");
    state.set(id, 1);
    for (const l of lines) {
      if (
        !Number.isFinite(l.quantity) ||
        l.quantity <= 0 ||
        !Number.isFinite(l.scrapRate ?? 0) ||
        (l.scrapRate ?? 0) < 0 ||
        (l.scrapRate ?? 0) > 100
      )
        throw new Error(a.number + " 存在无效用量");
      if (l.childAssemblyId) visit(l.childAssemblyId, depth + 1);
      else if (!l.materialId || !ix.materials.has(l.materialId))
        throw new Error(a.number + " 存在失效物料关联");
    }
    state.set(id, 2);
    ordered.push(id);
  };
  for (const id of roots.keys()) visit(id, 0);
  const totals = new Map(roots),
    materialTotals = new Map<string, Quantity>(),
    sources = new Map<string, Set<string>>();
  for (const id of ordered.reverse()) {
    const total = totals.get(id) || quantity(0);
    for (const l of ix.lines.get(ix.boms.get(id)!)!) {
      const required = multiply(
        total,
        multiply(quantity(l.quantity), allowance(l.scrapRate)),
      );
      if (l.childAssemblyId) bump(totals, l.childAssemblyId, required);
      else {
        bump(materialTotals, l.materialId!, required);
        const set = sources.get(l.materialId!) || new Set<string>();
        set.add(l.bomId);
        sources.set(l.materialId!, set);
      }
    }
  }
  return [...materialTotals]
    .map(([id, gross]) => {
      const m = ix.materials.get(id)!;
      const s = stock[id] || { onHand: 0, receipts: 0, safety: 0 };
      for (const x of Object.values(s))
        if (!Number.isFinite(x) || x < 0 || x > 1000000000000)
          throw new Error("库存输入必须为非负有限数字，且不超过 10^12");
      const net = subtract(
        add(gross, quantity(s.safety)),
        add(quantity(s.onHand), quantity(s.receipts)),
      );
      return {
        materialId: id,
        number: m.number,
        name: m.name,
        unit: m.unit || "pcs",
        gross: asNumber(gross),
        ...s,
        net: positive(net) ? asNumber(net, (m.unit || "pcs") === "pcs") : 0,
        sourceBoms: sources.get(id)?.size || 0,
      };
    })
    .sort((a, b) => a.number.localeCompare(b.number));
}
