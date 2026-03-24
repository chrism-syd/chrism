'use client';

import { useMemo, useState, useTransition, type ChangeEvent } from 'react';
import { applySupremeImportAction } from './actions';
import {
  IMPORT_FIELD_DEFINITIONS,
  IMPORT_FIELD_SECTIONS,
  SPREADSHEET_FIELD_OPTIONS,
  buildExistingMemberMatchIndexes,
  createInitialColumnMapping,
  existingFieldValues,
  extractSpreadsheetColumns,
  formatDisplayValue,
  getMissingRequiredMappings,
  importedFieldValues,
  mapSpreadsheetRowsToSupremeRows,
  matchImportedRowToExisting,
  normalizeComparableValue,
  normalizeLookupValue,
  normalizeWhitespace,
  type ExistingSupremeComparablePerson,
  type ImportFieldDefinition,
  type ImportFieldKey,
  type ImportFieldSectionKey,
  type ResolvedImportFieldValues,
  type SpreadsheetColumnDefinition,
  type SpreadsheetFieldKey,
  type SpreadsheetFieldOption,
  type SupremeImportRow,
} from '@/lib/imports/supreme';

type SupremeImportWorkbenchProps = {
  existingPeople: ExistingSupremeComparablePerson[];
  expectedCouncilNumber: string | null;
};

type FieldChoice = 'current' | 'import' | 'custom';

type RowDecision = {
  importMode: 'update_existing' | 'create_new' | 'skip';
  fieldChoices: Record<ImportFieldKey, FieldChoice>;
  customValues: Record<ImportFieldKey, string>;
};

type ReviewRow = {
  row: SupremeImportRow;
  existingPerson: ExistingSupremeComparablePerson | null;
  matchReason: 'member_number' | 'name_birth_date' | 'name_only' | 'new_member';
  currentValues: ResolvedImportFieldValues;
  importValues: ResolvedImportFieldValues;
  differingFields: ImportFieldDefinition[];
  councilMatches: boolean;
  hasConflict: boolean;
};

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  cells.push(current);
  return cells;
}

async function readSpreadsheetRows(file: File) {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.csv')) {
    const text = await file.text();
    return text
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '')
      .map((line) => parseCsvLine(line));
  }

  const workbookBuffer = await file.arrayBuffer();
  const xlsx = await import('xlsx');
  const workbook = xlsx.read(workbookBuffer, {
    type: 'array',
    cellDates: true,
    raw: false,
    dense: true,
  });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [] as unknown[][];
  }

  const sheet = workbook.Sheets[firstSheetName];
  return xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
  }) as unknown[][];
}

function createInitialDecision(reviewRow: ReviewRow): RowDecision {
  const fieldChoices = Object.fromEntries(
    IMPORT_FIELD_DEFINITIONS.map((field) => {
      const currentValue = reviewRow.currentValues[field.key];
      const importValue = reviewRow.importValues[field.key];
      const normalizedCurrent = normalizeComparableValue(field, currentValue);
      const normalizedImport = normalizeComparableValue(field, importValue);
      const defaultChoice: FieldChoice = normalizedCurrent === normalizedImport ? 'import' : 'import';
      return [field.key, defaultChoice];
    })
  ) as Record<ImportFieldKey, FieldChoice>;

  const customValues = Object.fromEntries(
    IMPORT_FIELD_DEFINITIONS.map((field) => [field.key, reviewRow.importValues[field.key] ?? ''])
  ) as Record<ImportFieldKey, string>;

  return {
    importMode: reviewRow.existingPerson ? 'update_existing' : 'create_new',
    fieldChoices,
    customValues,
  };
}

function resolveFieldValue(
  field: ImportFieldDefinition,
  decision: RowDecision,
  reviewRow: ReviewRow
): string | null {
  const choice = decision.fieldChoices[field.key];

  if (choice === 'current') {
    return reviewRow.currentValues[field.key];
  }

  if (choice === 'custom') {
    const customValue = decision.customValues[field.key]?.trim();
    return customValue ? customValue : null;
  }

  return reviewRow.importValues[field.key];
}

function matchLabel(reviewRow: ReviewRow) {
  if (reviewRow.hasConflict) {
    return 'Potential duplicate';
  }

  switch (reviewRow.matchReason) {
    case 'member_number':
      return 'Matched by member number';
    case 'name_birth_date':
      return 'Matched by name + birth date';
    case 'name_only':
      return 'Matched by name only';
    case 'new_member':
    default:
      return 'New member candidate';
  }
}

