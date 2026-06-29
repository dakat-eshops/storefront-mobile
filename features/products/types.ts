/**
 * Minimal wire-shape mirror of the `FoProductsService.listPublic` /
 * `getPublic` response — enough to render PLP + PDP. The authoritative type
 * lives in @eshops/db (server side); we mirror only what the mobile UI reads.
 *
 * Keep this file thin. Do not import `@eshops/db` runtime modules — RN must
 * not pull in the Drizzle / Postgres machinery. Types-only is fine, but the
 * shape below is loose enough that we can defer the full types-only import
 * until @eshops/db ships an isomorphic `types` entrypoint.
 */
export type ProductImage = {
  url: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  blurhash?: string | null;
};

export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  defaultImage?: ProductImage | string | null;
  basePrice?: number | string | null;
  salePrice?: number | string | null;
  currency?: string | null;
  isFeatured?: boolean;
  isInStock?: boolean;
};

export type ProductDetail = ProductListItem & {
  images?: ProductImage[];
  /** GTIN / EAN-13 / UPC-A / Code128 barcode. Null when not set. Use variation.barcode when a specific variation is selected. */
  barcode?: string | null;
  variations?: Array<{
    id: string;
    name: string;
    isDefault?: boolean;
    isInStock?: boolean;
    /** Per-variation barcode. Takes precedence over product-level barcode per variation-precedence rule. */
    barcode?: string | null;
  }>;
};

export type Paginated<T> = {
  items: T[];
  total?: number;
  nextOffset?: number | null;
};
