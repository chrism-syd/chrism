'use client'

import { useMemo, useState } from 'react'
import ConfirmActionButton from '@/app/components/confirm-action-button'
import MemberSearchField from '@/app/components/member-search-field'
import {
  addCustomListMemberAction,
  claimCustomListMemberAction,
  logCustomListContactAction,
  releaseCustomListClaimAction,
  revokeCustomListAccessAction,
  removeCustomListMemberAction,
  shareCustomListAction,
} from '@/app/custom-lists/actions'
import { formatDate } from '@/lib/custom-lists'

type PersonSummaryRow = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  cell_phone: string | null
  home_phone: string | null
}

type CustomListMemberView = {
  id: string
  custom_list_id: string
  person_id: string
  claimed_by_person_id: string | null
  claimed_at: string | null
  last_contact_at: string | null
  last_contact_by_person_id: string | null
  added_at: string
  person: PersonSummaryRow | null
  claimedBy: PersonSummaryRow | null
  lastContactBy: PersonSummaryRow | null
}

type SharedAccessView = {
  id: string
  custom_list_id: string
  person_id: string | null
  user_id: string | null
  grantee_email: string | null
  granted_at: string
  granted_by_auth_user_id: string | null
  person: PersonSummaryRow | null
}

type MemberOption = {
  id: string
  name: string
  email: string | null
}

type Props = {
  listId: string
  listName: string
  canManage: boolean
  currentPersonId: string | null
  members: CustomListMemberView[]
  sharedAccess: SharedAccessView[]
  shareCandidates: MemberOption[]
  addCandidates: MemberOption[]
}

type MembersSort = 'attention' | 'name_az' | 'name_za' | 'contact_newest' | 'contact_oldest'
type RecentSort = 'newest' | 'oldest' | 'name_az' | 'name_za'

function fullName(person?: PersonSummaryRow | null) {
  if (!person) return 'Unknown member'
  return `${person.first_name} ${person.last_name}`.trim()
}

function bestPhone(person?: PersonSummaryRow | null) {
  if (!person) return null
  return person.cell_phone || person.home_phone || null
}

function compareByLastName(left: CustomListMemberView, right: CustomListMemberView, direction: 1 | -1 = 1) {
  const leftLast = left.person?.last_name || ''
  const rightLast = right.person?.last_name || ''
  const lastCompare = leftLast.localeCompare(rightLast, 'en', { sensitivity: 'base' }) * direction
  if (lastCompare !== 0) return lastCompare

  const leftFirst = left.person?.first_name || ''
  const rightFirst = right.person?.first_name || ''
  return leftFirst.localeCompare(rightFirst, 'en', { sensitivity: 'base' }) * direction
}

function contactTime(value?: string | null) {
  return value ? new Date(value).getTime() : 0
}

function sortMembers(list: CustomListMemberView[], sortBy: MembersSort) {
  const rows = [...list]

  if (sortBy === 'name_az') {
    return rows.sort((left, right) => compareByLastName(left, right, 1))
  }
  if (sortBy === 'name_za') {
    return rows.sort((left, right) => compareByLastName(left, right, -1))
  }
  if (sortBy === 'contact_newest') {
    return rows.sort((left, right) => {
      const delta = contactTime(right.last_contact_at) - contactTime(left.last_contact_at)
      return delta !== 0 ? delta : compareByLastName(left, right, 1)
    })
  }
  if (sortBy === 'contact_oldest') {
    return rows.sort((left, right) => {
      const delta = contactTime(left.last_contact_at) - contactTime(right.last_contact_at)
      return delta !== 0 ? delta : compareByLastName(left, right, 1)
    })
  }

  return rows.sort((left, right) => {
    const leftHasContact = Boolean(left.last_contact_at)
    const rightHasContact = Boolean(right.last_contact_at)

    if (leftHasContact !== rightHasContact) {
      return leftHasContact ? 1 : -1
    }

    if (!leftHasContact && !rightHasContact) {
      return compareByLastName(left, right, 1)
    }

    const delta = contactTime(left.last_contact_at) - contactTime(right.last_contact_at)
    return delta !== 0 ? delta : compareByLastName(left, right, 1)
  })
}

