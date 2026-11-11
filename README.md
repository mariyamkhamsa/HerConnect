
# HerConnect
### An AI-Powered Women Collaboration Platform

HerConnect is a platform designed to connect women entrepreneurs, particularly those managing home-based businesses, with skilled women seeking local and flexible work opportunities.

It addresses the challenges of finding suitable workers for part-time, seasonal, and short-term requirements through a **hybrid AI-based recommendation system**.

## Key Features

- User registration and role-based authentication
- Entrepreneur and worker profile management
- Job posting and application management
- AI-powered worker and job recommendations
- Invitation and connection management
- In-platform notifications
- Optional contact-detail sharing
- Explainable recommendations through a "Why this match?" section

## AI Recommendation System

HerConnect uses a **two-stage semantic recommendation approach** combining SBERT retrieval and Cross-Encoder re-ranking.

1. **Structured Filtering:** Filters eligible profiles based on locality, availability, work type, and experience.
2. **SBERT Retrieval:** Uses `all-MiniLM-L6-v2` to generate semantic embeddings and retrieve the top 15 relevant candidates using cosine similarity.
3. **Cross-Encoder Re-ranking:** Uses `cross-encoder/ms-marco-MiniLM-L-6-v2` to evaluate shortlisted job-worker text pairs and refine their ranking.
4. **Final Score Combination:** Combines semantic relevance with structured match strength to generate the final ranking and match explanations.

The same pipeline supports both worker recommendations for entrepreneurs and job recommendations for workers.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React.js, Vite |
| Backend | Python, FastAPI |
| Database | MySQL |
| ORM | SQLAlchemy |
| Authentication | JWT |
| AI/ML | Sentence Transformers |
| Semantic Retrieval | SBERT |
| Re-ranking | Cross-Encoder |

## Project Structure

```text
herconnect/
├── backend/
│   └── app/
│       ├── ai/
│       │   ├── embeddings.py
│       │   ├── reranker.py
│       │   └── pipeline.py
│       └── routers/
├── frontend/
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── context/
│       └── api.js
├── sample_data/
└── README.md
```

## Installation and Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- MySQL 8.0+
- npm

### 1. Clone the Repository

```bash
git clone <repository-url>
cd herconnect
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
```

Activate the virtual environment:

**Windows:**
```bash
venv\Scripts\activate
```

**Linux/macOS:**
```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### 3. Database Configuration

Create the database using the provided schema:

```bash
mysql -u root -p < schema.sql
```

Configure the `.env` file using `.env.example` and update the database connection and JWT secret key.

### 4. Load Sample Data

```bash
python seed.py
```

### 5. Run the Backend

```bash
uvicorn app.main:app --reload --port 8000
```

API documentation: `http://localhost:8000/docs`

### 6. Frontend Setup

Open a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Access the application at `http://localhost:5173`.


## Contributors

- Twinkle Treesa
- Mariyam K Hamsa
