# Claude Skills (FO Mobile)

This repo carries **only platform-layer** skills — React Native / Expo know-how that has no
cross-repo contract in it. Everything that crosses a repo boundary (Broadcast payloads, channel
names, HMAC headers, webhook shapes, cache tags, feature toggles, entity attributes, migrations,
CI/CD) is still owned by the **BO** library and mirrored here — see
[Use the Skills — ALWAYS](../../CLAUDE.md#use-the-skills--always-critical) in this repo's `CLAUDE.md`.

## Sibling libraries (check these first for anything contract-shaped)

| Library | Covers | Index |
| --- | --- | --- |
| **BO** (shared, cross-repo) | Every BO↔FO contract surface | [BO/e-Shops/.claude/skills/README.md](../../../BO/e-Shops/.claude/skills/README.md) |
| **FO web** | Customer-domain entity scaffolding, toggle FO read, FO test layers — closest analogue for most mobile work | [FO/KhanhStore/.claude/skills/README.md](../../KhanhStore/.claude/skills/README.md) |

## Local skills (this repo — model-invoked, vendored from `vercel-labs/agent-skills`)

Auto-trigger by task description; not slash commands. Advisory only — on any conflict with this
repo's `CLAUDE.md` (Clerk-only auth, `/fo-mobile/` NestJS prefix, MMKV + TanStack Query storage,
"a feature that ships on web but not mobile is incomplete", homepage connection budget),
`CLAUDE.md` wins. Recorded in `skills-lock.json`; update with `npx skills update`.

| Skill | When to use |
| --- | --- |
| [vercel-react-native-skills](vercel-react-native-skills/SKILL.md) | React Native + Expo best practices — list virtualization/perf, animation, native modules, platform APIs. The primary skill for any mobile component or screen work here. |
| [vercel-composition-patterns](vercel-composition-patterns/SKILL.md) | React composition patterns (compound components, render props, context, React 19 API changes) — applies to RN component trees the same as web. |

## Adding / updating

```bash
# from this repo root
npx skills add vercel-labs/agent-skills -s <skill-name> -y   # add another
npx skills update                                            # refresh vendored skills
npx skills ls                                                # list installed
```

Real skill files live in `.agents/skills/<name>/`; `.claude/skills/<name>` is a symlink to it, and
both plus `skills-lock.json` are committed so all machines stay in sync after `git pull` — same
vendoring pattern as the BO repo.

## Conventions

The full convention table is in the BO index —
[BO/e-Shops/.claude/skills/README.md → Conventions](../../../BO/e-Shops/.claude/skills/README.md#conventions-for-writing-or-editing-a-skill).
If a repeated mobile-only pattern is worth its own authored skill, add it here following that table;
anything with a wire contract in it belongs in the BO library instead.
