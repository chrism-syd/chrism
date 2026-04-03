'use client'

import Link from 'next/link'
import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'

type InvitedCouncilDraft = {
  invited_council_name: string
  invited_council_number: string
  invite_email: string
  invite_contact_name: string
}

type ExternalInviteeDraft = {
  invitee_name: string
  invitee_email: string
  invitee_phone: string
  invitee_role_label: string
  invitee_notes: string
}

type EventFormInitialValues = {
  title?: string
  description?: string
  location_name?: string
  location_address?: string
  starts_at?: string | null
  ends_at?: string | null
  status_code?: 'draft' | 'scheduled' | 'completed' | 'cancelled'
  scope_code?: 'home_council_only' | 'multi_council'
  event_kind_code?: 'standard' | 'general_meeting' | 'executive_meeting'
  requires_rsvp?: boolean
  needs_volunteers?: boolean
  rsvp_deadline_at?: string | null
  reminder_enabled?: boolean
  reminder_scheduled_for?: string | null
  invited_councils?: InvitedCouncilDraft[]
  external_invitees?: ExternalInviteeDraft[]
}

type EventFormProps = {
  mode: 'create' | 'edit'
  action: (formData: FormData) => void | Promise<void>
  cancelHref: string
  submitLabel?: string
  initialValues?: EventFormInitialValues
  footerActions?: ReactNode
}

type EventTypeOption =
  | 'home_council_event'
  | 'multi_council_event'
  | 'executive_meeting'
  | 'general_meeting'

const emptyInviteRow = (): InvitedCouncilDraft => ({
  invited_council_name: '',
  invited_council_number: '',
  invite_email: '',
  invite_contact_name: '',
})

const emptyExternalInviteeRow = (): ExternalInviteeDraft => ({
  invitee_name: '',
  invitee_email: '',
  invitee_phone: '',
  invitee_role_label: '',
  invitee_notes: '',
})

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function fieldNoteStyle(): CSSProperties {
  return {
    margin: '6px 0 0',
    fontSize: 13,
    color: 'var(--text-secondary)',
  }
}

function deriveEventType(initialValues?: EventFormInitialValues): EventTypeOption {
  if (initialValues?.event_kind_code === 'executive_meeting') {
    return 'executive_meeting'
  }

  if (initialValues?.event_kind_code === 'general_meeting') {
    return 'general_meeting'
  }

  if (initialValues?.scope_code === 'multi_council') {
    return 'multi_council_event'
  }

  return 'home_council_event'
}

function getResolvedEventFields(eventType: EventTypeOption) {
  if (eventType === 'multi_council_event') {
    return {
      scope_code: 'multi_council' as const,
      event_kind_code: 'standard' as const,
    }
  }

  if (eventType === 'executive_meeting') {
    return {
      scope_code: 'home_council_only' as const,
      event_kind_code: 'executive_meeting' as const,
    }
  }

  if (eventType === 'general_meeting') {
    return {
      scope_code: 'home_council_only' as const,
      event_kind_code: 'general_meeting' as const,
    }
  }

  return {
    scope_code: 'home_council_only' as const,
    event_kind_code: 'standard' as const,
  }
}

function hasInviteCouncilValues(rows: InvitedCouncilDraft[]) {
  return rows.some((row) => Object.values(row).some((value) => value.trim() !== ''))
}

function hasExternalInviteeValues(rows: ExternalInviteeDraft[]) {
  return rows.some((row) => Object.values(row).some((value) => value.trim() !== ''))
}

type EventFormFieldKey =
  | 'title'
  | 'starts_at'
  | 'ends_at'
  | 'rsvp_deadline_at'
  | 'reminder_scheduled_for'
  | 'reminder_days_before'
  | 'invited_councils'
  | 'external_invitees'

