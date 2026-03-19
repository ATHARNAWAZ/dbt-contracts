# dbt-contracts LinkedIn Launch Posts

---

## Post 1 — Problem/Solution (Launch week, Day 1)

**Hook:**
Your dbt project has 47 models.
You have data contracts for zero of them.

Don't lie — I know.

---

Data contracts are the gap between "our dbt project is well-tested" and "our data is actually reliable."

dbt tests catch nulls. dbt tests catch duplicates. But no dbt test tells you:
- "This mart should never have fewer than 100 rows"
- "This column will only ever be: pending, completed, or failed"
- "Finance expects this data by 8am every day"

Those guarantees live in Slack messages, tribal knowledge, and incident post-mortems.

So I built dbt-contracts.

→ Upload manifest.json
→ Claude generates a contract for every model (freshness, row counts, column rules)
→ Edit it in a Monaco editor
→ Download contracts.yml + a one-line GitHub Action

Your contracts are enforced in CI before anyone merges.

Free. Open source. No installation. No sign-up.

🔗 [link in comments]

---
**Hashtags:** #dbt #dataengineering #datacontracts #analytics #dataengineers

---

## Post 2 — Demo/Feature highlight (Day 3)

**Hook:**
I uploaded a manifest.json with 11 dbt models.
35 seconds later I had contracts for all of them.

Here's what Claude figured out without me telling it anything:

---

For `orders` (a mart model):
- owner: analytics ✓
- freshness: warn after 24h, error after 48h ✓
- row_count: min 10, warn if below 100 ✓
- order_id: not_null, unique ✓
- status: accepted_values [pending, completed, failed, reversed] ✓
- amount_usd: min 0 (can't have negative orders) ✓

For `stg_transactions` (staging):
- freshness: tighter — warn after 6h, error after 12h ✓
- transaction_id: not_null, unique ✓
- settled_at: nullable (because it's null while pending) ✓

This is the kind of thing a senior data engineer spends an afternoon doing manually for each model.

dbt-contracts does it in seconds, and you just review + tweak.

Then one YAML file and one GitHub Action later — your pipeline has contract enforcement.

No warehouse credentials. No agents running in your infra. Just a manifest.json and a browser.

→ dbt-contracts.io

---
**Hashtags:** #dbt #datacontracts #ai #dataengineering

---

## Post 3 — Community/OSS angle (Day 7)

**Hook:**
The dbt community has a contracts problem.
Not "contracts are too hard" — "no one ships them."

---

I've spoken to dozens of data engineers about data contracts over the past year.

Every single one says:
"Yes, we should have contracts."
"Yes, I know what they should look like."
"No, we haven't set them up yet."

The blocker isn't knowledge. It's activation energy.

Setting up contracts from scratch means:
- Designing a schema
- Writing YAML for 30+ models
- Building a validator
- Wiring it into CI
- Convincing your team it's worth it

That's 2-3 days of work before you get any value.

dbt-contracts collapses that to 35 seconds.

I built it for myself. Then I built it properly and open-sourced it.

If you're a data engineer who's been meaning to add contracts — this is your activation energy.

Free. MIT licence. Source on GitHub.

🔗 dbt-contracts.io

---

## Post 4 — Social proof (Week 2, after traction)

**Hook:**
1,000 manifests parsed in the first week.
I was not prepared for this.

---

Some things I learned from the first 1,000 dbt-contracts users:

1. The average manifest has 23 models. Smaller than I expected.

2. Mart models get contracts generated first. Makes sense — they're the ones consumers actually use.

3. The most common manual edit: adding accepted_values to status columns that Claude didn't know about from the metadata alone.

4. The most common feedback: "can I have the GitHub Action fail on warnings too?" (yes, that's now an option)

Thank you to everyone who tried it, shared it, and filed issues.

If you haven't tried it yet: drop your manifest.json at dbt-contracts.io — it takes 30 seconds.

---

## Post 5 — GitHub Action announcement

**Hook:**
The part that makes data contracts real isn't generating them.
It's enforcing them.

---

dbt-contracts just shipped: the GitHub Action.

Add this to your repo:

```yaml
- name: Validate dbt contracts
  uses: dbt-contracts/action@v1
  with:
    contracts-path: contracts/contracts.yml
    manifest-path: target/manifest.json
```

Every PR that touches your models now gets contracts validated automatically.

If a column in your contract doesn't exist in the manifest — build fails.
If a model's freshness thresholds are invalid — build fails.
If you removed a column that downstream consumers depend on — build fails.

Not in production. In CI. Before anyone merges.

That's the full loop:
Generate → Review → Download → Enforce.

Free. Open source. MIT.

→ dbt-contracts.io

---
**Hashtags:** #dbt #dataengineering #datacontracts #CI #github
