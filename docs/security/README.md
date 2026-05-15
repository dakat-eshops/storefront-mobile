# Security — App Attest & Play Integrity Hardening

Device attestation and binary hardening for the mobile storefront.

## Documents

| File | Topic |
| --- | --- |
| [01-app-attest.md](01-app-attest.md) | iOS App Attest: key generation, attestation, assertion flow, 5-min cache |
| [02-play-integrity.md](02-play-integrity.md) | Android Play Integrity: integrity token, verdict fields, NestJS verification |
| [03-hardening-checklist.md](03-hardening-checklist.md) | Certificate pinning, jailbreak/root detection, ProGuard, replay protection, secret hygiene |

## Key invariants

1. **No secrets in the binary.** `FO_HMAC_SECRET`, `INTERNAL_API_KEY`, and any BO/NestJS service secrets MUST NOT be bundled. Mobile authenticates via Clerk JWT + device attestation — not shared secrets.
2. **`DeviceAttestationGuard` enforces attestation on sensitive routes.** The guard runs in NestJS and validates the attestation token on every write. Reads may be exempt to reduce latency.
3. **5-minute token cache.** Generating a new attestation token for every request is too slow. Cache the token in `expo-secure-store` for up to 5 minutes.
4. **Replay protection.** Attestation requests include a server-issued nonce (fresh per request). Tokens older than 5 minutes are rejected by NestJS.
5. **Jailbreak / root detection is advisory, not a hard block.** Flag the device, log it, show a warning — but don't refuse to let the user use the app (creates support friction). Only block on high-risk operations if needed.

## Cross-references

- `libs/device-attestation.ts`: `getOrCreateAppAttestKeyId()`, `useDeviceAttestation()`
- `_initial/07-device-attestation.md`
- NestJS `DeviceAttestationGuard`: `apps/api/src/common/guards/device-attestation.guard.ts`
