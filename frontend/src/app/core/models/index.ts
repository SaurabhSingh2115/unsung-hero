// Shared TypeScript types — this file IS the API contract between backend and frontend.
// Backend (FastAPI) returns exactly these shapes (snake_case field names).

export type Role = 'employee' | 'manager';
export type Location = 'office' | 'remote';

export interface Person {
  id: string;               // readable id, e.g. "priya"
  name: string;             // "Priya Sharma"
  first_name: string;       // "Priya"
  initials: string;         // "PS"
  email: string;
  role: Role;
  title: string;            // "Senior Software Engineer"
  level: string;            // "L4"
  discipline: 'Engineering' | 'Design' | 'Product' | 'Management';
  location: Location;
  city: string;
  team: string;             // team id, e.g. "payments"
  manager_id: string | null;
  opted_in: boolean;
  avatar_color: string;     // hex
}

export type Source =
  | 'chat' | 'doc_comment' | 'code_review' | 'ticket'
  | 'calendar' | 'manual' | 'launch_doc' | 'recognition';

export type Category =
  | 'mentoring' | 'unblocking' | 'review' | 'documentation'
  | 'onboarding' | 'firefighting' | 'core';

export const GLUE_CATEGORIES: Category[] = [
  'mentoring', 'unblocking', 'review', 'documentation', 'onboarding', 'firefighting',
];

export type Dimension = 'Impact' | 'Collaboration' | 'Knowledge' | 'Quality' | 'Leadership' | 'Growth';

export interface Activity {
  id: string;               // "A-0042"
  actor_id: string;
  target_ids: string[];
  source: Source;
  timestamp: string;        // ISO 8601
  text: string;
  link: string;             // in-app route, e.g. "/chat/eng-payments?msg=m-123" or "/source/A-0042"
  project_id: string | null;
  project_name: string | null;
}

export interface Classification {
  category: Category;
  confidence: number;       // 0..1
  rationale: string;
  model: 'gemini' | 'heuristic';
  asks_for_help: boolean;
}

export interface Annotation {
  activity_id: string;
  person_id: string;
  hidden: boolean;
  note: string | null;
  disputed: boolean;
}

export interface EvidenceItem {
  activity: Activity;
  classification: Classification | null;
  annotation: Annotation | null;
  dimensions: Dimension[];
}

// ---------- Team (manager) ----------
export interface GraphNode {
  id: string;
  name: string;
  title: string;
  discipline: string;
  location: Location;
  glue_work: number;           // count of glue activities given
  glue_share: number;          // 0..1
  help_given: number;          // help activities with a target
  thanks_received: number;
  unacknowledged_pct: number;  // 0..1 share of help never thanked
  recognition_gap: number;     // -1..1 ; >0 = under-recognised vs team median
  bridge_score: number;        // 0..1 normalised betweenness
}
export interface GraphLink {
  source: string;              // helper id
  target: string;              // helped id
  weight: number;              // number of help activities
  categories: Partial<Record<Category, number>>;
}
export interface TeamGraph { team_id: string; team_name: string; nodes: GraphNode[]; links: GraphLink[]; }

export type AlertType = 'recognition_gap' | 'load_imbalance' | 'bus_factor' | 'ghost_credit' | 'burnout';
export interface Alert {
  id: string;
  type: AlertType;
  severity: 'high' | 'medium' | 'low';
  title: string;               // "70% of Priya's help went unacknowledged"
  detail: string;
  person_ids: string[];
  evidence_ids: string[];      // activity ids
}

export interface TeamStats {
  team_id: string;
  team_name: string;
  people_count: number;
  activity_count: number;
  glue_work_share: number;            // 0..1
  avg_time_to_unblock_hours: number | null;
  follow_through_rate: number | null; // 0..1
}

export interface BiasGroup {
  group: string;               // "remote" | "office"
  size: number;
  suppressed: boolean;         // true if size < min_group_size
  help_given: number | null;
  thanks_received: number | null;
  thanks_per_help: number | null;
}
export interface BiasCheck { min_group_size: number; groups: BiasGroup[]; note: string; }

