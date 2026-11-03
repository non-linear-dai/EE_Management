"use client";
import { useState } from "react";
import { Hash, Save, CheckCircle2 } from "lucide-react";
import type { Workspace, NumberingRule } from "@/lib/ee/types";
import { rulesFor, KIND_LABELS, nextPartNumber } from "@/lib/ee/numbering";
export default function NumberingSettings({
  d,
  onData,
}: {
  d: Workspace;
  onData: (d: Workspace) => void;
}) {
  const [rules, setRules] = useState(rulesFor(d)),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false);
  function change(i: number, patch: Partial<NumberingRule>) {
    setRules((s) => s.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setSuccess(false);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/numbering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules),
      });
      const j = (await r.json()) as Workspace & { error?: string };
      if (!r.ok) throw new Error(j.error);
      onData(j);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="panel numbering-panel">
      <div className="panel-heading">
        <div>
          <h2>
            <Hash size={18} />
            企业内部零件号规则
          </h2>
          <p>
            产品、PCBA、TLA 和电子物料均使用企业内部零件号；MPN
            始终独立于内部编号。
          </p>
        </div>
      </div>
      <form onSubmit={submit}>
        <div className="notice">
          编号采用企业三段样式，如 1234567-00-A。主体号默认 7 位数字；后段格式中
          0 代表数字、A 代表大写字母。自动分配时后段使用
          00-A，手动可输入其他合规后段。新建时留空自动分配，手动输入会校验规则；跨产品、总成和物料全局查重。修改规则不会重编号已有档案。
        </div>
        <div className="table-scroll">
          <table className="rules-table">
            <thead>
              <tr>
                <th>零件类型</th>
                <th>前缀</th>
                <th>流水号位数</th>
                <th>主体号起始值</th>
                <th>后段格式</th>
                <th>下一个可用编号</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => {
                let preview = "";
                try {
                  preview = nextPartNumber(
                    { ...d, numberingRules: rules },
                    r.kind,
                  );
                } catch {
                  preview = "请检查规则或流水号已用尽";
                }
                return (
                  <tr key={r.kind}>
                    <td>{KIND_LABELS[r.kind]}</td>
                    <td>
                      <input
                        aria-label={KIND_LABELS[r.kind] + " 前缀"}
                        value={r.prefix}
                        maxLength={24}
                        onChange={(e) => change(i, { prefix: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={KIND_LABELS[r.kind] + " 流水号位数"}
                        type="number"
                        min="1"
                        max="12"
                        required
                        value={r.digits}
                        onChange={(e) =>
                          change(i, { digits: Number(e.target.value) })
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={KIND_LABELS[r.kind] + " 起始值"}
                        type="number"
                        min="0"
                        max="999999999999"
                        required
                        value={r.start}
                        onChange={(e) =>
                          change(i, { start: Number(e.target.value) })
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={KIND_LABELS[r.kind] + " 后段格式"}
                        value={r.suffix}
                        maxLength={12}
                        onChange={(e) => change(i, { suffix: e.target.value })}
                      />
                    </td>
                    <td className="mono">{preview}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {error && <div className="form-error">{error}</div>}
        {success && (
          <div className="notice">
            <CheckCircle2 size={16} />
            编码规则已保存，后续新建记录将按此规则分配。
          </div>
        )}
        <div className="numbering-footer">
          <span>自动分配仅在保存档案时生效；并发新建会进行编号冲突重试。</span>
          <button className="btn primary" type="submit" disabled={saving}>
            <Save size={15} />
            {saving ? "保存中…" : "保存编码规则"}
          </button>
        </div>
      </form>
    </section>
  );
}
