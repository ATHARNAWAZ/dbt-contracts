/**
 * Download.tsx — Export contracts.yml and the GitHub Action.
 *
 * Users arrive here after generating contracts in the app.
 * They can download both files and follow the setup instructions.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Copy, CheckCircle2, ShieldCheck, ArrowLeft, Github } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../components/ui/Button'
import { useContractStore } from '../stores/contractStore'
import { useManifestStore } from '../stores/manifestStore'
import { downloadTextFile, copyToClipboard } from '../lib/utils'

const GITHUB_ACTION_YAML = `# .github/workflows/dbt-contracts.yml
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
      - name: Validate dbt contracts
        uses: dbt-contracts/action@v1
        with:
          contracts-path: contracts/contracts.yml
          manifest-path: target/manifest.json
          fail-on-violation: true`

function CodeBlock({ code, filename }: { code: string; filename: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const ok = await copyToClipboard(code)
    if (ok) {
      setCopied(true)
      toast.success('Copied to clipboard.')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
        <span className="text-xs font-mono text-text-secondary" id={`file-label-${filename.replace(/[^a-z0-9]/gi, '-')}`}>
          {filename}
        </span>
        <button
          onClick={handleCopy}
          aria-label={copied ? `Copied ${filename} to clipboard` : `Copy ${filename} to clipboard`}
          aria-live="polite"
          className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
        >
          {copied
            ? <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            : <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          }
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        aria-label={`Code for ${filename}`}
        className="p-4 text-xs font-mono text-text-secondary overflow-x-auto whitespace-pre-wrap leading-relaxed"
      >
        {code}
      </pre>
    </div>
  )
}

export default function DownloadPage() {
  const { contracts } = useContractStore()
  const { manifest } = useManifestStore()

  // Concatenate all generated contracts into a single YAML file
  const generatedContracts = Object.values(contracts).filter((c) => c.yaml)
  const allContractsYaml = generatedContracts
    .map((c) => c.yaml.trim())
    .join('\n---\n')

  function handleDownloadContracts() {
    if (!allContractsYaml) {
      toast.error('No contracts generated yet. Go to the app first.')
      return
    }
    downloadTextFile(allContractsYaml, 'contracts.yml')
    toast.success('contracts.yml downloaded.')
  }

  function handleDownloadAction() {
    downloadTextFile(GITHUB_ACTION_YAML, 'dbt-contracts.yml')
    toast.success('GitHub Action downloaded.')
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {/* Nav */}
      <nav aria-label="Primary" className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" aria-label="dbt-contracts home">
            <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
            <span className="font-semibold text-sm">dbt-contracts</span>
          </Link>
          <Link to="/app" className="text-sm text-text-secondary hover:text-text-primary flex items-center gap-1 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to app
          </Link>
        </div>
      </nav>

      <main id="main-content">
        <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
          <div>
            <h1 className="text-[32px] font-semibold tracking-tight">Download your contracts</h1>
            <p className="text-text-secondary mt-2">
              Add these files to your dbt repository to start enforcing contracts in CI.
            </p>
          </div>

          {/* Status */}
          {manifest && (
            <div role="status" aria-live="polite" className="card p-4 flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" aria-hidden="true" />
              <span className="text-sm text-text-secondary">
                <span className="text-text-primary font-medium">{generatedContracts.length}</span>
                {' '}of{' '}
                <span className="text-text-primary font-medium">{manifest.model_count}</span>
                {' '}models have contracts
              </span>
              {generatedContracts.length === 0 && (
                <Link to="/app" className="ml-auto">
                  <Button size="sm" variant="primary">Generate contracts first</Button>
                </Link>
              )}
            </div>
          )}

          {/* Step 1: contracts.yml */}
          <section aria-labelledby="step1-heading" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-secondary font-mono mb-1" aria-hidden="true">STEP 1</p>
                <h2 id="step1-heading" className="text-[24px] font-semibold">Download contracts.yml</h2>
                <p className="text-text-secondary text-sm mt-1">
                  Place this in a <code className="font-mono text-text-primary bg-code px-1 rounded">contracts/</code> directory in your dbt project root.
                </p>
              </div>
              <Button variant="primary" size="md" onClick={handleDownloadContracts}
                aria-label="Download contracts.yml file">
                <Download className="h-4 w-4" aria-hidden="true" />
                Download
              </Button>
            </div>
            {allContractsYaml ? (
              <CodeBlock
                code={allContractsYaml.slice(0, 1000) + (allContractsYaml.length > 1000 ? '\n# ... truncated for display' : '')}
                filename="contracts/contracts.yml"
              />
            ) : (
              <div className="card p-6 text-center text-text-secondary text-sm">
                No contracts generated yet.{' '}
                <Link to="/app" className="text-accent hover:underline">Go to the app</Link> to generate them.
              </div>
            )}
          </section>

          {/* Step 2: GitHub Action */}
          <section aria-labelledby="step2-heading" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-secondary font-mono mb-1" aria-hidden="true">STEP 2</p>
                <h2 id="step2-heading" className="text-[24px] font-semibold">Add the GitHub Action</h2>
                <p className="text-text-secondary text-sm mt-1">
                  This workflow validates your contracts on every PR that touches dbt models.
                </p>
              </div>
              <Button variant="secondary" size="md" onClick={handleDownloadAction}
                aria-label="Download GitHub Action workflow file">
                <Github className="h-4 w-4" aria-hidden="true" />
                Download
              </Button>
            </div>
            <CodeBlock code={GITHUB_ACTION_YAML} filename=".github/workflows/dbt-contracts.yml" />
          </section>

          {/* Step 3: Commit and push */}
          <section aria-labelledby="step3-heading" className="space-y-4">
            <div>
              <p className="text-xs text-text-secondary font-mono mb-1" aria-hidden="true">STEP 3</p>
              <h2 id="step3-heading" className="text-[24px] font-semibold">Commit and push</h2>
              <p className="text-text-secondary text-sm mt-1">
                On your next PR, the action will validate contracts automatically.
              </p>
            </div>
            <CodeBlock
              code={`git add contracts/contracts.yml .github/workflows/dbt-contracts.yml
git commit -m "chore: add dbt data contracts"
git push`}
              filename="terminal"
            />
          </section>

          {/* Docs link */}
          <div className="card p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Need the full schema reference?</p>
              <p className="text-xs text-text-secondary mt-0.5">Docs cover every contract field with examples.</p>
            </div>
            <Link to="/docs">
              <Button variant="secondary" size="sm">View docs</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
