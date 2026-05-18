# FAQ

## Does Lovelacer replace my existing dashboard?

No. Lovelacer creates or updates its own dashboard, normally at `lovelacer-home`. Your existing Home Assistant dashboards stay in place.

## Do I need to write YAML?

No. The default apply path writes a native Lovelace storage-mode dashboard through Home Assistant APIs. YAML export exists for users who want to keep a copy or customize by hand.

## What Home Assistant installs are supported?

Home Assistant OS and Home Assistant Supervised are supported through the add-on. Home Assistant Core and Container users can run Lovelacer with standalone Docker by providing `HA_URL` and a long-lived access token.

## Does Lovelacer need internet access?

The add-on needs internet access during installation or update to pull the image from GHCR. After that, the runtime talks to Home Assistant. Optional AI providers may require outbound internet access if enabled.

## Are AI features required?

No. AI features are optional and off by default. The standard analyzer uses deterministic heuristics. If AI features are enabled later, they must respect configured provider credentials, confidence thresholds, and cost or call caps.

## What data leaves my Home Assistant instance?

In the default heuristic mode, entity metadata stays inside the Lovelacer runtime and Home Assistant. If optional AI features are enabled, selected entity context may be sent to the configured provider according to that provider's terms.

## How do I fix wrong room assignments?

Use Home Assistant areas where possible, then re-run analysis. Lovelacer also includes override controls so you can move, hide, or bulk-assign entities and preserve those decisions across future runs.

## Can I run it for development?

Yes. The repository includes a local Home Assistant fixture stack:

```bash
pnpm install
pnpm dev:ha
pnpm fixtures:load
pnpm dev
```

This gives you a repeatable local install for analyzer, generator, server, and web work.
