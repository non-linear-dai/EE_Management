import type { Workspace, NumberingRule, NumberingKind } from "./types";
export const DEFAULT_RULES: NumberingRule[] = (
  ["product", "PCBA", "TLA", "material"] as NumberingKind[]
).map((kind) => ({
  kind,
  prefix: "",
  suffix: "-00-A",
  digits: 7,
  start: 1000000,
}));
export const KIND_LABELS: Record<NumberingKind, string> = {
  product: "企业产品",
  PCBA: "PCBA 总成",
  TLA: "TLA 总成",
  material: "电子物料",
};
export function rulesFor(d: Workspace): NumberingRule[] {
  return DEFAULT_RULES.map(
    (r) => d.numberingRules?.find((x) => x.kind === r.kind) || r,
  );
}
export function matchesRule(number: string, r: NumberingRule): boolean {
  if (
    !number.startsWith(r.prefix) ||
    number.length !== r.prefix.length + r.digits + r.suffix.length
  )
    return false;
  const middle = number.slice(r.prefix.length, r.prefix.length + r.digits);
  if (!/^\d+$/.test(middle)) return false;
  const tail = number.slice(r.prefix.length + r.digits);
  return [...r.suffix].every((c, i) =>
    c === "0"
      ? /^[0-9]$/.test(tail[i])
      : c === "A"
        ? /^[A-Z]$/.test(tail[i])
        : c === tail[i],
  );
}
export function nextPartNumber(d: Workspace, kind: NumberingKind): string {
  const r = rulesFor(d).find((x) => x.kind === kind)!;
  const all = [...d.products, ...d.assemblies, ...d.materials].map(
    (x) => x.number,
  );
  let next = r.start;
  for (const n of all)
    if (matchesRule(n, r)) {
      const middle = n.slice(
        r.prefix.length,
        r.suffix ? -r.suffix.length : undefined,
      );
      next = Math.max(next, Number(middle) + 1);
    }
  if (next >= 10 ** r.digits)
    throw new Error("该编码规则的流水号已用尽，请增加位数或更换前缀");
  return r.prefix + String(next).padStart(r.digits, "0") + r.suffix;
}
