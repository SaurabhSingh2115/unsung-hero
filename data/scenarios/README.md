# Data scenarios

Each folder here is a self-contained dataset the app is seeded from. Pick one with
`DATA_SCENARIO=<folder>` in `.env` (default `payments-demo`) or `python -m scripts.seed_db --scenario <folder>`.

To add a story, edit or add JSON and re-run `python -m scripts.seed_db`. No code changes needed.
The seeder validates every file first and lists any unknown person/space ids.

## Layout

```
<scenario>/
├── team.json              # team + people (who exists, roles, levels, managers)
├── ladder.json            # level expectations per radar dimension (used by promo gap analysis)
├── projects.json          # projects; each points to a launch doc for impact extraction
├── launch_docs/*.md       # launch/impact reports (metrics are extracted from these)
├── chat/
│   ├── spaces.json        # chat spaces + DMs, and whether each is opted in to Unsung
│   └── threads/*.json     # conversations; one file per scenario type (add files freely)
├── doc_comments.json      # design docs / guides and their comments
├── code_reviews.json      # code reviews (reviewer helps author)
└── recognitions.json      # thanks already given in the recognition tool
```

## Adding a chat scenario

Drop a new file in `chat/threads/`, e.g. `chat/threads/pairing.json`:

```json
{
  "description": "Pair-programming sessions",
  "threads": [
    {
      "space": "eng-payments",
      "start": "2026-10-12T15:00:00",
      "messages": [
        {"sender": "dev",   "text": "Stuck on the webhook signature test", "label": "core"},
        {"sender": "priya", "text": "Use the fixed clock fixture, pairing link in DM", "after_minutes": 10,
         "mentions": ["dev"], "label": "unblocking"}
      ]
    }
  ]
}
```

- First message is the thread root; the rest are replies, each `after_minutes` after the previous one.
- Repliers automatically get the root author as a target (that's how the help graph is built).
- `label` is optional ground truth (`mentoring | unblocking | review | documentation | onboarding |
  firefighting | core`). Without it, the classifier decides.
- Messages in spaces with `"opted_in": false` are stored in the chat clone but never ingested.

## New scenario from scratch

Copy `payments-demo/`, edit, then run `python -m scripts.seed_db --scenario <new-folder>`.
Only `team.json` is required; every other file is optional.

## Real integrations

Chat comes from a pluggable provider (`CHAT_PROVIDER=local|gchat`). With `local`, the
`chat/` folder seeds the built-in chat clone. Once Google Chat access is approved, switch to
`gchat` and the scenario's `chat/threads` are ignored; people, projects and ladder still load from here.
See `backend/app/ingestion/chat_providers/gchat.py`.
