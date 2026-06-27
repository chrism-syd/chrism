'use client'

import { useState } from 'react'
import PortraitFrame from '@/app/components/portrait-frame'

type Props = {
  officerName: string
  imageUrl: string | null
  initialZoom: number
  initialPositionX: number
  initialPositionY: number
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export default function PortraitPositionEditor({
  officerName,
  imageUrl,
  initialZoom,
  initialPositionX,
  initialPositionY,
}: Props) {
  const [zoom, setZoom] = useState(clamp(initialZoom, 1, 3))
  const [positionX, setPositionX] = useState(clamp(initialPositionX, 0, 100))
  const [positionY, setPositionY] = useState(clamp(initialPositionY, 0, 100))

  function resetPosition() {
    setZoom(1)
    setPositionX(50)
    setPositionY(50)
  }

  return (
    <div className="qv-portrait-editor">
      <PortraitFrame
        image={{
          src: imageUrl,
          alt: imageUrl ? `${officerName} portrait` : '',
          zoom,
          positionX,
          positionY,
        }}
        size={132}
        radius={22}
        placeholderLabel="No portrait yet"
      />

      <input type="hidden" name="photo_zoom" value={zoom} />
      <input type="hidden" name="photo_position_x" value={positionX} />
      <input type="hidden" name="photo_position_y" value={positionY} />

      <div className="qv-portrait-controls">
        <label className="qv-control qv-portrait-control">
          <span className="qv-label">Zoom</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(event) => setZoom(Number.parseFloat(event.currentTarget.value))}
          />
        </label>

        <label className="qv-control qv-portrait-control">
          <span className="qv-label">Move left or right</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={positionX}
            onChange={(event) => setPositionX(Number.parseFloat(event.currentTarget.value))}
          />
        </label>

        <label className="qv-control qv-portrait-control">
          <span className="qv-label">Move up or down</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={positionY}
            onChange={(event) => setPositionY(Number.parseFloat(event.currentTarget.value))}
          />
        </label>

        <button type="button" className="qv-button-secondary" onClick={resetPosition}>
          Reset portrait position
        </button>
      </div>
    </div>
  )
}
