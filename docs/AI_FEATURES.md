# AI Features — Lovelacer

**Status:** Draft v1 · **Last updated:** 2026-04-27 · **Scope:** Tier 2 (AI / BYO key) and Tier 3 (Pro / managed cloud)

LLM-assisted analysis, suggestions, and natural-language operations on top of the OSS heuristic core.

## Vision

Heuristics get a Home Assistant install from messy to organized. AI gets it from organized to insightful. The free tier produces a working dashboard. The AI tier produces a dashboard that _understands_ the home — it knows which entities matter, which are noise, which need renaming, and which automations are sitting in plain sight waiting to be written.

## Why a tiered model

The HA community is privacy-conscious, so a pure cloud SaaS would be a poor fit. Three tiers map to how inference is paid for, not to feature gating:

1. **Free / OSS** — Heuristics only. Nothing leaves the local network. The 80% solution.
2. **AI / BYO key** — User chooses their LLM provider (including local Ollama). Privacy is in the user's hands. The 99% solution.
3. **Managed cloud** — For users who want the AI tier without managing API keys. Lovelacer relays inference. Optional offering, not a paywall on any feature.

Tiers 1 and 2 ship in the same Add-on, gated by configuration. The managed-cloud tier is an optional later product.

## AI features catalog

### F1 — AI-assisted room detection (the killer feature)

When the heuristic chain returns confidence below a threshold (default 0.5), call the LLM with the entity's metadata and the list of detected rooms. LLM returns a room assignment with reasoning.

**Why valuable:** Heuristics handle 80–85% of entities with high confidence. The remaining 15–20% are where AI shines — opaque entity IDs (`sensor.0x158d000123abcd`), multi-language mixed installs, manufacturer-coded names that humans can read but regex can't.

**Implementation:**

```typescript
async function aiResolveLowConfidence(entity: NormalizedEntity, rooms: Room[]) {
  if (entity.heuristicConfidence >= 0.5) return null

  const prompt = buildEntityPrompt(entity, rooms)
  const result = await llm.complete(prompt, EntityAssignmentSchema)

  return {
    roomId: result.room_id,
    confidence: Math.min(0.85, result.confidence), // cap below human-set
    reasoning: result.reasoning,
    source: 'ai' as const,
  }
}
```

Cost: ~500 input + 100 output tokens per low-confidence entity. For a 200-entity install with 30 low-confidence cases, roughly 18k input / 3k output tokens — about $0.005 with Haiku-class models, $0.05 with Sonnet-class.

### F2 — Entity rename suggestions

Detect entities with opaque IDs and propose human-readable renames using device metadata.

**Trigger:** Entity ID matches `/^[a-z]+\.0x[a-f0-9]+/i` or `/^[a-z]+\.[a-f0-9]{8,}/i` or contains the device manufacturer's serial pattern.

**Output:** "Rename `sensor.0x158d000123abcd_temperature` → `sensor.kitchen_temperature`?" with one-click apply via HA's `config/entity_registry/update_entity` WebSocket call.

This is genuinely useful — most users have a backlog of unreadable entity IDs they've been meaning to clean up.

### F3 — Layout suggestions

After generation, ask the LLM to critique the dashboard structure.

**Examples:**

- "Living Room has 27 entities. Consider splitting media-related entities (8 entities) into a 'Living Room Media' subview."
- "Your Office and Studio rooms have similar entity types and only 3–4 entities each. Consider merging."
- "Kitchen lacks any sensors. Want a placeholder for future additions?"

The LLM sees the post-generation structure (rooms, entity counts, domain distribution) and suggests structural changes. User accepts or dismisses.

### F4 — Natural-language operations

A chat-like input on the Review screen. User types intent, AI translates to override operations.

**Examples:**

- "Move all the Hue lights from the office to the bedroom" → identify entities, set overrides, regenerate
- "Hide all the diagnostic battery sensors" → bulk override with `room_id: null`
- "Group everything from my Sonos system into a Media room" → identify entities by manufacturer, create new room, override

