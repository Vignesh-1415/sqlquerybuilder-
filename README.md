# Statement — Natural Language to SQL for SQLite

Upload a SQLite database, ask a question in plain English, and get back a safe,
read-only SQL query and its results — previewed before anything runs.

This is the real, working backend and frontend for the "Statement" concept:
a schema-aware NL→SQL tool built entirely on free tools.

---

## 1. Architecture summary

```
Browser (static HTML/CSS/JS)
      │  fetch()
      ▼
Express API  ──────────────►  Groq free-tier AI API (NL → SQL text)
      │
      ├─► better-sqlite3 (READ-ONLY) → the uploaded .sqlite file
      │        (schema inspection + query execution)
      │
      └─► better-sqlite3 (read/write) → statement_meta.db
               (app's own metadata: sessions + query history)
```

**Why this stack is fully free:**
| Layer | Choice | Why it's free |
|---|---|---|
| Frontend | Plain HTML/CSS/JS | No build tooling, deployable as static files on any free host |
| Backend | Node.js + Express | Open source, runs on any free Node host |
| "User" database | The visitor's own uploaded `.sqlite` file | Never stored anywhere but the server's local disk |
| App metadata database | SQLite (`better-sqlite3`) | File-based, zero external service, zero signup |
| AI provider | [Groq](https://console.groq.com) | Free tier, no credit card, OpenAI-compatible API |
| Deployment | Render/Railway (backend), Netlify/Vercel/GitHub Pages (frontend) | All have permanent free tiers |

**Why no login system:** there are no user accounts or persistent personal
data — each upload gets a random, unguessable session ID (a UUID) that scopes
access to that one database and its history, similar to a share link. This
keeps the "final project" scope honest to what the app actually needs. If you
extend this into a multi-user product, add a `users` table, hash passwords
with `bcrypt`, and issue a JWT on login — the `sessions` table already has the
right shape to add a `user_id` foreign key.

**Security model, by layer:**
1. **Input validation** — `express-validator` rejects malformed requests before they reach any logic.
2. **File-type/size limits** — only `.db`/`.sqlite`/`.sqlite3`, capped at 15MB, enforced by `multer`.
3. **Prompt grounding** — the AI only ever sees the real schema, so it can't invent tables/columns.
4. **SQL allow-listing** — every AI-generated query is parsed and rejected unless it's a single `SELECT`/`WITH` statement with no write/DDL keywords (`sqlSafety.service.js`).
5. **Defense in depth** — the query is then run through a connection opened `readonly: true` **and** `PRAGMA query_only = ON`, so even a query that somehow got past step 4 cannot write to the file. This was tested directly (see §10).
6. **Rate limiting** — `express-rate-limit` caps `/api/query` at 15 requests/minute per IP to protect the free AI quota.
7. **Security headers** — `helmet` sets `X-Content-Type-Options`, `X-Frame-Options`, etc. on every response.
8. **CORS allow-list** — only origins listed in `ALLOWED_ORIGINS` can call the API from a browser.

---

## 2. Folder structure

```
statement-app/
├── client/                      # Static frontend — deploy as-is, no build step
│   ├── index.html
│   ├── css/app.css
│   ├── js/config.js              # <- set your deployed API URL here
│   ├── js/app.js
│   └── assets/sample.sqlite      # bundled demo database ("Use the sample database")
│
├── server/                      # Node.js/Express backend
│   ├── src/
│   │   ├── index.js              # entrypoint
│   │   ├── app.js                # Express app + middleware stack
│   │   ├── config/env.js         # all environment variables, read once
│   │   ├── db/
│   │   │   ├── schema.sql        # metadata DB schema
│   │   │   └── metaDb.js         # metadata DB connection
│   │   ├── middleware/
│   │   │   ├── upload.js         # multer config (file type/size limits)
│   │   │   ├── rateLimiter.js
│   │   │   └── errorHandler.js
│   │   ├── routes/                # thin route -> controller wiring
│   │   ├── controllers/           # request/response glue
│   │   ├── services/
│   │   │   ├── sqliteInspector.service.js  # reads schema from uploaded file
│   │   │   ├── nlToSql.service.js          # calls the Groq API
│   │   │   ├── sqlSafety.service.js        # validates generated SQL is read-only
│   │   │   └── queryRunner.service.js      # executes the query, read-only
│   │   ├── validators/            # express-validator rule sets
│   │   └── utils/                 # asyncHandler, AppError, logger, cleanup job
│   ├── uploads/                   # uploaded .sqlite files live here (gitignored)
│   ├── data/                      # statement_meta.db lives here (gitignored)
│   ├── .env.example
│   ├── package.json
│   ├── Dockerfile
│   └── .dockerignore
│
├── seed/
│   └── sample.sqlite              # source of truth for the bundled demo DB
│
├── docker-compose.yml             # runs client + server together with one command
├── .gitignore
└── README.md
```

---

## 3. Database design

### 3a. The uploaded database (the user's own file)
Not part of this codebase — it's whatever `.sqlite` file the visitor uploads.
The bundled `seed/sample.sqlite` demo has this shape:

```sql
customers(id PK, name, email UNIQUE, country, created_at)
products(id PK, name, category, price)
orders(id PK, customer_id FK -> customers.id, product_id FK -> products.id,
       quantity, total, created_at)
```
6 customers, 6 products, 40 orders — enough relational depth to ask real
questions (joins, aggregates, date filters).

### 3b. The app's own metadata database (`server/data/statement_meta.db`)

```sql
CREATE TABLE sessions (
    id            TEXT PRIMARY KEY,     -- UUID, doubles as the upload's access token
    original_name TEXT NOT NULL,
    stored_path   TEXT NOT NULL,
    schema_json   TEXT NOT NULL,        -- cached schema, avoids re-reading the file every request
    size_bytes    INTEGER NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE query_history (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    question      TEXT NOT NULL,
    sql_text      TEXT NOT NULL,
    row_count     INTEGER NOT NULL DEFAULT 0,
    status        TEXT NOT NULL CHECK (status IN ('success','error')),
    error_message TEXT,
    duration_ms   INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```
One-to-many `sessions → query_history`, cascading delete so removing a
session clears its history automatically. This file is created and migrated
automatically on server start — nothing to run by hand.

---

## 4. API reference

Base URL: `http://localhost:4000/api` (local) or your deployed backend URL.
All responses are JSON in the shape `{ success, data | message, code? }`.

### `GET /health`
Liveness check.
```json
{ "success": true, "message": "Statement API is running.", "timestamp": "..." }
```

### `POST /upload`
`multipart/form-data`, field name **`database`**. Accepts `.db`/`.sqlite`/`.sqlite3`, max 15MB.

**201 Created**
```json
{
  "success": true,
  "message": "Database uploaded and schema detected.",
  "data": {
    "sessionId": "uuid",
    "fileName": "sample.sqlite",
    "sizeBytes": 32768,
    "schema": [
      { "table": "customers", "rowCount": 6,
        "columns": [{ "name": "id", "type": "INTEGER", "notNull": false, "primaryKey": true }, "..."],
        "foreignKeys": [] }
    ]
  }
}
```
Errors: `422 INVALID_FILE_TYPE`, `422 INVALID_SQLITE_FILE`, `422 EMPTY_DATABASE`, `400 LIMIT_FILE_SIZE`.

### `POST /query`
```json
{ "sessionId": "uuid", "question": "Which 5 customers spent the most?" }
```
**200 OK**
```json
{
  "success": true,
  "data": {
    "question": "Which 5 customers spent the most?",
    "sql": "SELECT customers.name, SUM(orders.total) AS spent FROM customers JOIN orders ON orders.customer_id = customers.id GROUP BY customers.id ORDER BY spent DESC LIMIT 5",
    "columns": ["name", "spent"],
    "rows": [{ "name": "Aisha Bello", "spent": 1275.43 }],
    "rowCount": 5,
    "durationMs": 812
  }
}
```
Errors: `404 SESSION_NOT_FOUND`, `422 VALIDATION_ERROR`, `422 NOT_READ_ONLY`,
`422 MULTI_STATEMENT`, `422 FORBIDDEN_KEYWORD`, `422 UNANSWERABLE`,
`429` (rate limited), `502 AI_PROVIDER_ERROR` / `AI_UNREACHABLE`.

### `GET /history/:sessionId`
Returns up to the last 50 questions asked for that session, newest first.

### `GET /session/:sessionId`
Returns the session's file info and cached schema (used to restore a
session after a page reload).

