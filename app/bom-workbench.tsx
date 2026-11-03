"use client";
import { useMemo, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Download,
  Upload,
  Search,
  Trash2,
  AlertTriangle,
  GitBranch,
  Calculator,
  Layers,
  X,
} from "lucide-react";
import type { Workspace, Assembly, BomLine } from "@/lib/ee/types";
import { bomTree, type BomTreeRow } from "@/lib/ee/bom";
import { parseBomImport } from "@/lib/ee/csv";
type Props = {
  d: Workspace;
  assembly: Assembly;
  demo: boolean;
  onAdd: (bomId: string) => void;
  onEdit: (line: BomLine) => void;
  onRemove: (id: string) => void;
  onMaterial: (id: string) => void;
  onCalculate: () => void;
  onData: (d: Workspace) => void;
  onExport: (rows: unknown[][], name: string) => void;
};
const fmt = (v: number) =>
  v.toLocaleString("en-US", { maximumFractionDigits: 6 });
export default function BomWorkbench({
  d,
  assembly: a,
  demo,
  onAdd,
  onEdit,
  onRemove,
  onMaterial,
  onCalculate,
  onData,
  onExport,
}: Props) {
  const [mode, setMode] = useState("tree"),
    [query, setQuery] = useState(""),
    [closed, setClosed] = useState<Set<string>>(new Set()),
    [multiplier, setMultiplier] = useState(1),
    [page, setPage] = useState(1),
    [importOpen, setImportOpen] = useState(false);
  const bom = d.boms.find((b) => b.assemblyId === a.id && b.status === "生效");
  const result = useMemo(() => {
    try {
      return { rows: bomTree(d, a.id, multiplier), error: "" };
    } catch (e) {
      return {
        rows: [] as BomTreeRow[],
        error: e instanceof Error ? e.message : "展开失败",
      };
    }
  }, [d, a.id, multiplier]);
  const filtered = useMemo(() => {
    let rows =
      mode === "direct"
        ? result.rows.filter((r) => r.depth === 0)
        : result.rows;
    const q = query.trim().toLowerCase();
    if (q) {
      const hits = rows.filter((r) =>
        (r.number + " " + r.name + " " + r.line.references)
          .toLowerCase()
          .includes(q),
      );
      const needed = new Set(
        hits.flatMap((r) => {
          const p = r.key.split("/");
          return p.map((_, i) => p.slice(0, i + 1).join("/"));
        }),
      );
      rows = rows.filter((r) => needed.has(r.key));
    } else
      rows = rows.filter((r) => {
        const parts = r.key.split("/");
        return !parts
          .slice(0, -1)
          .some((_, i) => closed.has(parts.slice(0, i + 1).join("/")));
      });
    return rows;
  }, [result.rows, query, closed, mode]);
  const safePage = Math.min(
      page,
      Math.max(1, Math.ceil(filtered.length / 100)),
    ),
    shown = filtered.slice((safePage - 1) * 100, safePage * 100);
  function toggle(key: string) {
    setClosed((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }
  function exportTree() {
    onExport(
      [
        [
          "层级",
          "父级内部零件号",
          "内部零件号",
          "名称",
          "类型",
          "单级用量",
          "单位",
          "损耗加成%",
          "累计用量（含损耗）",
          "位号",
          "路径",
          "说明",
        ],
        ...result.rows.map((r) => [
          r.depth + 1,
          r.path.at(-2),
          r.number,
          r.name,
          r.kind === "assembly" ? "子总成" : "物料",
          r.perParent,
          r.unit,
          r.line.scrapRate || 0,
          r.cumulative,
          r.line.references,
          r.path.join(" > "),
          r.line.notes,
        ]),
      ],
      a.number + "-多层BOM.csv",
    );
  }
  return (
    <section className="bom-workbench">
      <div className="section-toolbar">
        <div>
          <h3>
            <GitBranch size={17} />
            多层级 BOM{" "}
            <span className="gray-tag">Rev {bom?.revision || a.revision}</span>
          </h3>
          <p>
            {d.bomLines.filter((l) => l.bomId === bom?.id).length} 个直接行 ·
            展开 {result.rows.length} 条路径 · 每一层按父级用量累乘
          </p>
        </div>
        <div className="button-group">
          <button className="btn small" onClick={onCalculate}>
            <Calculator size={14} />
            MRP 计算
          </button>
          <button className="btn small" onClick={exportTree}>
            <Download size={14} />
            导出
          </button>
          <button
            className="btn small"
            disabled={!bom}
            onClick={() => setImportOpen(true)}
          >
            <Upload size={14} />
            导入 CSV
          </button>
          <button
            className="btn primary small"
            disabled={!bom}
            onClick={() => onAdd(bom!.id)}
          >
            <Plus size={14} />
            添加行
          </button>
        </div>
      </div>
      <div className="bom-controls">
        <div className="segmented">
          <button
            className={mode === "tree" ? "active" : ""}
            onClick={() => {
              setMode("tree");
              setPage(1);
            }}
          >
            <GitBranch size={14} />
            层级展开
          </button>
          <button
            className={mode === "direct" ? "active" : ""}
            onClick={() => {
              setMode("direct");
              setPage(1);
            }}
          >
            直接用料
          </button>
        </div>
        <div className="bom-search">
          <Search size={14} />
          <input
            aria-label="搜索 BOM"
            placeholder="搜索零件号、名称、位号…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <label className="multiplier-field">
          展开基数{" "}
          <input
            aria-label="BOM 展开基数"
            type="number"
            min="0.000001"
            max="1000000"
            value={multiplier}
            onChange={(e) => setMultiplier(Number(e.target.value))}
          />
        </label>
        <button className="text-btn" onClick={() => setClosed(new Set())}>
          全部展开
        </button>
        <button
          className="text-btn"
          onClick={() =>
            setClosed(
              new Set(
                result.rows.filter((r) => r.hasChildren).map((r) => r.key),
              ),
            )
          }
        >
          全部收起
        </button>
      </div>
      {result.error && (
        <div className="form-error">
          <AlertTriangle size={16} />
          {result.error}
        </div>
      )}
      <div className="table-scroll bom-table-wrap">
        <table className="bom-tree-table">
          <thead>
            <tr>
              <th>层级 / 企业内部零件号 / 名称</th>
              <th>单级用量</th>
              <th>单位</th>
              <th>损耗加成</th>
              <th>累计用量</th>
              <th>位号</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={r.key}
                className={r.kind === "assembly" ? "bom-assembly-row" : ""}
              >
                <td>
                  <div
                    className="tree-part"
                    style={{ paddingLeft: Math.min(r.depth, 12) * 17 }}
                  >
                    {r.hasChildren ? (
                      <button
                        className="tree-toggle"
                        aria-label={
                          (closed.has(r.key) ? "展开 " : "收起 ") + r.number
                        }
                        onClick={() => toggle(r.key)}
                      >
                        {closed.has(r.key) ? (
                          <ChevronRight size={15} />
                        ) : (
                          <ChevronDown size={15} />
                        )}
                      </button>
                    ) : (
                      <span className="tree-stem" />
                    )}
                    <span className="level-label">L{r.depth + 1}</span>
                    <button
                      className="tree-part-name"
                      onClick={() =>
                        r.kind === "material"
                          ? onMaterial(r.itemId)
                          : toggle(r.key)
                      }
                    >
                      <strong className="mono">
                        {r.number}
                        {r.kind === "assembly" && (
                          <span className="gray-tag">子总成</span>
                        )}
                      </strong>
                      <small>{r.name}</small>
                    </button>
                  </div>
                  {r.warning && (
                    <small className="bom-warning">{r.warning}</small>
                  )}
                </td>
                <td className="mono">{fmt(r.perParent)}</td>
                <td>{r.unit}</td>
                <td className="mono">{r.line.scrapRate || 0}%</td>
                <td className="mono cumulative">{fmt(r.cumulative)}</td>
                <td className="refdes-cell" title={r.line.references}>
                  {r.line.references || "—"}
                </td>
                <td>
                  <div className="button-group">
                    <button className="text-btn" onClick={() => onEdit(r.line)}>
                      编辑
                    </button>
                    <button
                      className="icon-btn danger"
                      aria-label={"移除 " + r.number + " BOM行"}
                      onClick={() => onRemove(r.line.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!shown.length && !result.error && (
        <div className="empty">
          <Layers size={28} />
          <h3>{query ? "未找到匹配用料" : "BOM 尚无行项目"}</h3>
          <p>可以逐行新增，也可用内部零件号批量导入。</p>
        </div>
      )}
      <div className="pagination">
        <span>
          共 {filtered.length} 行，每页 100 行 · 同一物料在不同路径中分别显示
        </span>
        <div>
          <button
            disabled={safePage === 1}
            onClick={() => setPage(safePage - 1)}
            aria-label="BOM 上一页"
          >
            <ChevronRight className="rotate" size={14} />
          </button>
          <span>
            {safePage} / {Math.max(1, Math.ceil(filtered.length / 100))}
          </span>
          <button
            disabled={safePage * 100 >= filtered.length}
            onClick={() => setPage(safePage + 1)}
            aria-label="BOM 下一页"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <p className="calculation-note">
        累计用量 = 展开基数 × 各级单级用量 × 各级 (1 + 损耗加成
        %)。编辑子层行会同步影响复用该 BOM 的所有路径。
      </p>
      {importOpen && bom && (
        <BomImportDialog
          d={d}
          bomId={bom.id}
          demo={demo}
          onClose={() => setImportOpen(false)}
          onData={onData}
          onExport={onExport}
        />
      )}
    </section>
  );
}
function BomImportDialog({
  d,
  bomId,
  demo,
  onClose,
  onData,
  onExport,
}: {
  d: Workspace;
  bomId: string;
  demo: boolean;
  onClose: () => void;
  onData: (d: Workspace) => void;
  onExport: Props["onExport"];
}) {
  const [text, setText] = useState(""),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  const preview = useMemo(() => {
    if (!text) return { rows: [], error: "" };
    try {
      return { rows: parseBomImport(text, d), error: "" };
    } catch (e) {
      return { rows: [], error: e instanceof Error ? e.message : "CSV 无效" };
    }
  }, [text, d]);
  async function submit() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/bom-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bomId, csv: text }),
      });
      const j = (await r.json()) as Workspace & { error?: string };
      if (!r.ok) throw new Error(j.error);
      onData(j);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "导入失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className="modal import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">BULK BOM IMPORT</span>
            <h2 id="import-title">批量追加 BOM 用料</h2>
          </div>
          <button className="icon-btn" aria-label="关闭导入" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="notice">
          按企业内部零件号匹配现有物料或子总成。单次最多 2,000
          行，导入整体成功或整体回滚；现有行保留。请避免重复导入相同清单。
        </div>
        <div className="button-group">
          <label className="btn">
            <Upload size={15} />
            选择 CSV 文件
            <input
              type="file"
              accept=".csv,text/csv"
              className="file-input"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 1800000) {
                    setErr("文件不能超过 1.8 MB");
                    return;
                  }
                  setText(await f.text());
                  setErr("");
                }
              }}
            />
          </label>
          <button
            className="btn"
            onClick={() =>
              onExport(
                [
                  ["内部零件号", "数量", "位号", "损耗加成%", "说明"],
                  [d.materials[0]?.number || "EE-1001", 1, "U1", 0, ""],
                ],
                "BOM导入模板.csv",
              )
            }
          >
            <Download size={14} />
            下载模板
          </button>
        </div>
        <textarea
          className="csv-input"
          aria-label="CSV 内容"
          placeholder="内部零件号,数量,位号,损耗加成%,说明"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {preview.error && <div className="form-error">{preview.error}</div>}
        {preview.rows.length > 0 && (
          <div className="import-preview">
            <strong>预检通过：{preview.rows.length} 行</strong>
            <div>
              {preview.rows.slice(0, 6).map((r, i) => (
                <p key={i}>
                  <span className="mono">{r.number}</span>
                  <span>× {r.quantity}</span>
                  <span>{r.references}</span>
                  <span>损耗 {r.scrapRate}%</span>
                </p>
              ))}
            </div>
            {preview.rows.length > 6 && (
              <small>其余 {preview.rows.length - 6} 行也已完成预检</small>
            )}
          </div>
        )}
        {demo && (
          <div className="notice amber">
            请先载入示例数据，再向示例 BOM 导入用料。
          </div>
        )}
        {err && <div className="form-error">{err}</div>}
        <div className="modal-footer">
          <span>只接受已建档的内部零件号</span>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            disabled={busy || demo || !preview.rows.length || !!preview.error}
            onClick={submit}
          >
            {busy ? "正在导入…" : `确认追加 ${preview.rows.length} 行`}
          </button>
        </div>
      </section>
    </div>
  );
}
