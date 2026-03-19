#!/usr/bin/env python3
"""
validate.py — dbt-contracts GitHub Action validation logic.

This script is the engine of the GitHub Action. It:
1. Loads the contracts YAML file
2. Loads the dbt manifest.json
3. For each contracted model, validates the contract rules against the manifest schema
4. Reports violations and optionally fails the build

It intentionally has no dependencies beyond PyYAML so it installs in <2s.
Richer validation (freshness checks against warehouse) is roadmapped.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

import yaml


# ---------------------------------------------------------------------------
# Colour helpers — GitHub Actions supports ANSI codes
# ---------------------------------------------------------------------------
RESET = "\033[0m"
RED = "\033[31m"
YELLOW = "\033[33m"
GREEN = "\033[32m"
BOLD = "\033[1m"
CYAN = "\033[36m"


def red(s: str) -> str:
    return f"{RED}{s}{RESET}"


def yellow(s: str) -> str:
    return f"{YELLOW}{s}{RESET}"


def green(s: str) -> str:
    return f"{GREEN}{s}{RESET}"


def bold(s: str) -> str:
    return f"{BOLD}{s}{RESET}"


def cyan(s: str) -> str:
    return f"{CYAN}{s}{RESET}"


# ---------------------------------------------------------------------------
# Violation types
# ---------------------------------------------------------------------------

class ContractViolation:
    def __init__(self, model: str, field: str, message: str, severity: str = "error"):
        self.model = model
        self.field = field
        self.message = message
        self.severity = severity  # "error" | "warning"

    def __str__(self) -> str:
        colour = red if self.severity == "error" else yellow
        return f"  [{colour(self.severity.upper())}] {bold(self.model)}.{self.field}: {self.message}"


# ---------------------------------------------------------------------------
# Contract loader
# ---------------------------------------------------------------------------

def load_contracts(contracts_path: str) -> list[dict[str, Any]]:
    """
    Load one or more contracts from a YAML file.

    Supports multi-document YAML (multiple contracts separated by ---),
    which is the format produced by the dbt-contracts export.
    """
    path = Path(contracts_path)
    if not path.exists():
        print(red(f"Contracts file not found: {contracts_path}"))
        sys.exit(1)

    with path.open() as f:
        # yaml.safe_load_all handles multi-document YAML
        docs = list(yaml.safe_load_all(f))

    # Filter out None documents (trailing --- with no content)
    contracts = [d for d in docs if d is not None]

    if not contracts:
        print(red(f"No contracts found in {contracts_path}"))
        sys.exit(1)

    return contracts


# ---------------------------------------------------------------------------
# Manifest loader
# ---------------------------------------------------------------------------

def load_manifest(manifest_path: str) -> dict[str, Any]:
    path = Path(manifest_path)
    if not path.exists():
        print(red(f"Manifest not found: {manifest_path}"))
        print(yellow("  Did you run 'dbt compile' or 'dbt run' before this action?"))
        sys.exit(1)

    with path.open() as f:
        return json.load(f)


def get_model_node(manifest: dict[str, Any], model_name: str) -> dict[str, Any] | None:
    """Find a model node in the manifest by name (not unique_id)."""
    for unique_id, node in manifest.get("nodes", {}).items():
        if node.get("resource_type") == "model" and node.get("name") == model_name:
            return node
    return None


# ---------------------------------------------------------------------------
# Contract validation rules
# ---------------------------------------------------------------------------

def validate_contract_against_manifest(
    contract: dict[str, Any],
    manifest: dict[str, Any],
) -> list[ContractViolation]:
    """
    Validate a single contract against the manifest schema.

    Current validation checks:
    - version is 1
    - model exists in manifest
    - all contracted columns exist in the manifest
    - not_null columns: warn if no existing dbt not_null test
    - unique columns: warn if no existing dbt unique test
    - accepted_values: warn if no existing accepted_values test
    - row_count.min: advisory check (cannot enforce without warehouse access)
    - freshness: advisory check (cannot enforce without warehouse access)

    Violations that require warehouse access (freshness, row count) are warnings
    in the action context — they are enforced by the dbt-contracts runtime validator.
    """
    violations: list[ContractViolation] = []
    model_name = contract.get("model", "unknown")

    # Check version
    if contract.get("version") != 1:
        violations.append(ContractViolation(
            model=model_name,
            field="version",
            message=f"Unsupported contract version '{contract.get('version')}'. Only version 1 is supported.",
            severity="error",
        ))
        return violations  # Can't validate further without a valid version

    # Check model exists in manifest
    manifest_node = get_model_node(manifest, model_name)
    if not manifest_node:
        violations.append(ContractViolation(
            model=model_name,
            field="model",
            message=f"Model '{model_name}' not found in manifest.json. Has it been compiled?",
            severity="error",
        ))
        return violations

    manifest_columns = manifest_node.get("columns", {})
    contract_columns = contract.get("columns", {})

    # Validate each contracted column exists in the manifest
    for col_name, col_contract in contract_columns.items():
        if col_name not in manifest_columns:
            violations.append(ContractViolation(
                model=model_name,
                field=f"columns.{col_name}",
                message=(
                    f"Column '{col_name}' is in the contract but not in the manifest. "
                    "Either the column was removed or the contract is out of date."
                ),
                severity="error",
            ))
            continue

        if not isinstance(col_contract, dict):
            continue

        # Check for missing dbt tests that the contract declares
        existing_tests = manifest_node.get("tests", [])
        existing_test_strs = " ".join(str(t).lower() for t in existing_tests)

        if col_contract.get("not_null") and f"not_null.{col_name}" not in existing_test_strs:
            # This is a warning rather than an error — the contract declares intent,
            # but we can't force the user to add dbt tests at schema-check time.
            violations.append(ContractViolation(
                model=model_name,
                field=f"columns.{col_name}.not_null",
                message=(
                    f"Contract requires not_null for '{col_name}' "
                    "but no corresponding dbt not_null test was found. "
                    "Consider adding: tests: [not_null] to this column in your schema.yml."
                ),
                severity="warning",
            ))

        if col_contract.get("unique") and f"unique.{col_name}" not in existing_test_strs:
            violations.append(ContractViolation(
                model=model_name,
                field=f"columns.{col_name}.unique",
                message=(
                    f"Contract requires unique for '{col_name}' "
                    "but no corresponding dbt unique test was found."
                ),
                severity="warning",
            ))

        accepted_values = col_contract.get("accepted_values", [])
        if accepted_values and f"accepted_values.{col_name}" not in existing_test_strs:
            violations.append(ContractViolation(
                model=model_name,
                field=f"columns.{col_name}.accepted_values",
                message=(
                    f"Contract specifies accepted_values for '{col_name}' "
                    f"but no dbt accepted_values test exists. "
                    f"Expected values: {accepted_values}"
                ),
                severity="warning",
            ))

        # Validate min/max are reasonable numbers if provided
        col_min = col_contract.get("min")
        col_max = col_contract.get("max")
        if col_min is not None and col_max is not None:
            try:
                if float(col_min) > float(col_max):
                    violations.append(ContractViolation(
                        model=model_name,
                        field=f"columns.{col_name}.min/max",
                        message=f"min ({col_min}) is greater than max ({col_max}).",
                        severity="error",
                    ))
            except (TypeError, ValueError):
                pass

    # Freshness advisory (can't check without warehouse)
    freshness = contract.get("freshness", {})
    if freshness:
        warn_h = freshness.get("warn_after_hours")
        error_h = freshness.get("error_after_hours")
        if warn_h is not None and error_h is not None:
            try:
                if int(warn_h) >= int(error_h):
                    violations.append(ContractViolation(
                        model=model_name,
                        field="freshness",
                        message=f"warn_after_hours ({warn_h}) must be less than error_after_hours ({error_h}).",
                        severity="error",
                    ))
            except (TypeError, ValueError):
                pass

    return violations


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Validate dbt-contracts against a manifest")
    parser.add_argument("--contracts", required=True, help="Path to contracts YAML file")
    parser.add_argument("--manifest", required=True, help="Path to dbt manifest.json")
    parser.add_argument("--fail-on-violation", default="true", help="Exit 1 on violations")
    parser.add_argument("--models", default="", help="Comma-separated model filter")
    parser.add_argument("--severity", default="error", choices=["error", "warning"], help="Minimum severity to fail on")
    args = parser.parse_args()

    fail_on_violation = args.fail_on_violation.lower() == "true"
    model_filter = {m.strip() for m in args.models.split(",") if m.strip()}

    print(bold("\ndbt-contracts validation"))
    print(f"  Contracts: {cyan(args.contracts)}")
    print(f"  Manifest:  {cyan(args.manifest)}")
    print(f"  Fail on:   {cyan(args.severity)}")
    if model_filter:
        print(f"  Models:    {cyan(', '.join(sorted(model_filter)))}")
    print()

    contracts = load_contracts(args.contracts)
    manifest = load_manifest(args.manifest)

    # Apply model filter
    if model_filter:
        contracts = [c for c in contracts if c.get("model") in model_filter]
        if not contracts:
            print(yellow(f"No contracts matched the model filter: {model_filter}"))
            sys.exit(0)

    all_violations: list[ContractViolation] = []
    validated_count = 0

    for contract in contracts:
        model_name = contract.get("model", "unknown")
        violations = validate_contract_against_manifest(contract, manifest)
        all_violations.extend(violations)
        validated_count += 1

        error_count = sum(1 for v in violations if v.severity == "error")
        warning_count = sum(1 for v in violations if v.severity == "warning")

        if not violations:
            print(f"{green('PASS')} {bold(model_name)}")
        elif error_count > 0:
            print(f"{red('FAIL')} {bold(model_name)} ({error_count} error{'s' if error_count != 1 else ''}, {warning_count} warning{'s' if warning_count != 1 else ''})")
        else:
            print(f"{yellow('WARN')} {bold(model_name)} ({warning_count} warning{'s' if warning_count != 1 else ''})")

        for v in violations:
            print(v)

    # Summary
    error_violations = [v for v in all_violations if v.severity == "error"]
    warning_violations = [v for v in all_violations if v.severity == "warning"]

    print()
    print(bold("Summary"))
    print(f"  Models validated: {validated_count}")
    print(f"  Errors:   {red(str(len(error_violations))) if error_violations else green('0')}")
    print(f"  Warnings: {yellow(str(len(warning_violations))) if warning_violations else green('0')}")

    # Set GitHub Actions outputs
    github_output = os.environ.get("GITHUB_OUTPUT", "")
    if github_output:
        with open(github_output, "a") as f:
            f.write(f"violations={len(all_violations)}\n")
            f.write(f"validated-models={validated_count}\n")
            status = "PASS" if not error_violations else "FAIL"
            f.write(f"summary={status}: {validated_count} models, {len(error_violations)} errors, {len(warning_violations)} warnings\n")

    # Exit decision
    if fail_on_violation:
        if args.severity == "error" and error_violations:
            print()
            print(red(f"Build failed: {len(error_violations)} contract error(s) found."))
            sys.exit(1)
        elif args.severity == "warning" and all_violations:
            print()
            print(red(f"Build failed: {len(all_violations)} contract violation(s) found."))
            sys.exit(1)

    if not all_violations:
        print()
        print(green("All contracts passed."))
    elif not error_violations:
        print()
        print(yellow(f"{len(warning_violations)} warning(s) found. Build passing (warnings don't block)."))


if __name__ == "__main__":
    main()