function parseLocalDate(value: string) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export default function EventForm({
  mode,
  action,
  cancelHref,
  submitLabel,
  initialValues,
  footerActions,
}: EventFormProps) {
  const [eventType, setEventType] = useState<EventTypeOption>(deriveEventType(initialValues))
  const [requiresRsvp, setRequiresRsvp] = useState<boolean>(initialValues?.requires_rsvp ?? false)
  const [needsVolunteers, setNeedsVolunteers] = useState<boolean>(initialValues?.needs_volunteers ?? false)
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(
    initialValues?.reminder_enabled ?? false
  )
  const [invitedCouncils, setInvitedCouncils] = useState<InvitedCouncilDraft[]>(
    initialValues?.invited_councils?.length ? initialValues.invited_councils : [emptyInviteRow()]
  )
  const [externalInvitees, setExternalInvitees] = useState<ExternalInviteeDraft[]>(
    initialValues?.external_invitees?.length
      ? initialValues.external_invitees
      : [emptyExternalInviteeRow()]
  )

  const [showInviteCouncils, setShowInviteCouncils] = useState<boolean>(
    hasInviteCouncilValues(initialValues?.invited_councils ?? [])
  )
  const [showExternalInvitees, setShowExternalInvitees] = useState<boolean>(
    hasExternalInviteeValues(initialValues?.external_invitees ?? [])
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EventFormFieldKey, string>>>({})

  const resolvedSubmitLabel = useMemo(
    () => submitLabel ?? (mode === 'edit' ? 'Save changes' : 'Create event'),
    [mode, submitLabel]
  )

  const resolvedFields = getResolvedEventFields(eventType)
  const isMeeting = resolvedFields.event_kind_code !== 'standard'
  const shouldShowInviteSection = eventType === 'multi_council_event'
  const hasPublishedBaseline =
    mode === 'edit' && Boolean(initialValues?.status_code) && initialValues?.status_code !== 'draft'
  const hasExternalInviteeContent = hasExternalInviteeValues(externalInvitees)
  const canCollapseExternalInvitees =
    showExternalInvitees && externalInvitees.length === 1 && !hasExternalInviteeContent

  function updateInviteRow(index: number, field: keyof InvitedCouncilDraft, value: string) {
    setInvitedCouncils((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    )
  }

  function addInviteRow() {
    setShowInviteCouncils(true)
    setInvitedCouncils((current) => [...current, emptyInviteRow()])
  }

  function removeInviteRow(index: number) {
    setInvitedCouncils((current) => {
      if (current.length === 1) {
        setShowInviteCouncils(false)
        return [emptyInviteRow()]
      }

      const next = current.filter((_, rowIndex) => rowIndex !== index)
      if (!hasInviteCouncilValues(next)) {
        setShowInviteCouncils(false)
      }
      return next
    })
  }

  function updateExternalInviteeRow(
    index: number,
    field: keyof ExternalInviteeDraft,
    value: string
  ) {
    setExternalInvitees((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    )
  }

  function addExternalInviteeRow() {
    setShowExternalInvitees(true)
    setExternalInvitees((current) => [...current, emptyExternalInviteeRow()])
  }

  function removeExternalInviteeRow(index: number) {
    setExternalInvitees((current) => {
      if (current.length === 1) {
        setShowExternalInvitees(false)
        return [emptyExternalInviteeRow()]
      }

      const next = current.filter((_, rowIndex) => rowIndex !== index)
      if (!hasExternalInviteeValues(next)) {
        setShowExternalInvitees(false)
      }
      return next
    })
  }

  function enableRsvp() {
    setRequiresRsvp(true)
  }

  function disableRsvp() {
    setRequiresRsvp(false)
  }

  function enableVolunteers() {
    setNeedsVolunteers(true)
  }

  function disableVolunteers() {
    setNeedsVolunteers(false)
  }

  function collapseExternalInvitees() {
    setShowExternalInvitees(false)
    setExternalInvitees([emptyExternalInviteeRow()])
  }

  function enableReminder() {
    setReminderEnabled(true)
  }

  function disableReminder() {
    setReminderEnabled(false)
  }

  function clearValidation() {
    setSubmitError(null)
    setFieldErrors({})
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!validateForm(event.currentTarget)) {
      event.preventDefault()
      return
    }

    if (hasPublishedBaseline) {
      const confirmed = window.confirm(
        'This event is already published. Saving now will update live event details that people may already be using. Continue?'
      )

      if (!confirmed) {
        event.preventDefault()
      }
    }
  }

  function validateForm(form: HTMLFormElement) {
    const nextFieldErrors: Partial<Record<EventFormFieldKey, string>> = {}
    const formData = new FormData(form)
    const title = String(formData.get('title') ?? '').trim()
    const startsAt = String(formData.get('starts_at') ?? '').trim()
    const endsAt = String(formData.get('ends_at') ?? '').trim()
    const responseDeadlineAt = String(formData.get('rsvp_deadline_at') ?? '').trim()
    const reminderScheduledFor = String(formData.get('reminder_scheduled_for') ?? '').trim()
    const reminderDaysBefore = String(formData.get('reminder_days_before') ?? '').trim()

    if (!isMeeting && !title) {
      nextFieldErrors.title = 'Please add a title for the event.'
    }

    const startDate = parseLocalDate(startsAt)
    const endDate = parseLocalDate(endsAt)

    if (startsAt && !startDate) {
      nextFieldErrors.starts_at = 'Please choose a valid start time.'
    }

    if (endsAt && !endDate) {
      nextFieldErrors.ends_at = 'Please choose a valid end time.'
    }

    if (startDate && endDate && endDate.getTime() <= startDate.getTime()) {
      nextFieldErrors.ends_at = 'Please choose an end time that comes after the start time.'
    }

    const responseCollectionEnabled = requiresRsvp || needsVolunteers

    if (responseCollectionEnabled && responseDeadlineAt) {
      const deadline = parseLocalDate(responseDeadlineAt)
      if (!deadline) {
        nextFieldErrors.rsvp_deadline_at = 'Please choose a valid response deadline.'
      } else if (startDate && deadline.getTime() >= startDate.getTime()) {
        nextFieldErrors.rsvp_deadline_at = 'Please choose a response deadline that comes before the event starts.'
      }
    }

    if (reminderEnabled && reminderScheduledFor) {
      const reminder = parseLocalDate(reminderScheduledFor)
      if (!reminder) {
        nextFieldErrors.reminder_scheduled_for = 'Please choose a valid reminder time.'
      } else if (startDate && reminder.getTime() >= startDate.getTime()) {
        nextFieldErrors.reminder_scheduled_for = 'Please choose a reminder time that comes before the event starts.'
      }
    }

    if (reminderEnabled && reminderDaysBefore) {
      const parsedDays = Number(reminderDaysBefore)
      if (!Number.isInteger(parsedDays) || parsedDays < 0 || parsedDays > 60) {
        nextFieldErrors.reminder_days_before = 'Please enter a whole number between 0 and 60.'
      }
    }

    if (shouldShowInviteSection && showInviteCouncils) {
      const incompleteInviteIndex = invitedCouncils.findIndex((row) => {
        const hasAnyValue = Object.values(row).some((value) => value.trim() !== '')
        return hasAnyValue && row.invited_council_name.trim() === ''
      })

      if (incompleteInviteIndex >= 0) {
        nextFieldErrors.invited_councils = `Please give invited group ${incompleteInviteIndex + 1} a council name before saving.`
      }
    }

    if (showExternalInvitees) {
      const incompleteInviteeIndex = externalInvitees.findIndex((row) => {
        const hasAnyValue = Object.values(row).some((value) => value.trim() !== '')
        return hasAnyValue && row.invitee_name.trim() === ''
      })

      if (incompleteInviteeIndex >= 0) {
        nextFieldErrors.external_invitees = `Please give guest ${incompleteInviteeIndex + 1} a name before saving.`
      }
    }

    setFieldErrors(nextFieldErrors)

    if (Object.keys(nextFieldErrors).length > 0) {
      setSubmitError('Please review the highlighted details below and try again.')
      return false
    }

    setSubmitError(null)
    return true
  }

  if (!shouldShowInviteSection && showInviteCouncils) {
    setShowInviteCouncils(false)
  }

  return (
    <form
      action={action}
      className="qv-form-grid"
      onChange={() => {
        if (submitError || Object.keys(fieldErrors).length > 0) {
          clearValidation()
        }
      }}
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="scope_code" value={resolvedFields.scope_code} />
      <input type="hidden" name="event_kind_code" value={resolvedFields.event_kind_code} />
      <input type="hidden" name="requires_rsvp" value={requiresRsvp ? 'true' : 'false'} />
      <input type="hidden" name="needs_volunteers" value={needsVolunteers ? 'true' : 'false'} />
      <input type="hidden" name="reminder_enabled" value={reminderEnabled ? 'true' : 'false'} />

      {submitError ? (
        <section className="qv-card qv-error" role="alert">
          <p style={{ margin: 0 }}>{submitError}</p>
        </section>
      ) : null}

      <section className="qv-card">
        <div className="qv-directory-section-head">
          <div>
            <h2 className="qv-section-title">Event basics</h2>
            <p className="qv-section-subtitle">Add the title, timing, and location details for the event.</p>
          </div>
        </div>

        <div className="qv-form-grid">
          <div className="qv-form-row">
            <label className="qv-control">
              <span className="qv-label">Event type</span>
              <select
                value={eventType}
                onChange={(event) => setEventType(event.target.value as EventTypeOption)}
              >
                <option value="home_council_event">Home Council Event</option>
                <option value="multi_council_event">Multi-Council Event</option>
                <option value="executive_meeting">Executive Meeting</option>
                <option value="general_meeting">General Meeting</option>
              </select>
            </label>
          </div>

          <div className="qv-form-row">
            <label className="qv-control">
              <span className="qv-label">Event title</span>
              <input
                type="text"
                name="title"
                defaultValue={initialValues?.title ?? ''}
                placeholder={
                  eventType === 'executive_meeting'
                    ? 'Executive Meeting'
                    : eventType === 'general_meeting'
                      ? 'General Meeting'
                      : 'Event title'
                }
                required={!isMeeting}
              />
              {fieldErrors.title ? (
                <p style={{ ...fieldNoteStyle(), color: 'var(--danger-soft)' }}>{fieldErrors.title}</p>
              ) : isMeeting ? (
                <p style={fieldNoteStyle()}>
                  Leave blank to use the meeting type as the title.
                </p>
              ) : null}
            </label>
          </div>

          <div className="qv-form-row">
            <label className="qv-control">
              <span className="qv-label">Description</span>
              <textarea
                name="description"
                defaultValue={initialValues?.description ?? ''}
                placeholder="Description"
              />
            </label>
          </div>

          <div className="qv-form-row qv-form-row-2">
            <label className="qv-control">
              <span className="qv-label">Starts</span>
              <input
                type="datetime-local"
                name="starts_at"
                defaultValue={toDateTimeLocalValue(initialValues?.starts_at)}
                required
                aria-invalid={fieldErrors.starts_at ? 'true' : 'false'}
              />
              {fieldErrors.starts_at ? (
                <p style={{ ...fieldNoteStyle(), color: 'var(--danger-soft)' }}>{fieldErrors.starts_at}</p>
              ) : null}
            </label>
            <label className="qv-control">
              <span className="qv-label">Ends <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></span>
              <input
                type="datetime-local"
                name="ends_at"
                defaultValue={toDateTimeLocalValue(initialValues?.ends_at)}
                aria-invalid={fieldErrors.ends_at ? 'true' : 'false'}
              />
              {fieldErrors.ends_at ? (
                <p style={{ ...fieldNoteStyle(), color: 'var(--danger-soft)' }}>{fieldErrors.ends_at}</p>
              ) : (
                <p style={fieldNoteStyle()}>Leave blank if the event does not have a fixed end time.</p>
              )}
            </label>
          </div>

          <div className="qv-form-row qv-form-row-2">
            <label className="qv-control">
              <span className="qv-label">Location name</span>
              <input
                type="text"
                name="location_name"
                defaultValue={initialValues?.location_name ?? ''}
                placeholder="Parish Hall"
              />
            </label>
            <label className="qv-control">
              <span className="qv-label">Location address</span>
              <input
                type="text"
                name="location_address"
                defaultValue={initialValues?.location_address ?? ''}
                placeholder="Location address"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="qv-card">
        <div className="qv-directory-section-head">
          <div>
            <h2 className="qv-section-title">Participation</h2>
          </div>
        </div>

        <div className="qv-form-grid">
          <div className="qv-directory-section-head">
            <div>
              <h3 className="qv-section-title" style={{ fontSize: 18 }}>RSVP</h3>
              <p className="qv-section-subtitle">Let people respond that they are attending.</p>
            </div>
            <div className="qv-directory-actions">
              {requiresRsvp ? (
                <button type="button" onClick={disableRsvp} className="qv-button-secondary">
                  Remove RSVP
                </button>
              ) : (
                <button type="button" onClick={enableRsvp} className="qv-button-secondary">
                  Add RSVP
                </button>
              )}
            </div>
          </div>

          {requiresRsvp || needsVolunteers ? (
            <div className="qv-form-row">
              <label className="qv-control">
                <span className="qv-label">Response by</span>
                <input
                  type="datetime-local"
                  name="rsvp_deadline_at"
                  defaultValue={toDateTimeLocalValue(initialValues?.rsvp_deadline_at)}
                  aria-invalid={fieldErrors.rsvp_deadline_at ? 'true' : 'false'}
                />
                {fieldErrors.rsvp_deadline_at ? (
                  <p style={{ ...fieldNoteStyle(), color: 'var(--danger-soft)' }}>{fieldErrors.rsvp_deadline_at}</p>
                ) : null}
              </label>
            </div>
          ) : (
            <input type="hidden" name="rsvp_deadline_at" value="" />
          )}

          <div className="qv-directory-section-head" style={{ marginTop: 12 }}>
            <div>
              <h3 className="qv-section-title" style={{ fontSize: 18 }}>Volunteers</h3>
              <p className="qv-section-subtitle">Let people add themselves as volunteers on the event page.</p>
            </div>
            <div className="qv-directory-actions">
              {needsVolunteers ? (
                <button type="button" onClick={disableVolunteers} className="qv-button-secondary">
                  Remove Volunteers
                </button>
              ) : (
                <button type="button" onClick={enableVolunteers} className="qv-button-secondary">
                  Need Volunteers
                </button>
              )}
            </div>
          </div>

          {needsVolunteers ? (
            <p style={fieldNoteStyle()}>Volunteers can add their name, contact details, and notes from the public response page.</p>
          ) : null}
        </div>
      </section>

      {shouldShowInviteSection ? (
        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Invited councils</h2>
              <p className="qv-section-subtitle">Only needed for multi-council events.</p>
            </div>
            <div className="qv-directory-actions">
              {showInviteCouncils ? (
                <button type="button" onClick={addInviteRow} className="qv-button-secondary">
                  Add council
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowInviteCouncils(true)}
                  className="qv-button-secondary"
                >
                  Add councils
                </button>
              )}
            </div>
          </div>

          {showInviteCouncils ? (
            <div className="qv-form-grid">
              {fieldErrors.invited_councils ? (
                <div className="qv-card qv-error">
                  <p style={{ margin: 0 }}>{fieldErrors.invited_councils}</p>
                </div>
              ) : null}
              {invitedCouncils.map((row, index) => (
                <div key={index} className="qv-card">
                  <div className="qv-directory-section-head">
                    <div>
                      <h3 className="qv-section-title">Invited council {index + 1}</h3>
                      <p className="qv-section-subtitle">This row becomes one invite target and one RSVP link.</p>
                    </div>
                    <div className="qv-directory-actions">
                      <button
                        type="button"
                        onClick={() => removeInviteRow(index)}
                        className="qv-button-secondary"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="qv-form-grid">
                    <div className="qv-form-row qv-form-row-2">
                      <label className="qv-control">
                        <span className="qv-label">Council name</span>
                        <input
                          type="text"
                          name="invited_council_name[]"
                          value={row.invited_council_name}
                          onChange={(event) =>
                            updateInviteRow(index, 'invited_council_name', event.target.value)
                          }
                          placeholder="Council name"
                        />
                      </label>
                      <label className="qv-control">
                        <span className="qv-label">Council number</span>
                        <input
                          type="text"
                          name="invited_council_number[]"
                          value={row.invited_council_number}
                          onChange={(event) =>
                            updateInviteRow(index, 'invited_council_number', event.target.value)
                          }
                          placeholder="Council number"
                        />
                      </label>
                    </div>
                    <div className="qv-form-row qv-form-row-2">
                      <label className="qv-control">
                        <span className="qv-label">Invite email</span>
                        <input
                          type="email"
                          name="invite_email[]"
                          value={row.invite_email}
                          onChange={(event) => updateInviteRow(index, 'invite_email', event.target.value)}
                          placeholder="Invite email"
                        />
                      </label>
                      <label className="qv-control">
                        <span className="qv-label">Invite contact name</span>
                        <input
                          type="text"
                          name="invite_contact_name[]"
                          value={row.invite_contact_name}
                          onChange={(event) =>
                            updateInviteRow(index, 'invite_contact_name', event.target.value)
                          }
                          placeholder="Invite contact name"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="qv-empty">
              <h3 className="qv-empty-title">No invited councils yet</h3>
              <p className="qv-empty-text">Add councils only when this event needs outside group RSVP links.</p>
            </div>
          )}
        </section>
      ) : null}

      <section className="qv-card">
        <div className="qv-directory-section-head">
          <div>
            <h2 className="qv-section-title">Invite individual guests</h2>
            <p className="qv-section-subtitle">Guests stay attached only to this event.</p>
          </div>
          <div className="qv-directory-actions">
            {showExternalInvitees ? (
              canCollapseExternalInvitees ? (
                <button type="button" onClick={collapseExternalInvitees} className="qv-button-secondary">
                  Cancel
                </button>
              ) : (
                <button type="button" onClick={addExternalInviteeRow} className="qv-button-secondary">
                  Add guest
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => setShowExternalInvitees(true)}
                className="qv-button-secondary"
              >
                Add guest
              </button>
            )}
          </div>
        </div>

        {showExternalInvitees ? (
          <div className="qv-form-grid">
            {fieldErrors.external_invitees ? (
              <div className="qv-card qv-error">
                <p style={{ margin: 0 }}>{fieldErrors.external_invitees}</p>
              </div>
            ) : null}
            {externalInvitees.map((row, index) => (
              <div key={index} className="qv-card">
                <div className="qv-directory-section-head">
                  <div>
                    <h3 className="qv-section-title">Guest invitee {index + 1}</h3>
                    <p className="qv-section-subtitle">Guest invitees are not added to the member database.</p>
                  </div>
                  <div className="qv-directory-actions">
                    <button
                      type="button"
                      onClick={() => removeExternalInviteeRow(index)}
                      className="qv-button-secondary"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="qv-form-grid">
                  <div className="qv-form-row qv-form-row-2">
                    <label className="qv-control">
                      <span className="qv-label">Name</span>
                      <input
                        type="text"
                        name="invitee_name[]"
                        value={row.invitee_name}
                        onChange={(event) =>
                          updateExternalInviteeRow(index, 'invitee_name', event.target.value)
                        }
                        placeholder="Name"
                      />
                    </label>
                    <label className="qv-control">
                      <span className="qv-label">Email</span>
                      <input
                        type="email"
                        name="invitee_email[]"
                        value={row.invitee_email}
                        onChange={(event) =>
                          updateExternalInviteeRow(index, 'invitee_email', event.target.value)
                        }
                        placeholder="Email"
                      />
                    </label>
                  </div>
                  <div className="qv-form-row qv-form-row-2">
                    <label className="qv-control">
                      <span className="qv-label">Role / context</span>
                      <input
                        type="text"
                        name="invitee_role_label[]"
                        value={row.invitee_role_label}
                        onChange={(event) =>
                          updateExternalInviteeRow(index, 'invitee_role_label', event.target.value)
                        }
                        placeholder="Role / context"
                      />
                    </label>
                    <label className="qv-control">
                      <span className="qv-label">Phone</span>
                      <input
                        type="text"
                        name="invitee_phone[]"
                        value={row.invitee_phone}
                        onChange={(event) =>
                          updateExternalInviteeRow(index, 'invitee_phone', event.target.value)
                        }
                        placeholder="Phone"
                      />
                    </label>
                  </div>
                  <div className="qv-form-row">
                    <label className="qv-control">
                      <span className="qv-label">Notes</span>
                      <textarea
                        name="invitee_notes[]"
                        value={row.invitee_notes}
                        onChange={(event) =>
                          updateExternalInviteeRow(index, 'invitee_notes', event.target.value)
                        }
                        placeholder="Notes"
                      />
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="qv-card">
        <div className="qv-directory-section-head">
          <div>
            <h2 className="qv-section-title">Reminder email</h2>
          </div>
          <div className="qv-directory-actions">
            {reminderEnabled ? (
              <button type="button" onClick={disableReminder} className="qv-button-secondary">
                Remove reminder
              </button>
            ) : (
              <button type="button" onClick={enableReminder} className="qv-button-secondary">
                Set reminder
              </button>
            )}
          </div>
        </div>

        {reminderEnabled ? (
          <div className="qv-form-grid">
            <div className="qv-form-row">
              <label className="qv-control">
                <span className="qv-label">Reminder send time</span>
                <input
                  type="datetime-local"
                  name="reminder_scheduled_for"
                  defaultValue={toDateTimeLocalValue(initialValues?.reminder_scheduled_for)}
                  aria-invalid={fieldErrors.reminder_scheduled_for ? 'true' : 'false'}
                />
                {fieldErrors.reminder_scheduled_for ? (
                  <p style={{ ...fieldNoteStyle(), color: 'var(--danger-soft)' }}>{fieldErrors.reminder_scheduled_for}</p>
                ) : null}
              </label>
            </div>
            <p style={fieldNoteStyle()}>
              Canned reminder text is used today. Per-event reminder text and agenda support should be the next step.
            </p>
          </div>
        ) : (
          <input type="hidden" name="reminder_scheduled_for" value="" />
        )}
      </section>

      <div className="qv-form-actions">
        <Link href={cancelHref} className="qv-link-button qv-button-secondary">
          Cancel
        </Link>
        {footerActions}
        <button type="submit" name="submit_intent" value="draft" className="qv-button-secondary">
          Save as Draft
        </button>
        <button type="submit" name="submit_intent" value="save" className="qv-button-primary">
          {resolvedSubmitLabel}
        </button>
      </div>
    </form>
  )
}
