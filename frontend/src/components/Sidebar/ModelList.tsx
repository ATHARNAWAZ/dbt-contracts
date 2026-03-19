import type { ReactNode } from 'react'
import { Database, GitBranch, BarChart3 } from 'lucide-react'
import { ModelItem } from './ModelItem'
import { EmptyState } from '../ui/EmptyState'
import { useManifestStore } from '../../stores/manifestStore'
import type { ModelNode } from '../../types/manifest'

interface LayerSection {
  label: string
  layer: string
  icon: ReactNode
  models: ModelNode[]
}

export function ModelList() {
  const { manifest, selectedModel, selectModel } = useManifestStore()

  if (!manifest) {
    return (
      <EmptyState
        title="No manifest uploaded yet."
        description="Your contracts await."
        className="py-8"
      />
    )
  }

  // Group models by layer for the sidebar sections
  const sections: LayerSection[] = [
    {
      label: 'Staging',
      layer: 'staging',
      icon: <Database className="h-3 w-3" />,
      models: manifest.models.filter((m) => m.layer === 'staging'),
    },
    {
      label: 'Intermediate',
      layer: 'intermediate',
      icon: <GitBranch className="h-3 w-3" />,
      models: manifest.models.filter((m) => m.layer === 'intermediate'),
    },
    {
      label: 'Marts',
      layer: 'mart',
      icon: <BarChart3 className="h-3 w-3" />,
      models: manifest.models.filter((m) => m.layer === 'mart'),
    },
    {
      label: 'Other',
      layer: 'unknown',
      icon: null,
      models: manifest.models.filter((m) => m.layer === 'unknown'),
    },
  ].filter((s) => s.models.length > 0)

  return (
    // role="navigation" would be wrong here — this is a list of selectable
    // items, not a navigation menu.  We use nav only for actual site navigation.
    <div className="flex-1 overflow-y-auto py-2" aria-label="dbt models">
      {sections.map((section) => (
        <div key={section.layer} className="mb-4">
          {/* Use an <h3> so screen reader users can jump between layer groups
              via heading navigation (WCAG 1.3.1 Info and Relationships).
              The count is wrapped in a visually-hidden span with a label so
              it reads "3 models" rather than just "3". */}
          <h3
            className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary"
            id={`layer-heading-${section.layer}`}
          >
            <span aria-hidden="true">{section.icon}</span>
            {section.label}
            <span className="ml-auto" aria-label={`${section.models.length} models`}>
              {section.models.length}
            </span>
          </h3>
          {/* aria-labelledby associates this list with the layer heading */}
          <ul role="list" aria-labelledby={`layer-heading-${section.layer}`}>
            {section.models.map((model) => (
              <li key={model.unique_id}>
                <ModelItem
                  model={model}
                  isSelected={selectedModel?.unique_id === model.unique_id}
                  onClick={() => selectModel(model)}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
