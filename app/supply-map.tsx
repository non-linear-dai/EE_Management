"use client";
import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Factory,
  LocateFixed,
  AlertTriangle,
  Search,
} from "lucide-react";
import type * as Leaflet from "leaflet";
import type { Site, Workspace } from "@/lib/ee/types";
export function hasCoordinates(s: Site) {
  return (
    s.latitude !== null &&
    s.longitude !== null &&
    Number.isFinite(s.latitude) &&
    Number.isFinite(s.longitude)
  );
}
export function FactoryMap({
  sites,
  selectedId,
  onSelect,
  onPick,
  compact = false,
}: {
  sites: Site[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onPick?: (lat: number, lng: number) => void;
  compact?: boolean;
}) {
  const fitted = useRef(false);
  const el = useRef<HTMLDivElement>(null),
    map = useRef<Leaflet.Map | null>(null),
    layer = useRef<Leaflet.LayerGroup | null>(null),
    lib = useRef<typeof Leaflet | null>(null),
    callback = useRef({ onSelect, onPick });
  const [ready, setReady] = useState(false),
    [tileFailure, setTileFailure] = useState(false);
  callback.current = { onSelect, onPick };
  useEffect(() => {
    let live = true;
    import("leaflet").then((L) => {
      if (!live || !el.current) return;
      lib.current = L;
      const m = L.map(el.current, {
        scrollWheelZoom: false,
        worldCopyJump: true,
        minZoom: 2,
        maxZoom: 18,
      }).setView([24, 110], 3);
      map.current = m;
      layer.current = L.layerGroup().addTo(m);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      })
        .on("tileerror", () => setTileFailure(true))
        .addTo(m);
      m.on("click", (e: Leaflet.LeafletMouseEvent) =>
        callback.current.onPick?.(e.latlng.lat, e.latlng.lng),
      );
      setReady(true);
    });
    return () => {
      live = false;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);
  useEffect(() => {
    const L = lib.current,
      m = map.current,
      g = layer.current;
    if (!ready || !L || !m || !g) return;
    g.clearLayers();
    const located = sites.filter(hasCoordinates);
    const groups = new Map<string, Site[]>();
    for (const site of located) {
      const key = site.latitude!.toFixed(6) + "," + site.longitude!.toFixed(6);
      const group = groups.get(key) || [];
      group.push(site);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      const s = group.find((x) => x.id === selectedId) || group[0];
      const marker = L.marker([s.latitude!, s.longitude!], {
        title:
          group.length > 1
            ? `${s.city} · ${group.length} 个同位置工厂`
            : s.name + " · " + s.city,
        keyboard: true,
        icon: L.divIcon({
          className:
            "factory-pin " +
            (group.length > 1 ? "cluster " : "") +
            (group.some((x) => x.id === selectedId) ? "selected" : ""),
          html: `<span><b>${group.length > 1 ? group.length : "●"}</b></span>`,
          iconSize: [30, 36],
          iconAnchor: [15, 32],
        }),
      }).addTo(g);
      const content = document.createElement("div");
      content.className = "map-popup";
      const h = document.createElement("strong");
      h.textContent =
        group.length > 1
          ? `${s.city} · ${group.length} 个工厂共用坐标`
          : s.name;
      content.appendChild(h);
      for (const value of [
        s.operator,
        s.country + " · " + s.city,
        s.address,
        s.locationPrecision + " · " + (s.locationSource || "来源待补充"),
      ]) {
        const p = document.createElement("p");
        p.textContent = value;
        content.appendChild(p);
      }
      if (group.length > 1)
        for (const site of group) {
          const choice = document.createElement("button");
          choice.type = "button";
          choice.className = "map-cluster-choice";
          choice.textContent = site.name;
          choice.addEventListener("click", () =>
            callback.current.onSelect?.(site.id),
          );
          content.appendChild(choice);
        }
      marker.bindPopup(content);
      if (group.length === 1)
        marker.on("click", () => callback.current.onSelect?.(s.id));
      if (group.some((x) => x.id === selectedId)) marker.openPopup();
    }
    const active =
      located.find((s) => s.id === selectedId) ||
      (compact ? located[0] : undefined);
    if (compact && onPick && fitted.current) {
      m.invalidateSize();
      return;
    }
    fitted.current = true;
    if (active)
      m.setView([active.latitude!, active.longitude!], compact ? 12 : 7, {
        animate: false,
      });
    else if (located.length)
      m.fitBounds(
        L.latLngBounds(located.map((s) => [s.latitude!, s.longitude!])),
        { padding: [45, 45], maxZoom: 8, animate: false },
      );
    m.invalidateSize();
  }, [sites, selectedId, ready, compact]);
  function fit() {
    const L = lib.current,
      m = map.current;
    if (!L || !m) return;
    const located = sites.filter(hasCoordinates);
    if (located.length)
      m.fitBounds(
        L.latLngBounds(located.map((s) => [s.latitude!, s.longitude!])),
        { padding: [45, 45], maxZoom: 8 },
      );
  }
  return (
    <div className={"factory-map " + (compact ? "compact-map" : "")}>
      <div
        ref={el}
        className="map-canvas"
        role="region"
        aria-label={onPick ? "点击地图选择工厂坐标" : "制造工厂分布地图"}
      />
      <button type="button" className="map-fit btn small" onClick={fit}>
        <LocateFixed size={14} />
        查看全部定位
      </button>
      {tileFailure && (
        <div className="map-warning">
          <AlertTriangle size={13} />
          部分底图加载失败，可查看坐标或切换网络后重试。
        </div>
      )}
      {onPick && (
        <div className="map-pick-note">
          点击地图可设置 WGS84 经纬度，保存前请核验厂区位置。
        </div>
      )}
    </div>
  );
}
export default function SupplyMap({
  d,
  query,
  onEdit,
}: {
  d: Workspace;
  query: string;
  onEdit: (s: Site) => void;
}) {
  const [selected, setSelected] = useState(""),
    [stage, setStage] = useState("全部制造阶段");
  const sites = d.sites.filter(
    (s) =>
      [s.name, s.operator, s.country, s.city, s.address]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (stage === "全部制造阶段" ||
        d.mpnSites.some((l) => l.siteId === s.id && l.stage === stage)),
  );
  const current = sites.find((s) => s.id === selected);
  return (
    <section className="panel supply-map-panel">
      <div className="map-panel-heading">
        <div>
          <h3>
            <MapPin size={17} />
            制造工厂地图
          </h3>
          <p>
            {sites.filter(hasCoordinates).length} 个已定位 ·{" "}
            {sites.filter((s) => !hasCoordinates(s)).length} 个未定位 ·
            城市中心点与实际厂区分别标识
          </p>
        </div>
        <select
          aria-label="地图制造阶段筛选"
          value={stage}
          onChange={(e) => {
            setStage(e.target.value);
            setSelected("");
          }}
        >
          {["全部制造阶段", ...new Set(d.mpnSites.map((l) => l.stage))].map(
            (x) => (
              <option key={x}>{x}</option>
            ),
          )}
        </select>
      </div>
      <div className="map-layout">
        <div className="map-site-list">
          {sites.map((s, i) => (
            <button
              className={"map-site-row " + (selected === s.id ? "active" : "")}
              key={s.id}
              onClick={() => setSelected(s.id)}
            >
              <span className="map-site-index">
                {hasCoordinates(s) ? <MapPin size={15} /> : <span>?</span>}
              </span>
              <div>
                <strong>{s.name}</strong>
                <span>
                  {s.country} · {s.city}
                </span>
                <small>
                  {s.locationPrecision || "未定位"} ·{" "}
                  {
                    new Set(
                      d.mpnSites
                        .filter((l) => l.siteId === s.id)
                        .map((l) => l.mpnId),
                    ).size
                  }{" "}
                  MPN
                </small>
              </div>
            </button>
          ))}
          {!sites.length && (
            <div className="empty">
              <Factory size={24} />
              <p>暂无匹配的制造工厂</p>
            </div>
          )}
        </div>
        <div className="map-main">
          <FactoryMap
            sites={sites}
            selectedId={selected}
            onSelect={setSelected}
          />
          {current && (
            <div className="map-selected">
              <div>
                <strong>{current.name}</strong>
                <span>
                  {current.address || current.country + " · " + current.city}
                </span>
                <small>
                  {hasCoordinates(current)
                    ? `WGS84 ${current.latitude!.toFixed(6)}, ${current.longitude!.toFixed(6)} · ${current.locationPrecision}`
                    : "未录入经纬度，可编辑工厂后通过城市检索或手动标点定位。"}
                </small>
              </div>
              <button className="btn small" onClick={() => onEdit(current)}>
                编辑位置
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="map-attribution-note">
        城市定位数据：
        <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
          GeoNames
        </a>
        （CC BY 4.0）。城市级点位代表城市中心，不代表实际厂址。所有坐标使用
        WGS84。
      </div>
    </section>
  );
}
