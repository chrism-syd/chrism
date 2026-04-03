'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from 'react'
import CreateCustomListDialog from '@/app/custom-lists/create-custom-list-dialog'

type Member = {
  id: string
  first_name: string
  last_name: string
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

type MemberFilter = 'all' | 'with_email' | 'missing_email' | 'executive_officers'
type SortOption = 'last_name_asc' | 'last_name_desc' | 'first_name_asc' | 'first_name_desc'
type RowsPerPage = 10 | 20 | 50 | 'all'
type ColumnKey =
  | 'email'
  | 'cell_phone'
  | 'home_phone'
  | 'other_phone'
  | 'address'
  | 'relationship'
  | 'activity_level'
  | 'activity_context'
  | 'reengagement_status'

type NoticeState = {
  tone: 'success' | 'error'
  text: string
} | null

type CreateListDraft = {
  memberIds: string[]
  previewNames: string[]
  sourceLabel: string
  sourceBadge: string
}

type ActionMenuProps = {
  label: ReactNode
  menuRef: RefObject<HTMLDetailsElement | null>
  onCreateList: () => void
  onExport: () => Promise<void>
  onCopyEmails: () => Promise<void>
}

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

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function labelize(value: string | null | undefined) {
  if (!value) return 'Not set'
  return value.replaceAll('_', ' ')
}

function formatAddress(member: Member) {
  const line1 = [member.address_line_1, member.address_line_2].filter(Boolean).join(', ')
  const line2 = [member.city, member.state_province, member.postal_code].filter(Boolean).join(', ')
  return [line1, line2].filter(Boolean).join(' • ') || 'No address on file'
}

function getColumnValue(member: Member, key: ColumnKey) {
  switch (key) {
    case 'email':
      return member.email || 'No email on file'
    case 'cell_phone':
      return member.cell_phone || 'Not set'
    case 'home_phone':
      return member.home_phone || 'Not set'
    case 'other_phone':
      return member.other_phone || 'Not set'
    case 'address':
      return formatAddress(member)
    case 'relationship':
      return labelize(member.primary_relationship_code)
    case 'activity_level':
      return labelize(member.council_activity_level_code)
    case 'activity_context':
      return labelize(member.council_activity_context_code)
    case 'reengagement_status':
      return labelize(member.council_reengagement_status_code)
    default:
      return ''
  }
}

function fileSafe(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'members'
  )
}

function getUniqueEmailRecipients(list: Member[]) {
  return [...new Set(list.map((member) => member.email?.trim()).filter((value): value is string => Boolean(value)))]
}

function ActionMenu({ label, menuRef, onCreateList, onExport, onCopyEmails }: ActionMenuProps) {
  return (
    <details className="qv-view-menu" ref={menuRef}>
      <summary>
        <span>{label}</span>
        <span aria-hidden="true" className="qv-view-menu-chevron">▾</span>
      </summary>
      <div className="qv-view-menu-panel">
        <button type="button" className="qv-view-menu-item" onClick={onCreateList}>
          Create Custom List
        </button>
        <button type="button" className="qv-view-menu-item" onClick={onExport}>
          Export as Excel
        </button>
        <button type="button" className="qv-view-menu-item" onClick={onCopyEmails}>
          Copy Email addresses
        </button>
      </div>
    </details>
  )
}

