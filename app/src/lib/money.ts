/**
 * Money formatting for the portfolio surfaces. Everything in this app is integer cents (see
 * `MoneyCents`), and every screen was previously doing `(cents / 100).toLocaleString()` inline —
 * which drops trailing zeros, so $1,240.50 and $1,240.5 both appeared, and a column of figures
 * never lined up.
 *
 * A true minus sign (U+2212) rather than a hyphen: at the weights this app sets numbers in, a
 * hyphen reads as a stray dash rather than a negative.
 */
const MINUS = "−";

/** Full precision — "$1,240.50". For values a collector might reconcile against their wallet. */
export function money(cents: number): string {
  const abs = Math.abs(cents) / 100;
  const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${cents < 0 ? MINUS : ""}$${formatted}`;
}

/** Rounded to whole dollars — "$1,241". For stat tiles and headline totals, where two decimal
 * places are noise at that type size. */
export function moneyWhole(cents: number): string {
  const abs = Math.round(Math.abs(cents) / 100);
  return `${cents < 0 ? MINUS : ""}$${abs.toLocaleString()}`;
}

/** Always carries its sign — "+$12.40" / "−$12.40" — so a gain and a loss are distinguishable
 * without relying on color alone. */
export function signedMoney(cents: number): string {
  if (cents === 0) return "$0.00";
  return `${cents > 0 ? "+" : MINUS}$${(Math.abs(cents) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function signedPercent(percent: number): string {
  if (!Number.isFinite(percent) || percent === 0) return "0.0%";
  return `${percent > 0 ? "+" : MINUS}${Math.abs(percent).toFixed(1)}%`;
}