function sortRecentMembers(list: CustomListMemberView[], sortBy: RecentSort) {
  const rows = [...list]
  if (sortBy === 'oldest') {
    return rows.sort((left, right) => {
      const delta = contactTime(left.last_contact_at) - contactTime(right.last_contact_at)
      return delta !== 0 ? delta : compareByLastName(left, right, 1)
    })
  }
  if (sortBy === 'name_az') {
    return rows.sort((left, right) => compareByLastName(left, right, 1))
  }
  if (sortBy === 'name_za') {
    return rows.sort((left, right) => compareByLastName(left, right, -1))
  }

  return rows.sort((left, right) => {
    const delta = contactTime(right.last_contact_at) - contactTime(left.last_contact_at)
    return delta !== 0 ? delta : compareByLastName(left, right, 1)
  })
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}


function BootstrapIcon({
  name,
  className,
}: {
  name: 'trash' | 'x' | 'calendar' | 'chevron-down'
  className?: string
}) {
  if (name === 'trash') {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0A.5.5 0 0 1 8.5 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
        <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1 0-2H5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1h2.5a1 1 0 0 1 1 1M6 2a.5.5 0 0 0-.5.5V3h5v-.5A.5.5 0 0 0 10 2zm-2 2v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4z" />
      </svg>
    )
  }

  if (name === 'calendar') {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
        <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v1H0V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M16 14a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V5h16z" />
      </svg>
    )
  }

  if (name === 'chevron-down') {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
        <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z" />
    </svg>
  )
}

function ReviewMemberRow({
  member,
  listId,
  listName,
  currentPersonId,
  canManage,
}: {
  member: CustomListMemberView
  listId: string
  listName: string
  currentPersonId: string | null
  canManage: boolean
}) {
  const [showContactForm, setShowContactForm] = useState(false)
  const [contactDate, setContactDate] = useState(todayInputValue())
  const isClaimedByCurrentUser = Boolean(currentPersonId && member.claimed_by_person_id === currentPersonId)
  const isClaimedBySomeoneElse = Boolean(member.claimed_by_person_id && member.claimed_by_person_id !== currentPersonId)
  const phone = bestPhone(member.person)

  let summaryMeta = 'No contact logged yet'
  if (member.last_contact_at) {
    const lastContactByName = member.lastContactBy ? fullName(member.lastContactBy) : 'Unknown member'
    summaryMeta = `Last contact ${formatDate(member.last_contact_at)} by ${lastContactByName}`
  }
  if (member.claimedBy) {
    summaryMeta += ` • Claimed by ${fullName(member.claimedBy)}`
  }

  return (
    <details className="qv-review-row">
      <summary className="qv-review-row-summary">
        <div className="qv-review-row-headline">
          <div className="qv-review-row-main">
            <div className="qv-review-row-name">{fullName(member.person)}</div>
            <div className="qv-review-row-meta">{summaryMeta}</div>
          </div>
          <span className="qv-review-row-arrow" aria-hidden="true">
            <BootstrapIcon name="chevron-down" className="qv-bi-icon" />
          </span>
        </div>
      </summary>

      <div className="qv-review-row-body qv-inline-panel">
        <div className="qv-detail-list">
          <div className="qv-detail-item">
            <div className="qv-detail-label">Email</div>
            <div className="qv-detail-value">{member.person?.email || 'No email on file'}</div>
          </div>
          <div className="qv-detail-item">
            <div className="qv-detail-label">Phone</div>
            <div className="qv-detail-value">{phone || 'No phone on file'}</div>
          </div>
          <div className="qv-detail-item">
            <div className="qv-detail-label">Claimed by</div>
            <div className="qv-detail-value">{member.claimedBy ? fullName(member.claimedBy) : 'Not claimed yet'}</div>
          </div>
          <div className="qv-detail-item">
            <div className="qv-detail-label">Most recent contact</div>
            <div className="qv-detail-value">{member.last_contact_at ? formatDate(member.last_contact_at) : 'No contact logged yet'}</div>
          </div>
          <div className="qv-detail-item">
            <div className="qv-detail-label">Contacted by</div>
            <div className="qv-detail-value">{member.lastContactBy ? fullName(member.lastContactBy) : '—'}</div>
          </div>
        </div>

        <div className="qv-list-row-actions">
          {currentPersonId ? (
            isClaimedByCurrentUser ? (
              <form action={releaseCustomListClaimAction}>
                <input type="hidden" name="custom_list_id" value={listId} />
                <input type="hidden" name="custom_list_member_id" value={member.id} />
                <button type="submit" className="qv-button-secondary">
                  Release claim
                </button>
              </form>
            ) : isClaimedBySomeoneElse ? null : (
              <form action={claimCustomListMemberAction}>
                <input type="hidden" name="custom_list_id" value={listId} />
                <input type="hidden" name="custom_list_member_id" value={member.id} />
                <button type="submit" className="qv-button-primary">
                  Claim member
                </button>
              </form>
            )
          ) : null}

          {currentPersonId && !isClaimedBySomeoneElse ? (
            showContactForm ? (
              <form action={logCustomListContactAction} className="qv-inline-date-form">
                <input type="hidden" name="custom_list_id" value={listId} />
                <input type="hidden" name="custom_list_member_id" value={member.id} />
                <label className="qv-inline-date-picker qv-inline-date-picker-compact" aria-label="Contact date">
                  <input type="date" name="contact_date" value={contactDate} onChange={(event) => setContactDate(event.target.value)} />
                  <span className="qv-inline-date-picker-icon" aria-hidden="true">
                    <BootstrapIcon name="calendar" className="qv-bi-icon" />
                  </span>
                </label>
                <button type="submit" className="qv-button-primary">
                  Save
                </button>
                <button type="button" className="qv-button-secondary" onClick={() => setShowContactForm(false)}>
                  Cancel
                </button>
              </form>
            ) : (
              <button type="button" className="qv-button-secondary" onClick={() => setShowContactForm(true)}>
                Log contact
              </button>
            )
          ) : null}

          {canManage ? (
            <ConfirmActionButton
              action={removeCustomListMemberAction}
              hiddenFields={[
                { name: 'custom_list_id', value: listId },
                { name: 'custom_list_member_id', value: member.id },
              ]}
              triggerLabel={<BootstrapIcon name="trash" className="qv-bi-icon" />}
              triggerClassName="qv-icon-button qv-icon-button-danger"
              triggerStyle={{ marginLeft: 'auto' }}
              confirmTitle={`Remove this member from “Custom list: ${listName}”?`}
              confirmDescription="They will no longer appear on this custom list."
              confirmLabel="Confirm"
              cancelLabel="Cancel"
              confirmClassName="qv-button-danger"
              danger
            />
          ) : null}
        </div>
      </div>
    </details>
  )
}

function SortSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="qv-inline-sort">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ShareListCard({
  listId,
  sharedAccess,
  shareCandidates,
}: {
  listId: string
  sharedAccess: SharedAccessView[]
  shareCandidates: MemberOption[]
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <section className="qv-card">
      <div className="qv-directory-section-head">
        <div>
          <h2 className="qv-section-title">Share List</h2>
          <p className="qv-section-subtitle">Only Invited members can view this list.</p>
        </div>
        <button type="button" className="qv-button-secondary" onClick={() => setIsExpanded((value) => !value)}>
          Share
        </button>
      </div>

      {isExpanded ? (
        <form action={shareCustomListAction} className="qv-form-grid qv-inline-panel" style={{ marginTop: 16 }}>
          <input type="hidden" name="custom_list_id" value={listId} />
          <MemberSearchField name="person_id" label="Member" members={shareCandidates} placeholder="Type a member name" required />
          <div className="qv-form-actions">
            <button type="button" className="qv-button-secondary" onClick={() => setIsExpanded(false)}>
              Cancel
            </button>
            <button type="submit" className="qv-button-primary">
              Share list
            </button>
          </div>
        </form>
      ) : null}

      {sharedAccess.length === 0 ? (
        <p className="qv-inline-message" style={{ marginTop: 16 }}>This custom list has not been shared with anyone yet.</p>
      ) : (
        <div className="qv-simple-list" style={{ marginTop: 16 }}>
          {sharedAccess.map((access) => (
            <div key={access.id} className="qv-simple-list-row">
              <div>
                <div className="qv-list-row-title">{access.person ? fullName(access.person) : access.grantee_email || 'Shared member'}</div>
                <div className="qv-inline-message" style={{ marginTop: 4 }}>
                  {access.person?.email || access.grantee_email || 'No email on file'}
                </div>
              </div>
              <form action={revokeCustomListAccessAction}>
                <input type="hidden" name="custom_list_id" value={listId} />
                <input type="hidden" name="access_id" value={access.id} />
                <button type="submit" className="qv-icon-button" aria-label={`Unshare list with ${access.person ? fullName(access.person) : access.grantee_email || 'this member'}`} title="Unshare">
                  <BootstrapIcon name="x" className="qv-bi-icon" />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function CustomListDetailClient({
  listId,
  listName,
  canManage,
  currentPersonId,
  members,
  sharedAccess,
  shareCandidates,
  addCandidates,
}: Props) {
  const [membersSort, setMembersSort] = useState<MembersSort>('attention')
  const [recentSort, setRecentSort] = useState<RecentSort>('newest')
  const [isAddMemberExpanded, setIsAddMemberExpanded] = useState(false)

  const sortedMembers = useMemo(() => sortMembers(members, membersSort), [members, membersSort])
  const recentContactMembers = useMemo(
    () => sortRecentMembers(members.filter((member) => Boolean(member.last_contact_at)), recentSort),
    [members, recentSort]
  )

  return (
    <section className="qv-detail-grid">
      <div className="qv-detail-stack">
        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Members on this list</h2>
              <p className="qv-section-subtitle">Claim a member you plan on contacting or have contacted, so others are aware.</p>
            </div>
            <div className="qv-section-controls">
              <SortSelect
                label="Sort by"
                value={membersSort}
                onChange={(value) => setMembersSort(value as MembersSort)}
                options={[
                  { value: 'attention', label: 'Needs contact first' },
                  { value: 'name_az', label: 'Last name A-Z' },
                  { value: 'name_za', label: 'Last name Z-A' },
                  { value: 'contact_newest', label: 'Most recent contact' },
                  { value: 'contact_oldest', label: 'Oldest contact first' },
                ]}
              />
              {canManage ? (
                <button type="button" className="qv-button-secondary" onClick={() => setIsAddMemberExpanded((value) => !value)}>
                  Add member
                </button>
              ) : null}
            </div>
          </div>

          {canManage && isAddMemberExpanded ? (
            <div className="qv-inline-panel qv-member-inline-panel qv-custom-list-add-panel" style={{ marginTop: 16 }}>
              <div className="qv-member-inline-panel-head">
                <span className="qv-member-inline-panel-title">Add member</span>
                <button
                  type="button"
                  className="qv-icon-button"
                  aria-label="Close add member panel"
                  title="Close"
                  onClick={() => setIsAddMemberExpanded(false)}
                >
                  <BootstrapIcon name="x" className="qv-bi-icon" />
                </button>
              </div>

              <form action={addCustomListMemberAction} className="qv-member-inline-form">
                <input type="hidden" name="custom_list_id" value={listId} />
                <MemberSearchField
                  name="person_id"
                  label="Add member"
                  labelHidden
                  members={addCandidates}
                  placeholder="Type a member name"
                  required
                />
                <button type="submit" className="qv-button-primary">
                  Add to list
                </button>
              </form>
            </div>
          ) : null}

          {sortedMembers.length === 0 ? (
            <div className="qv-empty">
              <p className="qv-empty-title">This custom list has no members yet.</p>
              <p className="qv-empty-text">Add members from the directory or use the Add member button here.</p>
            </div>
          ) : (
            <div className="qv-simple-list qv-simple-list-review" style={{ marginTop: 16 }}>
              {sortedMembers.map((member) => (
                <ReviewMemberRow key={member.id} member={member} listId={listId} listName={listName} currentPersonId={currentPersonId} canManage={canManage} />
              ))}
            </div>
          )}
        </section>

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Most recent contact</h2>
              <p className="qv-section-subtitle">Use this view to scan the members who already have contact logged on this list.</p>
            </div>
            <SortSelect
              label="Sort by"
              value={recentSort}
              onChange={(value) => setRecentSort(value as RecentSort)}
              options={[
                { value: 'newest', label: 'Newest first' },
                { value: 'oldest', label: 'Oldest first' },
                { value: 'name_az', label: 'Last name A-Z' },
                { value: 'name_za', label: 'Last name Z-A' },
              ]}
            />
          </div>

          {recentContactMembers.length === 0 ? (
            <p className="qv-inline-message" style={{ marginTop: 16 }}>No contact has been logged on this list yet.</p>
          ) : (
            <div className="qv-simple-list qv-simple-list-review" style={{ marginTop: 16 }}>
              {recentContactMembers.map((member) => (
                <ReviewMemberRow key={`recent-${member.id}`} member={member} listId={listId} listName={listName} currentPersonId={currentPersonId} canManage={canManage} />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="qv-detail-stack">
        {canManage ? <ShareListCard listId={listId} sharedAccess={sharedAccess} shareCandidates={shareCandidates} /> : null}
      </div>
    </section>
  )
}
