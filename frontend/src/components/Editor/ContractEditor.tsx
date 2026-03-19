/**
 * ContractEditor.tsx — Monaco-based YAML editor for a single contract.
 *
 * The editor is the heart of the app. We configure Monaco with YAML support,
 * and feed it the contract YAML from the store. Edits go back to the store
 * so validation and export always operate on the latest content.
 */

import Editor from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useContractStore } from '../../stores/contractStore'
import type { ModelNode } from '../../types/manifest'
import type { ValidationError } from '../../types/contract'

interface ContractEditorProps {
  model: ModelNode
}

function toMonacoMarkers(
  errors: ValidationError[],
  model: Monaco.editor.ITextModel | null
): Monaco.editor.IMarkerData[] {
  if (!model) return []

  return errors.map((e) => ({
    // MarkerSeverity enum: Error = 8, Warning = 4
    severity: (e.severity === 'error' ? 8 : 4) as Monaco.MarkerSeverity,
    message: e.message,
    startLineNumber: e.line ?? 1,
    startColumn: e.column ?? 1,
    endLineNumber: e.line ?? 1,
    endColumn: (e.column ?? 1) + 10,
  }))
}

export function ContractEditor({ model }: ContractEditorProps) {
  const { contracts, setYaml } = useContractStore()
  const contract = contracts[model.name]

  const yaml = contract?.yaml ?? ''
  const errors = contract?.errors ?? []
  const warnings = contract?.warnings ?? []

  function handleEditorDidMount(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco
  ) {
    // Register markers when the editor mounts with existing validation state
    const editorModel = editor.getModel()
    if (editorModel) {
      const allMarkers = toMonacoMarkers([...errors, ...warnings], editorModel)
      monaco.editor.setModelMarkers(editorModel, 'dbt-contracts', allMarkers)
    }
  }

  function handleChange(value: string | undefined) {
    if (value !== undefined) {
      setYaml(model.name, value)
    }
  }

  return (
    // role="region" + aria-label identifies this as "the editor for <model>"
    // so screen reader users can jump to it via landmark navigation.
    // The inner Monaco editor manages its own focus and Tab trap — we add
    // a visually-hidden note above so keyboard-only users know they can
    // press Escape then Tab to leave the editor (standard Monaco pattern).
    <div role="region" aria-label={`YAML contract editor for ${model.name}`} className="flex-1 h-full flex flex-col">
      {/* Screen-reader-only instruction about Tab key behaviour inside Monaco.
          Sighted keyboard users see this on focus via Monaco's own tooltip,
          but screen reader users need it in the DOM (WCAG 2.1.2 No Keyboard Trap). */}
      <p className="sr-only">
        You are in a code editor. Press Escape to exit the editor and return Tab key navigation to the page.
      </p>
      <Editor
        height="100%"
        defaultLanguage="yaml"
        value={yaml}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
          fontSize: 13,
          lineHeight: 22,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          padding: { top: 16, bottom: 16 },
          renderLineHighlight: 'none',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          wordWrap: 'on',
          tabSize: 2,
          // Better YAML editing UX
          autoIndent: 'advanced',
          formatOnPaste: false,
          // Reduce noise for YAML (no bracket pair guides needed)
          bracketPairColorization: { enabled: false },
          guides: { indentation: true, bracketPairs: false },
        }}
      />
    </div>
  )
}
