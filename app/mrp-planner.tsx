"use client";
import { useMemo, useState } from "react";
import {
  Calculator,
  Plus,
  Trash2,
  Download,
  AlertTriangle,
  GitBranch,
  Package,
  Box,
} from "lucide-react";
import type { Workspace } from "@/lib/ee/types";
import { calculateMrp, type Demand, type StockInput } from "@/lib/ee/bom";
const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 6 });
export default function MrpPlanner({
  d,
  initial,
  onMaterial,
  onExport,
  query = "",
}: {
  d: Workspace;
  query?: string;
  initial?: { kind: "product" | "assembly"; id: string };
  onMaterial: (id: string) => void;
  onExport: (rows: unknown[][], name: string) => void;
}) {
  const [demands, setDemands] = useState<Demand[]>([
      {
        kind: initial?.kind || "product",
        id: initial?.id || d.products[0]?.id || "",
        quantity: 100,
      },
    ]),
    [stocks, setStocks] = useState<Record<string, StockInput>>({}),
    [netting, setNetting] = useState(false);
  function change(index: number, patch: Partial<Demand>) {
    setDemands((s) => s.map((x, i) => (i === index ? { ...x, ...patch } : x)));
  }
  const result = useMemo(() => {
    try {
      return {
        rows: calculateMrp(d, demands, netting ? stocks : {}),
        error: "",
      };
    } catch (e) {
      return { rows: [], error: e instanceof Error ? e.message : "计算失败" };
    }
  }, [d, demands, stocks, netting]);
  function stock(id: string, key: keyof StockInput, value: number) {
    setStocks((s) => ({
      ...s,
      [id]: {
        ...(s[id] || { onHand: 0, receipts: 0, safety: 0 }),
        [key]: value,
      },
    }));
  }
  return (
    <div className="mrp-layout">
      <section className="panel mrp-demand">
        <div className="panel-heading">
          <div>
            <h2>
              <Calculator size={17} />
              生产需求
            </h2>
            <p>支持多个产品及总成合并计算；计划数量变化后自动重算。</p>
          </div>
          <button
            className="btn small"
            onClick={() =>
              setDemands((s) => [
                ...s,
                { kind: "product", id: d.products[0]?.id || "", quantity: 1 },
              ])
            }
          >
            <Plus size={14} />
            添加需求
          </button>
        </div>
        <div className="demand-head">
          <span>需求类型</span>
          <span>企业内部零件号 / 名称</span>
          <span>计划数量</span>
          <span />
        </div>
        <div className="demand-lines">
          {demands.map((r, i) => (
            <div className="demand-row" key={i}>
              <select
                aria-label={`需求 ${i + 1} 类型`}
                value={r.kind}
                onChange={(e) =>
                  change(i, {
                    kind: e.target.value as Demand["kind"],
                    id:
                      (e.target.value === "product"
                        ? d.products
                        : d.assemblies)[0]?.id || "",
                  })
                }
              >
                <option value="product">企业产品</option>
                <option value="assembly">PCBA / TLA</option>
              </select>
              <select
                aria-label={`需求 ${i + 1} 零件号`}
                value={r.id}
                onChange={(e) => change(i, { id: e.target.value })}
              >
                {(r.kind === "product" ? d.products : d.assemblies).map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.number} · {x.name}
                  </option>
                ))}
              </select>
              <input
                aria-label={`需求 ${i + 1} 计划数量`}
                type="number"
                min="1"
                max="1000000"
                step="1"
                value={r.quantity}
                onChange={(e) =>
                  change(i, { quantity: Number(e.target.value) })
                }
              />
              <button
                className="icon-btn danger"
                aria-label={`移除需求 ${i + 1}`}
                disabled={demands.length === 1}
                onClick={() => setDemands((s) => s.filter((_, j) => j !== i))}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="mrp-mode">
          <label>
            <input
              type="checkbox"
              checked={netting}
              onChange={(e) => setNetting(e.target.checked)}
            />
            输入物料库存、在途和安全库存，计算净需求
          </label>
          <span>库存为本次计算输入，不写入库存账</span>
        </div>
      </section>
      <div className="mrp-summary">
        <div>
          <span className="mrp-summary-icon">
            <Box size={22} />
          </span>
          <span>
            <small>生产需求项</small>
            <strong>{demands.length}</strong>
          </span>
        </div>
        <div>
          <span className="mrp-summary-icon">
            <GitBranch size={22} />
          </span>
          <span>
            <small>汇总物料种类</small>
            <strong>{result.rows.length}</strong>
          </span>
        </div>
        <div>
          <span className="mrp-summary-icon">
            <Package size={22} />
          </span>
          <span>
            <small>存在净需求的物料</small>
            <strong>{result.rows.filter((r) => r.net > 0).length}</strong>
          </span>
        </div>
        <div className="mrp-summary-explainer">
          <strong>按内部零件号汇总</strong>
          <small>
            共享子总成先合并需求，再向下展开；同一物料库存仅抵扣一次。
          </small>
        </div>
      </div>
      {result.error ? (
        <div className="error-banner">
          <AlertTriangle size={17} />
          {result.error}。请补齐结构后重算，系统不会输出缺项的 MRP。
        </div>
      ) : null}
      <section className="panel mrp-results">
        <div className="panel-heading">
          <div>
            <h2>
              物料需求汇总 <span>{result.rows.length}</span>
            </h2>
            <p>
              毛需求含各层损耗加成；净需求 = max(毛需求 + 安全库存 − 可用库存 −
              在途, 0)。pcs 净需求向上取整。
            </p>
          </div>
          <button
            className="btn small"
            disabled={!result.rows.length || !!result.error}
            onClick={() =>
              onExport(
                [
                  [
                    "内部零件号",
                    "名称",
                    "单位",
                    "毛需求（含损耗）",
                    "可用库存",
                    "在途",
                    "安全库存",
                    "净需求",
                    "来源BOM数",
                  ],
                  ...result.rows.map((r) => [
                    r.number,
                    r.name,
                    r.unit,
                    r.gross,
                    r.onHand,
                    r.receipts,
                    r.safety,
                    r.net,
                    r.sourceBoms,
                  ]),
                ],
                "MRP物料需求.csv",
              )
            }
          >
            <Download size={14} />
            导出 MRP
          </button>
        </div>
        <div className="table-scroll mrp-table-wrap">
          <table className="mrp-table">
            <thead>
              <tr>
                <th>内部零件号 / 名称</th>
                <th>来源 BOM</th>
                <th>单位</th>
                <th>毛需求</th>
                {netting && (
                  <>
                    <th>可用库存</th>
                    <th>在途</th>
                    <th>安全库存</th>
                  </>
                )}
                <th>净需求</th>
              </tr>
            </thead>
            <tbody>
              {result.rows
                .filter((r) =>
                  (r.number + " " + r.name)
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((r) => (
                  <tr key={r.materialId}>
                    <td>
                      <button
                        className="table-text-link"
                        onClick={() => onMaterial(r.materialId)}
                      >
                        <strong className="mono">{r.number}</strong>
                        <small>{r.name}</small>
                      </button>
                    </td>
                    <td>{r.sourceBoms} 份</td>
                    <td>{r.unit}</td>
                    <td className="mono">{fmt(r.gross)}</td>
                    {netting &&
                      (["onHand", "receipts", "safety"] as const).map((key) => (
                        <td key={key}>
                          <input
                            aria-label={`${r.number} ${key === "onHand" ? "可用库存" : key === "receipts" ? "在途" : "安全库存"}`}
                            type="number"
                            min="0"
                            max="1000000000000"
                            step="any"
                            value={stocks[r.materialId]?.[key] || 0}
                            onChange={(e) =>
                              stock(r.materialId, key, Number(e.target.value))
                            }
                          />
                        </td>
                      ))}
                    <td className="mono net-demand">{fmt(r.net)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!result.rows.length && (
          <div className="empty">
            <Calculator size={28} />
            <h3>补充有效需求后显示计算结果</h3>
          </div>
        )}
      </section>
      <p className="calculation-note">
        此页用于静态用量与净需求计算：按全部自制总成展开，不抵扣成品或半成品库存，不包含交期、工单、批量规则和时段排程。不同单位不作合计。
      </p>
    </div>
  );
}
