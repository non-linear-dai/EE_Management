// Exact rational arithmetic prevents binary floating point drift during BOM explosion.
export type Quantity = { n: bigint; d: bigint };
const ZERO = BigInt(0),
  ONE = BigInt(1),
  TEN = BigInt(10);
function gcd(a: bigint, b: bigint): bigint {
  a = a < ZERO ? -a : a;
  while (b) {
    const r = a % b;
    a = b;
    b = r;
  }
  return a || ONE;
}
function q(n: bigint, d: bigint): Quantity {
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
export function quantity(value: number | string): Quantity {
  const s = String(value);
  if (!/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(s) || !Number.isFinite(Number(s)))
    throw new Error("用量必须是有限数字");
  const [base, exp = "0"] = s.toLowerCase().split("e");
  const scale = (base.split(".")[1]?.length || 0) - Number(exp);
  const n = BigInt(base.replace(".", ""));
  return scale >= 0
    ? q(n, TEN ** BigInt(scale))
    : q(n * TEN ** BigInt(-scale), ONE);
}
export const add = (a: Quantity, b: Quantity) =>
  q(a.n * b.d + b.n * a.d, a.d * b.d);
export const multiply = (a: Quantity, b: Quantity) => q(a.n * b.n, a.d * b.d);
export const subtract = (a: Quantity, b: Quantity) =>
  q(a.n * b.d - b.n * a.d, a.d * b.d);
export function allowance(value: number | undefined): Quantity {
  return add(quantity(1), multiply(quantity(value || 0), quantity("0.01")));
}
export function asNumber(a: Quantity, ceilUnit = false): number {
  if (a.n < ZERO) return 0;
  if (a.n > BigInt(Number.MAX_SAFE_INTEGER) * a.d)
    throw new Error("累计用量超出安全计算范围，请减少计划数量");
  if (ceilUnit) return Number((a.n + a.d - ONE) / a.d);
  const scale = BigInt(1000000);
  return Number((a.n * scale * BigInt(2) + a.d) / (a.d * BigInt(2))) / 1000000;
}
export const positive = (a: Quantity) => a.n > ZERO;
