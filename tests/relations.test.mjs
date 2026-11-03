import test from "node:test";
import assert from "node:assert/strict";
import { DEMO } from "../lib/ee/demo.ts";
import {
  materialAssemblies,
  materialProducts,
  assemblyMaterials,
  wouldCycle,
} from "../lib/ee/relations.ts";
test("反查包含直接 PCBA 与所有间接 TLA，且去重", () => {
  assert.deepEqual(
    new Set(materialAssemblies(DEMO, "mat-1001")),
    new Set(["asm-1", "asm-5", "asm-6"]),
  );
  assert.equal(materialProducts(DEMO, "mat-1001").length, 4);
});
test("TLA 展开子总成物料并保留 PCB", () => {
  const ids = assemblyMaterials(DEMO, "asm-5");
  assert.ok(ids.includes("mat-1008"));
  assert.ok(ids.includes("mat-1014"));
  assert.equal(ids.filter((x) => x === "mat-1003").length, 1);
});
test("阻止直接和跨层循环引用", () => {
  assert.equal(wouldCycle(DEMO, "asm-1", "asm-1"), true);
  assert.equal(wouldCycle(DEMO, "asm-1", "asm-5"), true);
  assert.equal(wouldCycle(DEMO, "asm-5", "asm-4"), false);
});
test("停用 BOM 不进入当前应用反查", () => {
  const w = structuredClone(DEMO);
  w.boms.find((b) => b.id === "bom-1").status = "作废";
  assert.deepEqual(materialAssemblies(w, "mat-1001"), []);
});
test("异常循环数据也能安全终止展开", () => {
  const w = structuredClone(DEMO);
  w.bomLines.push({
    id: "bad",
    bomId: "bom-1",
    materialId: null,
    childAssemblyId: "asm-5",
    quantity: 1,
    references: "",
    notes: "",
  });
  assert.ok(assemblyMaterials(w, "asm-5").length > 0);
});
test("每份示例 PCBA BOM 均包含对应裸板 PCB", () => {
  for (const a of DEMO.assemblies.filter((a) => a.type === "PCBA")) {
    assert.ok(
      assemblyMaterials(DEMO, a.id).some(
        (id) => DEMO.materials.find((m) => m.id === id)?.category === "PCB",
      ),
      a.number,
    );
  }
});
