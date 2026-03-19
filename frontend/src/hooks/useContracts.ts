/**
 * useContracts.ts — Hook for contract generation and validation.
 *
 * SSE streaming is handled here rather than in a component because
 * the streaming logic is stateful (we accumulate chunks) and we want
 * the contract store to be the single source of truth.
 */

import toast from 'react-hot-toast'
import type { ModelNode } from '../types/manifest'
import type { ValidateContractResponse } from '../types/contract'
import { useContractStore } from '../stores/contractStore'
import { useManifestStore } from '../stores/manifestStore'

const API_BASE = import.meta.env['VITE_API_URL'] ?? ''

export function useContracts() {
  const { startGenerating, appendYaml, finishGenerating, setError, setValidation } =
    useContractStore()
  const { manifest } = useManifestStore()

  /**
   * Generate a contract for a single model via SSE streaming.
   *
   * We use fetch + ReadableStream rather than EventSource because
   * EventSource doesn't support POST requests. This gives us the same
   * streaming behaviour with full control over headers and body.
   */
  async function generateContract(model: ModelNode): Promise<void> {
    if (!manifest) return

    startGenerating(model.name)

    const payload = {
      manifest_hash: manifest.manifest_hash,
      model_name: model.name,
      model_data: model,
    }

    try {
      const response = await fetch(`${API_BASE}/api/contracts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Generation failed' }))
        throw new Error(err.detail ?? `HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body for SSE stream.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE protocol: each event ends with a blank line
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6)

          let parsed: { chunk: string; done: boolean; error?: string }
          try {
            parsed = JSON.parse(raw) as { chunk: string; done: boolean; error?: string }
          } catch {
            continue
          }

          if (parsed.error) {
            setError(model.name, parsed.error)
            const isRateLimit = /rate.?limit|429/i.test(parsed.error)
            if (isRateLimit) {
              toast.error(
                `You've hit the free tier limit (10 contracts/hour). Come back later, or the sample manifest resets.`
              )
            } else {
              toast.error(
                `Contract generation failed. Check that ANTHROPIC_API_KEY is set, or use the programmatic fallback below.`
              )
            }
            return
          }

          if (parsed.done) {
            finishGenerating(model.name)
            return
          }

          if (parsed.chunk) {
            appendYaml(model.name, parsed.chunk)
          }
        }
      }

      // Stream ended without [DONE] — treat as complete
      finishGenerating(model.name)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      setError(model.name, message)
      const isNetwork = /fetch|network|failed to fetch/i.test(message)
      if (isNetwork) {
        toast.error(`Can't reach the API. Is the backend running? Try docker-compose up.`)
      } else {
        toast.error(
          `Contract generation failed. Check that ANTHROPIC_API_KEY is set, or use the programmatic fallback below.`
        )
      }
    }
  }

  async function validateContract(
    modelName: string,
    contractYaml: string
  ): Promise<ValidateContractResponse | null> {
    try {
      const response = await fetch(`${API_BASE}/api/contracts/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_yaml: contractYaml, model_name: modelName }),
      })

      if (!response.ok) {
        toast.error(`Can't reach the API. Is the backend running? Try docker-compose up.`)
        return null
      }

      const result: ValidateContractResponse = await response.json()
      setValidation(modelName, result.is_valid, result.errors, result.warnings)

      if (result.is_valid) {
        toast.success('Contract is valid. Your future self thanks you.')
      } else {
        toast.error(
          `${result.errors.length} validation error${result.errors.length !== 1 ? 's' : ''} found. Check the panel below.`
        )
      }

      return result
    } catch {
      toast.error(`Can't reach the API. Is the backend running? Try docker-compose up.`)
      return null
    }
  }

  /**
   * Generate contracts for all models in sequence.
   * We intentionally avoid Promise.all here — parallel generation would
   * hit the rate limiter for large projects.
   */
  async function generateAllContracts(models: ModelNode[]): Promise<void> {
    for (const model of models) {
      await generateContract(model)
    }
    toast.success(`${models.length} contracts generated. Your future self thanks you.`)
  }

  return { generateContract, validateContract, generateAllContracts }
}
