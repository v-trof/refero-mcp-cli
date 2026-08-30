---
name: refero-design
description: "Research-first design guidance for using Refero from the CLI. Use real styles, screens, and flows before making visual or product-design decisions."
---

# Refero Design Research Skill

Refero gives agents product evidence and design taste. Use it before design work instead of relying on generic model memory.

Refero has three research layers:

1. **Styles** — visual direction and taste: typography, color, layout, spacing, surfaces, imagery, and component feel.
2. **Screens** — concrete UI patterns: page structure, hierarchy, copy, states, components, and product-specific details.
3. **Flows** — multi-step journey logic: goals, actions, system responses, friction, recovery, and completion states.

For visual work, start with styles. Use screens for concrete interface decisions. Use flows when the task has a before/after sequence. The best results combine all relevant layers without copying one reference.

## Non-negotiables

- Research before design work. Major visual, layout, content, and interaction decisions must trace to Refero research, the user brief, or a relevant craft rule.
- Use styles first when the task has a visual component.
- Study several strong references and synthesize a new direction; do not copy one reference.
- Do not average conflicting references into a safe middle. Choose one dominant direction and preserve its sharp traits.
- Preserve the meaning of source tokens. A CTA color, code color, decorative gradient, radius, shadow, or component treatment stays in its source role.
- Preserve imagery roles. If a direction depends on photography, illustration, product shots, or graphics, use an appropriate asset or an intentional, correctly sized placeholder.
- Synthesize before implementation. Produce a short concept, token direction, reference lock, and decision ledger before drawing or coding substantial work.
- Validate after building. Compare the implementation with the locked direction and correct actionable drift.

## Authentication

If no token is configured, run:

```sh
refero auth login
```

The command opens `https://refero.design/mcp`. Copy the API token shown there and paste it into the prompt. It is stored in the per-user config and sent as `Authorization: Bearer <token>` on MCP requests.

For CI, use `REFERO_TOKEN` or `--token`. Never put a token in source control, prompts, or generated artifacts.

## Command map

| Research operation | MCP tool | CLI command |
|---|---|---|
| Search visual styles | `refero_search_styles` | `refero search styles "<query>"` |
| Get full style guidance | `refero_get_style` | `refero get style <uuid> [<uuid> ...]` |
| Search product screens | `refero_search_screens` | `refero search screens "<query>" --platform web\|ios` |
| Get full screen metadata | `refero_get_screen` | `refero get screen <uuid> [<uuid> ...]` |
| Find similar screens | `refero_get_similar_screens` | `refero similar <screen-uuid> [--limit 1-20]` |
| Retrieve a screenshot | `refero_get_screen_image` | `refero image <screen-uuid> [--size thumbnail\|full] --output <file>` |
| Search user flows | `refero_search_flows` | `refero search flows "<query>" --platform web\|ios` |
| Get a complete flow | `refero_get_flow` | `refero get flow <number> [<number> ...]` |

Add `--json` to searches, detail calls, and similar-screen calls when consuming results programmatically. Search and detail calls default to Markdown. Screen and flow searches require a platform. Use UUIDs for styles and screens; flow IDs are numbers. Detail batches accept at most 10 IDs.

## Discovery

Before researching, form a short brief. Ask only for information that would materially change the result; otherwise make a reasonable assumption and proceed.

```text
Designing [WHAT] for [WHO] on [PLATFORM].
Goal: [PRIMARY USER GOAL].
Tone: [DESIRED FEELING].
Main objection/risk: [OBJECTION].
Must remember: [HOOK OR DISTINCTIVE IDEA].
Constraints: [CONSTRAINTS].
Research needed: [styles/screens/flows].
Path: [direct build / visual exploration / audit / asset generation].
```

Choose the lightest workflow that can produce a high-quality result:

- **Direct build:** small fixes, clear production edits, or work with an existing system/source. Research and lock the direction, then code.
- **Visual exploration:** new visual language, major redesign, landing page, or several plausible directions. Search multiple angles and create reference-locked options before implementation.
- **Audit:** use captured screenshots, Refero screens, or flows as evidence before critique.
- **Asset generation:** use generated imagery only when the reference lock requires bitmap media that code, icons, or existing assets cannot faithfully provide.

## Tool routing

### Styles: visual direction

Use:

```sh
refero search styles "premium fintech website with restrained typography"
refero search styles "developer tool website with product screenshots"
refero get style <strong-style-uuid-1> <strong-style-uuid-2>
```

Use styles for look and feel, brand direction, typography, palette, layout rhythm, spacing, radius, elevation, surfaces, component treatments, imagery, and design-system inspiration. A style is a semantic design reference, not a screenshot or component library.

