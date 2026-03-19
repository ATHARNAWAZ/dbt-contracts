# dbt-contracts — Product Hunt Listing

## Tagline
Data contracts for dbt. In your browser. No installation.

## Description (280 chars)
Upload your dbt manifest.json. Get AI-generated data contracts for every model in seconds. Download contracts.yml + a GitHub Action to enforce them in CI. Free. Open source.

## Full Description

**The problem every data team has, but no one talks about:**

Your dbt project has great tests. Nulls are caught. Duplicates are found. But somewhere between your last dbt run and your CEO's 9am dashboard, something broke silently.

Data contracts are the answer — but setting them up from scratch is 2-3 days of YAML, schema design, and CI wiring that no one ever prioritises.

**dbt-contracts collapses that to 35 seconds.**

Upload your `manifest.json`. Claude reads your model metadata, column types, and descriptions, then streams a production-ready contract for every model: freshness windows, row count expectations, and column-level rules (not_null, unique, accepted_values, min/max).

Edit the contracts in a Monaco editor. Validate them before you export. Download a single `contracts.yml` and a one-line GitHub Action.

On your next PR, the action validates your contracts. Column removed that consumers depend on? Build fails. Freshness thresholds misconfigured? Build fails. In CI. Before anyone merges.

**What makes it different:**

- No installation — runs entirely in the browser
- No sign-up required — just a manifest.json
- AI-generated, human-reviewed — Claude writes, you edit
- Real YAML, not proprietary format — works with any tooling
- Open source — MIT licence, source on GitHub

**For the dbt community:**

Built by a data engineer who was tired of saying "we should add contracts" and never doing it. This is the activation energy we were missing.

## Maker Comment

Hey Product Hunt! I'm the maker of dbt-contracts.

I've been a data engineer for 7 years. In that time, I've been on teams that talked about data contracts constantly and shipped them never. The concept is solid. The activation energy was always too high.

dbt-contracts exists to remove that activation energy completely.

The flow I wanted: drop your manifest.json in a browser tab → review AI-generated contracts → download two files → push to your repo. Done. No new accounts, no agents in your infra, no 3-day project.

The GitHub Action is what makes it real. Generating contracts is satisfying. Enforcing them is what actually protects your downstream consumers.

Happy to answer any questions about the technical implementation or the contract schema. Try it at dbt-contracts.io — it's free and takes 30 seconds.

## Topics
Developer Tools, Data & Analytics, Artificial Intelligence, Open Source

## Gallery Captions

**Image 1 — App screenshot:**
Upload manifest.json → sidebar populates with all your models → click Generate → watch contracts stream in

**Image 2 — Contract YAML:**
Production-ready contract with freshness, row count, and column rules. Editable in Monaco.

**Image 3 — GitHub Action output:**
PASS / FAIL / WARN per model in CI. Every PR gets contracts validated automatically.

**Image 4 — Download page:**
Two files to download: contracts.yml and the GitHub Action workflow.
