'use client'

import { useState } from 'react'
import './copy-customer-details.css'

type CopyCustomerDetailsProps = {
  organization: string
  contact: string
  email: string | null
  phone: string | null
  addressLines: string[]
  showShippingDetails?: boolean
}

type CopyFieldButtonProps = {
  label: string
  value: string
}

function CopyFieldButton({ label, value }: CopyFieldButtonProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      className="ccic-admin-copy-field"
      onClick={copy}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function CopyCustomerDetails({
  organization,
  contact,
  email,
  phone,
  addressLines,
  showShippingDetails = false,
}: CopyCustomerDetailsProps) {
  const [allCopied, setAllCopied] = useState(false)
  const address = addressLines.join('\n')
  const fullDetails = [
    contact,
    organization,
    address,
    phone,
    email,
  ].filter(Boolean).join('\n')

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(fullDetails)
      setAllCopied(true)
      window.setTimeout(() => setAllCopied(false), 1600)
    } catch {
      setAllCopied(false)
    }
  }

  return (
    <>
      {showShippingDetails ? (
        <div className="ccic-admin-copy-all-wrap">
          <button type="button" className="ccic-admin-copy-all" onClick={copyAll}>
            {allCopied ? 'Shipping details copied' : 'Copy shipping details'}
          </button>
        </div>
      ) : null}

      <dl className="ccic-admin-copy-details">
        <div>
          <dt>Organization</dt>
          <dd><span>{organization}</span><CopyFieldButton label="organization" value={organization} /></dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd><span>{contact}</span><CopyFieldButton label="contact name" value={contact} /></dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{email ? <><a href={`mailto:${email}`}>{email}</a><CopyFieldButton label="email" value={email} /></> : <span>Not provided</span>}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{phone ? <><a href={`tel:${phone}`}>{phone}</a><CopyFieldButton label="phone" value={phone} /></> : <span>Not provided</span>}</dd>
        </div>
        {showShippingDetails ? (
          <div>
            <dt>Address</dt>
            <dd className="ccic-admin-copy-address">
              <span>{addressLines.length ? addressLines.map((line) => <span key={line}>{line}</span>) : 'Not provided'}</span>
              {address ? <CopyFieldButton label="address" value={address} /> : null}
            </dd>
          </div>
        ) : null}
      </dl>
    </>
  )
}
