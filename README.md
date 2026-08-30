# HerConnect — First Demo Build

An AI-powered women collaboration platform connecting **women entrepreneurs**
with **skilled women** seeking local, flexible work — with a genuinely
functional two-stage AI recommendation pipeline (SBERT retrieval +
Cross-Encoder re-ranking), per the PRD.

This is a runnable first-demo build: React frontend, FastAPI backend, MySQL
database, and a real (not hardcoded/faked) AI recommendation pipeline using
pre-trained `sentence-transformers` models.

---

## 1. Project layout

```
herconnect/
├── backend/                 FastAPI + SQLAlchemy + AI pipeline
│   ├── app/
│   │   ├── main.py          FastAPI app entrypoint
│   │   ├── config.py        Settings (reads .env)
│   │   ├── database.py      SQLAlchemy engine/session
│   │   ├── models.py        ORM models (mirrors schema.sql)
│   │   ├── schemas.py       Pydantic request/response models
│   │   ├── security.py      Password hashing + JWT
│   │   ├── deps.py          Auth dependencies / role guards
│   │   ├── ai/
│   │   │   ├── embeddings.py   SBERT embedding generation (all-MiniLM-L6-v2)
│   │   │   ├── reranker.py     Cross-Encoder re-ranking (ms-marco-MiniLM-L-6-v2)
│   │   │   └── pipeline.py     Structured filtering + score combination + "Why this match?"
│   │   └── routers/
│   │       ├── auth.py, workers.py, entrepreneurs.py, jobs.py,
│   │       └── applications.py, recommendations.py, admin.py
│   ├── requirements.txt
│   ├── schema.sql            MySQL schema (run this to create the database)
│   ├── seed.py                Loads sample_data/ into MySQL, computing real embeddings
│   └── .env.example
├── frontend/                 React (Vite) app
│   └── src/
│       ├── pages/             Login, Register, Dashboards, Job forms,
│       │                      Profile forms, Recommendation results, Applications
│       ├── components/        Navbar, Card, Button, MatchExplanation, ProtectedRoute
│       ├── context/AuthContext.jsx
│       ├── api.js             Axios client (points at http://localhost:8000)
│       └── index.css          Pastel pink / blush design tokens & styles
├── sample_data/
│   ├── sample_workers.json    12 sample worker profiles
│   └── sample_jobs.json       8 sample job postings (from 5 sample businesses)
└── README.md
```

---

## 2. Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- MySQL 8.0+ (running locally, or a reachable instance)
- ~2 GB free disk space for the first-time model download (SBERT + Cross-Encoder,
  downloaded automatically the first time the backend runs — an internet
  connection is needed only for that first download)

---

## 3. Backend setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

### 3.1 Create the database

```bash
mysql -u root -p < schema.sql
```

This creates the `herconnect` database and all tables, and seeds the
`categories` table with a few defaults.

### 3.2 Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL` to match your MySQL user/password, e.g.:

```
DATABASE_URL=mysql+pymysql://root:your_password@localhost:3306/herconnect
```

Also set `SECRET_KEY` to any long random string for JWT signing.

### 3.3 Load the sample dataset (recommended for the demo)

```bash
python seed.py
```

This inserts the 12 sample worker profiles and 8 sample jobs from
`sample_data/`, and — importantly — computes a **real SBERT embedding** for
each of them using the same code path the live API uses. The first run will
download the `all-MiniLM-L6-v2` model (~90MB), which may take a minute.

All seeded accounts share the password: `Password123`
(e.g. `meera.tailor@example.com` / `Password123`, `boutique.owner@example.com` / `Password123`).

### 3.4 Run the backend

```bash
uvicorn app.main:app --reload --port 8000
# or: ./run.sh
```

The first request that touches the AI pipeline will download the
Cross-Encoder model (`cross-encoder/ms-marco-MiniLM-L-6-v2`, ~90MB) if it
isn't cached yet — this happens once.

API docs are available at `http://localhost:8000/docs`.

---

## 4. Frontend setup

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The frontend expects the backend at
`http://localhost:8000` (see `src/api.js` if you need to change this).

---

## 5. Demo walkthrough

1. **Register** as an Entrepreneur (or log in as one of the seeded accounts,
   e.g. `boutique.owner@example.com` / `Password123`).
2. Set up (or review) the **business profile**.
3. **Post a job** — or open one of the seeded jobs — e.g. "Bridal Blouse
   Embroidery Specialist Needed".
4. Click **"✨ AI-recommended workers"**. Watch the ranked list appear with:
   - a combined match score,
   - the semantic relevance score from the SBERT + Cross-Encoder pipeline,
   - a "Why this match?" breakdown (skill match / location / availability / experience).
5. Compare against **manual browsing**: log in as a worker
   (e.g. `meera.tailor@example.com` / `Password123`) and use **"Browse All
   Jobs"** vs. **"✨ AI-Recommended Jobs"** to see the same "naive list vs.
   AI-ranked list" comparison from the other side.
6. As a worker, **apply** to a job. As the entrepreneur, open **"View
   applications"** on that job and **Accept/Reject**.
7. Try editing a worker profile's About/Description or a job's description —
   saving recomputes and stores a fresh embedding immediately (visible by
   re-running the recommendation view).

---

## 6. How the AI pipeline actually works (no faking)

For a request like *"recommend workers for job X"*:

1. **Structured eligibility filtering (normal code)** — `app/ai/pipeline.py`
   filters all worker profiles down to those matching locality (same/nearby),
   availability overlap, work type, and minimum experience.
2. **SBERT semantic retrieval** — the job's title + description + required
   skills are combined into one text passage and embedded live
   (`app/ai/embeddings.py`); this is compared via cosine similarity against
   each eligible worker's **precomputed** embedding (computed when the
   profile was created/edited) to produce a shortlist (top 15).
3. **Cross-Encoder re-ranking** — the shortlist is re-scored by
   `cross-encoder/ms-marco-MiniLM-L-6-v2`, which reads the (job, worker) text
   pair jointly for a more accurate relevance score (`app/ai/reranker.py`).
4. **Final combination (normal code)** — the semantic score and the strength
   of the structured match are blended into one final score, and a
   human-readable "Why this match?" breakdown is generated.

The same pipeline runs symmetrically for "recommend jobs for a worker".
Nothing here is hardcoded: change a profile's description or a job's
requirements and the ranking changes accordingly, because the embeddings and
Cross-Encoder scores are recomputed from the actual text.

---

## 7. Notes / first-demo scope

- No GPS/geocoding — locality matching uses a small predefined "nearby
  localities" map plus exact match, as specified in the PRD.
- No fine-tuning — both SBERT and the Cross-Encoder are used as pre-trained,
  general-purpose models.
- No load/performance testing, analytics dashboards, or advanced admin tools
  — kept out of scope per the PRD's first-demo corrections.
- Portfolio/certificate upload is a single optional file per worker profile,
  stored as-is (no content parsing).
