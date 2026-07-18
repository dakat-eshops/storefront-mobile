/**
 * CMS content types — the subset of Payload document fields the mobile app
 * renders. Documents arrive in Payload's shape (BO contract §4: byte-identical
 * to the web FO), so these types are intentionally structural, not exhaustive —
 * add fields as screens need them.
 *
 * SSOT: BO/e-Shops/docs/cms/payloadcms/nestjs-content-api/00-fo-compatibility-contract.md
 */

/** Payload's list envelope — arrives inside the ApiResponse `data` field. */
export type CmsPaginated<T> = {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
};

export type CmsBanner = {
  id: number | string;
  message: string;
  link?: string | null;
  priority?: number | null;
};

export type CmsFaq = {
  id: number | string;
  question: string;
  /** Lexical JSON — render with the shared rich-text renderer when it lands. */
  answer: unknown;
  sortOrder?: number | null;
};

export type CmsPolicy = {
  id: number | string;
  type: string;
  slug: string;
  title: string;
  /** Lexical JSON. */
  body: unknown;
  summary?: string | null;
  effectiveFrom?: string | null;
  requiresConsent: boolean;
  requiresReacceptance: boolean;
  sortOrder?: number | null;
};

/** Consent-log pin — see the web FO's `getPublishedPolicyVersionId`. */
export type CmsPolicyPublishedVersion = {
  policyId: number | string | null;
  versionId: number | string | null;
};
