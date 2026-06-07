'use client'

import { useFormStatus } from 'react-dom'
import { REGISTRATION_CONSENT_TEXT } from '@/lib/registration/consent'
import { registerContactAction } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="qv-button-primary" disabled={pending}>
      {pending ? 'Sending verification...' : 'Register and verify email'}
    </button>
  )
}

type RegisterFormProps = {
  defaultEmail?: string | null
}

export default function RegisterForm({ defaultEmail }: RegisterFormProps) {
  return (
    <form action={registerContactAction} className="qv-form-grid qv-register-form">
      <div className="qv-form-row qv-form-row-2">
        <label className="qv-field">
          <span>First name</span>
          <input name="first_name" type="text" autoComplete="given-name" required />
        </label>
        <label className="qv-field">
          <span>Last name</span>
          <input name="last_name" type="text" autoComplete="family-name" required />
        </label>
      </div>

      <label className="qv-field">
        <span>Email address</span>
        <input name="email" type="email" autoComplete="email" required defaultValue={defaultEmail ?? ''} />
      </label>

      <label className="qv-field">
        <span>Phone number, optional</span>
        <input name="phone" type="tel" autoComplete="tel" />
      </label>

      <label className="qv-register-consent">
        <span>
          <input name="consent_accepted" type="checkbox" required />
          {REGISTRATION_CONSENT_TEXT}
        </span>
      </label>

      <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
        <SubmitButton />
      </div>
    </form>
  )
}
