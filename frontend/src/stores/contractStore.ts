/**
 * contractStore.ts — Zustand store for generated contracts.
 *
 * Maps model names to their ContractState so each model's contract
 * can be independently generated, edited, and validated.
 */

import { create } from 'zustand'
import type { ContractState, ValidationError } from '../types/contract'

interface ContractStore {
  // Map of model name -> contract state
  contracts: Record<string, ContractState>

  // Actions
  startGenerating: (modelName: string) => void
  appendYaml: (modelName: string, chunk: string) => void
  finishGenerating: (modelName: string) => void
  setError: (modelName: string, error: string) => void
  setYaml: (modelName: string, yaml: string) => void
  setValidation: (
    modelName: string,
    isValid: boolean,
    errors: ValidationError[],
    warnings: ValidationError[]
  ) => void
  reset: () => void
}

const defaultContractState = (modelName: string): ContractState => ({
  modelName,
  yaml: '',
  status: 'idle',
  isValid: false,
  errors: [],
  warnings: [],
  generatedAt: null,
})

export const useContractStore = create<ContractStore>((set) => ({
  contracts: {},

  startGenerating: (modelName) =>
    set((state) => ({
      contracts: {
        ...state.contracts,
        [modelName]: {
          ...defaultContractState(modelName),
          status: 'generating',
        },
      },
    })),

  appendYaml: (modelName, chunk) =>
    set((state) => {
      const existing = state.contracts[modelName] ?? defaultContractState(modelName)
      return {
        contracts: {
          ...state.contracts,
          [modelName]: {
            ...existing,
            yaml: existing.yaml + chunk,
            status: 'generating',
          },
        },
      }
    }),

  finishGenerating: (modelName) =>
    set((state) => {
      const existing = state.contracts[modelName] ?? defaultContractState(modelName)
      return {
        contracts: {
          ...state.contracts,
          [modelName]: {
            ...existing,
            status: 'generated',
            generatedAt: new Date().toISOString(),
          },
        },
      }
    }),

  setError: (modelName, error) =>
    set((state) => {
      const existing = state.contracts[modelName] ?? defaultContractState(modelName)
      return {
        contracts: {
          ...state.contracts,
          [modelName]: {
            ...existing,
            status: 'error',
            errors: [{ line: null, column: null, message: error, severity: 'error' }],
          },
        },
      }
    }),

  setYaml: (modelName, yaml) =>
    set((state) => {
      const existing = state.contracts[modelName] ?? defaultContractState(modelName)
      return {
        contracts: {
          ...state.contracts,
          [modelName]: { ...existing, yaml },
        },
      }
    }),

  setValidation: (modelName, isValid, errors, warnings) =>
    set((state) => {
      const existing = state.contracts[modelName] ?? defaultContractState(modelName)
      return {
        contracts: {
          ...state.contracts,
          [modelName]: {
            ...existing,
            isValid,
            errors,
            warnings,
            status: isValid ? 'validated' : 'generated',
          },
        },
      }
    }),

  reset: () => set({ contracts: {} }),
}))
