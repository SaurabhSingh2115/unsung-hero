# Unsung — API contract

All endpoints are under `/api`. The caller identifies themselves with the header
`X-User-Id: <person id>` (demo auth — persona switcher). Response field names are
snake_case and match `frontend/src/app/core/models/index.ts` exactly.

## Personas (team id `payments`, team name "Payments Platform")

| id | name | role | title / level | discipline | location | story |
|---|---|---|---|---|---|---|
| `priya` | Priya Sharma | employee | Senior Software Engineer, L4 | Engineering | office (Bangalore) | Unblocks everyone, reviews the most, thanked the least — the hero |
| `arjun` | Arjun Mehta | employee | Software Engineer, L4 | Engineering | office | Ships the Billing v2 launch, mostly unblocked by Priya |
| `rahul` | Rahul Verma | employee | Software Engineer, L3 | Engineering | remote (Pune) | His edge-cache idea is presented by someone else (ghost credit) |
| `meera` | Meera Iyer | employee | Product Manager, L5 | Product | office | Bridges Design and Engineering (bridge score) |
| `karan` | Karan Kapoor | manager | Engineering Manager, L6 | Management | office | Uses the manager view; manager of everyone else |
| `sana` | Sana Khan | employee | Product Designer, L4 | Design | office | Background |
| `dev` | Dev Patel | employee | Software Engineer, L3 | Engineering | remote | New hire, being onboarded |
| `lin` | Lin Chen | employee | UX Researcher, L3 | Design | remote | Background |

## Access rules
- Employee: can read/write only their own `/person/{id}/*` data.
- Manager: can read their reports' profiles, evidence (manager visibility: hidden items removed), review drafts, 1:1 prep, and all `/team/*` endpoints.
- `as_manager=true` on profile/evidence = "What my manager sees" preview for the employee themself.
- Chat endpoints: any persona; only spaces where caller is a member.

## Endpoints

### People / config
| Method | Path | Returns |
|---|---|---|
| GET | `/people` | `Person[]` (no auth needed) |
| GET | `/me` | `Person` |
| GET | `/config` | `AppConfig` |
| GET | `/projects` | `Project[]` |
| PUT | `/person/{id}/opt-in` body `{opted_in}` | `Person` |

### Team (manager only)
| GET | `/team/{team_id}/graph` | `TeamGraph` |
|---|---|---|
| GET | `/team/{team_id}/alerts` | `Alert[]` |
| GET | `/team/{team_id}/stats` | `TeamStats` |
| GET | `/team/{team_id}/bias-check` | `BiasCheck` |

### Person
| Method | Path | Returns |
|---|---|---|
| GET | `/person/{id}/profile[?as_manager=true]` | `Profile` |
| GET | `/person/{id}/evidence?dimension=&category=&as_manager=&limit=` | `EvidenceItem[]` (newest first) |
| GET | `/person/{id}/unthanked-helpers` | `UnthankedHelper[]` |
| GET | `/person/{id}/digest` | `Digest` (last 7 days) |
| POST | `/person/{id}/thank-draft` body `{helper_id, activity_ids, type}` | `ThankDraft` |
| POST | `/recognition` body `{to_id, activity_ids, type, message}` | `Recognition` (marks thanks sent; recognition gap updates) |
| POST | `/person/{id}/review-draft` (manager) | `Draft` |
| POST | `/person/{id}/promo-packet` (self) | `Draft` with `gap_analysis` |
| GET | `/person/{id}/brag-doc` | `BragDoc` |
| POST | `/person/{id}/translate` body `{activity_ids}` | `Translation[]` |
| GET | `/person/{id}/one-on-one` (manager) | `OneOnOne` |

### Activity
| Method | Path | Returns |
|---|---|---|
| GET | `/activity/{id}` | `SourceRecord` (activity + raw source payload) |
| POST | `/activity/{id}/annotate` body `{hidden?, note?, disputed?}` | `Annotation` |
| POST | `/activity` body `{text, target_ids, timestamp, project_id?, request_confirmation}` | `Activity` (manual entry) |

### Pipeline
| GET | `/pipeline/status` | `PipelineStatus` |
|---|---|---|
| POST | `/pipeline/sync` | `PipelineStatus & {new_activities}` — pulls new chat messages, classifies, recomputes |

### Chat clone ("Chat")
| Method | Path | Returns |
|---|---|---|
| GET | `/chat/spaces` | `ChatSpace[]` caller is member of, newest activity first |
| GET | `/chat/spaces/{id}` | `ChatSpace` |
| GET | `/chat/spaces/{id}/messages` | `ChatMessage[]` oldest first (roots and replies; group by `thread_id`) |
| POST | `/chat/spaces/{id}/messages` body `{text, thread_id}` | `ChatMessage`. Server parses `@FirstName` mentions. New message is ingested into Unsung automatically in the background (if space is opted in). |
| POST | `/chat/dm` body `{member_id}` | `ChatSpace` (find or create DM) |

Seeded spaces: `payments-team` (all 8), `eng-payments` (engineers + Karan + Meera),
`design-product` (Meera, Sana, Lin, Karan), `incidents` (engineers + Karan),
`ask-anything` (all — onboarding Q&A), `random` (all — **not opted in to Unsung**), plus a few DMs.

### Links inside activities
- Chat activities: `link = "/chat/{space_id}?msg={message_id}"` → open chat clone and highlight message.
- Everything else: `link = "/source/{activity_id}"` → source viewer page using `GET /activity/{id}`.

### Recognition tool link
`ThankDraft.recognition_link` is built from `RECOGNITION_LINK_TEMPLATE` (env), with `{recipient}`, `{message}`, `{type}` URL-encoded.
