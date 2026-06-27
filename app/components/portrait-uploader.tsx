import PortraitFrame from './portrait-frame'

type PortraitUploaderProps = {
  idPrefix: string
  uploadAction: (formData: FormData) => void | Promise<void>
  removeAction?: (formData: FormData) => void | Promise<void>
  hiddenFields: Record<string, string>
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

export default function PortraitUploader({
  idPrefix,
  uploadAction,
  removeAction,
  hiddenFields,
  imageUrl,
  imageAlt,
  uploadLabel = 'Upload or replace portrait',
  uploadButtonLabel = 'Upload portrait',
  removeButtonLabel = 'Remove portrait',
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
  const fileInputId = `${idPrefix}-portrait-upload`
  const resolvedHelpText = helpText ?? `JPG, PNG, or WebP. ${maxSizeLabel}`

  return (
    <div className="qv-portrait-uploader">
      <PortraitFrame
        image={{
          src: imageUrl,
          alt: imageUrl ? imageAlt : '',
          zoom,
          positionX,
          positionY,
        }}
        size={frameSize}
        radius={frameRadius}
        placeholderLabel={placeholderLabel}
      />

      <div className="qv-portrait-uploader-controls">
        <form action={uploadAction} className="qv-officer-public-actions" encType="multipart/form-data">
          <HiddenFields fields={hiddenFields} />
          <label className="qv-control" htmlFor={fileInputId} style={{ flex: '1 1 260px' }}>
            <span className="qv-label">{uploadLabel}</span>
            <input id={fileInputId} type="file" name="officer_photo" accept={acceptedMimeTypes} />
            <span className="qv-help-text">{resolvedHelpText}</span>
          </label>
          <button type="submit" className="qv-button-secondary">{uploadButtonLabel}</button>
        </form>

        {removeAction && imageUrl ? (
          <form action={removeAction}>
            <HiddenFields fields={hiddenFields} />
            <button type="submit" className="qv-link-button">{removeButtonLabel}</button>
          </form>
        ) : null}
      </div>
    </div>
  )
}
