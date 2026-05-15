# Cart feature

Mirrors FO web `src/features/cart/` — TanStack DB collection (guest = MMKV-backed
`localStorageCollectionOptions` shim, authed = `queryCollectionOptions`), with
guest→authed merge on Clerk sign-in.

See docs/_initial/05-data-layer.md.
