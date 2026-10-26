# Running Unsung Hero & Google Chat Integration Guide

## 1. Quick Start: Running the Project

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

---

### Step 1: Backend Setup & Running

Open a terminal in the project directory:

```bash
cd backend

# 1. Activate the virtual environment
source .venv/bin/activate

# 2. (Optional) Set your Gemini API key in backend/.env or your terminal:
# export GEMINI_API_KEY="your-gemini-api-key"

# 3. Seed the database with the synthetic team and activity data:
python -m scripts.seed_db

# 4. Start the FastAPI backend server:
uvicorn app.main:app --reload --port 8000
```

The backend API will be live at:
- **API Base**: `http://localhost:8000/api`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`

---

### Step 2: Frontend (Angular) Setup & Running

Open a second terminal window:

```bash
cd frontend

# 1. Install dependencies (if not already done):
npm install

# 2. Start the Angular development server:
npm start
```

The frontend will be live at:
- **Web App**: `http://localhost:4200`
- The Angular dev server proxies `/api` calls to `http://localhost:8000` via `proxy.conf.json`.

---

## 2. Getting a Gemini API Key

Unsung Hero uses the Google GenAI SDK (`google-genai`) with `gemini-3.8-flash` to classify activities, detect recognition moments, extract impact from launch docs, rate project complexity, and generate evidence-grounded performance review & promotion drafts.

### How to get an API key:
1. Go to **[Google AI Studio](https://aistudio.google.com/)** (`https://aistudio.google.com/`).
2. Sign in with your Google account.
3. Click **"Get API key"** in the top navigation or left sidebar.
4. Click **"Create API key"** and choose or create a Google Cloud project.
5. Copy the generated key.
6. Add it to your `.env` file in the project root or `backend/.env`:
   ```env
   GEMINI_API_KEY="AIzaSy..."
   GEMINI_MODEL="gemini-3.8-flash"
   ```

*Note: If no API key is provided, the project automatically runs in heuristic fallback mode so that all graphs, metrics, and drafts still work seamlessly without failing.*

---

## 3. Real Google Chat (GChat) Integration: Privacy, Security, & Architecture

Currently, the project uses an internal Chat clone with synthetic messages. When integrating with **actual Google Chat / Google Workspace Chat API**, you must design strictly around user privacy and data security.

### 3.1 Architecture Overview

```
Google Chat API (Events / Webhook / PubSub)
          │
          ▼
   Ingestion Filter
   ├── Opt-In Verification (User & Space)
   ├── Space Type Check (Never ingest direct 1:1 DMs without both parties' opt-in)
   └── Keyword / Ephemeral pre-filter
          │
          ▼
   PII & Security Scrubber (pii.py)
   ├── Mask email addresses, phone numbers
   ├── Strip passwords, API keys, tokens, session headers
   └── Remove sensitive enterprise keywords
          │
          ▼
   Normalized Activity Event (activity table)
          │
          ▼
   Gemini Classifier & Enrichment (Cached)
```

---

### 3.2 Required Google Cloud & Google Workspace Permissions

To read Google Chat messages via the official Google Chat REST API, your GCP project and OAuth consent screen will require:

1. **OAuth Scopes**:
   - `https://www.googleapis.com/auth/chat.spaces.readonly` — View chat spaces and conversations the app is added to.
   - `https://www.googleapis.com/auth/chat.messages.readonly` — Read messages in spaces where the app is explicitly invited or authorized.
2. **Google Workspace Admin Approval**:
   - Internal app verification: Workspace admins must allow-list the Unsung app in Google Workspace Admin Console (`admin.google.com > Security > Access and data control > API controls`).
   - Domain-Wide Delegation (if using a service account) or User OAuth consent.

---

### 3.3 Privacy & Security Guardrails: Ensuring User Privacy Is Not Violated

#### A. Dual-Consent (User + Space Level Opt-In)
- **User Opt-In**: Employees must explicitly opt in (`opted_in = true`) before any message they send or receive is processed.
- **Space Opt-In**: Only designated spaces (e.g. `#eng-payments`, `#ask-anything`, `#incident-response`) are monitored. Social, watercooler, or non-work spaces (e.g. `#random`, `#lunch`) must have monitoring permanently disabled.
- **Never Ingest DMs by Default**: Direct 1:1 messages between colleagues should never be analyzed unless both participants explicitly click "Opt-In & Share this conversation with Unsung".

#### B. PII & Secret Scrubbing Before Storage or LLM Calls
- Never send raw message text with personal identifiers (phone numbers, personal emails, residential addresses) to external models.
- Run deterministic regex and entropy scanners on every message to strip API keys, OAuth tokens, passwords, and database credentials before saving to the database.

#### C. On-Device / In-App Privacy Controls for the Employee
- **"What My Manager Sees" Live Preview**: An employee can switch to manager view anytime to see exactly what their manager is shown.
- **Hide Any Activity**: An employee can click **Hide** on any ingested message or activity with one click. Hidden items are immediately excluded from manager views, team graphs, and radar calculations.
- **Annotate & Dispute**: Employees can add contextual notes to explain an activity or dispute incorrect classifications.
- **Right to Be Forgotten / Data Export**: Employees can request full deletion of their activity history at any time.

#### D. Group Aggregation Minimums (No Surveillance of Individuals in Org Views)
- Group and department-level summaries (such as the Bias Check between remote vs. in-office employees) must require a **minimum group size of 5 (or configurable `MIN_GROUP_SIZE`)** to prevent de-anonymizing individuals.
- No surveillance metrics: Lines of code, keystrokes, message counts, or online hours are explicitly out of scope.

---

## 4. Demo Walkthrough Script (3 Minutes)

1. **Manager View (`karan`)**:
   - Open `/team` to view the Team Help Network graph.
   - Notice **Priya** is the largest node (most glue work) and highlighted with the largest recognition gap.
   - Check the **Alerts** card: *"93% of Priya's help went unacknowledged"*, plus the *Ghost Credit* detection alert.
2. **Employee View (`arjun`)**:
   - Switch persona to `arjun` using the persona switcher at the top right.
   - View `/employee/thanks`: A card appears: *"Priya unblocked you 7 times — say thanks"*.
   - Click **Say Thanks**: Pre-fills a cited recognition draft citing the specific schema migration blocker and opens the `gThanks` link.
3. **Employee View (`priya`)**:
   - Switch persona to `priya`.
   - Open `/employee/promo`: View the generated Promotion Packet (`L4 → L5`) with automatic ladder gap analysis. Notice *"0 unverified claims"* enforced by the server-side citation checker.
   - Open `/employee/privacy`: Hide an activity or add a personal note, and click **Preview What My Manager Sees** to verify it is omitted.
4. **Chat Integration Demo**:
   - Open `/chat` in the navigation to view the Google Chat clone.
   - Send a message in `#eng-payments` asking for help or thanking a peer.
   - Click **Sync Pipeline** in `/pipeline` to watch the newly sent message get ingested, classified, and reflected in the live team graph.
