import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/libs/api-client';
import { contentQueryKeys, type ContentLocale } from '../collections/queryKeys';
import type {
  CmsBanner,
  CmsFaq,
  CmsPaginated,
  CmsPolicy,
  CmsPolicyPublishedVersion,
} from '../types';

/**
 * CMS content reads — `/fo-mobile/stores/{storeId}/cms/*`.
 *
 * Same NestJS service (identical filters + visibility gates) as the web FO;
 * only the transport differs (mobile gateway guards, `useApiClient`). Content
 * is low-change and CDN-cached server-side (60–300 s), so a generous client
 * staleTime avoids refetch churn on tab focus / navigation.
 *
 * Locale default is `vi` (BO contract §6); `en` falls back per-field.
 */
const CONTENT_STALE_TIME = 5 * 60 * 1000;

export function useBanners(locale: ContentLocale = 'vi') {
  const api = useApiClient();
  return useQuery({
    queryKey: contentQueryKeys.banners(locale),
    queryFn: () =>
      api.get<CmsPaginated<CmsBanner>>(`/cms/banners?locale=${locale}`),
    staleTime: CONTENT_STALE_TIME,
    select: (page) => page.docs,
  });
}

export function useFaqs(locale: ContentLocale = 'vi') {
  const api = useApiClient();
  return useQuery({
    queryKey: contentQueryKeys.faqs(locale),
    queryFn: () => api.get<CmsPaginated<CmsFaq>>(`/cms/faqs?locale=${locale}`),
    staleTime: CONTENT_STALE_TIME,
    select: (page) => page.docs,
  });
}

export function usePolicies(locale: ContentLocale = 'vi') {
  const api = useApiClient();
  return useQuery({
    queryKey: contentQueryKeys.policies(locale),
    queryFn: () =>
      api.get<CmsPaginated<CmsPolicy>>(`/cms/policies?locale=${locale}`),
    staleTime: CONTENT_STALE_TIME,
    select: (page) => page.docs,
  });
}

/** Single policy by slug — `data` is `null` (not an error) when unpublished/unknown. */
export function usePolicy(slug: string | undefined, locale: ContentLocale = 'vi') {
  const api = useApiClient();
  return useQuery({
    queryKey: contentQueryKeys.policy(slug ?? '', locale),
    queryFn: () =>
      api.get<CmsPolicy | null>(
        `/cms/policies/${encodeURIComponent(slug ?? '')}?locale=${locale}`,
      ),
    enabled: !!slug,
    staleTime: CONTENT_STALE_TIME,
  });
}

/**
 * Consent-log pin — the latest PUBLISHED version id of a policy. Record this
 * (never the document id) on any policy acceptance; both fields `null` means
 * "cannot record consent yet — skip the POST" (same contract as the web FO's
 * `getPublishedPolicyVersionId`).
 */
export function usePolicyPublishedVersion(slug: string | undefined) {
  const api = useApiClient();
  return useQuery({
    queryKey: contentQueryKeys.policyPublishedVersion(slug ?? ''),
    queryFn: () =>
      api.get<CmsPolicyPublishedVersion>(
        `/cms/policies/${encodeURIComponent(slug ?? '')}/published-version`,
      ),
    enabled: !!slug,
    // Shorter than content: a fresh publish should pin quickly (server tier is 60 s).
    staleTime: 60 * 1000,
  });
}
