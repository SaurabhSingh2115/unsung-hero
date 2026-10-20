# Unsung

> Find the invisible work that holds teams together, and make sure it gets credited.

Full design: [`docs/design-doc.md`](docs/design-doc.md)

## How data flows

```
ingestion  →  enrichment  →  metrics  →  api  →  frontend
 (normalize)   (Gemini tags)  (pure math)  (REST)   (Angular)
                                              ↘ generation (Gemini drafts, citation-checked)
```

## Directory structure

```
unsung-hero/
├── backend/
│   ├── app/
│   │   ├── core/          # config, DB connection, roles & permissions
│   │   ├── models/        # DB tables — one file per table
│   │   ├── schemas/       # request/response shapes for the API
│   │   ├── ingestion/     # turns every source into one Activity Event format
│   │   │   └── sources/   #   one file per source: chat, code reviews, calendar, ...
│   │   ├── gemini/        # shared Gemini client + response cache
│   │   ├── enrichment/    # Gemini tags activities: category, thanks, impact, complexity
│   │   │   └── prompts/
│   │   ├── metrics/       # all numbers: help graph, recognition gap, radar — no AI here
│   │   ├── generation/    # Gemini writes drafts: review, promo packet, thank-you
│   │   │   └── prompts/   #   citation_check.py drops any claim without evidence
│   │   ├── services/      # ties metrics + generation together for each endpoint
│   │   └── api/routes/    # REST endpoints: team, person, activity, recognition
│   ├── synthetic/         # fake team (Priya, Arjun, ...) and data generator
│   ├── scripts/           # one-off commands: seed DB, run enrichment, eval classifier
│   └── tests/
├── frontend/src/app/      # Angular (latest, standalone components)
│   ├── core/              # api service, auth (role guard, user interceptor), models, mocks
│   ├── features/
│   │   ├── manager/       #   team graph, alerts, review draft
│   │   ├── employee/      #   promo packet, say-thanks cards, privacy, manual entry
│   │   └── profile/       #   shared by both: radar, quadrant, evidence timeline
│   ├── shared/            # reusable ui + chart components
│   ├── layout/            # app shell, nav, role switcher
│   └── app.routes.ts      # lazy-loaded routes per feature
├── data/                  # synthetic events, mock launch docs, level ladder, eval set
├── infra/                 # Cloud Run + Firebase deploy config
└── docs/                  # design doc, architecture, demo script
```

## Who owns what

| Role | Folders |
|---|---|
| Data / backend | `models`, `ingestion`, `metrics`, `services`, `api`, `synthetic` |
| AI | `gemini`, `enrichment`, `generation`, `data/eval` |
| Frontend | `frontend/` |
| Pitch | `docs/demo-script.md`, `data/mock_docs`, `data/levels` |
