# PRD — Lovelacer

**Status:** Draft v1 · **Owner:** Adam · **Last updated:** 2026-04-27

## Vision

Make Home Assistant feel finished out of the box. Give users a clean starting dashboard they can actually use — organized by room, grouped by domain, no naming chaos, no manual YAML — that they'll either keep, or use as a foundation to customize from rather than rebuilding from scratch.

## Target personas

### 1. Migrating Mike — Primary

Coming from SmartThings, Hubitat, or Apple Home. Has 80–250 entities. Tried HA's auto-generated dashboard, was horrified, started Googling "home assistant dashboard examples" and found Reddit threads telling him to learn YAML. Wants a result, not a hobby.

- **Tech level:** Comfortable with Docker, willing to install an Add-on, won't write YAML.
- **Time budget:** 30 minutes before frustration sets in.
- **Win condition:** Working room-based dashboard within one session.

### 2. Overwhelmed Olivia — Secondary

Set up HA six months ago, accumulated entities from five integrations (Zigbee2MQTT, Hue, Tuya, ESPHome, weather), and her dashboard hasn't been touched since the auto-generated one. She knows it could be better but every attempt to clean it up takes a weekend.

- **Tech level:** Edits YAML reluctantly, copies snippets from forums.
- **Pain:** The cost of starting over is too high.
- **Win condition:** Generate, preview, and selectively apply — keep what she's already built where it works.

### 3. Tinkerer Tomáš — Tertiary

Power user. Has a custom dashboard already. Curious about Lovelacer for new rooms or as a starting point when adding a major integration. Will judge the output quality harshly.

- **Tech level:** Knows Lovelace inside out, uses Mushroom and custom cards.
- **Pain:** Bootstrapping new sections from scratch.
- **Win condition:** Uses Lovelacer to scaffold, then customizes by hand. Output must be readable YAML, not a soup.

## Problem

HA's entity model is powerful but exposes raw plumbing to users. Specific failure points:

1. **Inconsistent naming.** `light.kitchen_ceiling`, `Kitchen Light`, `0xabc_kitchen` — same room, three integrations, three conventions.
2. **No automatic structure.** Areas exist but are optional; many entities have no `area_id`. Devices and entities both can have areas, sometimes disagreeing.
3. **Auto-generated default dashboard is unusable.** It dumps everything into one view sorted by domain, ignoring areas.
4. **Manual dashboard creation is high-effort.** Lovelace YAML, card schemas, view structure, and the new Sections grid system each have learning curves.
5. **No "regenerate" path.** Adding new devices means manually adding cards. There's no tool that says "you have 12 new entities, here's where they belong."

## Solution

A self-hosted tool that:

1. **Reads** the HA entity, device, and area registries via the WebSocket API.
2. **Analyzes** entities using a layered heuristic chain (areas → device metadata → name parsing → fallback).
3. **Groups** entities by detected room and by domain within each room.
4. **Generates** a complete Lovelace dashboard config (storage-mode JSON or YAML).
5. **Previews** the result in a side-by-side UI before any change is made.
6. **Applies** the config via the Lovelace WebSocket API as a new dashboard (never overwrites existing).
7. **Suggests** improvements over time — low-confidence assignments, ungrouped entities, naming inconsistencies.

## Scope

### MVP (must-have, Tier 1 / Free)

- Read entities, devices, areas via WebSocket
- Heuristic room detection (priority chain in [HEURISTICS.md](./HEURISTICS.md))
- Generate Sections-view dashboard, one section per room
- Per-domain card selection (lights → tile, climate → thermostat, etc.)
- Preview UI showing the proposed dashboard
- Apply as a new dashboard (preserves existing ones)
- Multi-language room name matching (EN, CS, DE)
- Manual override per entity (move to a different room)

### Tier 2 / AI MVP (post-Tier-1 release)

- LLM provider abstraction with Anthropic, OpenAI, and Ollama support
- AI fallback for low-confidence room detection
- Inline reasoning hints
- Entity rename suggestions
- Layout suggestions
- See [`AI_FEATURES.md`](./AI_FEATURES.md) for full catalog

### Should-have (v1.1, Tier 1)

- Additional languages (ES, FR, IT, PL, NL)
- Export as YAML file
- Re-run with diff against current generated dashboard
- Floor support (HA introduced floors in 2024.8)
- Custom card pack (Mushroom) as opt-in

### Could-have (post-v1)

