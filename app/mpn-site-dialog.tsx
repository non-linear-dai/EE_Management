"use client";
import { useMemo, useState } from "react";
import { X, Search, Check, Link2, AlertTriangle, Package } from "lucide-react";
import type { Workspace } from "@/lib/ee/types";
const stages = [
  "晶圆制造",
  "封装",
  "测试",
  "封装测试",
  "PCB 制造",
  "无源器件制造",
  "器件制造",
];
export type MpnLinkSummary = {
  requested: number;
  added: number;
  skipped: number;
};
export default function MpnSiteDialog({
  d,
  initial,
  demo,
  onClose,
  onSaved,
}: {
  d: Workspace;
  initial?: Record<string, unknown>;
  demo: boolean;
  onClose: () => void;
  onSaved: (data: Workspace, summary: MpnLinkSummary) => void;
}) {
  const [siteId, setSiteId] = useState(
      String(initial?.siteId || d.sites[0]?.id || ""),
    ),
    [stage, setStage] = useState(String(initial?.stage || stages[0])),
    [selected, setSelected] = useState<Set<string>>(
      new Set(initial?.mpnId ? [String(initial.mpnId)] : []),
    ),
    [query, setQuery] = useState(""),
    [source, setSource] = useState(String(initial?.source || "")),
    [verifiedAt, setVerifiedAt] = useState(String(initial?.verifiedAt || "")),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const materials = useMemo(
    () => new Map(d.materials.map((m) => [m.id, m])),
    [d.materials],
  );
  const existing = useMemo(
    () =>
      new Set(
        d.mpnSites
          .filter((l) => l.siteId === siteId && l.stage === stage)
          .map((l) => l.mpnId),
      ),
    [d.mpnSites, siteId, stage],
  );
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return d.mpns.filter((m) =>
      [
        m.mpn,
        m.manufacturer,
        materials.get(m.materialId)?.number,
        materials.get(m.materialId)?.name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [d.mpns, query, materials]);
  const pending = [...selected].filter(
    (id) => !existing.has(id) && d.mpns.some((m) => m.id === id),
  );
  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!pending.length) {
      setError("请至少选择一个尚未关联的 MPN");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/mpn-site-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          stage,
          mpnIds: pending,
          source,
          verifiedAt,
        }),
      });
      const data = (await r.json()) as Workspace & {
        error?: string;
        linkSummary: MpnLinkSummary;
      };
      if (!r.ok) throw new Error(data.error);
      onSaved(data, data.linkSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "关联失败，请重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <section
        className="modal mpn-link-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mpn-link-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">MANUFACTURING RELATIONSHIPS</span>
            <h2 id="mpn-link-title">
              <Link2 size={20} />
              为工厂关联多个 MPN
            </h2>
          </div>
          <button
            className="icon-btn"
            type="button"
            aria-label="关闭关联窗口"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="wide">
              <span>制造工厂 *</span>
              <select
                name="siteId"
                required
                disabled={busy}
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
              >
                <option value="" disabled>
                  请选择制造工厂
                </option>
                {d.sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.country} / {s.city}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>制造阶段 *</span>
              <select
                name="stage"
                required
                disabled={busy}
                value={stage}
                onChange={(e) => setStage(e.target.value)}
              >
                {stages.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              <span>核验日期</span>
              <input
                type="date"
                name="verifiedAt"
                disabled={busy}
                value={verifiedAt}
                onChange={(e) => setVerifiedAt(e.target.value)}
              />
            </label>
          </div>
          <div className="mpn-selection-heading">
            <span>
              <Package size={15} />
              制造商器件 MPN <b>可多选</b>
            </span>
            <span>
              待新增 <strong>{pending.length}</strong> 个 · 当前阶段已关联{" "}
              {existing.size} 个
            </span>
          </div>
          <div className="mpn-selection-tools">
            <div className="mpn-selection-search">
              <Search size={15} />
              <input
                aria-label="搜索可关联 MPN"
                disabled={busy}
                placeholder="搜索 MPN、制造商、内部零件号…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              className="text-btn"
              type="button"
              disabled={busy || !filtered.some((m) => !existing.has(m.id))}
              onClick={() =>
                setSelected(
                  (current) =>
                    new Set([
                      ...current,
                      ...filtered
                        .filter((m) => !existing.has(m.id))
                        .map((m) => m.id),
                    ]),
                )
              }
            >
              全选当前结果
            </button>
            <button
              className="text-btn"
              type="button"
              disabled={busy || !selected.size}
              onClick={() => setSelected(new Set())}
            >
              清空选择
            </button>
          </div>
          <fieldset
            className="mpn-checkbox-list"
            disabled={busy}
            aria-label="可关联 MPN 列表"
          >
            <legend className="sr-only">选择制造商器件</legend>
            {filtered.map((m) => {
              const linked = existing.has(m.id),
                checked = linked || selected.has(m.id),
                material = materials.get(m.materialId);
              return (
                <label
                  key={m.id}
                  className={
                    "mpn-checkbox-row " +
                    (linked ? "already-linked" : checked ? "chosen" : "")
                  }
                >
                  <input
                    type="checkbox"
                    aria-label={
                      "选择 " +
                      m.mpn +
                      " · " +
                      m.manufacturer +
                      " · " +
                      material?.number
                    }
                    checked={checked}
                    disabled={linked || busy}
                    onChange={() => toggle(m.id)}
                  />
                  <div>
                    <strong className="mono">{m.mpn}</strong>
                    <span>{m.manufacturer}</span>
                    <small>
                      {material?.number} · {material?.name}
                    </small>
                  </div>
                  <span
                    className={
                      linked
                        ? "linked-label"
                        : "mpn-approval " +
                          (m.approval === "已批准" ? "approved" : "")
                    }
                  >
                    {linked ? (
                      <>
                        <Check size={12} />
                        已关联
                      </>
                    ) : (
                      m.approval
                    )}
                  </span>
                </label>
              );
            })}
            {!filtered.length && (
              <div className="empty">
                <Search size={24} />
                <p>没有匹配的 MPN，尝试其他搜索条件。</p>
              </div>
            )}
          </fieldset>
          <p className="mpn-selection-hint">
            已选项会跨搜索保留。同一工厂、同一阶段的已有关系会自动跳过；不同阶段可分别维护。
          </p>
          <label className="mpn-source-field">
            <span>信息来源 / 证据 *</span>
            <textarea
              required
              name="source"
              maxLength={1000}
              rows={3}
              disabled={busy}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="填写适用于本次所选 MPN 的原厂声明、PCN 编号或文件来源"
            />
          </label>
          <p className="mpn-selection-hint">
            制造阶段、核验日期和信息来源将应用到本次勾选的所有 MPN。
          </p>
          {demo && (
            <div className="notice amber">
              <AlertTriangle size={15} />
              请先载入示例数据，再保存示例工厂的关联。
            </div>
          )}
          {pending.length > 1000 && (
            <div className="form-error">
              每次最多关联 1,000 个 MPN，请减少勾选数量。
            </div>
          )}
          {error && (
            <div className="form-error" role="alert">
              <AlertTriangle size={15} />
              {error}
            </div>
          )}
          <div className="modal-footer">
            <span>
              匹配 {filtered.length} / {d.mpns.length} 个器件
            </span>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={
                busy ||
                demo ||
                !siteId ||
                !pending.length ||
                pending.length > 1000
              }
            >
              {busy ? "正在关联…" : `关联 ${pending.length} 个 MPN`}
              {!busy && <Check size={15} />}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
