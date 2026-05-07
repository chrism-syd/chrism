'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from 'react'
import CreateCustomListDialog from '@/app/custom-lists/create-custom-list-dialog'

type Member = {
  id: string
  first_name: string
  last_name: string
  preferred_display_name?: string | null
  email: string | null
  cell_phone: string | null
  home_phone: string | null
  other_phone: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state_province: string | null
  postal_code: string | null
  primary_relationship_code: string
  council_activity_level_code: string | null
  council_activity_context_code: string | null
  council_reengagement_status_code: string | null
}

type CurrentViewControlMode = 'menu' | 'button'
type Props = {
  members: Member[]
  currentOfficerLabelsById?: Record<string, string[]>
  executiveOfficerLabelsById?: Record<string, string[]>
  sectionTitle?: string
  sectionSubtitle?: string
  currentViewControlMode?: CurrentViewControlMode
}

type QuickFilter = 'all' | 'with_email' | 'missing_email' | 'executive_officers'
type RelationshipFilter = 'all' | 'member' | 'volunteer_only' | 'prospect'
type SortOption = 'last_name_asc' | 'last_name_desc' | 'first_name_asc' | 'first_name_desc'
type RowsPerPage = 10 | 20 | 50 | 'all'
type ColumnKey = 'email' | 'cell_phone' | 'home_phone' | 'other_phone' | 'address' | 'relationship' | 'activity_level' | 'activity_context' | 'reengagement_status'
type NoticeState = { tone: 'success' | 'error'; text: string } | null
type CreateListDraft = { memberIds: string[]; previewNames: string[]; sourceLabel: string; sourceBadge: string }
type ActionMenuProps = { label: ReactNode; menuRef: RefObject<HTMLDetailsElement | null>; onCreateList: () => void; onExport: () => Promise<void>; onCopyEmails: () => Promise<void> }

const DEFAULT_COLUMNS: ColumnKey[] = ['cell_phone', 'home_phone', 'email']
const DEFAULT_ROWS_PER_PAGE: RowsPerPage = 10
const COLUMN_OPTIONS: Array<{ key: ColumnKey; label: string }> = [
  { key: 'email', label: 'Email' },
  { key: 'cell_phone', label: 'Cell phone' },
  { key: 'home_phone', label: 'Home phone' },
  { key: 'other_phone', label: 'Other phone' },
  { key: 'address', label: 'Address' },
  { key: 'relationship', label: 'Relationship' },
  { key: 'activity_level', label: 'Activity level' },
  { key: 'activity_context', label: 'Activity context' },
  { key: 'reengagement_status', label: 'Re-engagement status' },
]

function normalize(value: string | null | undefined) { return (value ?? '').trim().toLowerCase() }
function legalFullName(member: Pick<Member, 'first_name' | 'last_name'>) { return `${member.first_name} ${member.last_name}`.trim() }
function displayFullName(member: Pick<Member, 'first_name' | 'last_name' | 'preferred_display_name'>) {
  const preferred = member.preferred_display_name?.trim()
  if (!preferred) return legalFullName(member)
  const legalLastName = member.last_name?.trim() ?? ''
  if (!legalLastName) return preferred
  if (normalize(preferred).endsWith(normalize(legalLastName))) return preferred
  return `${preferred} ${legalLastName}`.trim()
}
function labelize(value: string | null | undefined) {
  if (!value) return 'Not set'
  if (value === 'volunteer_only') return 'Volunteer'
  return value.replaceAll('_', ' ').split(' ').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}
function formatAddress(member: Member) {
  const line1 = [member.address_line_1, member.address_line_2].filter(Boolean).join(', ')
  const line2 = [member.city, member.state_province, member.postal_code].filter(Boolean).join(' • ')
  return [line1, line2].filter(Boolean).join(' • ') || 'No address on file'
}
function getColumnValue(member: Member, key: ColumnKey) {
  switch (key) {
    case 'email': return member.email || 'No email on file'
    case 'cell_phone': return member.cell_phone || 'Not set'
    case 'home_phone': return member.home_phone || 'Not set'
    case 'other_phone': return member.other_phone || 'Not set'
    case 'address': return formatAddress(member)
    case 'relationship': return labelize(member.primary_relationship_code)
    case 'activity_level': return labelize(member.council_activity_level_code)
    case 'activity_context': return labelize(member.council_activity_context_code)
    case 'reengagement_status': return labelize(member.council_reengagement_status_code)
    default: return ''
  }
}
function fileSafe(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'people' }
function getUniqueEmailRecipients(list: Member[]) { return [...new Set(list.map((member) => member.email?.trim()).filter((value): value is string => Boolean(value)))] }
function ActionMenu({ label, menuRef, onCreateList, onExport, onCopyEmails }: ActionMenuProps) {
  return <details className="qv-view-menu" ref={menuRef}><summary><span>{label}</span><span aria-hidden="true" className="qv-view-menu-chevron">▾</span></summary><div className="qv-view-menu-panel"><button type="button" className="qv-view-menu-item" onClick={onCreateList}>Create Custom List</button><button type="button" className="qv-view-menu-item" onClick={onExport}>Export as Excel</button><button type="button" className="qv-view-menu-item" onClick={onCopyEmails}>Copy Email addresses</button></div></details>
}

