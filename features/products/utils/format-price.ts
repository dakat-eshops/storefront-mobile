/**
 * Numeric price coercion + currency formatting. Wire format from NestJS is
 * either `number` (numeric) or `string` (Postgres numeric serialized via
 * Drizzle). Always pass the row's / store's currency — the VND fallback is only
 * for a value with no currency at all (>75% of FO traffic is Vietnam).
 *
 * Fraction digits come from Intl's ISO 4217 data (VND/JPY/KRW 0, USD 2) — the
 * same exponents as BO's currency registry. Never force them: forcing 2 for
 * every non-VND code rendered JPY as `¥1,332.00`.
 */
export function formatPrice(
  value: number | string | null | undefined,
  currency?: string | null,
): string {
  if (value == null) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  const code = currency ?? 'VND';
  try {
    return new Intl.NumberFormat(code === 'VND' ? 'vi-VN' : 'en-US', {
      style: 'currency',
      currency: code,
    }).format(n);
  } catch {
    return `${n} ${code}`;
  }
}
