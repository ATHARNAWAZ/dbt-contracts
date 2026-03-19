# dbt-contracts GitHub Action

Validate your dbt data contracts on every pull request that touches your models. Fails the build when contracts are violated.

## Usage

```yaml
# .github/workflows/dbt-contracts.yml
name: dbt Contract Validation

on:
  pull_request:
    paths:
      - 'models/**'
      - 'contracts/**'

jobs:
  validate-contracts:
    name: Validate dbt contracts
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run dbt
        run: dbt compile --profiles-dir .

      - name: Validate dbt contracts
        uses: dbt-contracts/action@v1
        with:
          contracts-path: contracts/contracts.yml
          manifest-path: target/manifest.json
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `contracts-path` | Yes | `contracts/contracts.yml` | Path to your contracts YAML file |
| `manifest-path` | Yes | `target/manifest.json` | Path to your dbt manifest.json |
| `fail-on-violation` | No | `true` | Whether to fail CI on contract errors |
| `models` | No | `""` (all) | Comma-separated list of models to validate |
| `severity` | No | `error` | Minimum severity that fails the build: `error` or `warning` |

## Outputs

| Output | Description |
|---|---|
| `violations` | Total number of violations found |
| `validated-models` | Number of models validated |
| `summary` | Human-readable summary string |

## What gets validated

The action checks:

- **Column existence** — every column in your contract exists in the manifest
- **not_null rules** — warns if a contract requires not_null but no dbt test exists
- **unique rules** — warns if a contract requires unique but no dbt test exists
- **accepted_values** — warns if accepted_values are declared but not tested
- **Freshness thresholds** — validates the threshold logic (warn must be < error)
- **Schema version** — contract must be version 1

Freshness and row count checks against your warehouse require the dbt-contracts runtime (roadmap).

## Generate contracts

Generate contracts at [dbt-contracts.io](https://dbt-contracts.io) — upload your manifest.json, get AI-generated contracts in seconds.