export default function MembersList({ members, currentOfficerLabelsById = {}, executiveOfficerLabelsById = {}, sectionTitle = 'People listing', sectionSubtitle = 'Search, sort, and manage people records.', currentViewControlMode = 'menu' }: Props) {
  const [search, setSearch] = useState('')
  const [relationshipFilter, setRelationshipFilter] = useState<RelationshipFilter>('all')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [sortBy, setSortBy] = useState<SortOption>('last_name_asc')
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS)
  const [rowsPerPage, setRowsPerPage] = useState<RowsPerPage>(DEFAULT_ROWS_PER_PAGE)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [notice, setNotice] = useState<NoticeState>(null)
  const [showFieldPicker, setShowFieldPicker] = useState(false)
  const [createListDraft, setCreateListDraft] = useState<CreateListDraft | null>(null)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const actionMenuRef = useRef<HTMLDetailsElement | null>(null)
  const selectionRef = useRef<HTMLInputElement | null>(null)

  const filteredAndSortedMembers = useMemo(() => {
    const query = normalize(search)
    const filtered = members.filter((member) => {
      const firstName = normalize(member.first_name)
      const lastName = normalize(member.last_name)
      const preferredName = normalize(member.preferred_display_name)
      const legalName = normalize(legalFullName(member))
      const shownName = normalize(displayFullName(member))
      const reverseName = `${lastName}, ${firstName}`.trim()
      const officerLabels = currentOfficerLabelsById[member.id] ?? []
      const executiveOfficerLabels = executiveOfficerLabelsById[member.id] ?? []
      const isExecutiveOfficer = executiveOfficerLabels.length > 0
      const searchableValues = [
        member.email,
        member.cell_phone,
        member.home_phone,
        member.other_phone,
        labelize(member.primary_relationship_code),
        labelize(member.council_activity_level_code),
        labelize(member.council_activity_context_code),
        labelize(member.council_reengagement_status_code),
        ...officerLabels,
        ...executiveOfficerLabels,
      ].map((value) => normalize(value)).filter(Boolean)
      const matchesSearch = query === '' || firstName.includes(query) || lastName.includes(query) || preferredName.includes(query) || legalName.includes(query) || shownName.includes(query) || reverseName.includes(query) || searchableValues.some((value) => value.includes(query))
      const matchesRelationshipFilter = relationshipFilter === 'all' || member.primary_relationship_code === relationshipFilter
      const matchesQuickFilter = quickFilter === 'all' || (quickFilter === 'with_email' && Boolean(member.email)) || (quickFilter === 'missing_email' && !member.email) || (quickFilter === 'executive_officers' && isExecutiveOfficer)
      return matchesSearch && matchesRelationshipFilter && matchesQuickFilter
    })
    return [...filtered].sort((left, right) => {
      const leftFirst = normalize(left.first_name)
      const rightFirst = normalize(right.first_name)
      const leftLast = normalize(left.last_name)
      const rightLast = normalize(right.last_name)
      switch (sortBy) {
        case 'last_name_desc': { const byLast = rightLast.localeCompare(leftLast); return byLast !== 0 ? byLast : rightFirst.localeCompare(leftFirst) }
        case 'first_name_asc': { const byFirst = leftFirst.localeCompare(rightFirst); return byFirst !== 0 ? byFirst : leftLast.localeCompare(rightLast) }
        case 'first_name_desc': { const byFirst = rightFirst.localeCompare(leftFirst); return byFirst !== 0 ? byFirst : leftLast.localeCompare(rightLast) }
        default: { const byLast = leftLast.localeCompare(rightLast); return byLast !== 0 ? byLast : leftFirst.localeCompare(rightFirst) }
      }
    })
  }, [currentOfficerLabelsById, executiveOfficerLabelsById, quickFilter, members, relationshipFilter, search, sortBy])

  const totalPages = useMemo(() => rowsPerPage === 'all' ? 1 : Math.max(1, Math.ceil(filteredAndSortedMembers.length / rowsPerPage)), [filteredAndSortedMembers.length, rowsPerPage])
  const safeCurrentPage = Math.min(currentPage, totalPages)
  useEffect(() => { setPageInput(String(safeCurrentPage)) }, [safeCurrentPage])
  useEffect(() => { const fn = (event: MouseEvent) => { const target = event.target as Node; if (!actionMenuRef.current?.contains(target)) actionMenuRef.current?.removeAttribute('open') }; document.addEventListener('mousedown', fn); return () => document.removeEventListener('mousedown', fn) }, [])
  useEffect(() => { setSelectedMemberIds((current) => current.filter((memberId) => members.some((member) => member.id === memberId))) }, [members])
  const paginatedMembers = useMemo(() => rowsPerPage === 'all' ? filteredAndSortedMembers : filteredAndSortedMembers.slice((safeCurrentPage - 1) * rowsPerPage, (safeCurrentPage - 1) * rowsPerPage + rowsPerPage), [filteredAndSortedMembers, rowsPerPage, safeCurrentPage])
  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member] as const)), [members])
  const selectedMembers = useMemo(() => selectedMemberIds.map((memberId) => membersById.get(memberId)).filter((member): member is Member => Boolean(member)), [membersById, selectedMemberIds])
  const selectedMemberIdSet = useMemo(() => new Set(selectedMemberIds), [selectedMemberIds])
  const filteredMemberIds = useMemo(() => filteredAndSortedMembers.map((member) => member.id), [filteredAndSortedMembers])
  const selectedCount = selectedMembers.length
  const allFilteredMembersSelected = filteredMemberIds.length > 0 && filteredMemberIds.every((memberId) => selectedMemberIdSet.has(memberId))
  const someFilteredMembersSelected = filteredMemberIds.some((memberId) => selectedMemberIdSet.has(memberId))
  useEffect(() => { if (selectionRef.current) selectionRef.current.indeterminate = someFilteredMembersSelected && !allFilteredMembersSelected }, [allFilteredMembersSelected, someFilteredMembersSelected])

  const hasActiveControls = search.trim() !== '' || relationshipFilter !== 'all' || quickFilter !== 'all' || sortBy !== 'last_name_asc' || rowsPerPage !== DEFAULT_ROWS_PER_PAGE
  function getDisplayedRole(memberId: string, relationshipCode: string) {
    const executiveOfficerLabels = executiveOfficerLabelsById[memberId] ?? []
    const currentOfficerLabels = currentOfficerLabelsById[memberId] ?? []
    return executiveOfficerLabels[0] ?? (currentOfficerLabels.length > 0 ? currentOfficerLabels.join(', ') : labelize(relationshipCode))
  }
  function toggleColumn(columnKey: ColumnKey) { setVisibleColumns((current) => current.includes(columnKey) ? current.filter((value) => value !== columnKey) : [...current, columnKey]) }
  function closeMenu() { actionMenuRef.current?.removeAttribute('open') }
  function resetControls() { setSearch(''); setRelationshipFilter('all'); setQuickFilter('all'); setSortBy('last_name_asc'); setRowsPerPage(DEFAULT_ROWS_PER_PAGE); setCurrentPage(1); setNotice(null) }
  function commitPageInput() { if (rowsPerPage === 'all') return setPageInput('1'); const parsed = Number(pageInput); if (!Number.isFinite(parsed)) return setPageInput(String(safeCurrentPage)); const nextPage = Math.min(Math.max(1, Math.trunc(parsed)), totalPages); setCurrentPage(nextPage); setPageInput(String(nextPage)) }
  async function exportMembersAsExcel(list: Member[], scopeLabel: string, filePrefix: string) {
    const selectedColumnOptions = COLUMN_OPTIONS.filter((option) => visibleColumns.includes(option.key))
    const exportRows = list.map((member) => {
      const baseRow: Record<string, string> = { 'Display name': displayFullName(member), 'Legal name': legalFullName(member), 'Directory role': getDisplayedRole(member.id, member.primary_relationship_code) }
      for (const option of selectedColumnOptions) baseRow[option.label] = getColumnValue(member, option.key)
      return baseRow
    })
    const XLSX = await import('xlsx'); const worksheet = XLSX.utils.json_to_sheet(exportRows); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'People')
    const today = new Date().toISOString().slice(0, 10); XLSX.writeFile(workbook, `${fileSafe(`${filePrefix}-${today}`)}.xlsx`)
    setNotice({ tone: 'success', text: `Exported ${exportRows.length} ${scopeLabel} to Excel.` })
  }
  async function copyEmailsFromMembers(list: Member[], scopeLabel: string) {
    const recipients = getUniqueEmailRecipients(list)
    if (recipients.length === 0) return setNotice({ tone: 'error', text: `No email addresses are available in ${scopeLabel}.` })
    try { await navigator.clipboard.writeText(recipients.join('; ')); setNotice({ tone: 'success', text: `Copied ${recipients.length} email address${recipients.length === 1 ? '' : 'es'} from ${scopeLabel}.` }) } catch { setNotice({ tone: 'error', text: 'Could not copy the email list. Please try again.' }) }
  }
  function openCreateListFromMembers(list: Member[], sourceLabel: string, sourceBadge: string) {
    if (list.length === 0) return setNotice({ tone: 'error', text: `There are no people in ${sourceLabel} to save into a custom list.` })
    closeMenu(); setNotice(null); setCreateListDraft({ memberIds: list.map((member) => member.id), previewNames: list.slice(0, 12).map((member) => displayFullName(member)), sourceLabel, sourceBadge })
  }
  function toggleMemberSelection(memberId: string) { setSelectedMemberIds((current) => current.includes(memberId) ? current.filter((value) => value !== memberId) : [...current, memberId]) }
  function handleToggleAllSelection() {
    if (filteredMemberIds.length === 0) return
    setSelectedMemberIds((current) => {
      const next = new Set(current)
      if (allFilteredMembersSelected) for (const memberId of filteredMemberIds) next.delete(memberId)
      else for (const memberId of filteredMemberIds) next.add(memberId)
      return [...next]
    })
  }
  async function handleExportCurrentView() { closeMenu(); if (filteredAndSortedMembers.length === 0) return setNotice({ tone: 'error', text: 'There are no people in this filtered view to export.' }); await exportMembersAsExcel(filteredAndSortedMembers, 'people from the current filtered view', 'people') }
  async function handleExportSelectedRows() { closeMenu(); if (selectedMembers.length === 0) return setNotice({ tone: 'error', text: 'Select at least one person before exporting.' }); await exportMembersAsExcel(selectedMembers, 'selected people', 'selected-people') }
  async function handleCopyCurrentViewEmails() { closeMenu(); await copyEmailsFromMembers(filteredAndSortedMembers, 'the current filtered view') }
  async function handleCopySelectedRowEmails() { closeMenu(); if (selectedMembers.length === 0) return setNotice({ tone: 'error', text: 'Select at least one person before copying email addresses.' }); await copyEmailsFromMembers(selectedMembers, 'the selected rows') }
  function handleRowsPerPageChange(value: string) { if (value === 'all') { setRowsPerPage('all'); setCurrentPage(1); return } const parsed = Number(value); setRowsPerPage(parsed === 20 ? 20 : parsed === 50 ? 50 : 10); setCurrentPage(1) }
  function handlePageInputKeyDown(event: KeyboardEvent<HTMLInputElement>) { if (event.key === 'Enter') { event.preventDefault(); commitPageInput() } }

  const usingSelectedRows = selectedCount > 0
  const actionMenuLabel = usingSelectedRows ? 'Use Selected Rows' : 'Use Current View'

  return <>
    <section className="qv-card qv-members-list-card">
      <div className="qv-directory-section-head">
        <div><h2 className="qv-section-title">{sectionTitle}</h2><p className="qv-section-subtitle">{sectionSubtitle}</p></div>
        <div className="qv-view-menu-stack">
          {currentViewControlMode === 'button' ? <button type="button" className="qv-button-secondary qv-view-action-button" onClick={() => usingSelectedRows ? openCreateListFromMembers(selectedMembers, 'the selected rows', 'Selected rows') : openCreateListFromMembers(filteredAndSortedMembers, 'the current filtered view', 'Current filters applied')}>{actionMenuLabel}</button> : <ActionMenu label={actionMenuLabel} menuRef={actionMenuRef} onCreateList={() => usingSelectedRows ? openCreateListFromMembers(selectedMembers, 'the selected rows', 'Selected rows') : openCreateListFromMembers(filteredAndSortedMembers, 'the current filtered view', 'Current filters applied')} onExport={usingSelectedRows ? handleExportSelectedRows : handleExportCurrentView} onCopyEmails={usingSelectedRows ? handleCopySelectedRowEmails : handleCopyCurrentViewEmails} />}
          {notice ? <p className={notice.tone === 'error' ? 'qv-view-menu-notice qv-inline-error' : 'qv-view-menu-notice qv-inline-message'}>{notice.text}</p> : null}
        </div>
      </div>

      <div className="qv-controls qv-controls-directory" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, alignItems: 'stretch' }}>
        <select aria-label="Filter people by type" style={{ width: '100%', minWidth: 0 }} value={relationshipFilter} onChange={(event) => { setRelationshipFilter(event.target.value as RelationshipFilter); setCurrentPage(1) }}>
          <option value="all">All people</option><option value="member">Members only</option><option value="volunteer_only">Volunteers only</option><option value="prospect">Prospects only</option>
        </select>
        <select aria-label="Quick filter" style={{ width: '100%', minWidth: 0 }} value={quickFilter} onChange={(event) => { setQuickFilter(event.target.value as QuickFilter); setCurrentPage(1) }}>
          <option value="all">All records</option><option value="with_email">With email</option><option value="missing_email">Missing email</option><option value="executive_officers">Executive officers</option>
        </select>
        <select aria-label="Sort people" style={{ width: '100%', minWidth: 0 }} value={sortBy} onChange={(event) => { setSortBy(event.target.value as SortOption); setCurrentPage(1) }}>
          <option value="last_name_asc">Last name A-Z</option><option value="last_name_desc">Last name Z-A</option><option value="first_name_asc">First name A-Z</option><option value="first_name_desc">First name Z-A</option>
        </select>
        <input aria-label="Search people" style={{ width: '100%', minWidth: 0 }} type="text" value={search} onChange={(event) => { setSearch(event.target.value); setCurrentPage(1) }} placeholder="Search by name, phone, email, or office" />
      </div>

      <div className="qv-pagination-toolbar">
        <div className="qv-pagination-left">
          <label className="qv-pagination-meta-group"><span className="qv-pagination-meta-label">People per page</span><select aria-label="People per page" className="qv-pagination-inline-select" value={rowsPerPage} onChange={(event) => handleRowsPerPageChange(event.target.value)}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value="all">All</option></select></label>
          <div className="qv-pagination-divider" aria-hidden="true" />
          <p className="qv-pagination-total">{filteredAndSortedMembers.length.toLocaleString()} people</p>
          {rowsPerPage !== 'all' && totalPages > 1 ? <><div className="qv-pagination-divider" aria-hidden="true" /><div className="qv-pagination-controls"><button type="button" className="qv-pagination-icon-button" onClick={() => setCurrentPage(1)} disabled={safeCurrentPage === 1} aria-label="First page">|‹</button><button type="button" className="qv-pagination-icon-button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safeCurrentPage === 1} aria-label="Previous page">‹</button><label className="qv-pagination-page-input-wrap"><span className="sr-only">Current page</span><input aria-label="Current page" className="qv-pagination-page-input" inputMode="numeric" value={pageInput} onChange={(event) => setPageInput(event.target.value.replace(/[^0-9]/g, '') || '1')} onBlur={commitPageInput} onKeyDown={handlePageInputKeyDown} /></label><span className="qv-pagination-page-total">/ {totalPages}</span><button type="button" className="qv-pagination-icon-button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safeCurrentPage === totalPages} aria-label="Next page">›</button><button type="button" className="qv-pagination-icon-button" onClick={() => setCurrentPage(totalPages)} disabled={safeCurrentPage === totalPages} aria-label="Last page">›|</button></div></> : null}
        </div>
        <div className="qv-pagination-right">
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: filteredMemberIds.length > 0 ? 'pointer' : 'default' }}>
            <input ref={selectionRef} type="checkbox" checked={allFilteredMembersSelected} onChange={handleToggleAllSelection} disabled={filteredMemberIds.length === 0} style={{ width: 16, height: 16 }} />
            <span className="qv-inline-message" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{allFilteredMembersSelected ? 'Clear all' : 'Select all'}</span>
          </label>
          {selectedCount > 0 ? <span className="qv-badge">{selectedCount} selected</span> : null}
          {hasActiveControls ? <button type="button" className="qv-text-toggle qv-text-toggle-secondary" onClick={resetControls}><span>Reset filters</span></button> : null}
          <button type="button" className="qv-text-toggle" aria-expanded={showFieldPicker} onClick={() => setShowFieldPicker((current) => !current)}><span>Show Additional Fields</span><span aria-hidden="true" className="qv-text-toggle-chevron">{showFieldPicker ? '▴' : '▾'}</span></button>
        </div>
      </div>

      {showFieldPicker ? <div className="qv-inline-field-panel" role="region" aria-label="Choose which person details appear"><p className="qv-inline-message" style={{ margin: 0 }}>Choose which person details appear in this session.</p><div className="qv-field-picker-grid">{COLUMN_OPTIONS.map((option) => <label key={option.key} className="qv-field-picker-option"><input type="checkbox" checked={visibleColumns.includes(option.key)} onChange={() => toggleColumn(option.key)} style={{ width: 16, height: 16 }} /><span>{option.label}</span></label>)}</div></div> : null}

      {paginatedMembers.length === 0 ? <div className="qv-empty"><p className="qv-empty-title">No people match your search.</p><p className="qv-empty-text">Try a different search, filter, or reset the controls.</p></div> : <div className="qv-member-table-scroll" style={{ overflowY: 'visible', paddingTop: 6, paddingBottom: 6 }}><div className="qv-member-list" style={{ gap: 10, paddingTop: 2 }}>{paginatedMembers.map((person) => {
        const currentOfficerLabels = currentOfficerLabelsById[person.id] ?? []
        const executiveOfficerLabels = executiveOfficerLabelsById[person.id] ?? []
        const primaryExecutiveLabel = executiveOfficerLabels[0] ?? null
        const fallbackRoleLabel = labelize(person.primary_relationship_code)
        const columnCount = Math.max(visibleColumns.length, 1)
        const gridTemplateColumns = `minmax(180px, 1.2fr) repeat(${columnCount}, minmax(104px, 0.9fr)) auto`
        const rowMinWidth = 280 + columnCount * 148 + 28
        const isSelected = selectedMemberIdSet.has(person.id)
        const displayName = displayFullName(person)
        const legalName = legalFullName(person)
        const showLegalName = normalize(displayName) !== normalize(legalName)
        const roleText = primaryExecutiveLabel ? primaryExecutiveLabel : currentOfficerLabels.length > 0 ? currentOfficerLabels.join(', ') : fallbackRoleLabel
        const rowStyle = { ['--qv-member-row-template' as const]: gridTemplateColumns, ['--qv-member-row-min-width' as const]: `${rowMinWidth}px` } as CSSProperties
        return <div key={person.id} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 2 }} aria-label={`Select ${displayName}`}><input type="checkbox" checked={isSelected} onChange={() => toggleMemberSelection(person.id)} style={{ width: 16, height: 16 }} /></label>
          <Link href={`/members/${person.id}`} className="qv-member-link">
            <div className="qv-member-row qv-member-row-compact" style={isSelected ? { borderColor: 'rgba(92, 74, 114, 0.34)', boxShadow: '0 0 0 1px rgba(92, 74, 114, 0.16)' } : undefined}>
              <div className="qv-member-row-grid" style={rowStyle}>
                <div style={{ minWidth: 0 }}>
                  <div className="qv-member-name qv-member-name-tight">{displayName}</div>
                  <div className="qv-member-meta qv-member-meta-tight">{showLegalName ? legalName : roleText}</div>
                  {showLegalName ? <div className="qv-inline-message" style={{ marginTop: 2 }}>{roleText}</div> : null}
                </div>
                {visibleColumns.length > 0 ? visibleColumns.map((columnKey) => { const option = COLUMN_OPTIONS.find((item) => item.key === columnKey); return <div key={columnKey} style={{ minWidth: 0 }}><div className="qv-detail-label">{option?.label ?? columnKey}</div><div className="qv-inline-message" style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{getColumnValue(person, columnKey)}</div></div> }) : <div style={{ minWidth: 0 }}><div className="qv-detail-label">Details</div><div className="qv-inline-message" style={{ color: 'var(--text-primary)' }}>Choose fields above</div></div>}
                <div className="qv-member-row-right" style={{ justifySelf: 'end' }}><span className="qv-chevron">›</span></div>
              </div>
            </div>
          </Link>
        </div>
      })}</div></div>}
    </section>

    {createListDraft ? <CreateCustomListDialog open onClose={() => setCreateListDraft(null)} memberIds={createListDraft.memberIds} previewNames={createListDraft.previewNames} sourceLabel={createListDraft.sourceLabel} sourceBadge={createListDraft.sourceBadge} /> : null}
  </>
}
