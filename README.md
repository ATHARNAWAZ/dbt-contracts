# dbt-contracts

**Data contracts for dbt. In your browser. No installation required.**

Upload your `manifest.json`. Get AI-generated data contracts for every model in seconds. Enforce them in CI with a single GitHub Action.

[Try it free at dbt-contracts (https://dbt-contracts.vercel.app/)) &nbsp;·&nbsp;
[Docs](https://dbt-contracts.vercel.app/docs) &nbsp;·&nbsp;
[Report a bug](https://github.com/dbt-contracts/dbt-contracts/issues)

---

## The problem

Your dbt project has great tests. Nulls are caught. Duplicates are found. But somewhere between your last `dbt run` and your CEO's 9am dashboard, something broke silently.

Data contracts are the answer — but setting them up from scratch is 2–3 days of YAML, schema design, and CI wiring that no one ever prioritises.

## The solution

dbt-contracts collapses that to 35 seconds.

```
1. Upload manifest.json    →  sidebar populates with all your models
2. Click Generate          →  Claude writes a contract for each model
3. Edit in Monaco          →  tweak freshness, row counts, column rules
4. Download                →  contracts.yml + GitHub Action
5. Push to your repo       →  contracts enforced on every PR
```

## Quick start

**Browser (no installation):**

1. Run `dbt compile` in your dbt project to generate `target/manifest.json`
2. Go to [dbt-contracts.io/app](https://dbt-contracts.io/app)
3. Drop your `manifest.json` in the upload zone
4. Click **Generate** for each model (or **Generate all**)
5. Download `contracts.yml` and the GitHub Action from the Download page

**GitHub Action:**

```yaml
# .github/workflows/dbt-contracts.yml
name: dbt Contract Validation

on:
  pull_request:
    paths:
      - 'models/**'
      - 'contracts/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate dbt contracts
        uses: dbt-contracts/action@v1
        with:
          contracts-path: contracts/contracts.yml
          manifest-path: target/manifest.json
```

## Contract format

```yaml
version: 1
model: orders
description: "Final orders mart. One row per transaction."
owner: analytics
freshness:
  warn_after_hours: 24
  error_after_hours: 48
row_count:
  min: 10
  warn_below: 100
columns:
  order_id:
    not_null: true
    unique: true
    accepted_values: []
    min: null
    max: null
    warn_if_null_rate_above: null
  status:
    not_null: false
    unique: false
    accepted_values: [pending, completed, failed, reversed]
    min: null
    max: null
    warn_if_null_rate_above: 0.05
```

## Architecture

```
dbt-contracts/
├── frontend/          React + TypeScript + Tailwind + Monaco
├── backend/           FastAPI + Claude API (SSE streaming)
├── github-action/     Python validator, zero dependencies beyond PyYAML
├── supabase/          Postgres migrations (sessions, contracts, waitlist, stats)
└── sample_data/       Realistic fintech dbt manifest for testing
```

**Backend endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/manifest/parse` | Parse manifest.json, return model inventory |
| POST | `/api/contracts/generate` | Stream contract YAML via SSE (calls Claude) |
| POST | `/api/contracts/validate` | Validate YAML, return errors with line numbers |
| GET | `/api/contracts/export` | Download contracts.yml + GitHub Action |
| POST | `/api/waitlist` | Join the waitlist |
| GET | `/api/stats` | Public usage statistics |

## Local development

**Prerequisites:** Docker + Docker Compose, or Python 3.12 + Node 20.

**With Docker:**

```bash
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
docker-compose up --build
# Backend: http://localhost:8000
# Frontend: http://localhost:5173
```

**Without Docker:**

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env  # fill in values
uvicorn app.main:app --reload

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

**Run tests:**

```bash
cd backend
pytest tests/ -v
```

## Deployment

**Backend:** Railway (Dockerfile in `backend/`, config in `railway.json`)

**Frontend:** Vercel (build output in `frontend/dist/`)

**Database:** Supabase (migrations in `supabase/migrations/`)

Secrets required:
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Contributing

Issues and PRs welcome. Please open an issue before starting a large feature.

**What we'd love help with:**
- More contract YAML validators (semantic checks)
- dbt Cloud manifest fetching (so you don't need to download locally)
- Offline / rule-based contract generation (no Claude required)
- Contract history / versioning

## Licence

MIT — see [LICENSE](./LICENSE).

---

Built for the dbt community. By a data engineer who was tired of saying "we should add contracts" and never doing it.
