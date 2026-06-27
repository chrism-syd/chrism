'use client'

import { useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, FormEvent, PointerEvent } from 'react'
import PortraitFrame from './portrait-frame'

type ServerAction = (formData: FormData) => void | Promise<void>

type PortraitUploaderStyle = CSSProperties & {
  '--portrait-uploader-size': string
  '--portrait-uploader-radius': string
}

type DragState = {
  pointerId: number
  startClientX: number
  startClientY: number
  startPositionX: number
  startPositionY: number
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
  const dragStateRef = useRef<DragState | null>(null)
  const fileInputId = `${idPrefix}-portrait-upload`
  const resolvedHelpText = helpText ?? `JPG, PNG, or WebP. ${maxSizeLabel}`
  const [currentZoom, setCurrentZoom] = useState(clamp(Number(zoom ?? 1), 1, 3, 1))
  const [currentPositionX, setCurrentPositionX] = useState(clamp(Number(positionX ?? 50), 0, 100, 50))
  const [currentPositionY, setCurrentPositionY] = useState(clamp(Number(positionY ?? 50), 0, 100, 50))
  const [fileName, setFileName] = useState('')
  const [isUploadSubmitting, setIsUploadSubmitting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const frameStyle: PortraitUploaderStyle = {
    '--portrait-uploader-size': `${frameSize}px`,
    '--portrait-uploader-radius': `${frameRadius}px`,
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

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!imageUrl) return

    event.currentTarget.setPointerCapture(event.pointerId)
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPositionX: currentPositionX,
      startPositionY: currentPositionY,
    }
    setIsDragging(true)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    const movementScale = 100 / frameSize
    const deltaX = (event.clientX - dragState.startClientX) * movementScale
    const deltaY = (event.clientY - dragState.startClientY) * movementScale

    setCurrentPositionX(clamp(dragState.startPositionX - deltaX, 0, 100, 50))
    setCurrentPositionY(clamp(dragState.startPositionY - deltaY, 0, 100, 50))
  }

  function stopDragging(event: PointerEvent<HTMLDivElement>) {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null
      setIsDragging(false)
    }
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
        <div
          className={`qv-portrait-uploader-frame${imageUrl ? ' qv-portrait-uploader-frame-draggable' : ''}${isDragging ? ' qv-portrait-uploader-frame-dragging' : ''}`}
          style={frameStyle}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          role={imageUrl ? 'application' : undefined}
          aria-label={imageUrl ? 'Drag portrait to reposition it inside the frame' : undefined}
        >
          <PortraitFrame
            image={{
              src: imageUrl,
              alt: imageUrl ? imageAlt : '',
              zoom: currentZoom,
              positionX: currentPositionX,
              positionY: currentPositionY,
            }}
            size={frameSize}
            radius={frameRadius}
            placeholderLabel={placeholderLabel}
            className="qv-portrait-uploader-frame-inner"
          />

          {removeAction && imageUrl ? (
            <form action={removeAction} onSubmit={handleDeleteSubmit} className="qv-portrait-delete-form">
              <HiddenFields fields={hiddenFields} />
              <button type="submit" className="qv-portrait-delete-button" aria-label={removeButtonLabel}>x</button>
            </form>
          ) : null}
        </div>

        <label className="qv-portrait-simple-zoom">
          <span className="qv-label">Zoom</span>
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
        </label>
      </div>

      <form ref={uploadFormRef} action={uploadAction} className="qv-portrait-upload-form" encType="multipart/form-data">
        <HiddenFields fields={hiddenFields} />
        <input type="hidden" name="photo_zoom" value={currentZoom} />
        <input type="hidden" name="photo_position_x" value={currentPositionX} />
        <input type="hidden" name="photo_position_y" value={currentPositionY} />
        <label className="qv-portrait-upload-button" htmlFor={fileInputId}>
          {isUploadSubmitting ? 'Uploading...' : imageUrl ? 'Replace portrait' : uploadButtonLabel}
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

      <div className="qv-portrait-upload-copy">
        <span className="qv-help-text">{fileName ? `Selected: ${fileName}` : imageUrl ? 'Drag the photo to reposition it, then save the public profile.' : resolvedHelpText}</span>
        {imageUrl ? <button type="button" className="qv-link-button qv-portrait-reset-button" onClick={resetPosition}>Reset portrait</button> : null}
      </div>
    </div>
  )
}