export default function MembersList({
  members,
  currentOfficerLabelsById = {},
  executiveOfficerLabelsById = {},
  sectionTitle = 'Member listing',
  sectionSubtitle = 'Search, sort, and manage member records.',
  currentViewControlMode = 'menu',
}: Props) {
  const [search, setSearch] = useState('')
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all')
  const [sortBy, setSortBy] = useState<SortOption>('last_name_asc')
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS)
  const [rowsPerPage, setRowsPerPage] = useState<RowsPerPage>(DEFAULT_ROWS_PER_PAGE)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [notice, setNotice] = useState<NoticeState>(null)
  const [showFieldPicker, setShowFieldPicker] = useState(false)
  const [createListDraft, setCreateListDraft] = useState<CreateListDraft | null>(null)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const currentViewMenuRef = useRef<HTMLDetailsElement | null>(null)
  const selectedRowsMenuRef = useRef<HTMLDetailsElement | null>(null)
  const pageSelectionRef = useRef<HTMLInputElement | null>(null)

  const filteredAndSortedMembers = useMemo(() => {
    const query = normalize(search)

    const filtered = members.filter((member) => {
      const firstName = normalize(member.first_name)
      const lastName = normalize(member.last_name)
      const fullName = `${firstName} ${lastName}`.trim()
      const reverseName = `${lastName}, ${firstName}`.trim()
      const officerLabels = currentOfficerLabelsById[member.id] ?? []
      const executiveOfficerLabels = executiveOfficerLabelsById[member.id] ?? []
      const isExecutiveOfficer = executiveOfficerLabels.length > 0
      const searchableValues = [
        member.email,
        member.cell_phone,
        member.home_phone,
        member.other_phone,
        formatAddress(member),
        labelize(member.primary_relationship_code),
        labelize(member.council_activity_level_code),
        labelize(member.council_activity_context_code),
        labelize(member.council_reengagement_status_code),
        ...officerLabels,
        ...executiveOfficerLabels,
      ]
        .map((value) => normalize(value))
        .filter(Boolean)

      const matchesSearch =
        query === '' ||
        firstName.includes(query) ||
        lastName.includes(query) ||
        fullName.includes(query) ||
        reverseName.includes(query) ||
        searchableValues.some((value) => value.includes(query))

      const matchesMemberFilter =
        memberFilter === 'all' ||
        (memberFilter === 'with_email' && Boolean(member.email)) ||
        (memberFilter === 'missing_email' && !member.email) ||
        (memberFilter === 'executive_officers' && isExecutiveOfficer)

      return matchesSearch && matchesMemberFilter
    })

    return [...filtered].sort((left, right) => {
      const leftFirst = normalize(left.first_name)
      const rightFirst = normalize(right.first_name)
      const leftLast = normalize(left.last_name)
      const rightLast = normalize(right.last_name)

      switch (sortBy) {
        case 'last_name_desc': {
          const byLast = rightLast.localeCompare(leftLast)
          return byLast !== 0 ? byLast : rightFirst.localeCompare(leftFirst)
        }
        case 'first_name_asc': {
          const byFirst = leftFirst.localeCompare(rightFirst)
          return byFirst !== 0 ? byFirst : leftLast.localeCompare(rightLast)
        }
        case 'first_name_desc': {
          const byFirst = rightFirst.localeCompare(leftFirst)
          return byFirst !== 0 ? byFirst : leftLast.localeCompare(rightLast)
        }
        case 'last_name_asc':
        default: {
          const byLast = leftLast.localeCompare(rightLast)
          return byLast !== 0 ? byLast : leftFirst.localeCompare(rightFirst)
        }
      }
    })
  }, [currentOfficerLabelsById, executiveOfficerLabelsById, memberFilter, members, search, sortBy])

  const totalPages = useMemo(() => {
    if (rowsPerPage === 'all') {
      return 1
    }

    return Math.max(1, Math.ceil(filteredAndSortedMembers.length / rowsPerPage))
  }, [filteredAndSortedMembers.length, rowsPerPage])

  const safeCurrentPage = Math.min(currentPage, totalPages)

  useEffect(() => {
    setPageInput(String(safeCurrentPage))
  }, [safeCurrentPage])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node

      if (!currentViewMenuRef.current?.contains(target)) {
        currentViewMenuRef.current?.removeAttribute('open')
      }

      if (!selectedRowsMenuRef.current?.contains(target)) {
        selectedRowsMenuRef.current?.removeAttribute('open')
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    setSelectedMemberIds((current) => current.filter((memberId) => members.some((member) => member.id === memberId)))
  }, [members])

  const paginatedMembers = useMemo(() => {
    if (rowsPerPage === 'all') {
      return filteredAndSortedMembers
    }

    const start = (safeCurrentPage - 1) * rowsPerPage
    return filteredAndSortedMembers.slice(start, start + rowsPerPage)
  }, [filteredAndSortedMembers, rowsPerPage, safeCurrentPage])

  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member] as const)), [members])

  const selectedMembers = useMemo(
    () => selectedMemberIds.map((memberId) => membersById.get(memberId)).filter((member): member is Member => Boolean(member)),
    [membersById, selectedMemberIds]
  )

  const selectedMemberIdSet = useMemo(() => new Set(selectedMemberIds), [selectedMemberIds])
  const filteredMemberIds = useMemo(() => filteredAndSortedMembers.map((member) => member.id), [filteredAndSortedMembers])
  const paginatedMemberIds = useMemo(() => paginatedMembers.map((member) => member.id), [paginatedMembers])

  const selectedCount = selectedMembers.length
  const selectedVisibleCount = filteredMemberIds.filter((memberId) => selectedMemberIdSet.has(memberId)).length
  const hiddenSelectedCount = selectedCount - selectedVisibleCount
  const allPageMembersSelected = paginatedMemberIds.length > 0 && paginatedMemberIds.every((memberId) => selectedMemberIdSet.has(memberId))
  const somePageMembersSelected = paginatedMemberIds.some((memberId) => selectedMemberIdSet.has(memberId))

  useEffect(() => {
    if (!pageSelectionRef.current) {
      return
    }

    pageSelectionRef.current.indeterminate = somePageMembersSelected && !allPageMembersSelected
  }, [allPageMembersSelected, somePageMembersSelected])

  const hasActiveControls =
    search.trim() !== '' ||
    memberFilter !== 'all' ||
    sortBy !== 'last_name_asc' ||
    rowsPerPage !== DEFAULT_ROWS_PER_PAGE

  function getDisplayedRole(memberId: string) {
    const executiveOfficerLabels = executiveOfficerLabelsById[memberId] ?? []
    const currentOfficerLabels = currentOfficerLabelsById[memberId] ?? []
    return executiveOfficerLabels[0] ?? (currentOfficerLabels.length > 0 ? currentOfficerLabels.join(', ') : 'Member')
  }

  function toggleColumn(columnKey: ColumnKey) {
    setVisibleColumns((current) => {
      if (current.includes(columnKey)) {
        return current.filter((value) => value !== columnKey)
      }

      return [...current, columnKey]
    })
  }

  function closeMenus() {
    currentViewMenuRef.current?.removeAttribute('open')
    selectedRowsMenuRef.current?.removeAttribute('open')
  }

  function resetControls() {
    setSearch('')
    setMemberFilter('all')
    setSortBy('last_name_asc')
    setRowsPerPage(DEFAULT_ROWS_PER_PAGE)
    setCurrentPage(1)
    setNotice(null)
  }

  function commitPageInput() {
    if (rowsPerPage === 'all') {
      setPageInput('1')
      return
    }

    const parsed = Number(pageInput)
    if (!Number.isFinite(parsed)) {
      setPageInput(String(safeCurrentPage))
      return
    }

    const nextPage = Math.min(Math.max(1, Math.trunc(parsed)), totalPages)
    setCurrentPage(nextPage)
    setPageInput(String(nextPage))
  }

  async function exportMembersAsExcel(list: Member[], scopeLabel: string, filePrefix: string) {
    const selectedColumnOptions = COLUMN_OPTIONS.filter((option) => visibleColumns.includes(option.key))
    const exportRows = list.map((member) => {
      const baseRow: Record<string, string> = {
        'First name': member.first_name,
        'Last name': member.last_name,
        'Directory role': getDisplayedRole(member.id),
      }

      for (const option of selectedColumnOptions) {
        baseRow[option.label] = getColumnValue(member, option.key)
      }

      return baseRow
    })

    const XLSX = await import('xlsx')
    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Members')

    const today = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `${fileSafe(`${filePrefix}-${today}`)}.xlsx`)

    setNotice({ tone: 'success', text: `Exported ${exportRows.length} ${scopeLabel} to Excel.` })
  }

  async function copyEmailsFromMembers(list: Member[], scopeLabel: string) {
    const recipients = getUniqueEmailRecipients(list)

    if (recipients.length === 0) {
      setNotice({ tone: 'error', text: `No email addresses are available in ${scopeLabel}.` })
      return
    }

    const recipientList = recipients.join('; ')

    try {
      await navigator.clipboard.writeText(recipientList)
      setNotice({ tone: 'success', text: `Copied ${recipients.length} email address${recipients.length === 1 ? '' : 'es'} from ${scopeLabel}.` })
    } catch {
      setNotice({ tone: 'error', text: 'Could not copy the email list. Please try again.' })
    }
  }

  function openCreateListFromMembers(list: Member[], sourceLabel: string, sourceBadge: string) {
    if (list.length === 0) {
      setNotice({ tone: 'error', text: `There are no members in ${sourceLabel} to save into a custom list.` })
      return
    }

    closeMenus()
    setNotice(null)
    setCreateListDraft({
      memberIds: list.map((member) => member.id),
      previewNames: list.slice(0, 12).map((member) => `${member.first_name} ${member.last_name}`.trim()),
      sourceLabel,
      sourceBadge,
    })
  }

  function toggleMemberSelection(memberId: string) {
    setSelectedMemberIds((current) =>
      current.includes(memberId) ? current.filter((value) => value !== memberId) : [...current, memberId]
    )
  }

  function handleTogglePageSelection() {
    if (paginatedMemberIds.length === 0) {
      return
    }

    setSelectedMemberIds((current) => {
      const next = new Set(current)

      if (allPageMembersSelected) {
        for (const memberId of paginatedMemberIds) {
          next.delete(memberId)
        }
      } else {
        for (const memberId of paginatedMemberIds) {
          next.add(memberId)
        }
      }

      return [...next]
    })
  }

  function handleSelectFilteredView() {
    if (filteredMemberIds.length === 0) {
      setNotice({ tone: 'error', text: 'There are no members in the current filtered view to select.' })
      return
    }

    setSelectedMemberIds((current) => [...new Set([...current, ...filteredMemberIds])])
    setNotice({ tone: 'success', text: `Selected ${filteredMemberIds.length} member${filteredMemberIds.length === 1 ? '' : 's'} from the current filtered view.` })
  }

  function handleClearSelection() {
    setSelectedMemberIds([])
    setNotice(null)
  }

  async function handleExportCurrentView() {
    closeMenus()

    if (filteredAndSortedMembers.length === 0) {
      setNotice({ tone: 'error', text: 'There are no members in this filtered view to export.' })
      return
    }

    await exportMembersAsExcel(filteredAndSortedMembers, 'members from the current filtered view', 'members')
  }

  async function handleExportSelectedRows() {
    closeMenus()

    if (selectedMembers.length === 0) {
      setNotice({ tone: 'error', text: 'Select at least one member before exporting.' })
      return
    }

    await exportMembersAsExcel(selectedMembers, 'selected members', 'selected-members')
  }

  async function handleCopyCurrentViewEmails() {
    closeMenus()
    await copyEmailsFromMembers(filteredAndSortedMembers, 'the current filtered view')
  }

  async function handleCopySelectedRowEmails() {
    closeMenus()

    if (selectedMembers.length === 0) {
      setNotice({ tone: 'error', text: 'Select at least one member before copying email addresses.' })
      return
    }

    await copyEmailsFromMembers(selectedMembers, 'the selected rows')
  }

  function handleRowsPerPageChange(value: string) {
    if (value === 'all') {
      setRowsPerPage('all')
      setCurrentPage(1)
      return
    }

    const parsed = Number(value)
    const nextValue: RowsPerPage = parsed === 20 ? 20 : parsed === 50 ? 50 : 10
    setRowsPerPage(nextValue)
    setCurrentPage(1)
  }

  function handlePageInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitPageInput()
    }
  }

  return (
    <>
      <section className="qv-card qv-members-list-card">
        <div className="qv-directory-section-head">
          <div>
            <h2 className="qv-section-title">{sectionTitle}</h2>
            <p className="qv-section-subtitle">{sectionSubtitle}</p>
          </div>

          <div className="qv-view-menu-stack">
            <div className="qv-directory-action-row">
              {currentViewControlMode === 'button' ? (
                <button
                  type="button"
                  className="qv-button-secondary qv-view-action-button"
                  onClick={() => openCreateListFromMembers(filteredAndSortedMembers, 'the current filtered view', 'Current filters applied')}
                >
                  Use Current View
                </button>
              ) : (
                <ActionMenu
                  label="Use Current View"
                  menuRef={currentViewMenuRef}
                  onCreateList={() => openCreateListFromMembers(filteredAndSortedMembers, 'the current filtered view', 'Current filters applied')}
                  onExport={handleExportCurrentView}
                  onCopyEmails={handleCopyCurrentViewEmails}
                />
              )}

              {selectedCount > 0 ? (
                <ActionMenu
                  label={<>Use Selected Rows <span className="qv-view-menu-count">({selectedCount})</span></>}
                  menuRef={selectedRowsMenuRef}
                  onCreateList={() => openCreateListFromMembers(selectedMembers, 'the selected rows', 'Selected rows')}
                  onExport={handleExportSelectedRows}
                  onCopyEmails={handleCopySelectedRowEmails}
                />
              ) : null}
            </div>

            {notice ? (
              <p className={notice.tone === 'error' ? 'qv-view-menu-notice qv-inline-error' : 'qv-view-menu-notice qv-inline-message'}>
                {notice.text}
              </p>
            ) : null}
          </div>
        </div>

        <div className="qv-controls qv-controls-directory">
          <select
            aria-label="Filter members"
            value={memberFilter}
            onChange={(event) => {
              setMemberFilter(event.target.value as MemberFilter)
              setCurrentPage(1)
            }}
          >
            <option value="all">All members</option>
            <option value="with_email">With email</option>
            <option value="missing_email">Missing email</option>
            <option value="executive_officers">Executive officers</option>
          </select>

          <select
            aria-label="Sort members"
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as SortOption)
              setCurrentPage(1)
            }}
          >
            <option value="last_name_asc">Last name A-Z</option>
            <option value="last_name_desc">Last name Z-A</option>
            <option value="first_name_asc">First name A-Z</option>
            <option value="first_name_desc">First name Z-A</option>
          </select>

          <input
            aria-label="Search members"
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setCurrentPage(1)
            }}
            placeholder="Search by name, phone, email, or office"
          />
        </div>

        <div className="qv-selection-toolbar" role="region" aria-label="Selected members actions">
          <div className="qv-selection-toolbar-left">
            <label className="qv-selection-checkbox-label">
              <input
                ref={pageSelectionRef}
                type="checkbox"
                checked={allPageMembersSelected}
                onChange={handleTogglePageSelection}
                disabled={paginatedMemberIds.length === 0}
              />
              <span>{allPageMembersSelected ? 'Clear page' : 'Select page'}</span>
            </label>

            <button type="button" className="qv-text-toggle" onClick={handleSelectFilteredView} disabled={filteredAndSortedMembers.length === 0}>
              <span>Select filtered view</span>
            </button>

            {selectedCount > 0 ? (
              <button type="button" className="qv-text-toggle qv-text-toggle-secondary" onClick={handleClearSelection}>
                <span>Clear selection</span>
              </button>
            ) : null}
          </div>

          <div className="qv-selection-toolbar-right">
            <span className="qv-badge">{selectedCount} selected</span>
            {hiddenSelectedCount > 0 ? (
              <span className="qv-inline-message qv-selection-meta">{hiddenSelectedCount} hidden by current filters</span>
            ) : null}
          </div>
        </div>

        <div className="qv-pagination-toolbar">
          <div className="qv-pagination-left">
            <label className="qv-pagination-meta-group">
              <span className="qv-pagination-meta-label">Users per page</span>
              <select
                aria-label="Users per page"
                className="qv-pagination-inline-select"
                value={rowsPerPage}
                onChange={(event) => handleRowsPerPageChange(event.target.value)}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value="all">All</option>
              </select>
            </label>

            <div className="qv-pagination-divider" aria-hidden="true" />

            <p className="qv-pagination-total">{filteredAndSortedMembers.length.toLocaleString()} users</p>

            {rowsPerPage !== 'all' && totalPages > 1 ? (
              <>
                <div className="qv-pagination-divider" aria-hidden="true" />

                <div className="qv-pagination-controls">
                  <button
                    type="button"
                    className="qv-pagination-icon-button"
                    onClick={() => setCurrentPage(1)}
                    disabled={safeCurrentPage === 1}
                    aria-label="First page"
                  >
                    |‹
                  </button>
                  <button
                    type="button"
                    className="qv-pagination-icon-button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={safeCurrentPage === 1}
                    aria-label="Previous page"
                  >
                    ‹
                  </button>
                  <label className="qv-pagination-page-input-wrap">
                    <span className="sr-only">Current page</span>
                    <input
                      aria-label="Current page"
                      className="qv-pagination-page-input"
                      inputMode="numeric"
                      value={pageInput}
                      onChange={(event) => setPageInput(event.target.value.replace(/[^0-9]/g, '') || '1')}
                      onBlur={commitPageInput}
                      onKeyDown={handlePageInputKeyDown}
                    />
                  </label>
                  <span className="qv-pagination-page-total">/ {totalPages}</span>
                  <button
                    type="button"
                    className="qv-pagination-icon-button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={safeCurrentPage === totalPages}
                    aria-label="Next page"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    className="qv-pagination-icon-button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safeCurrentPage === totalPages}
                    aria-label="Last page"
                  >
                    ›|
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <div className="qv-pagination-right">
            {hasActiveControls ? (
              <button type="button" className="qv-text-toggle qv-text-toggle-secondary" onClick={resetControls}>
                <span>Reset filters</span>
              </button>
            ) : null}

            <button
              type="button"
              className="qv-text-toggle"
              aria-expanded={showFieldPicker}
              onClick={() => setShowFieldPicker((current) => !current)}
            >
              <span>Show Additional Fields</span>
              <span aria-hidden="true" className="qv-text-toggle-chevron">{showFieldPicker ? '▴' : '▾'}</span>
            </button>
          </div>
        </div>

        {showFieldPicker ? (
          <div className="qv-inline-field-panel" role="region" aria-label="Choose which member details appear">
            <p className="qv-inline-message" style={{ margin: 0 }}>
              Choose which member details appear in this session.
            </p>
            <div className="qv-field-picker-grid">
              {COLUMN_OPTIONS.map((option) => (
                <label key={option.key} className="qv-field-picker-option">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(option.key)}
                    onChange={() => toggleColumn(option.key)}
                    style={{ width: 16, height: 16 }}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {paginatedMembers.length === 0 ? (
          <div className="qv-empty">
            <p className="qv-empty-title">No members match your search.</p>
            <p className="qv-empty-text">Try a different search, filter, or reset the controls.</p>
          </div>
        ) : (
          <div className="qv-member-table-scroll">
            <div className="qv-member-list">
              {paginatedMembers.map((person) => {
                const currentOfficerLabels = currentOfficerLabelsById[person.id] ?? []
                const executiveOfficerLabels = executiveOfficerLabelsById[person.id] ?? []
                const primaryExecutiveLabel = executiveOfficerLabels[0] ?? null
                const columnCount = Math.max(visibleColumns.length, 1)
                const gridTemplateColumns = `minmax(200px, 1.3fr) repeat(${columnCount}, minmax(120px, 1fr)) auto`
                const rowMinWidth = 320 + columnCount * 180 + 48
                const isSelected = selectedMemberIdSet.has(person.id)

                const rowStyle = {
                  ['--qv-member-row-template' as const]: gridTemplateColumns,
                  ['--qv-member-row-min-width' as const]: `${rowMinWidth}px`,
                } as CSSProperties

                return (
                  <div key={person.id} className="qv-member-row-shell">
                    <label className="qv-member-row-selector" aria-label={`Select ${person.first_name} ${person.last_name}`}>
                      <input
                        type="checkbox"
                        className="qv-member-row-checkbox"
                        checked={isSelected}
                        onChange={() => toggleMemberSelection(person.id)}
                      />
                    </label>

                    <Link href={`/members/${person.id}`} className="qv-member-link">
                      <div className={`qv-member-row qv-member-row-compact${isSelected ? ' qv-member-row-selected' : ''}`}>
                        <div className="qv-member-row-grid" style={rowStyle}>
                          <div style={{ minWidth: 0 }}>
                            <div className="qv-member-name qv-member-name-tight">
                              {person.first_name} {person.last_name}
                            </div>
                            <div className="qv-member-meta qv-member-meta-tight">
                              {primaryExecutiveLabel
                                ? primaryExecutiveLabel
                                : currentOfficerLabels.length > 0
                                  ? currentOfficerLabels.join(', ')
                                  : 'Member'}
                            </div>
                          </div>

                          {visibleColumns.length > 0 ? (
                            visibleColumns.map((columnKey) => {
                              const option = COLUMN_OPTIONS.find((item) => item.key === columnKey)
                              return (
                                <div key={columnKey} style={{ minWidth: 0 }}>
                                  <div className="qv-detail-label">{option?.label ?? columnKey}</div>
                                  <div className="qv-inline-message" style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                                    {getColumnValue(person, columnKey)}
                                  </div>
                                </div>
                              )
                            })
                          ) : (
                            <div style={{ minWidth: 0 }}>
                              <div className="qv-detail-label">Details</div>
                              <div className="qv-inline-message" style={{ color: 'var(--text-primary)' }}>
                                Choose fields above
                              </div>
                            </div>
                          )}

                          <div className="qv-member-row-right" style={{ justifySelf: 'end' }}>
                            <span className="qv-chevron">›</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {createListDraft ? (
        <CreateCustomListDialog
          open
          onClose={() => setCreateListDraft(null)}
          memberIds={createListDraft.memberIds}
          previewNames={createListDraft.previewNames}
          sourceLabel={createListDraft.sourceLabel}
          sourceBadge={createListDraft.sourceBadge}
        />
      ) : null}
    </>
  )
}
