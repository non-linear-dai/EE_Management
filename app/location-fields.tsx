"use client";
import { useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { FactoryMap } from "./supply-map";
import type { Site } from "@/lib/ee/types";
type City = [string, string, string, string, number, number, string];
export default function LocationFields({
  initial,
}: {
  initial?: Record<string, unknown>;
}) {
  const [country, setCountry] = useState(String(initial?.country || "")),
    [city, setCity] = useState(String(initial?.city || "")),
    [address, setAddress] = useState(String(initial?.address || "")),
    [lat, setLat] = useState(
      initial?.latitude == null ? "" : String(initial.latitude),
    ),
    [lng, setLng] = useState(
      initial?.longitude == null ? "" : String(initial.longitude),
    ),
    [precision, setPrecision] = useState(
      String(initial?.locationPrecision || "未定位"),
    ),
    [source, setSource] = useState(String(initial?.locationSource || "")),
    [query, setQuery] = useState(String(initial?.city || "")),
    [cities, setCities] = useState<City[]>([]),
    [loading, setLoading] = useState(false),
    [err, setErr] = useState(""),
    [picking, setPicking] = useState(false);
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    return q.length >= 2
      ? cities
          .filter((c) => [c[1], c[2], c[6]].join(" ").toLowerCase().includes(q))
          .slice(0, 10)
      : [];
  }, [query, cities]);
  async function search() {
    setLoading(true);
    setErr("");
    try {
      if (!cities.length) {
        const r = await fetch("/data/cities.json");
        if (!r.ok) throw new Error("城市坐标库加载失败");
        setCities((await r.json()) as City[]);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "城市检索失败");
    } finally {
      setLoading(false);
    }
  }
  function choose(c: City) {
    const display =
      new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(c[3]) || c[3];
    const chinese = c[6].split("|").find((n) => /^[\u4e00-\u9fff]+$/.test(n));
    setCountry(display);
    setCity(chinese || c[1]);
    setLat(String(c[4]));
    setLng(String(c[5]));
    setPrecision("城市级");
    setSource(
      "GeoNames 城市中心（CC BY 4.0）；geonameid " + c[0] + "；非厂区坐标",
    );
    setQuery("");
  }
  const point: Site = {
    id: "edit-location",
    name: "当前选择位置",
    operator: "",
    country,
    city,
    address,
    latitude: lat === "" ? null : Number(lat),
    longitude: lng === "" ? null : Number(lng),
    locationPrecision: precision,
    locationSource: source,
  };
  return (
    <div className="location-fields">
      <div className="location-search">
        <label>
          <span>
            <Search size={13} />
            城市检索（中文或英文）
          </span>
          <div>
            <input
              aria-label="城市检索"
              value={query}
              placeholder="例如 上海、Suzhou、Penang…"
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className="btn small"
              disabled={loading || query.trim().length < 2}
              onClick={search}
            >
              {loading ? "加载中…" : "查找城市"}
            </button>
          </div>
        </label>
        {results.length > 0 && (
          <div className="city-results">
            {results.map((c) => (
              <button type="button" key={c[0]} onClick={() => choose(c)}>
                <strong>
                  {c[1]}{" "}
                  <small>{c[6].split("|").slice(0, 2).join(" / ")}</small>
                </strong>
                <span>
                  {new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(
                    c[3],
                  )}{" "}
                  · {c[4]}, {c[5]}
                </span>
              </button>
            ))}
          </div>
        )}
        {cities.length > 0 && query.trim().length >= 2 && !results.length && (
          <p className="calculation-note">
            未匹配到城市。可以手动填写城市与经纬度，或在地图上选点。
          </p>
        )}
        {err && <p className="form-error">{err}</p>}
      </div>
      <div className="form-grid">
        <label>
          <span>国家 / 地区 *</span>
          <input
            required
            name="country"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setLat("");
              setLng("");
              setPrecision("未定位");
              setSource("");
            }}
          />
        </label>
        <label>
          <span>城市 / 区域 *</span>
          <input
            required
            name="city"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setLat("");
              setLng("");
              setPrecision("未定位");
              setSource("");
            }}
          />
        </label>
        <label className="wide">
          <span>详细地址</span>
          <input
            name="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="可填写园区、道路、门牌或厂区名称"
          />
        </label>
        <label>
          <span>纬度（WGS84）</span>
          <input
            name="latitude"
            type="number"
            min="-90"
            max="90"
            step="any"
            value={lat}
            onChange={(e) => {
              setLat(e.target.value);
              setPrecision(e.target.value ? "手动标点（待核验）" : "未定位");
              setSource("手动录入，待核验");
            }}
          />
        </label>
        <label>
          <span>经度（WGS84）</span>
          <input
            name="longitude"
            type="number"
            min="-180"
            max="180"
            step="any"
            value={lng}
            onChange={(e) => {
              setLng(e.target.value);
              setPrecision(e.target.value ? "手动标点（待核验）" : "未定位");
              setSource("手动录入，待核验");
            }}
          />
        </label>
        <label>
          <span>坐标精度 *</span>
          <select
            name="locationPrecision"
            value={precision}
            onChange={(e) => setPrecision(e.target.value)}
          >
            {["未定位", "城市级", "厂区级", "手动标点（待核验）"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          <span>坐标来源 / 核验说明</span>
          <input
            name="locationSource"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="城市库 / 原厂资料 / 人工核验"
          />
        </label>
      </div>
      <button
        type="button"
        className="btn small map-picker-toggle"
        onClick={() => setPicking(!picking)}
      >
        <MapPin size={14} />
        {picking ? "收起地图选点" : "在地图上选择位置"}
      </button>
      {picking && (
        <FactoryMap
          compact
          sites={lat !== "" && lng !== "" ? [point] : []}
          onPick={(a, b) => {
            setLat(a.toFixed(6));
            setLng(b.toFixed(6));
            setPrecision("手动标点（待核验）");
            setSource("OpenStreetMap 底图手动标点，待厂区位置核验");
          }}
        />
      )}
      <p className="calculation-note">
        城市库涵盖主要城市；选择后填入城市中心坐标。只有确认实际厂址后才应标为“厂区级”。
        <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
          {" "}
          GeoNames · CC BY 4.0
        </a>
      </p>
    </div>
  );
}