### `DELETE /session/:sessionId`
Deletes the uploaded file and its history.

---

## 5. Sample / test data

`seed/sample.sqlite` (also served at `client/assets/sample.sqlite` for the
"Use the sample database" button) contains customers, products, and orders.
Try asking it:
- "How many customers are there?"
- "Which 5 customers spent the most, and how much?"
- "What's the average order value by product category?"
- "List orders placed in the last 30 days."

There are no login credentials — the app has no accounts (see §1).

---

## 6. Local setup

**Requirements:** Node.js 18+, npm, a free [Groq](https://console.groq.com) API key.

```bash
# 1. Backend
cd server
cp .env.example .env
# open .env and paste your GROQ_API_KEY
npm install
npm run dev              # http://localhost:4000

# 2. Frontend (in a new terminal)
cd client
python3 -m http.server 8080     # or: npx serve .
# open http://localhost:8080
```
`client/js/config.js` already points at `http://localhost:4000/api` — no
change needed for local dev.

### Run everything with Docker instead
```bash
GROQ_API_KEY=your_key_here docker compose up --build
# client: http://localhost:8080   server: http://localhost:4000
```

---

## 7. Test cases (main features)

Run these against a local server (`npm run dev`) with `curl`, or use them as
a checklist in Postman/Insomnia.

| # | Feature | Steps | Expected result |
|---|---|---|---|
| 1 | Upload valid database | `POST /upload` with `sample.sqlite` | `201`, schema for `customers`/`products`/`orders` returned |
| 2 | Reject non-SQLite file | `POST /upload` with a `.txt` file | `400 INVALID_FILE_TYPE` |
| 3 | Reject oversized file | Upload a file > 15MB | `400`, `LIMIT_FILE_SIZE` |
| 4 | Question too short | `POST /query` with `question: "hi"` | `422 VALIDATION_ERROR` |
| 5 | Invalid session id | `POST /query` with `sessionId: "not-a-uuid"` | `422 VALIDATION_ERROR` |
| 6 | Unknown session | `POST /query` with a well-formed but unknown UUID | `404 SESSION_NOT_FOUND` |
| 7 | Missing AI key | Leave `GROQ_API_KEY` empty, ask a question | `500 MISSING_API_KEY`, logged to `query_history` as `status: error` |
| 8 | Destructive SQL is blocked | Directly unit-test `sanitizeGeneratedSql("DROP TABLE customers;")` | Throws `NOT_READ_ONLY` |
| 9 | Multi-statement injection blocked | `sanitizeGeneratedSql("SELECT 1; DELETE FROM customers;")` | Throws `MULTI_STATEMENT` |
| 10 | Read-only enforced at the DB layer | Call `queryRunner.runQuery(path, "DELETE FROM customers")` directly | Throws; row count in the file is unchanged |
| 11 | Rate limiting | Send 16 `/query` requests inside one minute | The 16th returns `429` |
| 12 | History persists | Ask two questions, then `GET /history/:sessionId` | Both appear, newest first |
| 13 | Session cleanup | Manually set a session's `last_used_at` older than `SESSION_TTL_HOURS`, wait for the hourly job (or call `cleanupOldSessions()`) | Session and its file are removed |

All of the above were run against this exact codebase during development —
see the commit history / development notes for the actual command output.

---

## 8. Deployment (100% free tier)

### Backend → Render (free tier)
1. Push this repo to GitHub.
2. On [render.com](https://render.com): **New → Web Service** → connect the repo, root directory `server`.
3. Build command: `npm install`  ·  Start command: `node src/index.js`.
4. Add environment variables from `server/.env.example` (paste your real `GROQ_API_KEY`; set `ALLOWED_ORIGINS` to your deployed frontend URL).
5. Free tier note: Render's free web services use an **ephemeral disk** — uploaded files and history are cleared on redeploy/restart. Fine for a demo/final project; for persistence, attach a Render Disk (still free at small sizes) mounted at `/app/data` and `/app/uploads`, or move `metaDb.js` to a free Postgres instance (e.g. Supabase).

*(Railway's free tier works identically: connect the repo, set the root directory to `server`, add the same env vars.)*

### Frontend → Netlify (free tier)
1. On [netlify.com](https://netlify.com): **Add new site → Import from Git**, base directory `client`, no build command, publish directory `client`.
2. Before deploying, edit `client/js/config.js` and set `apiBaseUrl` to your Render backend URL, e.g. `https://statement-api.onrender.com/api`.
3. Deploy. Netlify gives you a free `*.netlify.app` HTTPS URL.

*(Vercel or GitHub Pages work the same way — both just serve the static `client/` folder.)*

### After deploying
Update the backend's `ALLOWED_ORIGINS` env var to include your live frontend
URL, then redeploy the backend so CORS allows it.

---

## 9. Commands reference

| Task | Command |
|---|---|
| Install backend deps | `cd server && npm install` |
| Run backend (dev, auto-restart) | `npm run dev` |
| Run backend (prod) | `npm start` |
| Serve frontend locally | `cd client && python3 -m http.server 8080` |
| Run everything via Docker | `docker compose up --build` |
| Regenerate the sample database | `python3 seed/generate_sample.py` (see `seed/README.md`) |

---

## 10. What the UI looks like (module by module)

- **Header** — brand mark, live "API connected / unreachable" status pill.
- **Sidebar → Upload panel** — drag-and-drop zone, file picker, and a
  "Use the sample database" shortcut; shows upload progress and errors inline.
- **Sidebar → Schema panel** — appears after upload; one card per table listing
  columns, types, and primary keys.
- **Sidebar → History panel** — every question asked this session, with a
  colored dot for success/error; clicking one re-fills the question box.
- **Main → Empty state** — shown before any upload, explains what to do.
- **Main → Ask form** — textarea + "Ask" button with a loading spinner.
- **Main → Result card** — two-tone panel (amber = your question, teal = the
  SQL that ran), a meta row (row count, duration), and a scrollable results
  table; failed queries render as a red error card explaining what happened
  instead of a silent failure.
