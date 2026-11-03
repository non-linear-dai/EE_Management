import test from "node:test";
import assert from "node:assert/strict";
import { validateMpnSiteBatch } from "../lib/ee/mpn-site-batch.ts";
const sites = new Set(["factory-1"]),
  mpns = new Set(["a", "b", "c"]);
const valid = {
  siteId: "factory-1",
  mpnIds: ["a", "b"],
  stage: "封装测试",
  source: "原厂制造声明 QA-01",
  verifiedAt: "2026-11-04",
};
test("一个工厂可一次关联多颗 MPN，并保留共同阶段、来源和日期", () => {
  const r = validateMpnSiteBatch(valid, sites, mpns);
  assert.deepEqual(r.mpnIds, ["a", "b"]);
  assert.equal(r.siteId, "factory-1");
  assert.equal(r.stage, "封装测试");
  assert.equal(r.source, valid.source);
  assert.equal(r.verifiedAt, "2026-11-04");
});
test("重复勾选的 MPN 去重，同时兼容只关联一个 MPN", () => {
  assert.deepEqual(
    validateMpnSiteBatch({ ...valid, mpnIds: ["a", "b", "a"] }, sites, mpns)
      .mpnIds,
    ["a", "b"],
  );
  assert.deepEqual(
    validateMpnSiteBatch({ ...valid, mpnIds: ["c"] }, sites, mpns).mpnIds,
    ["c"],
  );
});
test("任一 MPN 失效时拒绝整次保存，而不是部分关联", () => {
  assert.throws(
    () =>
      validateMpnSiteBatch({ ...valid, mpnIds: ["a", "missing"] }, sites, mpns),
    /记录已失效/,
  );
  assert.throws(
    () => validateMpnSiteBatch({ ...valid, siteId: "missing" }, sites, mpns),
    /工厂不存在/,
  );
});
test("空选择、缺少来源、错误日期和阶段被拒绝", () => {
  for (const bad of [
    { mpnIds: [] },
    { source: " " },
    { verifiedAt: "2026-02-30" },
    { stage: "未知阶段" },
  ])
    assert.throws(() =>
      validateMpnSiteBatch({ ...valid, ...bad }, sites, mpns),
    );
  assert.equal(
    validateMpnSiteBatch({ ...valid, verifiedAt: "" }, sites, mpns).verifiedAt,
    "",
  );
});
test("单次最多 1000 个 MPN，支持大批量勾选", () => {
  const ids = Array.from({ length: 1000 }, (_, i) => String(i));
  assert.equal(
    validateMpnSiteBatch({ ...valid, mpnIds: ids }, sites, new Set(ids)).mpnIds
      .length,
    1000,
  );
  assert.throws(() =>
    validateMpnSiteBatch(
      { ...valid, mpnIds: [...ids, "extra"] },
      sites,
      new Set([...ids, "extra"]),
    ),
  );
});