**Implementation:** Two-step. First call: LLM translates NL to a structured operation plan. Second call: user reviews proposed operations before applying. Never auto-apply NL commands.

### F5 — Inline reasoning hints

Tooltips and hover states explaining decisions:

- Hover a low-confidence entity → "Placed in Misc because the entity ID `sensor_3` contains no room information and the device has no area assigned."
- Hover a room badge → "5 entities placed via area_id, 3 via name matching, 2 via AI inference."
- Hover a card → "Tile card chosen because this is a `light` entity with brightness control. Switch to Mushroom card pack for a different style."

These are cheap to generate (cache in SQLite, regenerate only on entity change) and dramatically improve UX trust.

### F6 — Automation suggestions (adjacent territory)

After analysis, the LLM scans for automation patterns:

- Motion sensor + light in same room without an existing automation → suggest motion-activated light
- Door sensor + alarm without arm-on-leave automation → suggest presence-based arming
- Multiple lights in a room without a "all off" scene → suggest scene creation

This overlaps with HACS's [AI Automation Suggester](https://github.com/ai-automation-suggester) but our advantage is integration with the dashboard generation flow — suggestions appear in context, not as a separate tool.

**Boundary:** We _suggest_ automations and provide YAML the user can copy. We don't auto-create them. Stays inside the dashboard product's scope.

### F7 — Style learning from existing dashboards

User points Lovelacer at an existing handcrafted dashboard (Mushroom-built, custom YAML, etc.). AI parses it and identifies:

- Preferred card types (tile vs Mushroom vs custom)
- Grouping patterns (by floor / by domain / by activity)
- Naming conventions
- View structure preferences

Future generations match the user's style instead of imposing Lovelacer defaults. This is the killer "doesn't feel generic" feature for power users.

### F8 — Reanalyze with feedback (continuous improvement)

User clicks "regenerate" on a partial section. AI uses prior overrides as training signal: "I see you moved 5 sensors to the Garage. The next time I see similar sensors, I'll prefer Garage."

Per-install learning, stored locally in SQLite. No data leaves the user's HA — feedback shapes prompts, not external models.

## Tier 2 architecture (BYO key)

### LLM provider abstraction

```typescript
interface LLMProvider {
  name: string
  complete<T>(prompt: Prompt, schema: ZodSchema<T>): Promise<T>
  estimateCost(prompt: Prompt): { inputTokens: number; outputTokens: number; usd?: number }
  supportsStreaming: boolean
}

// Implementations
class AnthropicProvider implements LLMProvider {
  /* uses /v1/messages */
}
class OpenAIProvider implements LLMProvider {
  /* uses /v1/chat/completions */
}
class OllamaProvider implements LLMProvider {
  /* uses local /api/chat */
}
class LovelacerCloudProvider implements LLMProvider {
  /* uses Lovelacer relay */
}
```

The Add-on instantiates one provider based on configuration:

```yaml
# Add-on options
ai:
  enabled: true
  provider: anthropic # anthropic | openai | ollama | lovelacer-cloud
  model: claude-haiku-4-5 # provider-specific
  api_key: !secret ai_api_key
  base_url: '' # for Ollama or self-hosted endpoints
  budget:
    max_cost_per_run_usd: 0.10 # hard stop
    max_calls_per_run: 50 # safety
```

### Schema-validated outputs

Every LLM call returns structured JSON matching a Zod schema. No free-form prose interpretation:

```typescript
const EntityAssignmentSchema = z.object({
  room_id: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(200),
  alternative_rooms: z.array(z.string()).max(3).optional(),
})
```

Validation failures retry once, then fall through to "AI declined to answer; treat as Misc."

For Anthropic and OpenAI: use their structured-output / tool-use modes. For Ollama: use grammar-constrained generation if the model supports it, otherwise validate post-hoc with retry.

### Provider-specific notes

#### Anthropic

- Models supported: Claude Haiku 4.5 (recommended for cost), Claude Sonnet 4.6/4.7 (recommended for quality)
- API: `/v1/messages` with tool-use for structured output
- Auth: API key, configured in Add-on options
- Bring-your-own-key flow: user creates key at console.anthropic.com, pastes into Add-on config

