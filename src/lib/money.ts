/** $1,250.00 from integer cents. The whole platform runs in US dollars. */
export function formatMoney(minor: number, _currency?: string | null) {
  return `$${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
