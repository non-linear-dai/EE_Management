"use client";
import { useEffect, useState, useMemo } from "react";
import {
  CircuitBoard,
  Layers,
  Network,
  Package,
  Search,
  Plus,
  ChevronRight,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  SlidersHorizontal,
  Download,
  Check,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  Factory,
  MapPin,
  Box,
  Activity,
  BookOpen,
  ChevronDown,
  X,
  ExternalLink,
  FileText,
  Link2,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Database,
  Menu,
  Globe2,
  Component,
  LogOut,
  Command,
  GitBranch,
  Calculator,
  Hash,
} from "lucide-react";
import BomWorkbench from "./bom-workbench";
import MrpPlanner from "./mrp-planner";
import SupplyMap from "./supply-map";
import LocationFields from "./location-fields";
import NumberingSettings from "./numbering-settings";
import MpnSiteDialog from "./mpn-site-dialog";
import { rulesFor, nextPartNumber } from "@/lib/ee/numbering";
import type { LucideIcon } from "lucide-react";
import { DEMO } from "@/lib/ee/demo";
import type {
  Workspace,
  Material,
  Mpn,
  Assembly,
  Product,
} from "@/lib/ee/types";
import {
  materialAssemblies,
  materialProducts,
  assemblyMaterials,
} from "@/lib/ee/relations";
type View =
  | "materials"
  | "relations"
  | "products"
  | "supply"
  | "activity"
  | "mrp"
  | "numbering";
