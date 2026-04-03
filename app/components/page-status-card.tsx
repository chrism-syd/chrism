import Link from 'next/link'
import type { ReactNode } from 'react'

type Action = {
  label: string
  href: string
  tone?: 'primary' | 'secondary' | 'danger'
}

type PageStatusCardProps = {
  title: string
  body: ReactNode
  tone?: 'empty' | 'info' | 'warning' | 'error'
  actions?: Action[]
}

function toneClassName(tone: NonNullable<PageStatusCardProps['tone']>) {
  switch (tone) {
    case 'error':
      return 'qv-status-card qv-status-card-error'
    case 'warning':
      return 'qv-status-card qv-status-card-warning'
    case 'info':
      return 'qv-status-card qv-status-card-info'
    default:
      return 'qv-status-card qv-status-card-empty'
  }
}

function actionToneClass(tone: Action['tone']) {
  switch (tone) {
    case 'primary':
      return 'qv-link-button qv-button-primary'
    case 'danger':
      return 'qv-link-button qv-button-danger'
    default:
      return 'qv-link-button qv-button-secondary'
  }
}

export default function PageStatusCard({
  title,
  body,
  tone = 'empty',
  actions = [],
}: PageStatusCardProps) {
  return (
    <div className={toneClassName(tone)}>
      <h3 className="qv-status-card-title">{title}</h3>
      <div className="qv-status-card-body">{body}</div>

      {actions.length > 0 ? (
        <div className="qv-status-card-actions">
          {actions.map((action) => (
            <Link key={`${action.href}:${action.label}`} href={action.href} className={actionToneClass(action.tone)}>
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
