/**
 * Docs.tsx — Documentation page.
 *
 * Sections: Quick start, Contract schema reference, GitHub Action reference.
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, ArrowLeft } from 'lucide-react'

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  // id is placed on the <h2> (not the <section>) so the section's id anchor
  // and the heading id are separate — avoids duplicate id violations.
  return (
    <h2 id={id} className="text-[24px] font-semibold tracking-tight scroll-mt-20">
      {children}
    </h2>
  )
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-[18px] font-semibold mt-8 mb-3">{children}</h3>
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="font-mono text-sm text-text-primary bg-code px-1.5 py-0.5 rounded border border-border">
      {children}
    </code>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="code-block p-4 overflow-x-auto leading-relaxed text-xs font-mono text-text-secondary whitespace-pre my-4">
      {children}
    </pre>
  )
}

function FieldRow({
  name,
  type,
  required,
  description,
}: {
  name: string
  type: string
  required?: boolean
  description: string
}) {
  return (
    <tr className="border-t border-border">
      <td className="py-2.5 pr-4">
        <code className="font-mono text-xs text-text-primary">{name}</code>
        {required && <span className="ml-1 text-[10px] text-error">required</span>}
      </td>
      <td className="py-2.5 pr-4">
        <code className="font-mono text-xs text-text-muted">{type}</code>
      </td>
      <td className="py-2.5 text-sm text-text-secondary">{description}</td>
    </tr>
  )
}

export default function DocsPage() {
  const navItems = [
    { id: 'quick-start', label: 'Quick start' },
    { id: 'schema', label: 'Contract schema' },
    { id: 'github-action', label: 'GitHub Action' },
    { id: 'faq', label: 'FAQ' },
  ]

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Nav */}
      <nav aria-label="Primary" className="border-b border-border sticky top-0 z-50 bg-bg/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" aria-label="dbt-contracts home">
            <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
            <span className="font-semibold text-sm">dbt-contracts</span>
          </Link>
          <Link to="/" className="text-sm text-text-secondary hover:text-text-primary flex items-center gap-1 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Home
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12 flex gap-12">
        {/* Sidebar nav */}
        <aside aria-label="Page sections" className="w-48 flex-shrink-0 hidden md:block sticky top-20 self-start">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3" id="toc-label">
            On this page
          </p>
          <nav aria-labelledby="toc-label" className="space-y-1">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block text-sm text-text-secondary hover:text-text-primary py-1 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main id="main-content" className="flex-1 min-w-0 space-y-12">
          <div>
            <h1 className="text-[32px] font-bold tracking-tight">Documentation</h1>
            <p className="text-text-secondary mt-2">
              Everything you need to generate, validate, and enforce data contracts.
            </p>
          </div>

          {/* Quick start */}
          <section id="quick-start" className="space-y-4">
            <SectionHeading id="qs-heading">Quick start</SectionHeading>
            <p className="text-text-secondary leading-relaxed">
              dbt-contracts is a browser-based tool. No installation, no API keys, no sign-up.
            </p>

            <SubHeading>1. Get your manifest.json</SubHeading>
            <p className="text-text-secondary text-sm leading-relaxed">
              Run dbt compile or dbt run in your dbt project. This generates{' '}
              <Code>target/manifest.json</Code>.
            </p>
            <CodeBlock>{`cd your-dbt-project
dbt compile
# target/manifest.json is now available`}</CodeBlock>

            <SubHeading>2. Upload to dbt-contracts</SubHeading>
            <p className="text-text-secondary text-sm leading-relaxed">
              Go to <Link to="/app" className="text-accent hover:underline">/app</Link>{' '}
              and drop your <Code>manifest.json</Code> into the upload zone.
              The sidebar will populate with all your models grouped by layer.
            </p>

            <SubHeading>3. Generate contracts</SubHeading>
            <p className="text-text-secondary text-sm leading-relaxed">
              Click a model to select it, then click <strong>Generate</strong>.
              Claude reads your column metadata and streams a contract YAML into the editor.
              You can edit the YAML directly — it's just text.
            </p>

            <SubHeading>4. Validate and export</SubHeading>
            <p className="text-text-secondary text-sm leading-relaxed">
              Click <strong>Validate</strong> to check your contract for schema errors.
              When you're happy, go to{' '}
              <Link to="/download" className="text-accent hover:underline">Download</Link>{' '}
              and get <Code>contracts.yml</Code> and the GitHub Action.
            </p>
          </section>

          {/* Schema reference */}
          <section id="schema" className="space-y-4">
            <SectionHeading id="schema">Contract schema</SectionHeading>
            <p className="text-text-secondary leading-relaxed text-sm">
              All contracts follow version 1 of the dbt-contracts schema.
            </p>

            <CodeBlock>{`version: 1
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
    warn_if_null_rate_above: 0.05`}</CodeBlock>

            <SubHeading>Top-level fields</SubHeading>
            {/* scope="col" on <th> satisfies WCAG 1.3.1 Info and Relationships */}
            <table className="w-full text-sm" aria-label="Top-level contract fields">
              <thead>
                <tr>
                  <th scope="col" className="text-left py-2 pr-4 text-xs font-semibold text-text-secondary uppercase tracking-wide">Field</th>
                  <th scope="col" className="text-left py-2 pr-4 text-xs font-semibold text-text-secondary uppercase tracking-wide">Type</th>
                  <th scope="col" className="text-left py-2 text-xs font-semibold text-text-secondary uppercase tracking-wide">Description</th>
                </tr>
              </thead>
              <tbody>
                <FieldRow name="version" type="integer" required description="Contract schema version. Must be 1." />
                <FieldRow name="model" type="string" required description="dbt model name. Must match the model in your project." />
                <FieldRow name="description" type="string" description="Human-readable description of the model." />
                <FieldRow name="owner" type="string" description="Team or person responsible for this model." />
                <FieldRow name="freshness" type="object" description="Freshness thresholds. See freshness fields below." />
                <FieldRow name="row_count" type="object" description="Row count expectations." />
                <FieldRow name="columns" type="object" required description="Map of column names to column contracts." />
              </tbody>
            </table>

            <SubHeading>Column fields</SubHeading>
            <table className="w-full text-sm" aria-label="Column-level contract fields">
              <thead>
                <tr>
                  <th scope="col" className="text-left py-2 pr-4 text-xs font-semibold text-text-secondary uppercase tracking-wide">Field</th>
                  <th scope="col" className="text-left py-2 pr-4 text-xs font-semibold text-text-secondary uppercase tracking-wide">Type</th>
                  <th scope="col" className="text-left py-2 text-xs font-semibold text-text-secondary uppercase tracking-wide">Description</th>
                </tr>
              </thead>
              <tbody>
                <FieldRow name="not_null" type="boolean" description="If true, the column must not contain null values." />
                <FieldRow name="unique" type="boolean" description="If true, all values must be unique." />
                <FieldRow name="accepted_values" type="string[]" description="Exhaustive list of allowed values. Empty list = unconstrained." />
                <FieldRow name="min" type="number | null" description="Minimum allowed numeric value." />
                <FieldRow name="max" type="number | null" description="Maximum allowed numeric value." />
                <FieldRow name="warn_if_null_rate_above" type="float | null" description="Warn if the fraction of null values exceeds this threshold (0.0–1.0)." />
              </tbody>
            </table>
          </section>

          {/* GitHub Action */}
          <section id="github-action" className="space-y-4">
            <SectionHeading id="ga-heading">GitHub Action reference</SectionHeading>
            <p className="text-text-secondary text-sm leading-relaxed">
              The dbt-contracts GitHub Action validates your contracts against a dbt manifest
              on every PR. It fails the build if any contract is violated.
            </p>

            <CodeBlock>{`- name: Validate dbt contracts
  uses: dbt-contracts/action@v1
  with:
    # Path to the contracts YAML file (required)
    contracts-path: contracts/contracts.yml

    # Path to the dbt manifest (required)
    manifest-path: target/manifest.json

    # Fail the build on violation (default: true)
    fail-on-violation: true

    # Only validate specific models (optional, comma-separated)
    # models: orders,customers,revenue`}</CodeBlock>

            <SubHeading>Inputs</SubHeading>
            <table className="w-full text-sm" aria-label="GitHub Action inputs">
              <thead>
                <tr>
                  <th scope="col" className="text-left py-2 pr-4 text-xs font-semibold text-text-secondary uppercase tracking-wide">Input</th>
                  <th scope="col" className="text-left py-2 pr-4 text-xs font-semibold text-text-secondary uppercase tracking-wide">Required</th>
                  <th scope="col" className="text-left py-2 text-xs font-semibold text-text-secondary uppercase tracking-wide">Description</th>
                </tr>
              </thead>
              <tbody>
                <FieldRow name="contracts-path" type="yes" required description="Relative path to your contracts.yml file." />
                <FieldRow name="manifest-path" type="yes" required description="Relative path to dbt target/manifest.json." />
                <FieldRow name="fail-on-violation" type="no" description="Whether to fail CI on contract violation. Default: true." />
                <FieldRow name="models" type="no" description="Comma-separated list of model names to validate. Default: all." />
              </tbody>
            </table>
          </section>

          {/* FAQ — use <dl> (description list) which maps directly to
              question/answer structure; superior semantics over bare <div>s
              (WCAG 1.3.1 Info and Relationships) */}
          <section id="faq" className="space-y-6">
            <SectionHeading id="faq-heading">FAQ</SectionHeading>

            <dl className="space-y-6">
              {[
                {
                  q: 'Does my manifest.json leave my browser?',
                  a: 'Yes — it is sent to our backend for parsing. The raw JSON is not persisted. Only the SHA-256 hash, model count, and generated contracts are stored in our database.',
                },
                {
                  q: 'Which dbt versions are supported?',
                  a: 'dbt-contracts parses manifest.json schema versions 9–11, which corresponds to dbt Core 1.4+. Older versions may work but are not tested.',
                },
                {
                  q: 'Can I use this without Claude / without an internet connection?',
                  a: 'Contract generation requires the Claude API. Validation and export work fully in the browser. An offline mode with rule-based generation is on the roadmap.',
                },
                {
                  q: 'Is this open source?',
                  a: 'Yes. The full source is on GitHub under the MIT licence.',
                },
              ].map((item) => (
                <div key={item.q} className="space-y-2">
                  <dt className="font-medium text-text-primary">{item.q}</dt>
                  <dd className="text-text-secondary text-sm leading-relaxed">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        </main>
      </div>
    </div>
  )
}
