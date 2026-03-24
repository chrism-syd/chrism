export function sanitizeNextPath(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith('/')) {
    return null;
  }

  if (trimmed.startsWith('//')) {
    return null;
  }

  return trimmed;
}

export function buildAuthConfirmRedirectUrl(origin: string, nextPath?: string | null) {
  const confirmUrl = new URL('/auth/confirm', origin);
  const safeNextPath = sanitizeNextPath(nextPath);

  if (safeNextPath) {
    confirmUrl.searchParams.set('next', safeNextPath);
  }

  return confirmUrl.toString();
}
