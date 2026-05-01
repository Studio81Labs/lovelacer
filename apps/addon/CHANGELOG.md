# Changelog

All notable changes to the Lovelacer add-on are documented here.

## [0.0.1] — Phase 1a alpha (unreleased)

Initial add-on packaging.

- Multi-arch images (aarch64, amd64, armv7) published to GitHub Container Registry.
- HA Supervisor ingress so Lovelacer opens through the HA sidebar.
- Two add-on options: `log_level` and `dashboard_url_path`.
- Bundled SPA + Fastify backend wired through `SUPERVISOR_TOKEN`.
- No persistence yet (`/data` is mounted but unused; placeholder for P1b).