// ---------- Profile (shared) ----------
export interface RadarDim { dimension: Dimension; score: number; evidence_count: number; explanation: string; }
export interface QuadrantPoint {
  project_id: string;
  project_name: string;
  impact: number;              // 0..100
  effort: number;              // number of activities the person did on it
  complexity: number;          // 1..5 (bubble size)
  role: 'owner' | 'contributor' | 'enabler';
  activity_ids: string[];
}
export interface ProfileStats {
  help_given: number;
  people_helped: number;
  thanks_received: number;
  unacknowledged_pct: number;
  glue_share: number;
  follow_through_rate: number | null;
  avg_time_to_unblock_hours: number | null;
  bridge_score: number;
  ripple_credit: number;
}
export interface Recognition {
  id: string;
  from_id: string;
  to_id: string;
  activity_refs: string[];
  type: 'kudos' | 'peer_bonus' | 'chat_thanks';
  message: string;
  sent_at: string;
  source: 'unsung' | 'chat' | 'recognition_tool';
}
export interface Profile {
  person: Person;
  view: 'self' | 'manager';
  radar: RadarDim[];
  quadrant: QuadrantPoint[];
  stats: ProfileStats;
  recognition_received: Recognition[];
}

// ---------- Thanks ----------
export interface UnthankedHelper {
  helper: Person;
  count: number;
  activities: (Activity & { category: Category })[];
  suggested_type: 'kudos' | 'peer_bonus';
}
export interface Digest { week_start: string; week_end: string; unthanked: UnthankedHelper[]; message: string; }
export interface ThankDraft {
  message: string;
  recognition_link: string;    // absolute URL to recognition tool, prefilled
  tool_name: string;           // "gThanks"
  activity_ids: string[];
  model: 'gemini' | 'heuristic';
}

// ---------- Generation ----------
export interface Claim { text: string; activity_ids: string[]; }
export interface DraftSection { title: string; claims: Claim[]; }
export interface GapDimension {
  dimension: Dimension;
  score: number;
  required: number;
  met: boolean;
  expectation: string;
  suggestion: string;
}
export interface GapAnalysis { current_level: string; next_level: string; dimensions: GapDimension[]; }
export interface Draft {
  person_id: string;
  kind: 'review' | 'promo';
  title: string;
  summary: string;
  sections: DraftSection[];
  citations_count: number;
  unverified_removed: number;  // claims dropped by server-side citation check
  model: 'gemini' | 'heuristic';
  generated_at: string;
  gap_analysis: GapAnalysis | null;
  markdown: string;            // ready-to-export markdown
}

export interface BragMonth { month: string; label: string; items: EvidenceItem[]; }
export interface BragDoc { person_id: string; months: BragMonth[]; }
export interface Translation { activity_id: string; original: string; business_impact: string; model: 'gemini' | 'heuristic'; }

export interface OneOnOne {
  person: Person;
  wins: EvidenceItem[];
  blockers: EvidenceItem[];
  unthanked_help: UnthankedHelper[];   // help this person received but has not thanked
  help_unacknowledged: number;         // help this person gave that went unthanked (count)
  burnout: { flag: boolean; reason: string } | null;
  open_action_items: number;
}

export interface Project {
  id: string; name: string; owner_ids: string[];
  start: string; end: string | null;
  impact_summary: string; impact_metric: string | null; impact_value: string | null;
  users_affected: number | null; impact_quote: string | null;
  complexity: number; complexity_rationale: string;
}

export interface SourceRecord { activity: Activity; classification: Classification | null; raw: Record<string, unknown>; }

export interface AppConfig { recognition_tool_name: string; gemini_enabled: boolean; min_group_size: number; team_id: string; }

export interface PipelineStatus {
  gemini_enabled: boolean;
  total_activities: number;
  classified: number;
  by_model: { gemini: number; heuristic: number };
  sources: { source: Source; events: number }[];
  chat: { provider?: string; scenario?: string; spaces_total: number; spaces_opted_in: number; messages_total: number; messages_ingested: number; last_synced_at: string | null };
  classifier_eval: { precision: number; n: number } | null;
}

// ---------- Chat clone ("Chat" app, mimics Google Chat) ----------
export interface ChatSpace {
  id: string;                  // "eng-payments" or "dm-arjun-priya"
  name: string;                // "Payments Eng" (for DMs: other person's name from caller's view)
  kind: 'space' | 'dm';
  description: string;
  member_ids: string[];
  opted_in_to_unsung: boolean; // if false: banner "This space is not shared with Unsung"
  last_message_at: string | null;
  last_message_preview: string | null;
}
export interface ChatMessage {
  id: string;                  // "m-000123"
  space_id: string;
  thread_id: string | null;    // null = top-level message (thread root); else id of root message
  sender_id: string;
  text: string;                // may contain "@Priya" mentions (by first name)
  created_at: string;
  mentions: string[];          // person ids
  reply_count: number;         // for roots
  ingested: boolean;           // already pulled into Unsung as an activity
}
