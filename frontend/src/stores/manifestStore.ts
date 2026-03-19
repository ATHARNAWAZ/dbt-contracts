/**
 * manifestStore.ts — Zustand store for the uploaded dbt manifest.
 *
 * The manifest is the entry point to the entire app. Everything else
 * (contract generation, model list, sidebar) depends on it being loaded.
 */

import { create } from 'zustand'
import type { ManifestParseResponse, ModelNode } from '../types/manifest'

interface ManifestStore {
  // The full parse response from the API
  manifest: ManifestParseResponse | null

  // The currently selected model in the sidebar
  selectedModel: ModelNode | null

  // Upload state
  isUploading: boolean
  uploadError: string | null

  // Actions
  setManifest: (manifest: ManifestParseResponse) => void
  selectModel: (model: ModelNode) => void
  setUploading: (uploading: boolean) => void
  setUploadError: (error: string | null) => void
  reset: () => void
}

export const useManifestStore = create<ManifestStore>((set) => ({
  manifest: null,
  selectedModel: null,
  isUploading: false,
  uploadError: null,

  setManifest: (manifest) =>
    set({
      manifest,
      uploadError: null,
      // Auto-select the first model so the editor isn't blank
      selectedModel: manifest.models[0] ?? null,
    }),

  selectModel: (model) => set({ selectedModel: model }),

  setUploading: (isUploading) => set({ isUploading }),

  setUploadError: (uploadError) => set({ uploadError }),

  reset: () =>
    set({
      manifest: null,
      selectedModel: null,
      isUploading: false,
      uploadError: null,
    }),
}))
