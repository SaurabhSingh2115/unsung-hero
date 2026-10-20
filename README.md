# Unsung Hero

> Find the invisible work that holds teams together, and make sure it gets credited.

## How it works

```
ingestion → enrichment → metrics → api → frontend
                                     ↘ generation
```

## Directory structure

```
unsung-hero/
├── backend/
│   ├── app/
│   │   ├── ingestion/     # pulls data from all sources into one format
│   │   ├── enrichment/    # Gemini tags each activity
│   │   ├── metrics/       # all scores and graphs (no AI)
│   │   ├── generation/    # Gemini writes review / promo / thank-you drafts
│   │   ├── gemini/        # shared Gemini client
│   │   ├── api/           # REST endpoints
│   │   ├── services/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── core/
│   ├── synthetic/         # fake team data generator
│   ├── scripts/
│   └── tests/
├── frontend/              # Angular app
│   └── src/app/
│       ├── features/      # manager, employee, profile screens
│       ├── core/
│       └── shared/
├── data/                  # synthetic data, mock docs, eval set
├── infra/                 # deploy config
└── docs/
```