type Modal = {
  kind: string;
  id?: string;
  initial?: Record<string, unknown>;
  title: string;
} | null;
const categories = [
  "全部物料",
  "微控制器",
  "电源管理",
  "电阻",
  "电容",
  "接口器件",
  "PCB",
];
const allCategories = [
  "微控制器",
  "电源管理",
  "电阻",
  "电容",
  "接口器件",
  "存储器",
  "PCB",
  "模拟器件",
  "晶振",
  "分立器件",
  "连接器",
  "电感",
  "传感器",
  "其他",
];
const navs: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "materials", label: "电子物料库", icon: Component },
  { id: "relations", label: "关系图谱", icon: Network },
  { id: "products", label: "产品与总成", icon: Layers },
  { id: "supply", label: "制造与供应", icon: Factory },
  { id: "mrp", label: "MRP 用量计算", icon: Calculator },
];
function Badge({
  children,
  tone = "green",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={"badge " + tone}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
function Chip({
  category = "",
  large = false,
}: {
  category?: string;
  large?: boolean;
}) {
  const icon =
    category === "PCB"
      ? CircuitBoard
      : category === "电容" || category === "电阻"
        ? Component
        : category === "连接器"
          ? Link2
          : Package;
  const Icon = icon;
  return (
    <div
      className={
        "part-icon " +
        (large ? "large " : "") +
        (category === "PCB"
          ? "pcb"
          : category === "电阻" || category === "电容"
            ? "passive"
            : "")
      }
    >
      <Icon size={large ? 38 : 19} strokeWidth={1.45} />
    </div>
  );
}
function Empty({
  text = "暂无记录",
  sub = "可以使用右上角按钮新增数据。",
}: {
  text?: string;
  sub?: string;
}) {
  return (
    <div className="empty">
      <Database size={30} />
      <h3>{text}</h3>
      <p>{sub}</p>
    </div>
  );
}
function Btn({
  children,
  onClick,
  primary = false,
  small = false,
  disabled = false,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  small?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={"btn " + (primary ? "primary " : "") + (small ? "small" : "")}
    >
      {children}
    </button>
  );
}
export default function Platform({ user }: { user: string }) {
  const [d, setD] = useState<Workspace>(DEMO),
    [demo, setDemo] = useState(true),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [view, setView] = useState<View>("materials"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("全部物料"),
    [filter, setFilter] = useState("全部状态"),
    [single, setSingle] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false),
    [selected, setSelected] = useState("mat-1001"),
    [detail, setDetail] = useState(false),
    [tab, setTab] = useState("overview"),
    [modal, setModal] = useState<Modal>(null),
    [toast, setToast] = useState(""),
    [page, setPage] = useState(1),
    [product, setProduct] = useState("prod-1"),
    [assembly, setAssembly] = useState("asm-1"),
    [catalogTab, setCatalogTab] = useState("products"),
    [mobile, setMobile] = useState(false),
    [busy, setBusy] = useState(false),
    [help, setHelp] = useState(false),
    [mrpInitial, setMrpInitial] = useState<{
      kind: "product" | "assembly";
      id: string;
    }>(),
    [supplyMode, setSupplyMode] = useState("map");
  useEffect(() => {
    fetch("/api/workspace")
      .then(async (r) => {
        const j = (await r.json()) as Workspace & { error?: string };
        if (!r.ok) throw new Error(j.error);
        if (
          j.materials.length ||
          j.products.length ||
          j.assemblies.length ||
          j.sites.length ||
          j.mpns.length
        ) {
          setD(j);
          setDemo(false);
          const requested = new URLSearchParams(window.location.search).get(
            "material",
          );
          setSelected(
            j.materials.find((m) => m.id === requested)?.id ||
              j.materials[0]?.id ||
              "",
          );
          if (requested && j.materials.some((m) => m.id === requested))
            setDetail(true);
          setProduct(j.products[0]?.id || "");
          setAssembly(j.assemblies[0]?.id || "");
        } else {
          setD((current) => ({ ...current, numberingRules: j.numberingRules }));
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (loading) return;
    const url = new URL(window.location.href);
    if (detail && selected) url.searchParams.set("material", selected);
    else url.searchParams.delete("material");
    url.searchParams.set("view", view);
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [view, detail, selected, loading]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("view") as View;
    if (
      [
        "materials",
        "relations",
        "products",
        "supply",
        "activity",
        "mrp",
        "numbering",
      ].includes(v)
    )
      setView(v);
    const id = params.get("material");
    if (id && DEMO.materials.some((m) => m.id === id)) {
      setSelected(id);
      setDetail(true);
    }
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    setPage(1);
  }, [query, category, filter, single]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        setDetail(false);
        setHelp(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const approved = (id: string) =>
    d.mpns.filter(
      (m) =>
        m.materialId === id &&
        m.approval === "已批准" &&
        m.lifecycle !== "停产",
    );
  const selectedMat =
    d.materials.find((m) => m.id === selected) || d.materials[0];
  const filtered = useMemo(
    () =>
      d.materials.filter((m) => {
        const text = [
          m.number,
          m.name,
          m.category,
          ...d.mpns
            .filter((p) => p.materialId === m.id)
            .flatMap((p) => [p.manufacturer, p.mpn]),
        ]
          .join(" ")
          .toLowerCase();
        return (
          text.includes(query.toLowerCase()) &&
          (category === "全部物料" || m.category === category) &&
          (filter === "全部状态" || m.lifecycle === filter) &&
          (!single || approved(m.id).length <= 1)
        );
      }),
    [d, query, category, filter, single],
  );
  const risk = d.materials.filter((m) => approved(m.id).length <= 1).length;
  const display = filtered.slice((page - 1) * 9, page * 9);
  const openMaterial = (id: string) => {
    setSelected(id);
    setDetail(true);
    setTab("overview");
  };
  const go = (v: View) => {
    setView(v);
    setDetail(false);
    setQuery("");
    setMobile(false);
  };
  function accept(data: Workspace) {
    setD(data);
    setDemo(false);
    setError("");
    if (!data.materials.some((m) => m.id === selected))
      setSelected(data.materials[0]?.id || "");
    if (!data.products.some((p) => p.id === product))
      setProduct(data.products[0]?.id || "");
    if (!data.assemblies.some((a) => a.id === assembly))
      setAssembly(data.assemblies[0]?.id || "");
  }
  async function seed() {
    setBusy(true);
    try {
      const r = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const j = (await r.json()) as Workspace & { error?: string };
      if (!r.ok) throw new Error(j.error);
      accept(j);
      setToast("示例工作区已保存，可以开始编辑。");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "载入失败");
    } finally {
      setBusy(false);
    }
  }
  function create(
    kind: string,
    title: string,
    initial: Record<string, unknown> = {},
  ) {
    setModal({ kind, title, initial });
  }
  async function save(data: Record<string, unknown>) {
    if (!modal) return;
    const r = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: modal.kind, id: modal.id, data }),
    });
    const j = (await r.json()) as Workspace & {
      error?: string;
      savedRecord?: { kind: string; id: string; number: string | null };
    };
    if (!r.ok) throw new Error(j.error);
    accept(j);
    if (!modal.id && j.savedRecord) {
      const saved = j.savedRecord;
      if (saved.kind === "material") {
        setSelected(saved.id);
        setDetail(true);
        setTab("overview");
      }
      if (saved.kind === "product") setProduct(saved.id);
      if (saved.kind === "assembly") {
        setAssembly(saved.id);
        setCatalogTab("assemblies");
      }
    }
    setModal(null);
    setToast(
      j.savedRecord?.number
        ? "已保存 · " + j.savedRecord.number
        : "已保存至工作区",
    );
  }
  async function remove(kind: string, id: string) {
    if (demo) {
      setToast("请先载入示例数据，再编辑示例关联。");
      return;
    }
    setModal({
      kind: "remove",
      title: "移除这条关联？",
      initial: { kind, id },
    });
  }
  async function confirmRemove() {
    if (!modal) return;
    const r = await fetch("/api/records", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(modal.initial),
    });
    const j = (await r.json()) as Workspace & { error?: string };
    if (!r.ok) throw new Error(j.error);
    accept(j);
    setModal(null);
    setToast("关联已移除");
  }
  function edit(kind: string, title: string, record: object) {
    if (demo) {
      setToast("请先点击「载入示例」保存工作区，再编辑示例记录。");
      return;
    }
    const rec = record as Record<string, unknown>;
    setModal({ kind, title, id: String(rec.id), initial: rec });
  }
  function exportCsv(rows: unknown[][], filename: string) {
    const safe = (v: unknown) => {
      const t = String(v ?? "");
      return (
        '"' + (/^[=+@\-\t\r]/.test(t) ? "'" + t : t).replaceAll('"', '""') + '"'
      );
    };
    const blob = new Blob(
      ["\ufeff" + rows.map((r) => r.map(safe).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8;" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast("清单已导出");
  }
  function exportMaterials() {
    exportCsv(
      [
        [
          "内部零件号",
          "物料名称",
          "分类",
          "封装",
          "生命周期",
          "批准 MPN 数",
          "适用总成数",
          "适用产品数",
        ],
        ...filtered.map((m) => [
          m.number,
          m.name,
          m.category,
          m.package,
          m.lifecycle,
          approved(m.id).length,
          materialAssemblies(d, m.id).length,
          materialProducts(d, m.id).length,
        ]),
      ],
      "电子物料清单.csv",
    );
  }
  const titles = {
    materials: "电子物料库",
    relations: "关系图谱",
    products: "产品与总成",
    supply: "制造与供应",
    activity: "变更记录",
    mrp: "MRP 用量计算",
    numbering: "内部编码规则",
  };
  function stats() {
    return (
      <div className="stats">
        <div className="stat">
          <div>
            <span>企业内部物料</span>
            <Component size={17} />
          </div>
          <strong>
            {d.materials.length}
            <small>颗</small>
          </strong>
          <p>
            <span className="mini-green">统一零件号</span> 贯穿全产品生命周期
          </p>
        </div>
        <div className="stat">
          <div>
            <span>制造商器件 MPN</span>
            <Package size={17} />
          </div>
          <strong>
            {d.mpns.length}
            <small>个</small>
          </strong>
          <p>
            <span className="mini-green">
              {d.mpns.filter((m) => m.approval === "已批准").length} 个已批准
            </span>{" "}
            管理可替代器件
          </p>
        </div>
        <div className="stat">
          <div>
            <span>关联产品 / 总成</span>
            <Layers size={17} />
          </div>
          <strong>
            {d.products.length}
            <span className="stat-divider">/</span>
            {d.assemblies.length}
            <small>项</small>
          </strong>
          <p>产品、PCBA 与 TLA 关系全覆盖</p>
        </div>
        <button
          className={"stat risk-stat " + (single ? "chosen" : "")}
          onClick={() => {
            go("materials");
            setSingle(!single);
          }}
        >
          <div>
            <span>替代来源待完善</span>
            <AlertTriangle size={17} />
          </div>
          <strong>
            {risk}
            <small>颗</small>
          </strong>
          <p>
            <span className="mini-amber">需要关注</span> 查看来源情况{" "}
            <ArrowUpRight size={13} />
          </p>
        </button>
      </div>
    );
  }
  function matOverview(m: Material, compact = false) {
    const mp = d.mpns.filter((p) => p.materialId === m.id);
    return (
      <>
        <div className="detail-hero">
          <Chip category={m.category} large />
          <div>
            <span className="eyebrow">INTERNAL PART NUMBER</span>
            <h2>{m.number}</h2>
            <p>{m.name}</p>
          </div>
        </div>
        <div className="tag-row">
          <Badge tone={m.lifecycle === "量产" ? "green" : "amber"}>
            {m.lifecycle}
          </Badge>
          <span className="gray-tag">{m.category}</span>
          <span className="gray-tag">{m.package}</span>
        </div>
        <div className="section-label">
          核心参数 <span>PARAMETERS</span>
        </div>
        <div className="param-grid">
          {Object.entries(JSON.parse(m.parameters))
            .slice(0, compact ? 4 : 20)
            .map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <strong>{String(v)}</strong>
              </div>
            ))}
        </div>
        <div className="section-label">
          批准器件 <span>{mp.length} MPN</span>
        </div>
        <div className="compact-mpns">
          {mp.slice(0, compact ? 2 : 20).map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setDetail(true);
                setTab("mpns");
              }}
            >
              <div className="maker-mark">
                {p.manufacturer.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <strong className="mono">{p.mpn}</strong>
                <span>{p.manufacturer}</span>
              </div>
              {p.approval === "已批准" ? (
                <CheckCircle2 size={16} className="green-text" />
              ) : (
                <Clock3 size={16} className="amber-text" />
              )}
            </button>
          ))}
        </div>
      </>
    );
  }
  function sidePanel() {
    return (
      <aside className="inspector">
        <div className="panel-title">
          <span>物料速览</span>
          <span className="light-label">PART PREVIEW</span>
        </div>
        {selectedMat ? (
          <>
            <div className="inspector-body">
              {matOverview(selectedMat, true)}
              <div className="usage-summary">
                <div>
                  <strong>
                    {materialAssemblies(d, selectedMat.id).length}
                  </strong>
                  <span>应用总成</span>
                </div>
                <div>
                  <strong>{materialProducts(d, selectedMat.id).length}</strong>
                  <span>关联产品</span>
                </div>
                <Network size={29} />
              </div>
            </div>
            <button
              className="inspector-footer"
              onClick={() => openMaterial(selectedMat.id)}
            >
              查看完整物料档案 <ArrowRight size={16} />
            </button>
          </>
        ) : (
          <Empty text="选择物料查看档案" />
        )}
      </aside>
    );
  }
  function materialsView() {
    return (
      <>
        {stats()}
        <div className="library-layout">
          <section className="panel library">
            <div className="panel-heading">
              <div>
                <h2>
                  物料清单 <span>{d.materials.length}</span>
                </h2>
                <p>一个内部零件号，连接多种合格器件。</p>
              </div>
              <button
                className={"icon-btn " + (filtersOpen ? "active" : "")}
                title="筛选物料"
                aria-label="筛选物料"
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <SlidersHorizontal size={18} />
              </button>
            </div>
            <div className="category-tabs">
              {categories.map((c) => (
                <button
                  key={c}
                  className={category === c ? "active" : ""}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
              <select
                aria-label="更多物料分类"
                value={categories.includes(category) ? "" : category}
                onChange={(e) => setCategory(e.target.value || "全部物料")}
              >
                <option value="">更多</option>
                {allCategories
                  .filter((c) => !categories.includes(c))
                  .map((c) => (
                    <option key={c}>{c}</option>
                  ))}
              </select>
            </div>
            {(filtersOpen || single) && (
              <div className="filter-bar">
                <span>筛选</span>
                <select
                  value={filter}
                  aria-label="生命周期筛选"
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {["全部状态", "量产", "评估中", "不推荐新设计", "停产"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
                <label>
                  <input
                    type="checkbox"
                    checked={single}
                    onChange={(e) => setSingle(e.target.checked)}
                  />{" "}
                  少于 2 个批准来源
                </label>
                <button
                  onClick={() => {
                    setSingle(false);
                    setFilter("全部状态");
                    setCategory("全部物料");
                    setQuery("");
                  }}
                >
                  重置
                </button>
              </div>
            )}
            <div className="table-scroll">
              <table className="material-table">
                <thead>
                  <tr>
                    <th>物料 / 内部零件号</th>
                    <th>类别 / 封装</th>
                    <th>批准器件</th>
                    <th>应用总成</th>
                    <th>生命周期</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {display.map((m) => (
                    <tr
                      key={m.id}
                      className={selected === m.id ? "selected" : ""}
                      onClick={() => setSelected(m.id)}
                    >
                      <td>
                        <button
                          className="part-cell"
                          onClick={(e) => {
                            e.stopPropagation();
                            openMaterial(m.id);
                          }}
                        >
                          <Chip category={m.category} />
                          <span>
                            <strong>{m.name}</strong>
                            <span className="mono secondary">{m.number}</span>
                          </span>
                        </button>
                      </td>
                      <td>
                        <span>{m.category}</span>
                        <small>{m.package}</small>
                      </td>
                      <td>
                        <div className="mpn-count">
                          <span
                            className={
                              approved(m.id).length > 1 ? "multiple" : "one"
                            }
                          >
                            {approved(m.id).length}
                          </span>
                          <span>
                            {" "}
                            /{" "}
                            {
                              d.mpns.filter((p) => p.materialId === m.id).length
                            }{" "}
                            MPN
                          </span>
                        </div>
                      </td>
                      <td>
                        <button
                          className="usage-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            openMaterial(m.id);
                            setTab("where");
                          }}
                        >
                          {materialAssemblies(d, m.id).length}
                          <span> 个总成</span>
                        </button>
                      </td>
                      <td>
                        <Badge
                          tone={
                            m.lifecycle === "量产"
                              ? "green"
                              : m.lifecycle === "停产"
                                ? "red"
                                : "amber"
                          }
                        >
                          {m.lifecycle}
                        </Badge>
                      </td>
                      <td>
                        <button
                          className="icon-btn"
                          aria-label={"打开 " + m.number + " 档案"}
                          onClick={() => openMaterial(m.id)}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!display.length && (
                <Empty
                  text="没有找到匹配物料"
                  sub="尝试更换零件号、MPN、制造商或筛选条件。"
                />
              )}
            </div>
            <div className="pagination">
              <span>
                显示 {filtered.length ? (page - 1) * 9 + 1 : 0}–
                {Math.min(page * 9, filtered.length)} 条，共 {filtered.length}{" "}
                颗物料
              </span>
              <div>
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  aria-label="上一页"
                >
                  <ChevronRight className="rotate" size={16} />
                </button>
                <span>
                  {page} / {Math.max(1, Math.ceil(filtered.length / 9))}
                </span>
                <button
                  disabled={page * 9 >= filtered.length}
                  onClick={() => setPage(page + 1)}
                  aria-label="下一页"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </section>
          {sidePanel()}
        </div>
        <div className="bottom-note">
          <ShieldCheck size={16} />
          <span>内部零件号保持唯一 · 替代器件独立审批 · 制造来源可追溯</span>
          <button onClick={() => setHelp(true)}>
            了解数据关系 <ArrowUpRight size={13} />
          </button>
        </div>
      </>
    );
  }
  function mpnCards(m: Material) {
    const items = d.mpns.filter((p) => p.materialId === m.id);
    return (
      <>
        <div className="section-toolbar">
          <div>
            <h3>制造商器件与替代关系</h3>
            <p>多个 MPN 对应同一内部零件号；只有通过验证的器件才应批准使用。</p>
          </div>
          <Btn
            small
            primary
            onClick={() =>
              create("mpn", "添加制造商器件", { materialId: m.id })
            }
          >
            <Plus size={15} />
            添加 MPN
          </Btn>
        </div>
        <div className="notice">
          <ShieldCheck size={17} />
          候选关系不代表直接互换，需完成电气、机械、固件和可靠性验证。
        </div>
        {items.length ? (
          items.map((p) => (
            <div className="mpn-card" key={p.id}>
              <div className="mpn-card-heading">
                <div className="maker-mark big">
                  {p.manufacturer.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="mono">{p.mpn}</h3>
                  <p>{p.manufacturer}</p>
                </div>
                <Badge
                  tone={
                    p.approval === "已批准"
                      ? "green"
                      : p.approval === "已拒绝"
                        ? "red"
                        : "amber"
                  }
                >
                  {p.approval}
                </Badge>
                <Btn
                  small
                  onClick={() => edit("mpn", "编辑器件 / 审批状态", p)}
                >
                  编辑 / 审批
                </Btn>
              </div>
              <div className="mpn-meta">
                <span>
                  器件状态 <b>{p.lifecycle}</b>
                </span>
                <span>
                  制造来源{" "}
                  <b>
                    {d.mpnSites.filter((s) => s.mpnId === p.id).length} 条记录
                  </b>
                </span>
                {p.datasheet ? (
                  <a href={p.datasheet} target="_blank" rel="noreferrer">
                    数据手册 <ExternalLink size={13} />
                  </a>
                ) : (
                  <span>
                    数据手册 <b>待补充</b>
                  </span>
                )}
              </div>
              {p.notes && <p className="notes">{p.notes}</p>}
            </div>
          ))
        ) : (
          <Empty text="尚未添加 MPN" />
        )}
      </>
    );
  }
  function supplyFor(m: Material) {
    const mp = d.mpns.filter((p) => p.materialId === m.id);
    const stages =
      m.category === "PCB"
        ? ["PCB 制造"]
        : ["电阻", "电容", "电感"].includes(m.category)
          ? ["无源器件制造", "封装", "测试"]
          : ["连接器", "晶振"].includes(m.category)
            ? ["器件制造", "封装", "测试"]
            : ["晶圆制造", "封装", "测试"];
    return (
      <>
        <div className="section-toolbar">
          <div>
            <h3>制造供应链</h3>
            <p>按 MPN 记录制造阶段、工厂、地理位置和信息来源。</p>
          </div>
          <Btn
            small
            onClick={() =>
              create("mpnSite", "关联制造工厂", {
                mpnId: mp[0]?.id || "",
                stage: stages[0],
              })
            }
          >
            <Plus size={15} />
            关联工厂
          </Btn>
        </div>
        {mp.map((p) => (
          <div className="supply-chain" key={p.id}>
            <div className="supply-chain-top">
              <span className="mono">{p.mpn}</span>
              <span>{p.manufacturer}</span>
            </div>
            <div className={"chain-steps stages-" + stages.length}>
              {stages.map((stage, i) => {
                const ss = d.mpnSites.filter(
                  (s) =>
                    s.mpnId === p.id &&
                    (s.stage === stage ||
                      (["封装", "测试"].includes(stage) &&
                        s.stage === "封装测试")),
                );
                return (
                  <div className="chain-step" key={stage}>
                    <div className="stage-label">
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      {stage}
                      <ArrowRight size={16} />
                    </div>
                    {ss.length ? (
                      ss.map((link) => {
                        const s = d.sites.find((s) => s.id === link.siteId);
                        return (
                          <div className="factory-card" key={link.id}>
                            <Factory size={22} />
                            <strong>{s?.name}</strong>
                            <span>{s?.operator}</span>
                            <p>
                              <MapPin size={13} />
                              {s?.country} · {s?.city}
                            </p>
                            <small>来源：{link.source}</small>
                            <small>核验：{link.verifiedAt || "待核验"}</small>
                            <button
                              className="text-btn"
                              onClick={() => remove("mpnSite", link.id)}
                            >
                              移除关联
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="unknown-site">
                        <span>制造地待补充</span>
                        <small>未记录 ≠ 无供应风险</small>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {d.mpnSites
              .filter(
                (s) =>
                  s.mpnId === p.id &&
                  !stages.includes(s.stage) &&
                  s.stage !== "封装测试",
              )
              .map((s) => (
                <div className="other-stage" key={s.id}>
                  {s.stage} · {d.sites.find((t) => t.id === s.siteId)?.name} ·
                  来源：{s.source}
                  <button
                    className="icon-btn"
                    aria-label="移除制造关联"
                    onClick={() => remove("mpnSite", s.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
          </div>
        ))}
      </>
    );
  }
  function whereUsed(m: Material) {
    const ids = materialAssemblies(d, m.id),
      prods = materialProducts(d, m.id);
    return (
      <>
        <div className="section-toolbar">
          <div>
            <h3>物料应用与影响分析</h3>
            <p>包含直接使用和通过子总成间接使用的产品关系。</p>
          </div>
          <Badge tone="blue">
            {ids.length} 总成 · {prods.length} 产品
          </Badge>
        </div>
        <div className="where-grid">
          <section>
            <h4>
              <CircuitBoard size={17} />
              应用总成
            </h4>
            {ids.map((id) => {
              const a = d.assemblies.find((a) => a.id === id)!;
              const direct = d.bomLines.some(
                (l) =>
                  l.materialId === m.id &&
                  d.boms.find((b) => b.id === l.bomId)?.assemblyId === id,
              );
              return (
                <button
                  className="where-item"
                  key={id}
                  onClick={() => {
                    go("products");
                    setCatalogTab("assemblies");
                    setAssembly(id);
                  }}
                >
                  <span className="assembly-icon">
                    <CircuitBoard size={20} />
                  </span>
                  <div>
                    <strong>{a.name}</strong>
                    <span className="mono">
                      {a.number} · Rev {a.revision}
                    </span>
                  </div>
                  <span className="gray-tag">
                    {direct ? "直接使用" : "间接使用"}
                  </span>
                  <ChevronRight size={16} />
                </button>
              );
            })}
            {!ids.length && <Empty text="尚未加入任何 BOM" />}
          </section>
          <section>
            <h4>
              <Box size={17} />
              关联产品
            </h4>
            {prods.map((id) => {
              const p = d.products.find((p) => p.id === id)!;
              return (
                <button
                  key={id}
                  className="where-item"
                  onClick={() => {
                    go("relations");
                    setProduct(id);
                  }}
                >
                  <span className="assembly-icon blue">
                    <Box size={20} />
                  </span>
                  <div>
                    <strong>{p.name}</strong>
                    <span className="mono">{p.number}</span>
                  </div>
                  <Badge tone="green">{p.status}</Badge>
                  <ChevronRight size={16} />
                </button>
              );
            })}
            {!prods.length && <Empty text="暂无关联产品" />}
          </section>
        </div>
      </>
    );
  }
  function detailView() {
    const m = selectedMat;
    if (!m) return <Empty />;
    return (
      <>
        <button className="back-link" onClick={() => setDetail(false)}>
          <ArrowLeft size={16} />
          返回{titles[view]}
        </button>
        <div className="material-detail panel">
          <div className="detail-top">
            <div className="detail-identity">
              <Chip category={m.category} large />
              <div>
                <div className="tag-row">
                  <span className="mono">{m.number}</span>
                  <Badge tone={m.lifecycle === "量产" ? "green" : "amber"}>
                    {m.lifecycle}
                  </Badge>
                </div>
                <h1>{m.name}</h1>
                <p>
                  {m.category} <span>·</span> {m.package} <span>·</span>{" "}
                  {materialAssemblies(d, m.id).length} 个应用总成
                </p>
              </div>
            </div>
            <Btn onClick={() => edit("material", "编辑物料档案", m)}>
              <SlidersHorizontal size={15} />
              编辑档案
            </Btn>
          </div>
          <div className="detail-tabs">
            {[
              ["overview", "物料概览"],
              [
                "mpns",
                `替代器件 (${d.mpns.filter((p) => p.materialId === m.id).length})`,
              ],
              ["where", "应用与反查"],
              ["supply", "制造供应链"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="detail-content">
            {tab === "overview" ? (
              <div className="overview-grid">
                <div>
                  <div className="section-label">
                    特性参数 <span>SPECIFICATIONS</span>
                  </div>
                  <div className="spec-table">
                    {Object.entries(JSON.parse(m.parameters)).map(([k, v]) => (
                      <div key={k}>
                        <span>{k}</span>
                        <strong>{String(v)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="section-label">物料说明</div>
                  <p className="description">
                    {m.description || "暂无物料说明。"}
                  </p>
                </div>
                <div className="overview-side">
                  <div className="section-label">关联概览</div>
                  <button onClick={() => setTab("mpns")}>
                    <Package size={18} />
                    <span>制造商器件</span>
                    <strong>
                      {d.mpns.filter((p) => p.materialId === m.id).length}
                    </strong>
                    <ChevronRight size={15} />
                  </button>
                  <button onClick={() => setTab("where")}>
                    <CircuitBoard size={18} />
                    <span>应用总成</span>
                    <strong>{materialAssemblies(d, m.id).length}</strong>
                    <ChevronRight size={15} />
                  </button>
                  <button onClick={() => setTab("where")}>
                    <Box size={18} />
                    <span>关联产品</span>
                    <strong>{materialProducts(d, m.id).length}</strong>
                    <ChevronRight size={15} />
                  </button>
                  <div className="data-note">
                    <ShieldCheck size={23} />
                    <h4>一颗物料，一份可信档案</h4>
                    <p>
                      物料规格由内部零件号统一管理；生产厂商、型号与制造地由各
                      MPN 独立维护。
                    </p>
                  </div>
                </div>
              </div>
            ) : tab === "mpns" ? (
              mpnCards(m)
            ) : tab === "where" ? (
              whereUsed(m)
            ) : (
              supplyFor(m)
            )}
          </div>
        </div>
      </>
    );
  }
  function graphView() {
    const p = d.products.find((p) => p.id === product) || d.products[0];
    const direct = d.productAssemblies.filter((r) => r.productId === p?.id);
    const asmIds = new Set(direct.map((r) => r.assemblyId));
    const descend = (id: string) => {
      const bom = d.boms.find(
        (b) => b.assemblyId === id && b.status === "生效",
      );
      for (const l of d.bomLines.filter((l) => l.bomId === bom?.id))
        if (l.childAssemblyId && !asmIds.has(l.childAssemblyId)) {
          asmIds.add(l.childAssemblyId);
          descend(l.childAssemblyId);
        }
    };
    [...asmIds].forEach(descend);
    const asms = d.assemblies.filter((a) => asmIds.has(a.id));
    const a = asms.find((a) => a.id === assembly) || asms[0];
    const matIds = a ? assemblyMaterials(d, a.id) : [];
    const mats = d.materials.filter((m) => matIds.includes(m.id));
    return (
      <>
        <div className="graph-intro">
          <div>
            <span className="eyebrow">CONNECTED BY DESIGN</span>
            <h2>从产品到物料，看见每一层关联。</h2>
            <p>选择一个节点，逐层探索 BOM；共享物料的应用关系同步可见。</p>
          </div>
          <div className="graph-legend">
            <span className="legend-dot" />
            当前路径 <span className="legend-dot pale" />
            关联节点
          </div>
        </div>
        <section className="panel graph-panel">
          <div className="graph-caption">
            <Network size={17} />
            <span>三级关系视图</span>
            <span className="gray-tag">产品 → 总成 → 企业物料</span>
            <span className="caption-right">
              点击物料查看 MPN 与制造链 <ArrowUpRight size={14} />
            </span>
          </div>
          <div className="graph-columns">
            <div className="graph-column">
              <div className="column-heading">
                <span className="step-no">01</span>
                <h3>企业产品</h3>
                <span>{d.products.length}</span>
              </div>
              <div className="nodes">
                {d.products
                  .filter(
                    (pr) =>
                      !query ||
                      pr.name.toLowerCase().includes(query.toLowerCase()) ||
                      pr.number.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((pr) => (
                    <button
                      key={pr.id}
                      className={
                        "node product-node " +
                        (p?.id === pr.id ? "selected" : "")
                      }
                      onClick={() => {
                        setProduct(pr.id);
                        setAssembly(
                          d.productAssemblies.find((r) => r.productId === pr.id)
                            ?.assemblyId || "",
                        );
                      }}
                    >
                      <span className="node-icon">
                        <Box size={22} />
                      </span>
                      <span>
                        <small className="mono">{pr.number}</small>
                        <strong>{pr.name}</strong>
                        <small>{pr.family}</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
              </div>
            </div>
            <div className="graph-connector">
              <svg
                className="graph-svg"
                viewBox="0 0 48 530"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d={`M0 ${
                    85 +
                    Math.max(
                      0,
                      d.products.findIndex((x) => x.id === p?.id),
                    ) *
                      96
                  } C24 ${
                    85 +
                    Math.max(
                      0,
                      d.products.findIndex((x) => x.id === p?.id),
                    ) *
                      96
                  },24 ${
                    85 +
                    Math.max(
                      0,
                      asms.findIndex((x) => x.id === a?.id),
                    ) *
                      96
                  },48 ${
                    85 +
                    Math.max(
                      0,
                      asms.findIndex((x) => x.id === a?.id),
                    ) *
                      96
                  }`}
                  fill="none"
                  stroke="#89ad7f"
                  strokeWidth="1.2"
                />
              </svg>
            </div>
            <div className="graph-column">
              <div className="column-heading">
                <span className="step-no">02</span>
                <h3>PCBA / TLA 总成</h3>
                <span>{asms.length}</span>
              </div>
              <div className="nodes">
                {asms.map((as) => (
                  <button
                    key={as.id}
                    className={"node " + (a?.id === as.id ? "selected" : "")}
                    onClick={() => setAssembly(as.id)}
                  >
                    <span className="node-icon">
                      <CircuitBoard size={22} />
                    </span>
                    <span>
                      <small className="mono">
                        {as.number} · {as.revision}
                      </small>
                      <strong>{as.name}</strong>
                      <small>
                        {direct.some((r) => r.assemblyId === as.id)
                          ? "直接关联"
                          : "子总成 · 间接关联"}{" "}
                        · {assemblyMaterials(d, as.id).length} 颗物料
                      </small>
                    </span>
                    <span className="node-type">{as.type}</span>
                  </button>
                ))}
              </div>
              {!asms.length && <Empty text="产品尚未关联总成" />}
            </div>
            <div className="graph-connector">
              <svg
                className="graph-svg"
                viewBox="0 0 48 530"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {mats.slice(0, 5).map((m, i) => (
                  <path
                    key={m.id}
                    d={`M0 ${
                      85 +
                      Math.max(
                        0,
                        asms.findIndex((x) => x.id === a?.id),
                      ) *
                        96
                    } C24 ${
                      85 +
                      Math.max(
                        0,
                        asms.findIndex((x) => x.id === a?.id),
                      ) *
                        96
                    },24 ${83 + i * 89},48 ${83 + i * 89}`}
                    fill="none"
                    stroke="#a8c29a"
                    strokeWidth="1"
                  />
                ))}
              </svg>
            </div>
            <div className="graph-column">
              <div className="column-heading">
                <span className="step-no">03</span>
                <h3>企业内部物料</h3>
                <span>{mats.length}</span>
              </div>
              <div className="nodes material-nodes">
                {mats.map((m) => (
                  <button
                    key={m.id}
                    className="node material-node"
                    onClick={() => openMaterial(m.id)}
                  >
                    <Chip category={m.category} />
                    <span>
                      <small className="mono">{m.number}</small>
                      <strong>{m.name}</strong>
                      <small>
                        {d.mpns.filter((mp) => mp.materialId === m.id).length}{" "}
                        MPN · {materialProducts(d, m.id).length} 关联产品
                      </small>
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
              {!mats.length && <Empty text="此总成尚无 BOM 物料" />}
            </div>
          </div>
          <div className="graph-bottom">
            <GitBranch size={16} />
            <span>
              {p?.name || "选择产品"} <ChevronRight size={13} />{" "}
              {a?.name || "选择总成"} <ChevronRight size={13} /> {mats.length}{" "}
              颗物料（含子总成用料）
            </span>
            <button
              onClick={() => {
                go("products");
                setCatalogTab("assemblies");
                setAssembly(a?.id || "");
              }}
            >
              查看独立 BOM <ArrowRight size={14} />
            </button>
          </div>
        </section>
        <div className="relation-callout">
          <div className="callout-icon">
            <Link2 size={23} />
          </div>
          <div>
            <h3>同一颗物料，贯穿不同产品</h3>
            <p>
              PCBA 和 TLA 各自维护独立 BOM；共享物料通过企业内部零件号关联，调整
              MPN 时可反查所有受影响产品。
            </p>
          </div>
          <Btn onClick={() => go("materials")}>
            浏览共享物料 <ArrowRight size={15} />
          </Btn>
        </div>
      </>
    );
  }
  function bomTable(a: Assembly) {
    return (
      <BomWorkbench
        key={a.id}
        d={d}
        assembly={a}
        demo={demo}
        onAdd={(bomId) => create("bomLine", "添加 BOM 行", { bomId })}
        onEdit={(l) => edit("bomLine", "编辑 BOM 行", l)}
        onRemove={(id) => remove("bomLine", id)}
        onMaterial={openMaterial}
        onCalculate={() => {
          setMrpInitial({ kind: "assembly", id: a.id });
          go("mrp");
        }}
        onData={(data) => {
          accept(data);
          setToast("BOM 已批量保存");
        }}
        onExport={exportCsv}
      />
    );
  }
  function productsView() {
    const p = d.products.find((p) => p.id === product) || d.products[0],
      a = d.assemblies.find((a) => a.id === assembly) || d.assemblies[0];
    const isProduct = catalogTab === "products";
    return (
      <>
        <div className="catalog-tabs">
          <button
            className={isProduct ? "active" : ""}
            onClick={() => setCatalogTab("products")}
          >
            <Box size={17} />
            企业产品 <span>{d.products.length}</span>
          </button>
          <button
            className={!isProduct ? "active" : ""}
            onClick={() => setCatalogTab("assemblies")}
          >
            <CircuitBoard size={17} />
            PCBA / TLA 总成 <span>{d.assemblies.length}</span>
          </button>
          <div />
          <Btn
            small
            onClick={() =>
              create(
                isProduct ? "product" : "assembly",
                isProduct ? "新建企业产品" : "新建 PCBA / TLA 总成",
              )
            }
          >
            <Plus size={15} />
            新建{isProduct ? "产品" : "总成"}
          </Btn>
        </div>
        <div className="catalog-layout">
          <section className="panel catalog-list">
            {(isProduct ? d.products : d.assemblies)
              .filter((x) =>
                (x.name + " " + x.number)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((item) => (
                <button
                  key={item.id}
                  className={
                    "catalog-item " +
                    ((isProduct ? p?.id : a?.id) === item.id ? "active" : "")
                  }
                  onClick={() =>
                    isProduct ? setProduct(item.id) : setAssembly(item.id)
                  }
                >
                  <div className="assembly-icon">
                    {isProduct ? <Box size={21} /> : <CircuitBoard size={21} />}
                  </div>
                  <div>
                    <strong>{item.name}</strong>
                    <span className="mono">{item.number}</span>
                  </div>
                  <ChevronRight size={15} />
                </button>
              ))}
            {!(isProduct ? d.products : d.assemblies).length && (
              <Empty text="尚无记录" />
            )}
          </section>
          <section className="panel catalog-detail">
            {isProduct ? (
              p ? (
                <>
                  <div className="catalog-header">
                    <div>
                      <span className="eyebrow">
                        {p.number} / {p.family}
                      </span>
                      <h2>{p.name}</h2>
                      <Badge>{p.status}</Badge>
                    </div>
                    <div className="button-group">
                      <Btn
                        small
                        onClick={() => {
                          setMrpInitial({ kind: "product", id: p.id });
                          go("mrp");
                        }}
                      >
                        <Calculator size={14} />
                        整机 MRP
                      </Btn>
                      <Btn small onClick={() => edit("product", "编辑产品", p)}>
                        编辑产品
                      </Btn>
                    </div>
                  </div>
                  <div className="section-toolbar">
                    <div>
                      <h3>关联总成</h3>
                      <p>同一总成可以复用于多个产品。</p>
                    </div>
                    <Btn
                      primary
                      small
                      onClick={() =>
                        create("productAssembly", "关联产品与总成", {
                          productId: p.id,
                        })
                      }
                    >
                      <Link2 size={15} />
                      关联总成
                    </Btn>
                  </div>
                  {d.productAssemblies
                    .filter((r) => r.productId === p.id)
                    .map((r) => {
                      const a = d.assemblies.find((a) => a.id === r.assemblyId);
                      return (
                        <div className="linked-assembly" key={r.id}>
                          <div className="assembly-icon">
                            <CircuitBoard size={23} />
                          </div>
                          <button
                            className="linked-name"
                            onClick={() => {
                              setCatalogTab("assemblies");
                              setAssembly(r.assemblyId);
                            }}
                          >
                            <strong>{a?.name}</strong>
                            <span className="mono">
                              {a?.number} · Rev {a?.revision}
                            </span>
                          </button>
                          <span className="gray-tag">{a?.type}</span>
                          <span>
                            用量 <b className="mono">{r.quantity}</b>
                          </span>
                          <button
                            className="icon-btn danger"
                            aria-label="移除产品总成关联"
                            onClick={() => remove("productAssembly", r.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  {!d.productAssemblies.some((r) => r.productId === p.id) && (
                    <Empty text="尚未关联总成" />
                  )}
                </>
              ) : (
                <Empty text="请先新建产品" />
              )
            ) : a ? (
              <>
                <div className="catalog-header">
                  <div>
                    <span className="eyebrow">
                      {a.number} / {a.type}
                    </span>
                    <h2>{a.name}</h2>
                    <span className="gray-tag">Rev {a.revision}</span>
                  </div>
                  <Btn
                    small
                    onClick={() => edit("assembly", "编辑总成基本信息", a)}
                  >
                    编辑总成
                  </Btn>
                </div>
                {bomTable(a)}
              </>
            ) : (
              <Empty text="请先新建总成" />
            )}
          </section>
        </div>
      </>
    );
  }
  function supplyView() {
    const linked = new Set(d.mpnSites.map((s) => s.mpnId));
    return (
      <>
        <div className="supply-stats">
          <div>
            <Factory size={21} />
            <span>
              <strong>{d.sites.length}</strong> 制造工厂
            </span>
          </div>
          <div>
            <Globe2 size={21} />
            <span>
              <strong>{new Set(d.sites.map((s) => s.country)).size}</strong>{" "}
              个国家 / 地区
            </span>
          </div>
          <div>
            <Link2 size={21} />
            <span>
              <strong>
                {linked.size} / {d.mpns.length}
              </strong>{" "}
              MPN 已记录制造来源
            </span>
          </div>
        </div>
        <div className="section-toolbar">
          <div>
            <h2>制造工厂名录</h2>
            <p>晶圆前道到封装测试后道，保留每一条来源依据。</p>
          </div>
          <div className="button-group">
            <Btn onClick={() => create("mpnSite", "关联 MPN 与工厂")}>
              <Link2 size={16} />
              关联 MPN
            </Btn>
            <Btn primary onClick={() => create("site", "新增制造工厂")}>
              <Plus size={16} />
              新增工厂
            </Btn>
          </div>
        </div>
        <div className="supply-view-tabs segmented">
          <button
            className={supplyMode === "map" ? "active" : ""}
            onClick={() => setSupplyMode("map")}
          >
            <MapPin size={14} />
            地图视图
          </button>
          <button
            className={supplyMode === "list" ? "active" : ""}
            onClick={() => setSupplyMode("list")}
          >
            <Factory size={14} />
            工厂名录
          </button>
        </div>
        {supplyMode === "map" && (
          <SupplyMap
            d={d}
            query={query}
            onEdit={(s) => edit("site", "编辑制造工厂与定位", s)}
            onLink={(s, stage) =>
              create("mpnSite", "为工厂关联多个 MPN", { siteId: s.id, stage })
            }
          />
        )}
        {supplyMode === "list" && (
          <div className="site-grid">
            {d.sites
              .filter((s) =>
                (s.name + s.operator + s.country + s.city)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((s) => (
                <article key={s.id} className="panel site-card">
                  <div className="site-top">
                    <div className="factory-icon">
                      <Factory size={25} />
                    </div>
                    <span className="gray-tag">{s.country}</span>
                  </div>
                  <h3>{s.name}</h3>
                  <p>{s.operator}</p>
                  <div className="site-location">
                    <MapPin size={14} />
                    {s.country} · {s.city}
                  </div>
                  <div className="site-bottom">
                    <span>
                      {
                        new Set(
                          d.mpnSites
                            .filter((l) => l.siteId === s.id)
                            .map((l) => l.mpnId),
                        ).size
                      }{" "}
                      个关联 MPN
                    </span>
                    <div className="button-group">
                      <button
                        onClick={() =>
                          create("mpnSite", "为工厂关联多个 MPN", {
                            siteId: s.id,
                          })
                        }
                      >
                        关联 MPN <Link2 size={12} />
                      </button>
                      <button onClick={() => edit("site", "编辑制造工厂", s)}>
                        编辑 <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
          </div>
        )}
        <section className="panel supply-records">
          <div className="panel-heading">
            <div>
              <h2>制造来源记录</h2>
              <p>
                未知制造地需继续向原厂核验；不得从总部或销售地推断实际产地。
              </p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>MPN / 制造商</th>
                  <th>制造阶段</th>
                  <th>工厂 / 制造地</th>
                  <th>信息来源</th>
                  <th>核验日期</th>
                </tr>
              </thead>
              <tbody>
                {d.mpnSites
                  .filter((l) => {
                    const m = d.mpns.find((m) => m.id === l.mpnId),
                      s = d.sites.find((s) => s.id === l.siteId);
                    return [
                      m?.mpn,
                      m?.manufacturer,
                      s?.name,
                      s?.operator,
                      s?.country,
                      s?.city,
                      l.stage,
                      l.source,
                    ]
                      .join(" ")
                      .toLowerCase()
                      .includes(query.toLowerCase());
                  })
                  .map((l) => {
                    const m = d.mpns.find((m) => m.id === l.mpnId),
                      s = d.sites.find((s) => s.id === l.siteId);
                    return (
                      <tr key={l.id}>
                        <td>
                          <button
                            className="table-text-link"
                            onClick={() => {
                              openMaterial(m!.materialId);
                              setTab("supply");
                            }}
                          >
                            <strong className="mono">{m?.mpn}</strong>
                            <small>{m?.manufacturer}</small>
                          </button>
                        </td>
                        <td>
                          <span className="gray-tag">{l.stage}</span>
                        </td>
                        <td>
                          <strong>{s?.name}</strong>
                          <small>
                            {s?.country} · {s?.city}
                          </small>
                        </td>
                        <td className="source-cell">{l.source}</td>
                        <td>
                          {l.verifiedAt || (
                            <span className="amber-text">待核验</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {!d.mpnSites.length && <Empty text="暂无制造来源记录" />}
        </section>
      </>
    );
  }
  function activityView() {
    return (
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>工作区变更记录</h2>
            <p>记录新增、编辑和关联移除操作，便于追溯数据维护。</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>操作</th>
                <th>对象</th>
                <th>维护人员</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {[...d.auditLogs]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Badge tone="blue">{a.action}</Badge>
                    </td>
                    <td>{a.entity}</td>
                    <td>{a.actor}</td>
                    <td>
                      {new Date(a.createdAt).toLocaleString("zh-CN", {
                        timeZone: "Asia/Shanghai",
                      })}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!d.auditLogs.length && (
          <Empty text="暂无变更记录" sub="保存数据后，操作记录会显示在这里。" />
        )}
      </section>
    );
  }
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <a className="brand" href="/" aria-label="芯链工作台">
          <span className="brand-icon">
            <CircuitBoard size={25} />
          </span>
          <span>
            <strong>
              芯链<span>CoreLink</span>
            </strong>
            <small>企业电子物料管理平台</small>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-letter">EE</span>
          <div>
            <strong>企业研发工作区</strong>
            <small>EE Management</small>
          </div>
          <ShieldCheck size={15} />
        </div>
        <div className="nav-label">
          物料管理 <span>WORKSPACE</span>
        </div>
        <nav>
          {navs.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === "materials" ? (
                <span className="nav-count">{d.materials.length}</span>
              ) : n.id === "relations" ? (
                <span className="new-dot" />
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="nav-label">协作与维护</div>
        <nav>
          <button
            className={view === "activity" ? "active" : ""}
            onClick={() => go("activity")}
          >
            <Activity size={18} />
            <span>变更记录</span>
          </button>
          <button
            className={view === "numbering" ? "active" : ""}
            onClick={() => go("numbering")}
          >
            <Hash size={18} />
            <span>内部编码规则</span>
          </button>
          <button onClick={() => setHelp(true)}>
            <BookOpen size={18} />
            <span>使用指南</span>
            <ArrowUpRight size={13} />
          </button>
        </nav>
        <div className="sidebar-card">
          <div className="sidebar-card-icon">
            <Network size={25} />
          </div>
          <h4>每一颗物料，清晰相连</h4>
          <p>从产品到总成，从器件到工厂，让数据真正流动起来。</p>
          <button onClick={() => go("relations")}>
            探索关系图谱 <ArrowRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className="user-avatar">{user.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{user.includes("@") ? user.split("@")[0] : user}</strong>
            <small>工作区成员</small>
          </div>
          <a
            href="/signout-with-chatgpt?return_to=/"
            target="_top"
            title="退出登录"
          >
            <LogOut size={16} />
          </a>
        </div>
        <div className="sidebar-version">
          <span className="status-dot" />
          CoreLink 工作台 <span>v2.0</span>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="关闭菜单"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            aria-label="打开菜单"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span>工作空间</span>
            <ChevronRight size={13} />
            <strong>{titles[view]}</strong>
            {detail && (
              <>
                <ChevronRight size={13} />
                <span>{selectedMat?.number}</span>
              </>
            )}
          </div>
          <div className="global-search">
            <Search size={16} />
            <input
              id="global-search"
              aria-label="全局搜索"
              placeholder={
                view === "materials"
                  ? "搜索零件号、MPN、制造商…"
                  : "搜索当前视图…"
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (detail) {
                  setDetail(false);
                  setView("materials");
                }
              }}
            />
            <kbd>⌘ K</kbd>
          </div>
          <button
            className="help-btn"
            aria-label="使用帮助"
            onClick={() => setHelp(true)}
          >
            ?
          </button>
          <div className="top-avatar">{user.slice(0, 1).toUpperCase()}</div>
        </header>
        <main className="main-content">
          {!detail && (
            <div className="page-heading">
              <div>
                <div className="heading-top">
                  <span className="eyebrow">ENGINEERING WORKSPACE</span>
                  <span className="heading-line" />
                </div>
                <h1>
                  {titles[view]}
                  <span className="heading-dot">.</span>
                </h1>
                <p>
                  {view === "materials"
                    ? "统一管理企业物料，让选型、替代与追溯有据可循。"
                    : view === "relations"
                      ? "跨越产品、总成与物料，沿关联发现影响范围。"
                      : view === "products"
                        ? "维护产品结构与独立 BOM，让共享总成高效复用。"
                        : view === "supply"
                          ? "连接器件与制造现场，掌握供应链的每一站。"
                          : view === "mrp"
                            ? "从多产品需求到逐级用量，按内部零件号精确汇总。"
                            : view === "numbering"
                              ? "统一产品、PCBA / TLA 与电子物料的企业内部零件号。"
                              : "每一次维护，都有记录。"}
                </p>
              </div>
              {view === "materials" ? (
                <div className="button-group">
                  <Btn onClick={exportMaterials}>
                    <Download size={16} />
                    导出清单
                  </Btn>
                  <Btn
                    primary
                    onClick={() => create("material", "新建企业物料")}
                  >
                    <Plus size={17} />
                    新建物料
                  </Btn>
                </div>
              ) : view === "relations" ? (
                <Btn onClick={() => go("products")}>
                  <Layers size={16} />
                  管理产品结构
                </Btn>
              ) : null}
            </div>
          )}
          {error && (
            <div className="error-banner">
              <AlertTriangle size={17} />
              <span>{error}。当前仅展示示例，请检查连接后刷新。</span>
              <button onClick={() => window.location.reload()}>
                <RefreshCw size={15} />
                刷新
              </button>
            </div>
          )}
          {demo && (
            <div className="demo-banner">
              <span className="demo-symbol">
                <Database size={14} />
              </span>
              <span>
                <b>{loading ? "正在连接工作区" : "示例工作区"}</b>{" "}
                <span className="demo-copy">
                  当前数据仅用于功能演示，器件兼容性与工厂信息未经核验。
                </span>
              </span>
              <button disabled={loading || busy || !!error} onClick={seed}>
                {busy ? "正在载入…" : "载入示例数据"}
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          {detail ? (
            detailView()
          ) : view === "materials" ? (
            materialsView()
          ) : view === "relations" ? (
            graphView()
          ) : view === "products" ? (
            productsView()
          ) : view === "supply" ? (
            supplyView()
          ) : view === "numbering" ? (
            <NumberingSettings
              d={d}
              onData={(data) => {
                setD((current) => ({
                  ...current,
                  numberingRules: data.numberingRules,
                }));
              }}
            />
          ) : view === "mrp" ? null : (
            activityView()
          )}
          {view === "mrp" && (
            <div style={{ display: detail ? "none" : undefined }}>
              <MrpPlanner
                query={query}
                key={(mrpInitial?.kind || "product") + (mrpInitial?.id || "")}
                d={d}
                initial={mrpInitial}
                onMaterial={openMaterial}
                onExport={exportCsv}
              />
            </div>
          )}
          <footer className="app-footer">
            <span>
              芯链 CORELINK <span>把复杂的物料关系，变得清晰。</span>
            </span>
            <span>
              <span className="status-dot" />
              {error
                ? "连接异常"
                : loading
                  ? "正在连接"
                  : demo
                    ? "示例浏览模式"
                    : "工作区已连接"}
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button aria-label="关闭提示" onClick={() => setToast("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {modal?.kind === "mpnSite" ? (
        <MpnSiteDialog
          key={
            String(modal.initial?.siteId || "") +
            String(modal.initial?.mpnId || "")
          }
          d={d}
          initial={modal.initial}
          demo={demo}
          onClose={() => setModal(null)}
          onSaved={(data, summary) => {
            accept(data);
            setModal(null);
            setToast(
              `已关联 ${summary.added} 个 MPN${summary.skipped ? `，${summary.skipped} 个已有关系已跳过` : ""}`,
            );
          }}
        />
      ) : modal ? (
        <RecordModal
          key={modal.kind + (modal.id || "new")}
          modal={modal}
          d={d}
          demo={demo}
          onClose={() => setModal(null)}
          onSave={save}
          onRemove={confirmRemove}
        />
      ) : null}{" "}
      {help && (
        <div className="modal-overlay" onClick={() => setHelp(false)}>
          <section
            className="modal help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">GETTING STARTED</span>
                <h2 id="help-title">从关系出发，管理物料</h2>
              </div>
              <button
                className="icon-btn"
                aria-label="关闭指南"
                onClick={() => setHelp(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="help-flow">
              <Box />
              <ChevronRight />
              <CircuitBoard />
              <ChevronRight />
              <Component />
              <ChevronRight />
              <Package />
            </div>
            <p>
              <b>产品 → PCBA / TLA → 企业物料 → MPN</b>
            </p>
            <p>
              每个内部零件号对应一类物料和多颗候选器件。已批准 MPN
              才计入可用来源；替代兼容性必须通过工程验证。
            </p>
            <p>
              在「产品与总成」建立产品、总成及 BOM。TLA
              可包含多级子总成，系统会阻止循环引用。点击「关系图谱」逐层下钻，物料档案中的「应用与反查」会包含间接使用关系。
            </p>
            <p>
              在「产品与总成」查看可折叠的多层
              BOM，逐行维护单级用量、单位和损耗加成。大批量用料可通过 CSV
              预检后整体追加，错误不会留下半份 BOM。在「MRP
              用量计算」输入多个产品 /
              总成需求，系统逐级累乘并按内部零件号汇总；库存仅扣一次。
            </p>
            <p>
              制造工厂按 MPN
              关联，支持多个前道和后道来源。地图可按制造阶段筛选，并通过城市检索或手动标点维护
              WGS84
              坐标。城市中心和实际厂区坐标必须分别标识。记录出处和核验日期，未记录的制造地会显示待补充。
            </p>
            <p>
              企业产品、PCBA / TLA 和电子物料都使用企业内部零件号，例如
              1234567-00-A。后两段含义与 BOM
              版本独立；留空可按编码规则自动分配。已有历史编号可保留。
            </p>
            <div className="notice">
              <Database size={18} />
              首次进入可浏览示例；点击「载入示例数据」可保存并编辑。新建真实物料会直接建立独立工作区。保存后的记录跨设备保留。
            </div>
            <p className="muted">
              当前工作区通过 Sites
              私有访问保护。多人访问需要配置工作区访问权限；本版按工作区成员统一授权。
            </p>
            <Btn primary onClick={() => setHelp(false)}>
              开始使用 <ArrowRight size={15} />
            </Btn>
          </section>
        </div>
      )}
    </div>
  );
}
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  value?: string;
  hint?: string;
  optional?: boolean;
  wide?: boolean;
};
function RecordModal({
  modal,
  d,
  demo,
  onClose,
  onSave,
  onRemove,
}: {
  modal: NonNullable<Modal>;
  d: Workspace;
  demo: boolean;
  onClose: () => void;
  onSave: (r: Record<string, unknown>) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false),
    [err, setErr] = useState(""),
    [itemType, setItemType] = useState(
      modal.initial?.childAssemblyId ? "assembly" : "material",
    );
  const opts = (arr: string[]) => arr.map((s) => ({ value: s, label: s }));
  const mats = d.materials.map((m) => ({
    value: m.id,
    label: m.number + " · " + m.name,
  }));
  const asms = d.assemblies.map((a) => ({
    value: a.id,
    label: a.number + " · " + a.name,
  }));
  const prods = d.products.map((p) => ({
    value: p.id,
    label: p.number + " · " + p.name,
  }));
  const base: Record<string, Field[]> = {
    material: [
      {
        key: "number",
        label: "企业内部零件号",
        value: "",
        optional: !modal.id,
        hint: "留空自动编号，例如 1234567-00-A",
      },
      { key: "name", label: "物料名称" },
      {
        key: "unit",
        label: "基本单位",
        options: opts(["pcs", "m", "g", "kg", "L", "set"]),
      },
      { key: "category", label: "物料分类", options: opts(allCategories) },
      {
        key: "package",
        label: "封装 / 规格",
        hint: "例如 LQFP-64、0603、六层 PCB",
      },
      {
        key: "lifecycle",
        label: "生命周期",
        options: opts(["量产", "评估中", "不推荐新设计", "停产"]),
      },
      {
        key: "description",
        label: "物料说明",
        type: "textarea",
        optional: true,
        wide: true,
      },
      {
        key: "parameters",
        label: "特性参数",
        type: "textarea",
        optional: true,
        wide: true,
        hint: "每行一项，例如：工作电压 = 3.3 V\n封装 = LQFP-64",
      },
    ],
    mpn: [
      { key: "materialId", label: "对应企业物料", options: mats, wide: true },
      { key: "manufacturer", label: "生产厂商" },
      { key: "mpn", label: "制造商型号 MPN" },
      {
        key: "approval",
        label: "替代审批状态",
        options: opts(["待验证", "已批准", "已拒绝"]),
      },
      {
        key: "lifecycle",
        label: "器件生命周期",
        options: opts(["在产", "NRND", "停产"]),
      },
      {
        key: "datasheet",
        label: "数据手册链接",
        type: "url",
        optional: true,
        wide: true,
        hint: "https://…",
      },
      {
        key: "notes",
        label: "验证结论 / 说明",
        type: "textarea",
        optional: true,
        wide: true,
      },
    ],
    product: [
      {
        key: "number",
        label: "企业内部零件号",
        optional: !modal.id,
        hint: "留空自动分配，例如 1234567-00-A",
      },
      { key: "name", label: "产品名称" },
      { key: "family", label: "产品系列" },
      {
        key: "status",
        label: "生命周期",
        options: opts(["研发", "试产", "量产", "停产"]),
      },
    ],
    assembly: [
      {
        key: "number",
        label: "企业内部零件号",
        optional: !modal.id,
        hint: "留空自动分配，例如 1234567-00-A",
      },
      { key: "name", label: "总成名称" },
      { key: "type", label: "总成类型", options: opts(["PCBA", "TLA"]) },
      {
        key: "revision",
        label: "初始 BOM 版本",
        value: "A.0",
        hint: modal.id ? "当前版本保持不变" : "将同步创建独立 BOM",
      },
    ],
    productAssembly: [
      { key: "productId", label: "企业产品", options: prods, wide: true },
      { key: "assemblyId", label: "关联总成", options: asms, wide: true },
      { key: "quantity", label: "单产品用量", type: "number", value: "1" },
    ],
    bomLine: [
      {
        key: itemType === "material" ? "materialId" : "childAssemblyId",
        label: itemType === "material" ? "企业内部物料" : "子总成",
        options: itemType === "material" ? mats : asms,
        wide: true,
      },
      {
        key: "quantity",
        label: "单级用量（每个父级）",
        type: "number",
        value: "1",
      },
      { key: "scrapRate", label: "损耗加成 %", type: "number", value: "0" },
      {
        key: "references",
        label: "参考位号",
        optional: true,
        hint: "例如 R1, R2 / U1",
      },
      {
        key: "notes",
        label: "行项目说明",
        type: "textarea",
        optional: true,
        wide: true,
      },
    ],
    site: [
      { key: "name", label: "工厂 / 厂区名称", wide: true },
      { key: "operator", label: "运营法人 / 制造商", wide: true },
    ],
  };
  const fields = base[modal.kind] || [];
  const blocked =
    demo && ["mpn", "productAssembly", "bomLine"].includes(modal.kind);
  function value(field: Field) {
    const v = modal.initial?.[field.key] ?? field.value ?? "";
    if (field.key === "parameters" && v) {
      try {
        return Object.entries(JSON.parse(String(v)))
          .map(([k, v]) => k + " = " + v)
          .join("\n");
      } catch {
        return "";
      }
    }
    return String(v);
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      if (modal.kind === "remove") await onRemove();
      else {
        const fd = new FormData(e.currentTarget);
        const data: Record<string, unknown> = {};
        for (const f of fields)
          data[f.key] = String(fd.get(f.key) ?? "").trim();
        if (modal.kind === "site") {
          for (const key of [
            "country",
            "city",
            "address",
            "locationPrecision",
            "locationSource",
          ])
            data[key] = String(fd.get(key) || "");
          for (const key of ["latitude", "longitude"])
            data[key] =
              String(fd.get(key) || "") === "" ? null : Number(fd.get(key));
        }
        if (modal.kind === "material") {
          const pairs = String(data.parameters)
            .split("\n")
            .filter((s) => s.trim())
            .map((s) => {
              const idx = s.search(/[=:：＝]/);
              if (idx < 1) throw new Error("参数每行需使用「参数名 = 值」格式");
              return [s.slice(0, idx).trim(), s.slice(idx + 1).trim()];
            });
          data.parameters = JSON.stringify(Object.fromEntries(pairs));
        }
        if (modal.kind === "bomLine") {
          data.bomId = modal.initial?.bomId;
          data.materialId = itemType === "material" ? data.materialId : null;
          data.childAssemblyId =
            itemType === "assembly" ? data.childAssemblyId : null;
        }
        if (modal.kind === "assembly" && modal.id)
          data.revision = modal.initial?.revision;
        await onSave(data);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">WORKSPACE RECORD</span>
            <h2 id="modal-title">{modal.title}</h2>
          </div>
          <button
            className="icon-btn"
            aria-label="关闭对话框"
            disabled={saving}
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <form onSubmit={submit}>
          {modal.kind === "remove" ? (
            <p className="description">
              仅移除当前关联，物料、MPN、产品和总成档案会保留。
            </p>
          ) : (
            <>
              {blocked && (
                <div className="notice amber">
                  <AlertTriangle size={17} />
                  请先关闭窗口并「载入示例数据」，再维护示例中的关联。
                </div>
              )}
              {demo && !blocked && (
                <div className="notice">
                  <Database size={17} />
                  保存后将创建真实工作区；当前浏览的示例不会导入。
                </div>
              )}
              {modal.kind === "bomLine" && (
                <div className="catalog-tabs modal-type">
                  <button
                    type="button"
                    className={itemType === "material" ? "active" : ""}
                    onClick={() => setItemType("material")}
                  >
                    企业物料
                  </button>
                  <button
                    type="button"
                    className={itemType === "assembly" ? "active" : ""}
                    onClick={() => setItemType("assembly")}
                  >
                    子总成
                  </button>
                </div>
              )}
              <div className="form-grid">
                {fields.map((f) => (
                  <label key={f.key} className={f.wide ? "wide" : ""}>
                    <span>
                      {f.label}
                      {!f.optional && <b> *</b>}
                    </span>
                    {f.options ? (
                      <select
                        name={f.key}
                        required={!f.optional}
                        defaultValue={value(f) || f.options[0]?.value}
                      >
                        <option value="" disabled>
                          请选择
                        </option>
                        {f.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : f.type === "textarea" ? (
                      <textarea
                        name={f.key}
                        defaultValue={value(f)}
                        required={!f.optional}
                        placeholder={f.hint}
                        rows={f.key === "parameters" ? 5 : 3}
                        maxLength={f.key === "parameters" ? 10000 : 3000}
                      />
                    ) : (
                      <input
                        name={f.key}
                        defaultValue={value(f)}
                        type={f.type || "text"}
                        required={!f.optional}
                        readOnly={f.key === "revision" && !!modal.id}
                        placeholder={f.hint}
                        maxLength={200}
                        min={
                          f.type === "number"
                            ? f.key === "scrapRate"
                              ? "0"
                              : "0.000001"
                            : undefined
                        }
                        max={
                          f.key === "scrapRate"
                            ? "100"
                            : f.type === "number"
                              ? "1000000"
                              : undefined
                        }
                        step={f.type === "number" ? "any" : undefined}
                      />
                    )}
                  </label>
                ))}
              </div>
              {modal.kind === "site" && (
                <LocationFields initial={modal.initial} />
              )}
            </>
          )}
          {err && (
            <div className="form-error" role="alert">
              <AlertTriangle size={16} />
              {err}
            </div>
          )}
          <div className="modal-footer">
            <span>* 为必填字段</span>
            <Btn disabled={saving} onClick={onClose}>
              取消
            </Btn>
            <Btn primary type="submit" disabled={saving || blocked}>
              {saving
                ? "正在保存…"
                : modal.kind === "remove"
                  ? "确认移除"
                  : "保存记录"}
              {!saving && <Check size={16} />}
            </Btn>
          </div>
        </form>
      </section>
    </div>
  );
}
