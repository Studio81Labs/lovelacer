---
layout: home

hero:
  name: Lovelacer
  text: Home Assistant dashboards that organize themselves.
  tagline: Analyze your Home Assistant registry, preview a useful room-first dashboard, and apply it without writing Lovelace YAML.
  image:
    src: /brand/lovelacer-lockup.svg
    alt: Lovelacer logo
  actions:
    - theme: brand
      text: Install on Home Assistant
      link: /install/supervised
    - theme: alt
      text: Run standalone Docker
      link: /install/standalone-docker

features:
  - title: Built for real HA installs
    details: Lovelacer reads entities, devices, areas, floors, and dashboard storage through Home Assistant APIs, then keeps the generated dashboard native.
  - title: Preview before apply
    details: Review detected rooms, unassigned entities, suggestions, and the generated dashboard before Lovelacer writes anything back.
  - title: Optional AI, off by default
    details: The heuristic pipeline is the default path. AI features require explicit runtime configuration and cost limits.
---

## What Lovelacer does

Lovelacer turns a Home Assistant install into a clean starting dashboard. It groups entities by room, chooses sensible Lovelace cards, previews the result, and applies a new dashboard through Home Assistant storage mode.

The project ships as a Home Assistant add-on first. Standalone Docker is available for development, testing, and users who run Home Assistant Core or Container.

## Start here

| Path                      | Use this when                                              | Guide                                                   |
| ------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| Home Assistant Supervised | You use HA OS or HA Supervised and have the add-on store   | [Install the add-on](./install/supervised.md)           |
| Standalone Docker         | You run HA Core, HA Container, or want a local dev runtime | [Run standalone Docker](./install/standalone-docker.md) |
| Architecture              | You want to understand the packages and data flow          | [Architecture](./architecture.md)                       |
| FAQ                       | You want answers before trying it                          | [FAQ](./faq.md)                                         |

## Current release posture

Phase 2 is the public-alpha polish phase. The docs site exists so installation paths, architecture, deployment expectations, and operational limits stay discoverable outside the source tree.