- Suggestions engine extension (low-confidence, duplicates, unused entities)
- Theme picker
- Multiple layout modes (Sections, Views, Masonry)
- Energy / climate / security view templates
- Integration-specific templates (e.g., Zigbee2MQTT network view)
- Tier 3 / Lovelacer Cloud (managed inference)
- Smart Panel export format (see [`SMART_PANEL_BRIDGE.md`](./SMART_PANEL_BRIDGE.md))
- Additional export targets contributed by community (Hubitat, OpenHAB, etc.)

### Won't have (explicitly out of scope)

- Editing the entity registry except via explicit user-confirmed AI suggestions
- Modifying device configurations
- Generating automations beyond suggestions the user copies manually
- Replacement for the HA UI editor — we generate, then hand off
- Cloud sync of dashboards
- Telemetry on free-tier users

## Non-goals

- Be a Lovelace IDE
- Compete with the HA frontend team's roadmap
- Replace handcrafted dashboards for power users — we're a starting point, not an endpoint

## Competitive landscape

| Tool                               | What it does                      | Where it falls short                           |
| ---------------------------------- | --------------------------------- | ---------------------------------------------- |
| **HA auto-generated dashboard**    | Built-in, dumps all entities      | No grouping by room, no opinion                |
| **Mushroom cards**                 | Pretty card library               | Not a generator; user still composes manually  |
| **auto-entities**                  | Card that auto-fills with filters | Per-card, not per-dashboard; requires YAML     |
| **lovelace_gen**                   | Jinja-templated YAML              | Power-user tool; more YAML, not less           |
| **dashboard-card-mod**             | Style overrides                   | Orthogonal; styling, not structure             |
| **HA Sections view (built-in)**    | Modern grid layout                | Layout primitive, not a generator              |
| **AI Automation Suggester (HACS)** | LLM-powered automation ideas      | Different problem (automations not dashboards) |
| **Bubble Card / Tile cards**       | Card libraries                    | Composition tools, not generators              |

**Differentiation:** Lovelacer is the only tool that takes the full registry, applies room heuristics, and produces a complete coherent dashboard rather than helping you build one card at a time.

## User journey

### First run

1. Install Lovelacer Add-on from the HA Add-on Store (custom repository).
2. Open Lovelacer in the sidebar.
3. Click **Analyze** — backend pulls entity/device/area registries.
4. Review the room-by-room preview. Confidence indicators flag uncertain assignments.
5. Adjust assignments via drag-and-drop or the override panel.
6. Click **Generate dashboard** — a new dashboard appears in HA's sidebar (e.g., "Lovelacer — Home").
7. Open it in HA, decide if it's better than the existing one.

### Ongoing use

- Add a new integration → 15 new entities appear.
- Open Lovelacer → click **Re-analyze** → diff view shows new entities and where they'd be placed.
- Click **Update dashboard** → new entities appear in the right rooms.

## Distribution

**Primary:** HA Add-on Store via custom repository (`github.com/<owner>/lovelacer-addon`). Users add the repo URL once, then install like any other Add-on. Supervisor handles auth, lifecycle, ingress.

**Secondary:** Standalone Docker Compose for HA Core users (no Supervisor). Requires the user to create a long-lived access token and configure URL.

**Not pursued:** HACS integration. HACS distributes frontend cards and Python integrations, not full Add-ons.

## Positioning and messaging

The Tier 1 launch leads with **"a clean starting dashboard you can actually use, in five minutes"** — a concrete, time-bound, undramatic value proposition. AI features are deliberately not part of the v1 marketing.

The reasoning: the HA community has high tolerance for "useful tools" and high suspicion of "AI-powered" framings. Launching as "AI HA dashboards" puts us in the same bucket as a dozen other recent HACS projects competing for attention with LLM-themed pitches. Launching as a solid heuristic tool that _also_ has AI as an upgrade path lets the AI reveal itself once the user already trusts the basics.

Tier 2 marketing comes ~3 months after Tier 1, framed as "better detection, smart suggestions" — never the headline.

## Monetization

Three-tier model. Tiers 1 and 2 ship in the same Add-on, gated by configuration. Tier 3 is a separately operated optional service — built only after Tier 2 proves demand.

### Tier 1 — Free / OSS

- Full heuristic-based generation, multi-language detection, manual overrides, YAML export
- MIT license, public repo
- Distributed via HA Add-on Store (custom repository) and standalone Docker
- Funded by GitHub Sponsors / Open Collective if at all

