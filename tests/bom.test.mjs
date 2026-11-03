import test from "node:test";
import assert from "node:assert/strict";
import { DEMO } from "../lib/ee/demo.ts";
import { bomTree, calculateMrp } from "../lib/ee/bom.ts";
import { quantity, asNumber, multiply, add } from "../lib/ee/quantities.ts";
const denseNumber = DEMO.materials.find((m) => m.id === "dense-0").number;
test("四层 BOM 逐路径累乘，产品需求数量包含产品到总成系数", () => {
  const rows = calculateMrp(DEMO, [
    { kind: "product", id: "prod-5", quantity: 100 },
  ]);
  const r = rows.find((r) => r.materialId === "dense-0");
  assert.equal(r.gross, 4848);
  assert.equal(r.net, 4848);
  const tree = bomTree(DEMO, "asm-9", 200);
  assert.equal(tree.find((r) => r.itemId === "dense-0").cumulative, 4848);
  assert.ok(tree.length > 170);
});
test("多计划复用子总成先汇总，再向下展开，库存只扣一次", () => {
  const rows = calculateMrp(
    DEMO,
    [
      { kind: "product", id: "prod-5", quantity: 100 },
      { kind: "assembly", id: "asm-8", quantity: 50 },
    ],
    { "dense-0": { onHand: 100, receipts: 20, safety: 12 } },
  );
  const r = rows.find((r) => r.materialId === "dense-0");
  assert.equal(r.gross, 5252);
  assert.equal(r.net, 5144);
});
test("同一物料在多份 BOM 的需求相加且不会按单位混合", () => {
  const rows = calculateMrp(DEMO, [
    { kind: "product", id: "prod-1", quantity: 10 },
  ]);
  assert.equal(rows.find((r) => r.materialId === "mat-1003").gross, 260);
  assert.ok(rows.every((r) => r.unit === "pcs"));
});
test("pcs 净需求在所有路径汇总后向上取整", () => {
  const w = structuredClone(DEMO);
  const l = w.bomLines.find((l) => l.materialId === "dense-0");
  l.quantity = 0.1;
  l.scrapRate = 1;
  const r = calculateMrp(w, [
    { kind: "assembly", id: "asm-7", quantity: 1 },
  ]).find((r) => r.materialId === "dense-0");
  assert.equal(r.gross, 0.101);
  assert.equal(r.net, 1);
});
test("非 pcs 物料保留六位小数的净需求", () => {
  const w = structuredClone(DEMO);
  w.materials.find((m) => m.id === "dense-0").unit = "m";
  w.bomLines.find((l) => l.materialId === "dense-0").quantity = 0.1;
  const r = calculateMrp(w, [
    { kind: "assembly", id: "asm-7", quantity: 1 },
  ]).find((r) => r.materialId === "dense-0");
  assert.equal(r.net, 0.101);
});
test("无 BOM、失效引用或循环时不生成缺项的 MRP", () => {
  const w = structuredClone(DEMO);
  w.boms = w.boms.filter((b) => b.assemblyId !== "asm-7");
  assert.throws(
    () => calculateMrp(w, [{ kind: "product", id: "prod-5", quantity: 1 }]),
    /缺少生效 BOM/,
  );
  const c = structuredClone(DEMO);
  c.bomLines.push({
    id: "cycle",
    bomId: "bom-7",
    materialId: null,
    childAssemblyId: "asm-9",
    quantity: 1,
    scrapRate: 0,
    references: "",
    notes: "",
  });
  assert.throws(
    () => calculateMrp(c, [{ kind: "assembly", id: "asm-9", quantity: 1 }]),
    /循环/,
  );
});
test("禁止负数、非整数计划、非法库存与计算溢出", () => {
  assert.throws(() =>
    calculateMrp(DEMO, [{ kind: "product", id: "prod-5", quantity: 0 }]),
  );
  assert.throws(() =>
    calculateMrp(DEMO, [{ kind: "product", id: "prod-5", quantity: 1.5 }]),
  );
  assert.throws(() =>
    calculateMrp(DEMO, [{ kind: "assembly", id: "asm-7", quantity: 1 }], {
      "dense-0": { onHand: -1, receipts: 0, safety: 0 },
    }),
  );
  assert.throws(() => asNumber(quantity("100000000000000000000")));
});
test("十进制相加相乘保留正确用量，无浮点尾差", () => {
  assert.equal(asNumber(add(quantity(0.1), quantity(0.2))), 0.3);
  assert.equal(asNumber(multiply(quantity(0.1), quantity(0.2))), 0.02);
  assert.equal(asNumber(quantity("1e-6")), 0.000001);
});
