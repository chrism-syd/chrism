'use client';

import { useState } from 'react';

type CopyLinkPillProps = {
  href: string;
  label?: string;
};

export default function CopyLinkPill({
  href,
  label = 'Council Invite Link',
}: CopyLinkPillProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={handleCopy} className="qv-badge" title={href}>
      {copied ? 'Copied Invite Link' : label}
    </button>
  );
}