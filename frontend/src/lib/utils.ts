/**
 * Utility functions used across the frontend.
 */

/**
 * Merge Tailwind class names. Handles conditional class application cleanly.
 * A minimal cn() without the clsx/tailwind-merge dependency — we don't need
 * conflict resolution for this project.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Format a model layer string into a display-friendly label.
 */
export function formatLayer(layer: string): string {
  const labels: Record<string, string> = {
    staging: 'Staging',
    intermediate: 'Intermediate',
    mart: 'Mart',
    unknown: 'Unknown',
  }
  return labels[layer] ?? layer
}

/**
 * Download a string as a file. Used for contract and GitHub Action exports.
 */
export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Copy text to the clipboard. Returns true on success.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for browsers without clipboard API (rare but possible in HTTP contexts)
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  }
}
