'use client'

import { useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, FormEvent } from 'react'

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
  hiddenFields: Record<string, string>
  profileFormId?: string
  imageUrl: string | null
  imageAlt: string
  uploadLabel?: string
  uploadButtonLabel?: string
  removeButtonLabel?: string
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
  hiddenFields,
  profileFormId,
  imageUrl,
  imageAlt,
  uploadLabel = 'Upload or replace portrait',
  uploadButtonLabel = 'Upload portrait',
  removeButtonLabel = 'Delete portrait',
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

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    setFileName(file?.name ?? '')

    if (!file) return

    setIsUploadSubmitting(true)
    uploadFormRef.current?.requestSubmit()
  }

  function handleDeleteSubmit(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm('Delete portrait?')) {
      event.preventDefault()
    }
  }

  function nudge(deltaX: number, deltaY: number) {
    setCurrentPositionX((value) => clamp(value + deltaX, 0, 100, 50))
    setCurrentPositionY((value) => clamp(value + deltaY, 0, 100, 50))
  }

  function resetPosition() {
    setCurrentZoom(1)
    setCurrentPositionX(50)
    setCurrentPositionY(50)
  }

  return (
    <div className="qv-portrait-uploader">
      {profileFormId ? (
        <>
          <input form={profileFormId} type="hidden" name="photo_zoom" value={currentZoom} />
          <input form={profileFormId} type="hidden" name="photo_position_x" value={currentPositionX} />
          <input form={profileFormId} type="hidden" name="photo_position_y" value={currentPositionY} />
        </>
      ) : null}

      <div className="qv-portrait-uploader-stage">
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

          <form ref={uploadFormRef} action={uploadAction} className={imageUrl ? 'qv-portrait-replace-form' : 'qv-portrait-empty-upload-form'} encType="multipart/form-data">
            <HiddenFields fields={hiddenFields} />
            <input type="hidden" name="photo_zoom" value={currentZoom} />
            <input type="hidden" name="photo_position_x" value={currentPositionX} />
            <input type="hidden" name="photo_position_y" value={currentPositionY} />
            <label className={imageUrl ? 'qv-portrait-replace-button' : 'qv-portrait-empty-upload-button'} htmlFor={fileInputId}>
              {isUploadSubmitting ? 'Uploading...' : uploadButtonLabel}
            </label>
            <input
              id={fileInputId}
              className="qv-portrait-upload-input"
              type="file"
              name="officer_photo"
              accept={acceptedMimeTypes}
              onChange={handleFileChange}
            />
          </form>

          {removeAction && imageUrl ? (
            <form action={removeAction} onSubmit={handleDeleteSubmit} className="qv-portrait-delete-form">
              <HiddenFields fields={hiddenFields} />
              <button type="submit" className="qv-portrait-delete-button" aria-label={removeButtonLabel}>x</button>
            </form>
          ) : null}
        </div>

        <div className="qv-portrait-mini-tools" aria-label="Portrait position controls">
          <div className="qv-portrait-zoom-stack">
            <span className="qv-portrait-zoom-mark" aria-hidden="true">+</span>
            <input
              className="qv-portrait-zoom-slider"
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={currentZoom}
              aria-label="Portrait zoom"
              onChange={(event) => setCurrentZoom(Number.parseFloat(event.currentTarget.value))}
            />
            <span className="qv-portrait-zoom-mark" aria-hidden="true">-</span>
          </div>

          <div className="qv-portrait-nudge-pad">
            <button type="button" className="qv-portrait-nudge-button qv-portrait-nudge-up" onClick={() => nudge(0, -2)} aria-label="Move portrait up">↑</button>
            <button type="button" className="qv-portrait-nudge-button qv-portrait-nudge-left" onClick={() => nudge(-2, 0)} aria-label="Move portrait left">←</button>
            <button type="button" className="qv-portrait-reset-button" onClick={resetPosition}>Reset</button>
            <button type="button" className="qv-portrait-nudge-button qv-portrait-nudge-right" onClick={() => nudge(2, 0)} aria-label="Move portrait right">→</button>
            <button type="button" className="qv-portrait-nudge-button qv-portrait-nudge-down" onClick={() => nudge(0, 2)} aria-label="Move portrait down">↓</button>
          </div>
        </div>
      </div>

      <div className="qv-portrait-upload-copy">
        <span className="qv-label">{uploadLabel}</span>
        <span className="qv-help-text">{fileName ? `Selected: ${fileName}` : resolvedHelpText}</span>
      </div>
    </div>
  )
}
