import test from "node:test";
import assert from "node:assert/strict";
import { DEMO } from "../lib/ee/demo.ts";
import {
  matchesRule,
  nextPartNumber,
  DEFAULT_RULES,
} from "../lib/ee/numbering.ts";
import { parseCsv, parseBomImport } from "../lib/ee/csv.ts";
test("企业三段规则接受七位主体号、两位数字、末段大写字母", () => {
  const r = DEFAULT_RULES[0];
  assert.equal(matchesRule("1234567-00-A", r), true);
  assert.equal(matchesRule("1234567-19-Z", r), true);
  for (const bad of [
    "123456-00-A",
    "12345678-00-A",
    "1234567-0-A",
    "1234567-00-a",
    "1234567-00-AA",
  ])
    assert.equal(matchesRule(bad, r), false, bad);
});
test("四类档案共用编号池，自动跳过其他类的主体号且保留历史号", () => {
  const w = structuredClone(DEMO);
  w.products.push({
    id: "last",
    number: "9000000-01-B",
    name: "test",
    family: "",
    status: "量产",
  });
  for (const kind of ["product", "material", "PCBA", "TLA"])
    assert.equal(nextPartNumber(w, kind), "9000001-00-A");
});
test("CSV 正确处理 BOM、引号、逗号与换行", () => {
  assert.deepEqual(
    parseCsv('\ufeff编号,说明\r\n"A","含,逗号与""引号""\n换行"'),
    [
      ["编号", "说明"],
      ["A", '含,逗号与"引号"\n换行'],
    ],
  );
});
test("批量导入以内部零件号识别物料及子总成，支持损耗和位号", () => {
  const m = DEMO.materials[0],
    a = DEMO.assemblies[0];
  const rows = parseBomImport(
    `内部零件号,数量,位号,损耗加成%,说明\n${m.number},20,"R1, R2",2,测试\n${a.number},3,,0,`,
    DEMO,
  );
  assert.equal(rows[0].materialId, m.id);
  assert.equal(rows[0].scrapRate, 2);
  assert.equal(rows[0].references, "R1, R2");
  assert.equal(rows[1].childAssemblyId, a.id);
});
test("未知零件号、无效数量、损耗和未闭合引号被拒绝", () => {
  for (const csv of [
    "内部零件号,数量\nUNKNOWN,1",
    `内部零件号,数量\n${DEMO.materials[0].number},0`,
    `内部零件号,数量,损耗加成%\n${DEMO.materials[0].number},1,-1`,
  ])
    assert.throws(() => parseBomImport(csv, DEMO));
  assert.throws(() => parseCsv('a,b\n"open'));
});
test("可预检 2,000 行大规模用料清单并拒绝超过上限", () => {
  const line = `${DEMO.materials[0].number},1`;
  assert.equal(
    parseBomImport(
      "内部零件号,数量\n" + Array(2000).fill(line).join("\n"),
      DEMO,
    ).length,
    2000,
  );
  assert.throws(() =>
    parseBomImport(
      "内部零件号,数量\n" + Array(2001).fill(line).join("\n"),
      DEMO,
    ),
  );
});
