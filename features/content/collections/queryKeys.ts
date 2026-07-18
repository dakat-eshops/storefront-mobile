/**
 * Single source of truth for CMS content query keys. Same shape convention as
 * `productQueryKeys` (see docs/_initial/05-data-layer.md).
 *
 * ALWAYS import keys from here. Never hardcode `['content', ...]` inline.
 */
export type ContentLocale = 'vi' | 'en';

export const contentQueryKeys = {
  all: ['content'] as const,
  banners: (locale: ContentLocale) =>
    [...contentQueryKeys.all, 'banners', locale] as const,
  faqs: (locale: ContentLocale) =>
    [...contentQueryKeys.all, 'faqs', locale] as const,
  policies: (locale: ContentLocale) =>
    [...contentQueryKeys.all, 'policies', locale] as const,
  policy: (slug: string, locale: ContentLocale) =>
    [...contentQueryKeys.all, 'policy', slug, locale] as const,
  policyPublishedVersion: (slug: string) =>
    [...contentQueryKeys.all, 'policy-published-version', slug] as const,
};
