'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { buildAuthConfirmRedirectUrl } from '@/lib/auth/redirects';

type ClaimStartFormProps = {
  defaultEmail: string;
  nextPath: string;
};

export default function ClaimStartForm({ defaultEmail, nextPath }: ClaimStartFormProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const buttonLabel = useMemo(
    () => (loading ? 'Sending link...' : 'Email me a secure link'),
    [loading]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const supabase = createClient();
    const emailRedirectTo = buildAuthConfirmRedirectUrl(window.location.origin, nextPath);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo,
      },
    });

    setMessage(
      error
        ? error.message
        : 'Check your email for the secure sign-in link. It will bring you back here.'
    );
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="qv-form-grid">
      <div className="qv-form-row qv-form-row-2">
        <label className="qv-control">
          <span className="qv-label">Email</span>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>
      </div>

      <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
        <button type="submit" className="qv-button-primary" disabled={loading}>
          {buttonLabel}
        </button>
      </div>

      {message ? (
        <p className="qv-inline-message" style={{ marginTop: 4 }}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
