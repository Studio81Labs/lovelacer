## 0.2.0 — 2026-05-07

### Phase 2 (Polish & Release)

- Re-analyze diff view: see what changes when you re-run Analyze.
- YAML export: save the generated dashboard as YAML alongside storage-mode apply.
- Floor-aware grouping: rooms group by floor when areas have a floor assigned.
- Bulk-assign for the Misc bucket: select multiple unscoped entities and assign in one click.
- Suggestions panel: smart improvements with one-click accept.
- Settings screen: configure language and which dashboard sections appear.
- Onboarding wizard: first-run flow walks new users through analyze → preview → apply.
- Brand identity: new logo, full visual identity, Inter + Instrument Serif typography, self-hosted fonts.

### Phase 1b (already shipped, summarised)

- Multi-language room detection: EN, CS, DE, ES, FR, IT, PL, NL.
- Per-entity overrides: drag rooms manually, mark entities hidden.
- Invite-code gate for closed alpha.
- HA add-on packaging with multi-arch images (aarch64, amd64, armv7).

### Phase 1a (already shipped, summarised)

- Initial analyze + apply flow against a single HA instance.
- HA storage-mode dashboard generation.
- WebSocket connection with retry/backoff.