#### OpenAI

- Models: GPT-4o-mini (cost), GPT-4o (quality)
- API: `/v1/chat/completions` with `response_format: json_schema`
- Auth: API key

#### Ollama (privacy-first, $0)

- Models: llama3.1:8b minimum, llama3.1:70b for quality
- API: local HTTP, default `http://homeassistant.local:11434`
- Performance: depends on hardware. RPi5 with 8GB can run 7B models slowly. Mini PC with NPU runs 70B comfortably.
- This is the killer privacy story — full AI features, zero external requests.

#### Lovelacer Cloud (Tier 3)

- Single endpoint: `https://api.lovelacer.dev/v1/inference`
- Auth: license key (UUID per subscriber)
- Backend forwards to Anthropic API (Lovelacer's account, Lovelacer eats the cost as part of subscription)
- See "Tier 3 architecture" below.

## Privacy boundaries

The single most important section. HA users will read this carefully.

### What gets sent to the LLM (Tier 2 with cloud provider)

For room detection (F1):

- entity_id, friendly_name
- domain, device_class, entity_category
- device.manufacturer, device.model, device.name_by_user
- area_id (if any)
- list of room canonical IDs available in the home

For other features: similar metadata only.

### What does NOT get sent

- Actual entity states or sensor readings
- HA install ID, IP address, URL
- User credentials, tokens, API keys
- Automation contents, script contents
- Any data outside the entity/device/area registries
- Anything from `secrets.yaml` or `configuration.yaml`

### Opt-in granularity

```yaml
ai:
  features:
    room_detection: true # F1
    rename_suggestions: false # F2
    layout_suggestions: true # F3
    natural_language: false # F4
    inline_hints: true # F5
    automation_suggestions: false # F6
    style_learning: false # F7
```

Each feature can be individually disabled. Disabling AI globally (`ai.enabled: false`) restricts the Add-on to OSS heuristic mode.

### Logging

Locally: full prompt + response logged at `debug` level for troubleshooting. Production default is `info` which logs only token counts.

Cloud (Tier 3): Lovelacer's relay logs only request count and aggregate token consumption per license key, for billing. Never prompt content. This is auditable — see "Tier 3 architecture" for the relay design.

### Local-only mode

Setting `provider: ollama` guarantees no network egress. The Add-on can be run on an HA instance that has the AI features fully blocked from the internet at the router. Documented as a first-class config.

## Cost analysis

Estimated cost per analysis run (200-entity install, ~30 low-confidence entities triggering F1, plus F3 layout review, plus inline hints):

| Provider       | Model             | Per run | Per month (4 runs) |
| -------------- | ----------------- | ------- | ------------------ |
| Anthropic      | Claude Haiku 4.5  | ~$0.02  | ~$0.08             |
| Anthropic      | Claude Sonnet 4.7 | ~$0.20  | ~$0.80             |
| OpenAI         | GPT-4o-mini       | ~$0.02  | ~$0.08             |
| OpenAI         | GPT-4o            | ~$0.25  | ~$1.00             |
| Ollama (local) | llama3.1:8b       | $0      | $0                 |

Most users will run analysis 1–4 times per month, so even cloud providers sit under $1/month with BYO key. The managed-cloud tier bundles inference into a flat fee; see the [managed-cloud architecture section](#tier-3-architecture-lovelacer-cloud-future) for details.

### Budget safety

Add-on enforces:

- `max_cost_per_run_usd` hard cap (uses provider pricing tables shipped with the Add-on)
- `max_calls_per_run` cap
- Token-counting before each call; aborts run with clear error if budget would be exceeded

UI surfaces estimated cost before each run with a confirm button.

## Prompt engineering

Prompts live in `packages/ai/prompts/` as TypeScript template functions. Versioned alongside code. Each prompt includes:

- System: role definition, output format expectations
- User: structured entity/room data
- Examples: 2-3 few-shot examples for the harder features

System prompts are intentionally short — long instructions degrade smaller models (Haiku, GPT-4o-mini, llama3.1:8b) more than they help.

### Example: F1 room detection prompt

```
SYSTEM:
You assign Home Assistant entities to rooms. You return only JSON matching the
provided schema. You never invent rooms not in the available list.

USER:
Available rooms: kitchen, living_room, master_bedroom, master_bath, office, garage, garden, misc

Entity:
- entity_id: sensor.0x158d000123abcd_temperature
- friendly_name: Temperature 4
- domain: sensor
- device_class: temperature
- device.manufacturer: Aqara
- device.model: WSDCGQ11LM
- device.name_by_user: Master Bath Temp Sensor
- area_id: null

Respond with JSON: { "room_id": "...", "confidence": 0.0-1.0, "reasoning": "..." }
```

The LLM sees the device's `name_by_user` ("Master Bath Temp Sensor") and resolves to `master_bath` with high confidence. Heuristics couldn't do this because they only check the entity friendly_name and entity_id, not device names — and the entity name is the unhelpful "Temperature 4".

(F5 would also be added later: have the analyzer pull device.name_by_user as a fourth heuristic source. The AI then catches what heuristics miss.)

## Failure handling

### LLM call fails (network, auth, rate limit)

Fall back to heuristic decision. Surface a non-blocking warning: "AI unavailable — used heuristics only. Check provider connection."

### LLM returns malformed output

Retry once with a clarification prompt. If still malformed, treat as no-answer.

### LLM returns a room not in the available list

Reject. Treat as no-answer.

### Cost cap reached mid-run

Abort cleanly. Save partial results. Display: "Analysis stopped at 47/200 entities — budget reached. Increase cap or use Ollama for unlimited runs."

### Provider down (Anthropic outage, Ollama not running)

Detect via initial health check before run. Refuse to start; offer to fall back to heuristics-only.

## Tier 3 architecture (Lovelacer Cloud, future)

**Build only after Tier 2 proves demand.** Sketched here so the Add-on architecture supports it from day one.

### Components

```
                    ┌──────────────────────────────────┐
                    │   Lovelacer Add-on (user's HA)   │
                    │  provider: lovelacer-cloud        │
                    │  license_key: ABC-123-XYZ         │
                    └────────────┬─────────────────────┘
                                 │ HTTPS
                                 ▼
            ┌────────────────────────────────────────────┐
            │  Cloudflare Worker (api.lovelacer.dev)     │
            │                                             │
            │  1. Validate license key (KV lookup)        │
            │  2. Check rate limits                       │
            │  3. Forward to Anthropic API                │
            │  4. Log token usage to D1                   │
            └────────────────────────┬───────────────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │  Anthropic API      │
                          │  (Lovelacer's key)  │
                          └─────────────────────┘
```

### Stack

- **Cloudflare Workers** for the relay (cheap, edge-cached, scales)
- **Cloudflare KV** for license keys
- **Cloudflare D1** for usage tracking
- **Stripe** for subscription billing + license key issuance
- **Anthropic API** under the hood (Claude Haiku 4.5 default, Sonnet for premium)

### Pricing model

Pricing is not finalised; the working assumptions live in [`ROADMAP.md`](./ROADMAP.md#open-questions) and will be resolved against Tier 2 adoption data before the managed-cloud tier is built. Whatever the final shape, the relay design above is intentionally cheap to operate so the margin can be modest and the tier remains a convenience option rather than a subsidy carrier.

Billing will be Stripe-managed, with no card-on-file held by Lovelacer. License keys would be emailed on signup.

### Why not build this in MVP

- Adds a service to operate (uptime, monitoring, support, billing)
- Requires legal setup (terms, privacy, billing entity in Czechia)
- Adds attack surface (license server can be DDoS'd, abused)
- Forces premature commitment to a pricing model
- BYO key tier accomplishes 90% of the differentiation for 0% of the operations work

Build it only if Tier 2 metrics show real demand: high adoption, frequent re-runs, requests for "I don't want to manage an API key."

## Ticket additions to roadmap

These extend [`ROADMAP.md`](./ROADMAP.md). Inserted as a new Phase 4 (between current "Phase 3 — Adoption response" and current "Phase 4 — Suggestions Engine").

### Phase 4 — AI tier MVP (4 weeks, ~20 evenings)

#### P4-1 — LLM provider interface · M

Define `LLMProvider` interface, `Prompt` and result types, error handling contract.
**AC:** Interface documented; mock provider for testing returns deterministic outputs.

#### P4-2 — Anthropic provider · M

Implementation calling `/v1/messages` with tool-use for structured output.
**AC:** Returns valid `EntityAssignmentSchema` from a real API call; handles auth errors gracefully; respects budget cap.

#### P4-3 — Ollama provider · M

Implementation for local Ollama. Health check on connect.
**AC:** Works against a local Ollama running llama3.1:8b; structured output validated.

#### P4-4 — OpenAI provider · S

Implementation calling `/v1/chat/completions` with `json_schema` response format.
**AC:** Returns valid output from a real API call.

#### P4-5 — F1 room detection (AI fallback) · M

Wire AI into the analysis pipeline as a fallback when heuristic confidence < threshold.
**AC:** Pathological fixture (high misc rate) shows misc bucket reduced ≥50% with AI enabled; reasoning captured per assignment.

#### P4-6 — F5 inline reasoning hints · S

Generate human-readable reasoning for assignments. Cache per-entity in SQLite.
**AC:** Hover tooltip shows reasoning; cache hit rate >90% on repeated views.

#### P4-7 — F2 rename suggestions · M

Detect opaque entity IDs, generate rename suggestions, one-click apply via HA's `config/entity_registry/update_entity`.
**AC:** Suggestions appear for ≥80% of opaque IDs in fixtures; rename succeeds on dev HA.

#### P4-8 — F3 layout suggestions · M

After generation, run layout review prompt, surface suggestions in UI.
**AC:** Suggestions are actionable (accept = re-generate with adjustment); dismissed suggestions don't reappear.

#### P4-9 — Add-on AI configuration UI · S

Surface provider, model, API key, budget caps in Add-on options panel.
**AC:** Fresh install shows empty AI config; valid config enables AI features in UI.

#### P4-10 — Cost tracking + budget enforcement · M

Token counting per call, running total per run, hard stop at budget.
**AC:** Test scenario with 1000 entities and tiny budget gracefully stops with partial results.

#### P4-11 — Privacy documentation · S

Detailed `docs/PRIVACY.md` listing exactly what gets sent for each feature, per provider.
**AC:** Doc reviewed against actual prompt code; no discrepancies.

#### P4-12 — Tier 2 release · S

Feature flag rollout, blog post, demo video showing AI features in action.

### Phase 5 — Advanced AI (post-Tier-2 adoption, ~15 evenings)

- F4 natural language operations
- F6 automation suggestions
- F7 style learning
- F8 reanalyze with feedback

### Phase 6 — Lovelacer Cloud (only if demand validates, ~30 evenings)

Tier 3 buildout: Cloudflare Worker relay, license keys, Stripe, marketing site, support process.

## Open questions

1. Should AI features be free for the OSS user when using Ollama (local, $0 cost)? **Yes — same Add-on, same code, no gating.** The "tier" concept is really about how inference is paid for, not feature gating.
2. Default model recommendations per provider — ship sensible defaults (Haiku for Anthropic, GPT-4o-mini for OpenAI, llama3.1:8b for Ollama)?
3. How aggressive should the `ai_confidence_threshold` default be? 0.5 sweet spot, configurable.
4. Should F4 natural language operations be guarded behind a "two-step confirm" UX or trust the LLM more aggressively? Two-step for first release.
5. Multi-model strategy: cheap Haiku for F1/F2/F5, expensive Sonnet for F3/F4/F7 where quality matters more? Worth testing.

For broader product-roadmap-level open questions (managed-cloud pricing, build trigger, custom card support), see [`ROADMAP.md`](./ROADMAP.md#open-questions).
