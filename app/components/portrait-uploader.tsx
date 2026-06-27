'use client'

import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'

type ServerAction = (formData: FormData) => void | Promise<void>

type PortraitUploaderStyle = CSSProperties & {
  '--portrait-uploader-size': string
  '--portrait-uploader-radius': string
  '--portrait-uploader-zoom': string
  '--portrait-uploader-position-x': string
  '--portrait-uploader-position-y': string
}

type PortraitUploaderProps = {
  idPrefix: string
  uploadAction: ServerAction
  removeAction?: ServerAction
  positionAction?: ServerAction
  hiddenFields: Record<string, string>
  imageUrl: string | null
  imageAlt: string
  uploadLabel?: string
  uploadButtonLabel?: string
  removeButtonLabel?: string
  savePositionButtonLabel?: string
  helpText?: string
  acceptedMimeTypes?: string
  maxSizeLabel?: string
  zoom?: number | null
  positionX?: number | null
  positionY?: number | null
  frameSize?: number
  frameRadius?: number
  placeholderLabel?: string
}

function HiddenFields({ fields }: { fields: Record<string, string> }) {
  return Object.entries(fields).map(([name, value]) => (
    <input key={name} type="hidden" name={name} value={value} />
  ))
}

function clamp(value: number, minimum: number, maximum: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(minimum, value))
}

export default function PortraitUploader({
  idPrefix,
  uploadAction,
  removeAction,
  positionAction,
  hiddenFields,
  imageUrl,
  imageAlt,
  uploadLabel = 'Upload or replace portrait',
  uploadButtonLabel = 'Choose file',
  removeButtonLabel = 'Delete portrait',
  savePositionButtonLabel = 'Save portrait position',
  helpText,
  acceptedMimeTypes = 'image/jpeg,image/png,image/webp',
  maxSizeLabel = 'Maximum 5 MB.',
  zoom = 1,
  positionX = 50,
  positionY = 50,
  frameSize = 180,
  frameRadius = 26,
  placeholderLabel = 'Portrait not set',
}: PortraitUploaderProps) {
  const uploadFormRef = useRef<HTMLFormElement>(null)
  const fileInputId = `${idPrefix}-portrait-upload`
  const resolvedHelpText = helpText ?? `JPG, PNG, or WebP. ${maxSizeLabel}`
  const [currentZoom, setCurrentZoom] = useState(clamp(Number(zoom ?? 1), 1, 3, 1))
  const [currentPositionX, setCurrentPositionX] = useState(clamp(Number(positionX ?? 50), 0, 100, 50))
  const [currentPositionY, setCurrentPositionY] = useState(clamp(Number(positionY ?? 50), 0, 100, 50))
  const [fileName, setFileName] = useState('')
  const [isUploadSubmitting, setIsUploadSubmitting] = useState(false)

  const frameStyle: PortraitUploaderStyle = {
    '--portrait-uploader-size': `${frameSize}px`,
    '--portrait-uploader-radius': `${frameRadius}px`,
    '--portrait-uploader-zoom': String(currentZoom),
    '--portrait-uploader-position-x': `${currentPositionX}%`,
    '--portrait-uploader-position-y': `${currentPositionY}%`,
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    setFileName(file?.name ?? '')

    if (!file) return

    setIsUploadSubmitting(true)
    uploadFormRef.current?.requestSubmit()
  }

  function resetPosition() {
    setCurrentZoom(1)
    setCurrentPositionX(50)
    setCurrentPositionY(50)
  }

  return (
    <div className="qv-portrait-uploader">
      <div className="qv-portrait-uploader-frame" style={frameStyle}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed private storage URLs are positioned inside a fixed portrait frame.
          <img className="qv-portrait-uploader-image" src={imageUrl} alt={imageAlt} />
        ) : (
          <div className="qv-portrait-uploader-placeholder" aria-label={placeholderLabel}>
            <div className="qv-portrait-uploader-placeholder-mark" aria-hidden="true">✦</div>
            <p>{placeholderLabel}</p>
          </div>
        )}
      </div>

      <div className="qv-portrait-uploader-controls">
        <form ref={uploadFormRef} action={uploadAction} className="qv-portrait-uploader-form" encType="multipart/form-data">
          <HiddenFields fields={hiddenFields} />
          <input type="hidden" name="photo_zoom" value={currentZoom} />
          <input type="hidden" name="photo_position_x" value={currentPositionX} />
          <input type="hidden" name="photo_position_y" value={currentPositionY} />

          <label className="qv-portrait-upload-button" htmlFor={fileInputId}>
            {isUploadSubmitting ? 'Uploading…' : uploadButtonLabel}
          </label>
          <input
            id={fileInputId}
            className="qv-portrait-upload-input"
            type="file"
            name="officer_photo"
            accept={acceptedMimeTypes}
            onChange={handleFileChange}
          />
          <div className="qv-portrait-upload-copy">
            <span className="qv-label">{uploadLabel}</span>
            <span className="qv-help-text">{fileName ? `Selected: ${fileName}` : resolvedHelpText}</span>
          </div>
        </form>

        {positionAction ? (
          <form action={positionAction} className="qv-portrait-position-form">
            <HiddenFields fields={hiddenFields} />
            <input type="hidden" name="photo_zoom" value={currentZoom} />
            <input type="hidden" name="photo_position_x" value={currentPositionX} />
            <input type="hidden" name="photo_position_y" value={currentPositionY} />

            <div className="qv-portrait-controls">
              <label className="qv-control qv-portrait-control">
                <span className="qv-label">Portrait zoom</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={currentZoom}
                  onChange={(event) => setCurrentZoom(Number.parseFloat(event.currentTarget.value))}
                />
              </label>
              <label className="qv-control qv-portrait-control">
                <span className="qv-label">Move left or right</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={currentPositionX}
                  onChange={(event) => setCurrentPositionX(Number.parseFloat(event.currentTarget.value))}
                />
              </label>
              <label className="qv-control qv-portrait-control">
                <span className="qv-label">Move up or down</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={currentPositionY}
                  onChange={(event) => setCurrentPositionY(Number.parseFloat(event.currentTarget.value))}
                />
              </label>
            </div>

            <div className="qv-portrait-uploader-actions">
              <button type="submit" className="qv-button-secondary">{savePositionButtonLabel}</button>
              <button type="button" className="qv-link-button" onClick={resetPosition}>Reset position</button>
            </div>
          </form>
        ) : null}

        {removeAction && imageUrl ? (
          <form action={removeAction}>
            <HiddenFields fields={hiddenFields} />
            <button type="submit" className="qv-link-button qv-portrait-delete-button">{removeButtonLabel}</button>
          </form>
        ) : null}
      </div>
    </div>
  )
}