This is the entire current MVP scope. The 80% solution.

### Tier 2 — AI / Bring Your Own API Key

- Same Add-on as Tier 1; AI features unlock when user configures an LLM provider
- Supported providers: **Anthropic, OpenAI, Ollama (local), Lovelacer Cloud**
- User pays the LLM provider directly — Lovelacer earns nothing from this tier directly
- Privacy-respecting by design: Ollama users get full features with zero external requests
- Why no monetization here: builds adoption, builds the community, sets up Tier 3

Detailed feature list and architecture in [`AI_FEATURES.md`](./AI_FEATURES.md).

### Tier 3 — Lovelacer Cloud / Pro (future, optional)

- For users who want Tier 2 features without managing their own API key
- License-key-authenticated relay endpoint (Cloudflare Worker) forwards inference to Anthropic
- Subscription billing via Stripe
- Tentative pricing: $5/mo (basic, ~50 runs), $15/mo (unlimited + Sonnet-class), $99 lifetime
- Lovelacer eats inference cost as part of subscription

**Build only if Tier 2 metrics show clear demand.** Tier 3 adds significant operational burden (uptime, billing, support, EU VAT) that's not worth taking on speculatively. The right time to build it is when there's a queue of users asking for it.

### Why this model works for the HA community

The HA audience is privacy-conscious and self-hosting-first. A pure cloud SaaS would alienate the exact users who should love this tool. The three-tier model lets:

- Privacy purists run fully local (Tier 1 or Tier 2 with Ollama)
- Pragmatists pay providers directly (Tier 2 with Anthropic / OpenAI)
- Convenience-seekers pay Lovelacer (Tier 3, when available)

Same codebase serves all three. No feature is paywalled inside the OSS — what's paywalled is the convenience of Lovelacer running infrastructure on your behalf.

### What we're NOT doing

- Free tier with crippled features designed to push upsells
- Cloud-only service that locks users into Lovelacer
- Telemetry on free users to monetize via ads or data
- Closed-source paid version

## Success metrics

### Acquisition (first 6 months)

- 1,000 Add-on installs
- 100 GitHub stars
- 10 contributor PRs merged

### Activation

- ≥ 70% of installs run **Generate** at least once
- ≥ 50% apply the generated dashboard

### Quality (the actual product test)

- ≥ 80% of generated dashboards have no room-detection errors flagged by the user
- ≥ 60% of users keep the generated dashboard untouched for at least 7 days
- ≥ 30% of users still have a Lovelacer-generated (or Lovelacer-derived, with their edits) dashboard after 30 days
- Median time from install to applied dashboard: **< 5 minutes**

### Retention

- ≥ 30% of users return within 30 days (re-run after adding integrations)

## Risks

| Risk                                                   | Likelihood | Mitigation                                                             |
| ------------------------------------------------------ | ---------- | ---------------------------------------------------------------------- |
| HA WebSocket API changes break us                      | Medium     | Pin to documented API, integration tests against multiple HA versions  |
| Generated dashboards look worse than user's manual one | High       | Preview-before-apply, never overwrite, generate as new dashboard       |
| Room detection fails for non-English HA installs       | High       | Multi-language detection from MVP, override UI is first-class          |
| Heuristics produce confident-but-wrong placements      | Medium     | Confidence scoring, low-confidence flagging, easy override             |
| Lovelace storage API isn't fully documented            | Medium     | Existing tools (HA frontend itself) use it; reverse-engineer if needed |
| Add-on Store review or distribution friction           | Low        | Custom repo bypasses official store review                             |

## Open questions

1. Should the first dashboard generation auto-set Lovelacer as the default dashboard, or always create alongside?
2. How do we handle entities with **no area** and unparseable names? Dump in a "Misc" room? Hide? Surface for review?
3. Devices spanning rooms (e.g., a multi-channel relay controlling lights in two rooms) — split entities or pick one?
4. Should we honor HA's `entity_category` (config/diagnostic) by hiding those, or surface them in a Settings view?
5. Floors (HA 2024.8+) — first-class layout primitive or just metadata for grouping?

## Approval gates

- [ ] PRD reviewed and signed off
- [ ] Architecture decisions confirmed (see [ARCHITECTURE.md](./ARCHITECTURE.md))
- [ ] Heuristics design reviewed (see [HEURISTICS.md](./HEURISTICS.md))
- [ ] Roadmap fits available time budget
- [ ] Project name finalized
