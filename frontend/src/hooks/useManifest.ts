/**
 * useManifest.ts — Custom hook for manifest upload logic.
 *
 * Keeps the upload fetch logic out of components so we can test it
 * and reuse it across the upload zone and drag-and-drop areas.
 */

import toast from 'react-hot-toast'
import type { ManifestParseResponse } from '../types/manifest'
import { useManifestStore } from '../stores/manifestStore'

const API_BASE = import.meta.env['VITE_API_URL'] ?? ''

export function useManifest() {
  const { setManifest, setUploading, setUploadError, isUploading } = useManifestStore()

  async function uploadManifest(file: File): Promise<ManifestParseResponse | null> {
    setUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${API_BASE}/api/manifest/parse`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ detail: 'Unknown error' }))
        const message = errorBody.detail ?? `HTTP ${response.status}`
        setUploadError(message)
        toast.error(
          `Couldn't parse that file. Make sure it's a dbt manifest.json from target/ — not a sources.yml or profiles.yml.`
        )
        return null
      }

      const data: ManifestParseResponse = await response.json()
      setManifest(data)
      toast.success(`Found ${data.model_count} models. Nice.`)
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error'
      setUploadError(message)
      toast.error(`Can't reach the API. Is the backend running? Try docker-compose up.`)
      return null
    } finally {
      setUploading(false)
    }
  }

  return { uploadManifest, isUploading }
}
