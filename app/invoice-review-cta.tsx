'use client'

import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from 'react'
import styles from './about/about.module.css'
import invoiceStyles from './invoice-review-cta.module.css'

const acceptedFileTypes = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv'
const maxFileSizeBytes = 10 * 1024 * 1024

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateFile(file: File) {
  if (file.size > maxFileSizeBytes) {
    return 'Please upload a file under 10 MB.'
  }

  return null
}

export default function InvoiceReviewCta() {
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [message, setMessage] = useState<string | null>(null)

  function openFilePicker() {
    inputRef.current?.click()
  }

  function acceptFile(file: File | null | undefined) {
    if (!file) return

    const fileError = validateFile(file)
    if (fileError) {
      setSubmitState('error')
      setMessage(fileError)
      return
    }

    setSelectedFile(file)
    setSubmitState('idle')
    setMessage(null)
    setIsModalOpen(true)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.[0])
    event.target.value = ''
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    acceptFile(event.dataTransfer.files?.[0])
  }

  function closeModal() {
    if (submitState === 'submitting') return

    setIsModalOpen(false)
    setSubmitState('idle')
    setMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedFile) {
      setSubmitState('error')
      setMessage('Please attach an invoice before submitting.')
      return
    }

    const formData = new FormData(event.currentTarget)
    formData.set('invoice', selectedFile)

    setSubmitState('submitting')
    setMessage(null)

    try {
      const response = await fetch('/api/invoice-review', {
        method: 'POST',
        body: formData,
      })

      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to submit your invoice right now.')
      }

      setSubmitState('success')
      setMessage('Thanks. Your invoice was sent to Chrism for review.')
      formRef.current?.reset()
    } catch (error) {
      setSubmitState('error')
      setMessage(error instanceof Error ? error.message : 'Unable to submit your invoice right now.')
    }
  }

  return (
    <div className={styles.invoiceCta}>
      <div className={styles.invoiceCtaIntro}>
        <h2 className={styles.ctaTitle}>Already working with a vendor?</h2>
        <p>
          Send us their invoice. We&apos;ll tell you if we can do better.
          <br />
          No obligation.
        </p>
        <p className={invoiceStyles.invoiceCtaNote}>(We truly just want to help.)</p>
      </div>

      <div
        className={`${styles.invoiceDropzone} ${invoiceStyles.invoiceDropzone}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          className={styles.invoiceFileInput}
          type="file"
          name="invoice"
          accept={acceptedFileTypes}
          onChange={handleFileChange}
        />
        <p className={styles.invoiceDropzoneTitle}>Drop an invoice here</p>
        <p className={styles.invoiceDropzoneText}>PDF, image, spreadsheet, or document. Max 10 MB.</p>
        <button type="button" className="qv-button-primary" onClick={openFilePicker}>
          Upload invoice
        </button>
      </div>

      {message && !isModalOpen ? <p className={styles.invoiceStatus}>{message}</p> : null}

      {isModalOpen ? (
        <div className={`${styles.invoiceModalBackdrop} ${invoiceStyles.invoiceModalBackdrop}`} role="presentation">
          <div
            className={`${styles.invoiceModal} ${invoiceStyles.invoiceModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-modal-title"
          >
            <button type="button" className={styles.invoiceModalClose} onClick={closeModal} aria-label="Close invoice form">
              ×
            </button>

            <div className={styles.invoiceModalHeader}>
              <p className={styles.eyebrow}>Invoice review</p>
              <h3 id="invoice-modal-title">Tell us about you</h3>
              {selectedFile ? (
                <p className={`${styles.invoiceFileSummary} ${invoiceStyles.invoiceFileSummary}`}>
                  Attached: <strong>{selectedFile.name}</strong> <span>{formatFileSize(selectedFile.size)}</span>
                </p>
              ) : null}
            </div>

            <form ref={formRef} className={`${styles.invoiceForm} ${invoiceStyles.invoiceForm}`} onSubmit={handleSubmit}>
              <label>
                Name
                <input name="name" type="text" autoComplete="name" required />
              </label>
              <label>
                Email
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label>
                Org
                <input name="organization" type="text" autoComplete="organization" required />
              </label>
              <label>
                Org Type
                <select name="organizationType" required defaultValue="">
                  <option value="" disabled>
                    Select one
                  </option>
                  <option value="Faith community">Faith community</option>
                  <option value="Education">Education</option>
                  <option value="Nonprofit">Nonprofit</option>
                  <option value="Business">Business</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              {message ? <p className={styles.invoiceStatus}>{message}</p> : null}

              <div className={styles.invoiceFormActions}>
                <button type="button" className="qv-button-secondary" onClick={openFilePicker} disabled={submitState === 'submitting'}>
                  Change file
                </button>
                <button type="submit" className="qv-button-primary" disabled={submitState === 'submitting'}>
                  {submitState === 'submitting' ? 'Sending...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
