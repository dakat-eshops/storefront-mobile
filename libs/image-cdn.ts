import { env } from '@/libs/env';

/**
 * Cloudflare delivery helper — mobile mirror of BO
 * `@eshops/db/utils/imageProvider` (same host detection + Rule 0-CF
 * allowlist). A Cloudflare ORIGIN url becomes one fixed-width
 * `/cdn-cgi/image/` variant; every other url is returned unchanged.
 * Widths must come from the shared ladder (160/320/480/640/828/1080/1280).
 * SSOT: BO docs/surface/media/cloudflare-images/00-fo-compatibility-contract.md
 */
const HOSTS: string[] = String(env.imageHost)
  .split(',')
  .map((h: string) => h.trim().toLowerCase())
  .filter(Boolean);

export function toCloudflareImageUrl(url: string, width: number): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.protocol !== 'https:' || !HOSTS.includes(parsed.hostname.toLowerCase())) {
    return url;
  }
  const key = parsed.pathname.replace(/^\/+/, '');
  if (!key || key.startsWith('cdn-cgi/')) return url;
  return `https://${parsed.host}/cdn-cgi/image/width=${width},fit=scale-down,quality=80,format=auto,onerror=redirect/${key}`;
}