Search 3–5 different angles when the task is substantial: a broad aesthetic, a domain/category, and a known brand or strong product when relevant. Retrieve 3–4 strong styles, compare what each contributes, choose one primary foundation, and borrow only 1–2 bounded details from secondary references.

Extract the north star, typography personality and scale, color roles, density, layout system, section rhythm, surface treatment, borders, shadows, imagery strategy, implementation notes, and do/don’t rules.

### Screens: concrete interface decisions

Use:

```sh
refero search screens "pricing page annual monthly toggle" --platform web
refero search screens "dashboard empty state" --platform web --json
refero get screen <screen-uuid>
refero similar <screen-uuid> --limit 5
refero image <screen-uuid> --size thumbnail --output ./reference.png
```

Search screens for specific page types, components, states, companies, on-screen text, layouts, hierarchy, CTA patterns, forms, dashboards, settings, modals, tables, pricing, empty states, and auth details. After finding strong results, get their full metadata. Request an image only when text metadata is not enough to understand the exact visual.

Do not use screens as the primary source of visual taste when styles are available. Use them to ground structure, content hierarchy, components, copy, states, edge cases, and conversion or trust tactics.

### Flows: journey logic

Use:

```sh
refero search flows "subscription cancellation with retention offer" --platform web
refero search flows "signup onboarding" --platform ios --json
refero get flow 11201
```

Use flows for onboarding, signup, checkout, subscription management, cancellation, account deletion, password reset, profile/settings changes, and any multi-step process. Extract the entry and exit state, step count, decisions, friction reducers, confirmations, recovery, error handling, retention moments, and system response at each step.

If flow search is sparse, broaden the query. If it is still sparse, use screens and reconstruct the journey explicitly rather than inventing unsupported behavior.

## Research workflow

1. Define the brief and decide whether the task needs styles, screens, flows, or all three.
2. Search styles from several angles for visual work.
3. Retrieve and compare several full styles.
4. Lock one primary direction and assign bounded jobs to any secondary references.
5. Search screens for concrete product patterns, states, copy, and layout decisions.
6. Search flows for multi-step logic, decisions, recovery, and system responses.
7. Synthesize findings into a short research summary and decision ledger.
8. Implement while preserving the reference lock.
9. Perform a visual and interaction QA pass against the lock before delivery.

### Reference lock

```text
Primary reference/direction: [one dominant source]
Preserve: [3–5 traits: canvas, type, accent, layout, density, media]
Borrow only: [1–2 specific secondary details]
Role rules: [token/component/media roles to preserve]
Media strategy: [real/generated/stock/code-native/placeholder + art direction]
Reject: [defaults or averages that would flatten the direction]
Token commitments: [background, type, accent, radius, border/shadow, imagery + roles]
```

Do not soften distinctive traits into safer colors, safer fonts, softer radius, or generic layouts. A reference lock is not cloning: preserve selected traits while adapting content, brand, and interaction details to the user’s product.

### Decision ledger

| Decision | Source | Source rule / role | Why |
|---|---|---|---|
| [palette/type/layout/media/content choice] | [style/screen/flow/user constraint] | [role to preserve] | [specific rationale] |

If a major choice has no source, research more, tie it to a user constraint, or remove it.

## Research depth

- Quick visual improvement: 2–3 style searches, 2–3 full styles, and one short synthesis.
- New landing page, brand direction, or major redesign: 3–5 style searches, 3–4 full styles, screen research for concrete sections, and a clear direction before implementation.
- Product workflow: styles for visual language, screens for key states/components, and flows for sequencing.
- Ambiguous or high-risk task: search several angles, inspect later pages, compare strong and unusual references, and document tradeoffs.

## Present findings

Do not dump every result. For non-trivial work, give the user a compact summary:

```text
Research summary:
- Styles reviewed: [count] across [directions]
- Screens reviewed: [count], if used
- Flows reviewed: [count], if used

Visual direction:
- [primary foundation and signature traits]
- [bounded secondary details]

Product patterns:
- [concrete decisions from screens]

Journey logic:
- [flow decisions, if applicable]

Recommendation:
- [what to design and why]
```

## Quality gate

Before final delivery, confirm:

- Styles informed visual taste when the task was visual.
- Multiple references were synthesized into a distinct direction.
- The primary reference’s signature traits and token roles were preserved.
- Screens informed concrete patterns, content, states, or components where needed.
- Flows informed sequencing and system responses where the task had multiple steps.
- Every major design decision traces to research, a user constraint, or a craft rule.
- The result fits the product, audience, accessibility needs, and responsive behavior.
- The implementation was compared against the locked direction and actionable drift was corrected.

For the authoritative Refero MCP contract, see https://doc.refero.design/mcp/tools. This skill is bundled by `refero skill`.
