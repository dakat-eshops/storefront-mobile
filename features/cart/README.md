# Cart feature

Mirrors FO web `src/features/cart/` — TanStack DB collection (guest = MMKV-backed
`localStorageCollectionOptions` shim, authed = `queryCollectionOptions`), with
guest→authed merge on Clerk sign-in.

See FO/KhanhStore/docs/react_native/05-data-layer.md.
