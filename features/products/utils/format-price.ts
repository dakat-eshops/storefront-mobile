/**
 * Numeric price coercion + currency formatting. Wire format from NestJS is
 * either `number` (numeric) or `string` (Postgres numeric serialized via
 * Drizzle). Default currency is VND because >75% of FO traffic is Vietnam.
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
      maximumFractionDigits: code === 'VND' ? 0 : 2,
    }).format(n);
  } catch {
    return `${n} ${code}`;
  }
}
