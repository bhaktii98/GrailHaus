import { Decimal } from "decimal.js";

/** Every money value that crosses a service boundary is integer cents. Never a float. */
export type Cents = number;

export function centsToDecimal(cents: Cents): Decimal {
  return new Decimal(cents).dividedBy(100);
}

export function decimalToCents(amount: Decimal): Cents {
  return amount.times(100).round().toNumber();
}

export function formatUsd(cents: Cents): string {
  return `$${centsToDecimal(cents).toFixed(2)}`;
}
