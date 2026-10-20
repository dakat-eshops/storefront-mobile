/**
 * Mobile has no video renderer yet (BO open item V-O6), so every
 * `type='video'` image row — self-hosted clips and YouTube/TikTok embeds
 * alike — is skipped. An `.mp4` must never be fed to `expo-image`.
 * SSOT: BO docs/surface/media/videos/04-cloudflare-video-design.md
 */
type MediaRow = { url: string; type?: string | null };

export function isVideoRow(row: MediaRow): boolean {
  return row.type === 'video';
}

export function stillImages<T extends MediaRow>(rows: T[] | null | undefined): T[] {
  return (rows ?? []).filter((row) => !isVideoRow(row));
}