function getOptionLabel(fieldKey: SpreadsheetFieldKey) {
  return (
    SPREADSHEET_FIELD_OPTIONS.find((option) => option.key === fieldKey)?.label ??
    normalizeWhitespace(String(fieldKey).replaceAll('_', ' '))
  );
}

function formatExampleValue(value: unknown) {
  const normalized = normalizeWhitespace(String(value ?? ''));
  return normalized || '—';
}

function getSectionFields(sectionKey: ImportFieldSectionKey) {
  return IMPORT_FIELD_DEFINITIONS.filter((field) => field.section === sectionKey);
}

function getVisibleFieldsForRow(reviewRow: ReviewRow, sectionKey: ImportFieldSectionKey) {
  const sectionFields = getSectionFields(sectionKey);

  if (!reviewRow.existingPerson) {
    return sectionFields.filter((field) => {
      const importValue = reviewRow.importValues[field.key];
      return Boolean(importValue);
    });
  }

  return sectionFields.filter((field) =>
    reviewRow.differingFields.some((differingField) => differingField.key === field.key)
  );
}

export default function SupremeImportWorkbench({
  existingPeople,
  expectedCouncilNumber,
}: SupremeImportWorkbenchProps) {
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState<unknown[][]>([]);
  const [columns, setColumns] = useState<SpreadsheetColumnDefinition[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, SpreadsheetFieldKey>>({});
  const [decisions, setDecisions] = useState<Record<string, RowDecision>>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  const existingIndexes = useMemo(
    () => buildExistingMemberMatchIndexes(existingPeople),
    [existingPeople]
  );

  const missingRequiredMappings = useMemo(
    () => getMissingRequiredMappings(columnMapping),
    [columnMapping]
  );

  const requiredMappingLabels = useMemo(
    () => missingRequiredMappings.map((fieldKey) => getOptionLabel(fieldKey)),
    [missingRequiredMappings]
  );

  const columnSamples = useMemo<Record<number, string>>(() => {
    const headerInfo = extractSpreadsheetColumns(rawRows);
    if (!headerInfo) {
      return {};
    }

    const dataRows = rawRows.slice(headerInfo.headerIndex + 1);
    return Object.fromEntries(
      columns.map((column) => {
        const sample = dataRows.find((row) => normalizeWhitespace(String(row[column.index] ?? '')) !== '');
        return [column.index, formatExampleValue(sample?.[column.index])];
      })
    );
  }, [columns, rawRows]);

  const importedRows = useMemo(() => {
    if (rawRows.length === 0 || columns.length === 0 || missingRequiredMappings.length > 0) {
      return [] as SupremeImportRow[];
    }

    return mapSpreadsheetRowsToSupremeRows(rawRows, columnMapping);
  }, [columnMapping, columns.length, missingRequiredMappings.length, rawRows]);

  const reviewRows = useMemo<ReviewRow[]>(() => {
    return importedRows.map((row) => {
      const match = matchImportedRowToExisting(row, existingIndexes);
      const existingPerson = match.person;
      const currentValues = existingFieldValues(existingPerson);
      const importValues = importedFieldValues(row);
      const differingFields = IMPORT_FIELD_DEFINITIONS.filter((field) => {
        return (
          normalizeComparableValue(field, currentValues[field.key]) !==
          normalizeComparableValue(field, importValues[field.key])
        );
      });

      return {
        row,
        existingPerson,
        matchReason: match.matchReason,
        currentValues,
        importValues,
        differingFields,
        councilMatches:
          !expectedCouncilNumber ||
          normalizeLookupValue(row.councilNumber) === normalizeLookupValue(expectedCouncilNumber),
        hasConflict: match.hasConflict,
      };
    });
  }, [existingIndexes, expectedCouncilNumber, importedRows]);

  const reviewRowsById = useMemo(
    () => new Map(reviewRows.map((reviewRow) => [reviewRow.row.rowId, reviewRow])),
    [reviewRows]
  );

  const actionableRows = reviewRows.filter((reviewRow) => reviewRow.councilMatches && !reviewRow.hasConflict);
  const matchedRows = reviewRows.filter((reviewRow) => reviewRow.existingPerson);
  const conversionRows = reviewRows.filter(
    (reviewRow) =>
      reviewRow.existingPerson && reviewRow.existingPerson.primary_relationship_code !== 'member'
  );
  const newRows = reviewRows.filter((reviewRow) => !reviewRow.existingPerson);
  const changedRows = reviewRows.filter((reviewRow) => reviewRow.differingFields.length > 0);
  const duplicateConflictRows = reviewRows.filter((reviewRow) => reviewRow.hasConflict);
  const unmappedColumns = columns.filter((column) => (columnMapping[column.index] ?? 'ignore') === 'ignore');

  const mappingSections = useMemo(
    () =>
      IMPORT_FIELD_SECTIONS.map((section) => ({
        ...section,
        options: SPREADSHEET_FIELD_OPTIONS.filter(
          (option) => option.key !== 'ignore' && option.section === section.key
        ),
      })).filter((section) => section.options.length > 0),
    []
  );

  function getMappedColumnForField(fieldKey: SpreadsheetFieldKey) {
    return columns.find((column) => columnMapping[column.index] === fieldKey) ?? null;
  }

  function setFieldMapping(fieldKey: SpreadsheetFieldKey, nextColumnIndexValue: string) {
    setColumnMapping((current) => {
      const next = { ...current };

      for (const [columnIndex, mappedField] of Object.entries(next)) {
        if (mappedField === fieldKey) {
          next[Number(columnIndex)] = 'ignore';
        }
      }

      if (nextColumnIndexValue !== '') {
        next[Number(nextColumnIndexValue)] = fieldKey;
      }

      return next;
    });
  }

  function updateRowDecision(rowId: string, updater: (current: RowDecision) => RowDecision) {
    setDecisions((current) => {
      const reviewRow = reviewRowsById.get(rowId);
      if (!reviewRow) {
        return current;
      }

      const baseDecision = current[rowId] ?? createInitialDecision(reviewRow);
      return {
        ...current,
        [rowId]: updater(baseDecision),
      };
    });
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setSuccessMessage('');
    setErrorMessage('');

    if (!file) {
      setFileName('');
      setRawRows([]);
      setColumns([]);
      setColumnMapping({});
      setDecisions({});
      return;
    }

    setFileName(file.name);

    try {
      const nextRawRows = await readSpreadsheetRows(file);
      const headerInfo = extractSpreadsheetColumns(nextRawRows);

      if (!headerInfo) {
        setRawRows([]);
        setColumns([]);
        setColumnMapping({});
        setDecisions({});
        setErrorMessage(
          'We could not find the header row. Make sure the file includes council number and member number columns.'
        );
        return;
      }

      const nextMapping = createInitialColumnMapping(headerInfo.columns);
      setRawRows(nextRawRows);
      setColumns(headerInfo.columns);
      setColumnMapping(nextMapping);
      setDecisions({});
    } catch (error) {
      setRawRows([]);
      setColumns([]);
      setColumnMapping({});
      setDecisions({});
      setErrorMessage(
        error instanceof Error ? error.message : 'We could not read that file. Please try again.'
      );
    }
  }

  async function handleApplyImport() {
    setErrorMessage('');
    setSuccessMessage('');

    const payloadRows = actionableRows
      .map((reviewRow) => {
        const decision = decisions[reviewRow.row.rowId] ?? createInitialDecision(reviewRow);
        if (decision.importMode === 'skip') {
          return null;
        }

        const fieldValues = Object.fromEntries(
          IMPORT_FIELD_DEFINITIONS.map((field) => [field.key, resolveFieldValue(field, decision, reviewRow)])
        ) as Record<ImportFieldKey, string | null>;

        return {
          rowId: reviewRow.row.rowId,
          sourceRowNumber: reviewRow.row.sourceRowNumber,
          councilNumber: reviewRow.row.councilNumber,
          existingPersonId: reviewRow.existingPerson?.id ?? null,
          importMode: decision.importMode,
          fieldValues,
        };
      })
      .filter(Boolean) as Array<{
        rowId: string;
        sourceRowNumber: number;
        councilNumber: string | null;
        existingPersonId: string | null;
        importMode: 'update_existing' | 'create_new';
        fieldValues: Record<ImportFieldKey, string | null>;
      }>;

    if (payloadRows.length === 0) {
      setErrorMessage('Nothing is selected to apply.');
      return;
    }

    startTransition(async () => {
      try {
        const result = await applySupremeImportAction({ rows: payloadRows });
        setSuccessMessage(
          `Applied ${result.appliedCount} roster rows. Updated ${result.updatedCount}, created ${result.createdCount}.`
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Import failed.');
      }
    });
  }

  return (
    <section className="qv-card">
      <div className="qv-directory-section-head">
        <div>
          <h2 className="qv-section-title">Import workbench</h2>
          <p className="qv-section-subtitle">
            Step 1: upload the roster. Step 2: confirm each mapped field. Step 3: review the member updates before you apply them.
          </p>
        </div>
      </div>

      <div className="qv-form-grid">
        <div className="qv-form-row">
          <label className="qv-control">
            <span className="qv-label">Roster file</span>
            <input type="file" accept=".csv,.xls,.xlsx" onChange={handleFileChange} />
            <p className="qv-section-subtitle" style={{ marginTop: 8 }}>
              CSV, XLS, and XLSX are supported. Known Supreme headers will auto-map when they match.
            </p>
          </label>
        </div>
      </div>

      {fileName ? (
        <p className="qv-results-text" style={{ marginTop: 16 }}>
          Loaded <strong>{fileName}</strong>
        </p>
      ) : null}

      {errorMessage ? <div className="qv-error" style={{ marginTop: 16 }}>{errorMessage}</div> : null}

      {successMessage ? (
        <div
          style={{
            marginTop: 16,
            padding: '16px 18px',
            borderRadius: 16,
            border: '1px solid color-mix(in srgb, var(--interactive) 22%, var(--divider))',
            background: 'color-mix(in srgb, var(--interactive) 10%, var(--bg-card))',
            color: 'var(--text-primary)',
          }}
        >
          {successMessage}
        </div>
      ) : null}

      {columns.length > 0 ? (
        <section className="qv-card" style={{ marginTop: 20, background: 'var(--bg-sunken)' }}>
          <div className="qv-directory-section-head">
            <div>
              <h3 className="qv-section-title">Column mapping</h3>
              <p className="qv-section-subtitle">
                Pick the source column for each field. The sample value comes from the uploaded file so you can spot bad mappings quickly.
              </p>
            </div>
          </div>

          {mappingSections.map((section) => (
            <div key={section.key} style={{ marginTop: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <div className="qv-member-name">{section.label}</div>
                <div className="qv-member-meta">{section.description}</div>
              </div>

              <div className="qv-member-list">
                {section.options.map((option) => {
                  const mappedColumn = getMappedColumnForField(option.key);
                  const sampleValue = mappedColumn ? columnSamples[mappedColumn.index] ?? '—' : '—';

                  return (
                    <div key={option.key} className="qv-member-row" style={{ alignItems: 'flex-start' }}>
                      <div className="qv-member-main" style={{ flex: 1 }}>
                        <div className="qv-member-text">
                          <div className="qv-member-name">
                            {option.label}{' '}
                            {option.required ? <span className="qv-badge">Required</span> : null}
                          </div>
                          {option.helpText ? (
                            <div className="qv-member-meta">{option.helpText}</div>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ width: 'min(100%, 440px)', display: 'grid', gap: 10 }}>
                        <label className="qv-control" style={{ margin: 0 }}>
                          <span className="qv-detail-meta">Source column</span>
                          <select
                            value={mappedColumn ? String(mappedColumn.index) : ''}
                            onChange={(event) => setFieldMapping(option.key, event.target.value)}
                          >
                            <option value="">Not mapped</option>
                            {columns.map((column) => (
                              <option key={column.index} value={column.index}>
                                {column.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(120px, 140px) minmax(0, 1fr)',
                            gap: 8,
                            alignItems: 'start',
                          }}
                        >
                          <div className="qv-detail-meta">Example value</div>
                          <div className="qv-detail-value" style={{ wordBreak: 'break-word' }}>
                            {sampleValue}
                          </div>
                        </div>

                        {mappedColumn ? (
                          <div className="qv-inline-message">
                            Header key: {mappedColumn.normalizedHeader || 'blank_column'}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {requiredMappingLabels.length > 0 ? (
            <div className="qv-form-alert" style={{ marginTop: 16 }}>
              Finish the required mapping before review: {requiredMappingLabels.join(', ')}.
            </div>
          ) : null}

          {unmappedColumns.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <div className="qv-member-name" style={{ fontSize: 15 }}>Unused file columns</div>
              <div className="qv-member-meta" style={{ marginBottom: 10 }}>
                These columns are currently left out of the import flow.
              </div>
              <div className="qv-member-list">
                {unmappedColumns.map((column) => (
                  <div key={column.index} className="qv-member-row" style={{ padding: '12px 16px' }}>
                    <div className="qv-member-main" style={{ flex: 1 }}>
                      <div className="qv-member-text">
                        <div className="qv-member-name" style={{ fontSize: 15 }}>{column.label}</div>
                        <div className="qv-member-meta">Example: {columnSamples[column.index] ?? '—'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {reviewRows.length > 0 ? (
        <>
          <div className="qv-stats" style={{ marginTop: 20 }}>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{reviewRows.length}</div>
              <div className="qv-stat-label">Rows in file</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{matchedRows.length}</div>
              <div className="qv-stat-label">Matched members</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{newRows.length}</div>
              <div className="qv-stat-label">New member candidates</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{conversionRows.length}</div>
              <div className="qv-stat-label">Prospects converting</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{changedRows.length}</div>
              <div className="qv-stat-label">Rows with changes</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{duplicateConflictRows.length}</div>
              <div className="qv-stat-label">Duplicate checks</div>
            </div>
          </div>

          <div className="qv-form-actions" style={{ marginTop: 20 }}>
            <button
              type="button"
              className="qv-button-primary"
              onClick={handleApplyImport}
              disabled={isPending || duplicateConflictRows.length > 0}
            >
              {isPending ? 'Applying import…' : 'Apply confirmed import'}
            </button>
          </div>

          {duplicateConflictRows.length > 0 ? (
            <div className="qv-form-alert" style={{ marginTop: 16 }}>
              One or more rows matched multiple people on file. Those rows stay locked until the duplicate is resolved in the member directory.
            </div>
          ) : null}

          <div style={{ marginTop: 20 }}>
            {reviewRows.map((reviewRow) => {
              const decision = decisions[reviewRow.row.rowId] ?? createInitialDecision(reviewRow);
              const rowName = `${reviewRow.row.firstName} ${reviewRow.row.lastName}`.trim();
              const relationshipLabel = reviewRow.existingPerson
                ? reviewRow.existingPerson.primary_relationship_code === 'member'
                  ? 'Existing member'
                  : `Existing ${reviewRow.existingPerson.primary_relationship_code}`
                : 'New member';
              const rowLocked = reviewRow.hasConflict || !reviewRow.councilMatches;
              const visibleSections = IMPORT_FIELD_SECTIONS.map((section) => ({
                ...section,
                fields: getVisibleFieldsForRow(reviewRow, section.key),
              })).filter((section) => section.fields.length > 0);

              return (
                <details
                  key={reviewRow.row.rowId}
                  className="qv-review-row"
                  open={reviewRow.differingFields.length > 0 || !reviewRow.existingPerson || reviewRow.hasConflict}
                >
                  <summary className="qv-review-row-summary">
                    <div className="qv-review-row-headline">
                      <div style={{ minWidth: 0 }}>
                        <div className="qv-member-name">{rowName}</div>
                        <div className="qv-member-meta">
                          Row {reviewRow.row.sourceRowNumber} • Member #{reviewRow.row.memberNumber ?? '—'} • {matchLabel(reviewRow)} • {relationshipLabel}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {!reviewRow.councilMatches ? <span className="qv-badge">Council mismatch</span> : null}
                        {reviewRow.hasConflict ? <span className="qv-badge">Review duplicate</span> : null}
                        {reviewRow.differingFields.length > 0 ? (
                          <span className="qv-badge">{reviewRow.differingFields.length} changes</span>
                        ) : (
                          <span className="qv-badge">No changes</span>
                        )}
                        <span className="qv-review-row-arrow">▾</span>
                      </div>
                    </div>
                  </summary>

                  <div className="qv-review-row-body">
                    <div className="qv-card" style={{ padding: 16 }}>
                      <div className="qv-form-row qv-form-row-2">
                        <label className="qv-control">
                          <span className="qv-label">Apply mode</span>
                          <select
                            value={rowLocked ? 'skip' : decision.importMode}
                            onChange={(event) => {
                              const nextMode = event.target.value as RowDecision['importMode'];
                              updateRowDecision(reviewRow.row.rowId, (current) => ({
                                ...current,
                                importMode: nextMode,
                              }));
                            }}
                            disabled={rowLocked}
                          >
                            {reviewRow.existingPerson ? (
                              <option value="update_existing">Update existing record</option>
                            ) : (
                              <option value="create_new">Create new member</option>
                            )}
                            <option value="skip">Skip this row</option>
                          </select>
                        </label>
                      </div>

                      {!reviewRow.councilMatches ? (
                        <div className="qv-form-alert" style={{ marginTop: 12 }}>
                          This row belongs to council {reviewRow.row.councilNumber ?? '—'} and will stay skipped for this council import.
                        </div>
                      ) : null}

                      {reviewRow.hasConflict ? (
                        <div className="qv-form-alert" style={{ marginTop: 12 }}>
                          More than one person on file looks like a match for this row. Resolve the duplicate in the directory first, then re-run the import.
                        </div>
                      ) : null}

                      {reviewRow.existingPerson && reviewRow.existingPerson.primary_relationship_code !== 'member' ? (
                        <div className="qv-form-alert" style={{ marginTop: 12 }}>
                          This existing {reviewRow.existingPerson.primary_relationship_code} will be converted into a member if you apply the row.
                        </div>
                      ) : null}
                    </div>

                    {visibleSections.length === 0 ? (
                      <div className="qv-empty">
                        <p className="qv-empty-title">No field differences detected</p>
                        <p className="qv-empty-text">
                          This row already matches the current record for the fields handled by this importer.
                        </p>
                      </div>
                    ) : null}

                    {visibleSections.map((section) => (
                      <div key={section.key} className="qv-card" style={{ padding: 16 }}>
                        <div style={{ marginBottom: 12 }}>
                          <div className="qv-member-name" style={{ fontSize: 15 }}>{section.label}</div>
                          <div className="qv-member-meta">{section.description}</div>
                        </div>

                        <div style={{ display: 'grid', gap: 12 }}>
                          {section.fields.map((field) => {
                            const choice = decision.fieldChoices[field.key];
                            const currentValueLabel = reviewRow.existingPerson ? 'On file' : 'Current value';
                            const importValueLabel = 'Incoming value';

                            return (
                              <div
                                key={field.key}
                                style={{
                                  border: '1px solid var(--divider)',
                                  borderRadius: 16,
                                  padding: 14,
                                  background: 'var(--bg-card)',
                                  display: 'grid',
                                  gap: 12,
                                }}
                              >
                                <div className="qv-detail-label">{field.label}</div>

                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: 12,
                                  }}
                                >
                                  <div>
                                    <div className="qv-detail-meta">{currentValueLabel}</div>
                                    <div className="qv-detail-value">
                                      {formatDisplayValue(field, reviewRow.currentValues[field.key])}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="qv-detail-meta">{importValueLabel}</div>
                                    <div className="qv-detail-value">
                                      {formatDisplayValue(field, reviewRow.importValues[field.key])}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'grid', gap: 8 }}>
                                  <label className="qv-control" style={{ margin: 0 }}>
                                    <span className="qv-detail-meta">Use this value</span>
                                    <select
                                      value={choice}
                                      onChange={(event) => {
                                        const nextChoice = event.target.value as FieldChoice;
                                        updateRowDecision(reviewRow.row.rowId, (current) => ({
                                          ...current,
                                          fieldChoices: {
                                            ...current.fieldChoices,
                                            [field.key]: nextChoice,
                                          },
                                        }));
                                      }}
                                      disabled={rowLocked}
                                    >
                                      <option value="current">
                                        {reviewRow.existingPerson ? 'Keep on file' : 'Leave blank'}
                                      </option>
                                      <option value="import">Use incoming value</option>
                                      <option value="custom">Enter custom value</option>
                                    </select>
                                  </label>

                                  {choice === 'custom' ? (
                                    <label className="qv-control" style={{ margin: 0 }}>
                                      <span className="qv-detail-meta">Custom value</span>
                                      <input
                                        value={decision.customValues[field.key]}
                                        onChange={(event) => {
                                          updateRowDecision(reviewRow.row.rowId, (current) => ({
                                            ...current,
                                            customValues: {
                                              ...current.customValues,
                                              [field.key]: event.target.value,
                                            },
                                          }));
                                        }}
                                        disabled={rowLocked}
                                      />
                                    </label>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
