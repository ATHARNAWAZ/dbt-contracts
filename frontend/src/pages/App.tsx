/**
 * App.tsx - The main two-panel application layout.
 *
 * Left: 280px sidebar (logo, upload zone, model list, generate-all)
 * Right: Main canvas (model header, tabs, Monaco editor, action buttons)
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  Download,
  Copy,
  ShieldCheck,
  Loader2,
  Home,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { UploadZone } from '../components/Sidebar/UploadZone'
import { ModelList } from '../components/Sidebar/ModelList'
import { ContractEditor } from '../components/Editor/ContractEditor'
import { ContractPreview } from '../components/Editor/ContractPreview'
import { ValidationErrors } from '../components/Editor/ValidationErrors'

import { useManifestStore } from '../stores/manifestStore'
import { useContractStore } from '../stores/contractStore'
import { useContracts } from '../hooks/useContracts'
import { copyToClipboard, downloadTextFile } from '../lib/utils'
import type { ModelLayer } from '../types/manifest'

type ActiveTab = 'contract' | 'preview'

const layerBadgeVariants: Record<ModelLayer, 'staging' | 'intermediate' | 'mart' | 'default'> = {
  staging: 'staging',
  intermediate: 'intermediate',
  mart: 'mart',
  unknown: 'default',
}

export default function AppPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('contract')
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)

  const { manifest, selectedModel } = useManifestStore()
  const { contracts } = useContractStore()
  const { generateContract, validateContract, generateAllContracts } = useContracts()

  const currentContract = selectedModel ? contracts[selectedModel.name] : null
  const isGenerating = currentContract?.status === 'generating'

  async function handleGenerate() {
    if (!selectedModel) return
    await generateContract(selectedModel)
  }

  async function handleValidate() {
    if (!selectedModel || !currentContract?.yaml) return
    await validateContract(selectedModel.name, currentContract.yaml)
  }

  async function handleCopy() {
    if (!currentContract?.yaml) return
    const ok = await copyToClipboard(currentContract.yaml)
    if (ok) toast.success('Copied to clipboard.')
  }

  function handleDownload() {
    if (!selectedModel || !currentContract?.yaml) return
    downloadTextFile(currentContract.yaml, `${selectedModel.name}.yml`)
  }

  async function handleGenerateAll() {
    if (!manifest) return
    setIsGeneratingAll(true)
    await generateAllContracts(manifest.models)
    setIsGeneratingAll(false)
  }

  return (
    <div className="flex h-screen bg-bg text-text-primary overflow-hidden">
      {/* ================================================================
          LEFT SIDEBAR - 280px fixed width
      ================================================================ */}
      <aside aria-label="Sidebar" className="w-[280px] flex-shrink-0 flex flex-col border-r border-border bg-surface">
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity" aria-label="dbt-contracts home">
            <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
            <span className="font-semibold text-sm text-text-primary">dbt-contracts</span>
          </Link>
          <Link to="/" aria-label="Go to home page" className="text-text-muted hover:text-text-secondary transition-colors">
            <Home className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {/* Upload zone */}
        <div className="px-3 py-3 border-b border-border">
          <UploadZone />
        </div>

        {/* Model list - scrollable */}
        <ModelList />

        {/* Bottom actions */}
        {manifest && (
          <div className="px-3 py-3 border-t border-border space-y-2">
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={handleGenerateAll}
              isLoading={isGeneratingAll}
              disabled={isGeneratingAll}
              aria-label={isGeneratingAll ? 'Generating all contracts, please wait' : `Generate contracts for all ${manifest.model_count} models`}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Generate all ({manifest.model_count})
            </Button>
            <div className="flex items-center justify-between text-[10px] text-text-muted px-1">
              <span>dbt {manifest.dbt_version}</span>
              <span>{manifest.source_count} sources</span>
            </div>
          </div>
        )}
      </aside>

      {/* ================================================================
          RIGHT PANEL - takes remaining width
      ================================================================ */}
      <main className="flex-1 flex flex-col min-w-0">
        {selectedModel ? (
          <>
            {/* Model header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <h1 className="font-mono font-semibold text-base text-text-primary truncate">
                  {selectedModel.name}
                </h1>
                <Badge variant={layerBadgeVariants[selectedModel.layer]}>
                  {selectedModel.layer}
                </Badge>
                {currentContract?.status === 'generating' && (
                  // role="status" + aria-live so screen readers announce the
                  // generating state without requiring focus to move (WCAG 4.1.3)
                  <span role="status" aria-live="polite" className="text-xs text-text-secondary flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    Generating...
                  </span>
                )}
                {currentContract?.status === 'validated' && currentContract.isValid && (
                  <span role="status" aria-live="polite" className="text-xs text-success">Valid</span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {currentContract?.yaml && (
                  <>
                    <Button size="sm" variant="ghost" onClick={handleValidate}
                      aria-label={`Validate contract for ${selectedModel.name}`}>
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Validate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCopy}
                      aria-label={`Copy contract YAML for ${selectedModel.name} to clipboard`}>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      Copy
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleDownload}
                      aria-label={`Download contract YAML for ${selectedModel.name}`}>
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Download
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleGenerate}
                  isLoading={isGenerating}
                  disabled={isGenerating}
                  aria-label={
                    isGenerating
                      ? `Generating contract for ${selectedModel.name}, please wait`
                      : currentContract?.yaml
                        ? `Regenerate contract for ${selectedModel.name}`
                        : `Generate contract for ${selectedModel.name}`
                  }
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {currentContract?.yaml ? 'Regenerate' : 'Generate'}
                </Button>
              </div>
            </div>

            {/* Tabs — WAI-ARIA tab pattern (WCAG 4.1.2) */}
            <div
              role="tablist"
              aria-label="Contract views"
              className="flex items-center gap-1 px-6 pt-3 border-b border-border flex-shrink-0"
            >
              {(['contract', 'preview'] as const).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  aria-controls={`tabpanel-${tab}`}
                  id={`tab-${tab}`}
                  onClick={() => setActiveTab(tab)}
                  className={[
                    'px-3 py-1.5 text-xs font-medium rounded-t transition-colors capitalize',
                    activeTab === tab
                      ? 'text-text-primary border-b-2 border-accent'
                      : 'text-text-secondary hover:text-text-primary',
                  ].join(' ')}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Main content area */}
            <div
              role="tabpanel"
              id={`tabpanel-${activeTab}`}
              aria-labelledby={`tab-${activeTab}`}
              className="flex-1 overflow-hidden"
            >
              {activeTab === 'contract' ? (
                currentContract?.yaml ? (
                  <ContractEditor model={selectedModel} />
                ) : (
                  <EmptyState
                    title="No contract generated yet."
                    description="Click Generate to ask Claude to write this contract."
                    className="h-full"
                    action={
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleGenerate}
                        isLoading={isGenerating}
                        aria-label={`Generate contract for ${selectedModel.name}`}
                      >
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        Generate contract
                      </Button>
                    }
                  />
                )
              ) : (
                <ContractPreview model={selectedModel} />
              )}
            </div>

            {/* Validation errors panel */}
            {currentContract && activeTab === 'contract' && (
              <ValidationErrors
                errors={currentContract.errors}
                warnings={currentContract.warnings}
                isValid={currentContract.isValid}
              />
            )}
          </>
        ) : (
          <EmptyState
            icon={<ShieldCheck className="h-10 w-10" aria-hidden="true" />}
            title={manifest ? 'Select a model from the sidebar.' : 'Upload a manifest to get started.'}
            description={
              manifest
                ? 'Click any model to open its contract editor.'
                : 'Drop your dbt manifest.json in the sidebar to see your models.'
            }
            className="h-full"
          />
        )}
      </main>
    </div>
  )
}
