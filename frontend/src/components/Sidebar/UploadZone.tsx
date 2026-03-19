import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileJson, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useManifest } from '../../hooks/useManifest'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export function UploadZone() {
  const { uploadManifest, isUploading } = useManifest()
  const [rejection, setRejection] = useState<'type' | 'size' | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setRejection(null)
      const file = acceptedFiles[0]
      if (file) {
        void uploadManifest(file)
      }
    },
    [uploadManifest]
  )

  const onDropRejected = useCallback(
    (fileRejections: import('react-dropzone').FileRejection[]) => {
      const firstError = fileRejections[0]?.errors[0]?.code
      if (firstError === 'file-too-large') {
        setRejection('size')
      } else {
        setRejection('type')
      }
    },
    []
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: { 'application/json': ['.json'] },
    maxFiles: 1,
    maxSize: MAX_SIZE_BYTES,
    disabled: isUploading,
    // noClick/noKeyboard are NOT set — react-dropzone handles them natively.
    // We keep the default behaviour so Space/Enter on the container open the
    // file picker (satisfies WCAG 2.1.1 Keyboard).
  })

  // Derive an accessible label for the current state so screen readers always
  // hear something meaningful when they land on the dropzone.
  const zoneLabel = isUploading
    ? 'Uploading manifest, please wait'
    : rejection === 'size'
      ? 'Upload failed: file exceeds 10 MB. Drop a smaller manifest.json or press Enter to browse.'
      : rejection === 'type'
        ? 'Upload failed: file must be a JSON file. Drop manifest.json or press Enter to browse.'
        : isDragActive
          ? 'Release to upload manifest.json'
          : 'Upload manifest.json. Press Enter or Space to open file browser, or drag and drop.'

  return (
    <div
      {...getRootProps()}
      aria-label={zoneLabel}
      // role="button" makes the dropzone recognisable as an interactive
      // element to screen readers (WCAG 4.1.2 Name, Role, Value).
      role="button"
      tabIndex={isUploading ? -1 : 0}
      aria-disabled={isUploading}
      className={cn(
        'relative flex flex-col items-center justify-center',
        'border border-dashed rounded-lg p-4 gap-2',
        'cursor-pointer transition-all duration-150',
        'text-center text-xs',
        // Focus ring for keyboard users (WCAG 2.4.7 Focus Visible)
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        isDragActive
          ? 'border-accent bg-accent/5 text-accent'
          : rejection
            ? 'border-error/60 text-error'
            : 'border-border hover:border-border-hover text-text-secondary hover:text-text-primary',
        isUploading && 'opacity-60 cursor-wait'
      )}
    >
      {/* Hidden file input — react-dropzone manages this */}
      <input {...getInputProps()} aria-hidden="true" />

      {isUploading ? (
        <>
          <div aria-hidden="true" className="h-4 w-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          {/* role="status" so screen readers announce without stealing focus */}
          <p role="status" aria-live="polite" className="text-accent">Reading your manifest...</p>
        </>
      ) : rejection === 'size' ? (
        <>
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <p>That manifest is over 10MB.</p>
          <p className="text-[10px]">
            500+ models might be a you problem. (We'll handle it, just slowly.)
          </p>
        </>
      ) : rejection === 'type' ? (
        <>
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <p>That doesn't look like a manifest.json.</p>
          <p className="text-[10px]">Is everything okay?</p>
        </>
      ) : isDragActive ? (
        <>
          <FileJson className="h-5 w-5" aria-hidden="true" />
          <p>Go ahead, drop it. We've seen worse.</p>
        </>
      ) : (
        <>
          <Upload className="h-4 w-4" aria-hidden="true" />
          <p>Drop your manifest.json here.</p>
          <p className="text-text-secondary text-[10px]">We won't judge its size.</p>
        </>
      )}
    </div>
  )
}
