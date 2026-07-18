# Content (CMS) — mobile consumption

CMS content reads for the mobile app, served by the NestJS content API at
`/2026-01/fo-mobile/stores/{storeId}/cms/*` — the mobile twin of the web FO's
content surface. Banners, policies (including the consent-log version pin), and
FAQs are wired first; the remaining collections (pages, blog-posts, portfolio,
careers, navigation, category-showcases) exist server-side on the same prefix
and can be added here as screens need them.

> ⚠️ **Wiring status**: the BO-side `FoMobileCmsModule`
> (`apps/api/src/modules/fo-mobile/cms/`) exists but is currently **not
> registered** in `FoMobileModule` — the mobile `/cms/*` routes are unmounted
> and the hooks below will 404 until it is re-imported. Web FO reads the same
> collections via its own `/api/cms` path and is unaffected.

## Contract

The SSOT is the BO repo:
`BO/e-Shops/docs/cms/payloadcms/nestjs-content-api/00-fo-compatibility-contract.md`.
Key points as they apply here:

- **Envelope**: `{ success, data, meta }` — `useApiClient` already unwraps
  `data`, so hooks receive Payload's pagination envelope (`docs`, `totalDocs`, …)
  directly.
- **Locale**: `?locale=vi|en`, default `vi`; `en` falls back to `vi` per field.
- **Visibility**: drafts / scheduled / expired / deactivated content never
  arrives — gating is server-side (`overrideAccess: false` + fixed filters).
  Missing single documents are `data: null` inside a `success` envelope, not 404s.
- **Read-only**: there are no write verbs on this surface, permanently.

## Code map

| File | Purpose |
| --- | --- |
| [features/content/types.ts](../../features/content/types.ts) | Structural types for the rendered subset of Payload fields |
| [features/content/collections/queryKeys.ts](../../features/content/collections/queryKeys.ts) | Query keys — never hardcode `['content', ...]` inline |
| [features/content/hooks/use-content.ts](../../features/content/hooks/use-content.ts) | `useBanners` / `useFaqs` / `usePolicies` / `usePolicy` / `usePolicyPublishedVersion` |

## Consent pinning (policies)

Any policy-acceptance flow MUST record the **version id** from
`usePolicyPublishedVersion(slug)`, never the document id — the version row pins
the exact legal text agreed to. `{ policyId: null, versionId: null }` means
"cannot record consent yet"; skip the acceptance POST entirely.

## Rich text

`body` / `answer` fields are Lexical JSON. Render with the shared rich-text
renderer ([components/ui/rich-text-content.tsx](../../components/ui/rich-text-content.tsx));
treat unsupported node types as opaque rather than crashing.
