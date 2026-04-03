'use client';

import { useState } from 'react';

type BaseRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes?: string;
  usesPrimaryContact?: boolean;
};

type SharedProps = {
  itemLabel: string;
  addButtonLabel: string;
  emptyTitle: string;
  emptyText: string;
};

type AttendeeRowsEditorProps = SharedProps & {
  rows: Array<{
    id: string;
    attendee_name: string;
    attendee_email: string | null;
    attendee_phone: string | null;
    uses_primary_contact: boolean;
  }>;
};

type VolunteerRowsEditorProps = SharedProps & {
  rows: Array<{
    id: string;
    volunteer_name: string;
    volunteer_email: string | null;
    volunteer_phone: string | null;
    volunteer_notes: string | null;
  }>;
};

type DynamicRowsEditorProps = SharedProps & {
  mode: 'attendee' | 'volunteer';
  rows: BaseRow[];
};

function createRow(mode: 'attendee' | 'volunteer', index: number): BaseRow {
  return {
    id: `new-${mode}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    email: '',
    phone: '',
    notes: '',
    usesPrimaryContact: mode === 'attendee',
  };
}

function cardStyle() {
  return {
    border: '1px solid var(--divider)',
    borderRadius: 16,
    padding: 16,
    background: 'var(--bg-sunken)',
    display: 'grid',
    gap: 14,
  } as const;
}

function emptyStyle() {
  return {
    border: '1px dashed var(--divider)',
    borderRadius: 16,
    padding: 18,
    background: 'var(--bg-sunken)',
    display: 'grid',
    gap: 10,
  } as const;
}

function buttonRowStyle() {
  return {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  } as const;
}

function DynamicRowsEditor({ mode, rows, itemLabel, addButtonLabel, emptyTitle, emptyText }: DynamicRowsEditorProps) {
  const [draftRows, setDraftRows] = useState<BaseRow[]>(() =>
    rows.length > 0 ? rows.map((row) => ({ ...row })) : [createRow(mode, 0)]
  );

  function updateRow(index: number, patch: Partial<BaseRow>) {
    setDraftRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setDraftRows((current) => [...current, createRow(mode, current.length)]);
  }

  function removeRow(index: number) {
    setDraftRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  if (draftRows.length === 0) {
    return (
      <div className="qv-form-grid">
        <div style={emptyStyle()}>
          <div>
            <h3 className="qv-section-title" style={{ fontSize: 18 }}>
              {emptyTitle}
            </h3>
            <p className="qv-section-subtitle" style={{ marginTop: 6 }}>
              {emptyText}
            </p>
          </div>

          <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="qv-link-button qv-button-secondary" onClick={addRow}>
              {addButtonLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="qv-form-grid">
      {draftRows.map((row, index) => (
        <div key={row.id} style={cardStyle()}>
          <div style={buttonRowStyle()}>
            <div>
              <h3 className="qv-section-title" style={{ fontSize: 18 }}>
                {itemLabel} {index + 1}
              </h3>
              <p className="qv-section-subtitle" style={{ marginTop: 6 }}>
                {mode === 'volunteer'
                  ? 'Add contact details for this volunteer if you have them.'
                  : 'Add contact details for this person or leave those fields blank.'}
              </p>
            </div>

            <button
              type="button"
              className="qv-link-button qv-button-secondary"
              onClick={() => removeRow(index)}
            >
              Remove
            </button>
          </div>

          <div className="qv-form-row qv-form-row-3">
            <label className="qv-control">
              <span className="qv-label">{mode === 'volunteer' ? 'Volunteer name' : 'Name'}</span>
              <input
                type="text"
                name={mode === 'volunteer' ? 'volunteer_name[]' : 'attendee_name[]'}
                value={row.name}
                onChange={(event) => updateRow(index, { name: event.target.value })}
              />
            </label>

            <label className="qv-control">
              <span className="qv-label">{mode === 'volunteer' ? 'Volunteer email' : 'Email'}</span>
              <input
                type="email"
                name={mode === 'volunteer' ? 'volunteer_email[]' : 'attendee_email[]'}
                value={row.email}
                onChange={(event) => updateRow(index, { email: event.target.value })}
              />
            </label>

            <label className="qv-control">
              <span className="qv-label">{mode === 'volunteer' ? 'Volunteer phone' : 'Phone'}</span>
              <input
                type="text"
                name={mode === 'volunteer' ? 'volunteer_phone[]' : 'attendee_phone[]'}
                value={row.phone}
                onChange={(event) => updateRow(index, { phone: event.target.value })}
              />
            </label>
          </div>

          {mode === 'attendee' ? (
            <div className="qv-form-row">
              <label className="qv-control" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  name={`attendee_use_primary_contact_${index}`}
                  value="true"
                  checked={row.usesPrimaryContact ?? true}
                  onChange={(event) => updateRow(index, { usesPrimaryContact: event.target.checked })}
                  style={{ width: 'auto' }}
                />
                <span className="qv-label" style={{ margin: 0 }}>
                  Use my email and phone for this person
                </span>
              </label>
            </div>
          ) : null}

          {mode === 'volunteer' ? (
            <div className="qv-form-row">
              <label className="qv-control">
                <span className="qv-label">Volunteer notes</span>
                <input
                  type="text"
                  name="volunteer_notes[]"
                  value={row.notes ?? ''}
                  onChange={(event) => updateRow(index, { notes: event.target.value })}
                  placeholder="Optional note"
                />
              </label>
            </div>
          ) : null}
        </div>
      ))}

      <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="qv-link-button qv-button-secondary" onClick={addRow}>
          {addButtonLabel}
        </button>
      </div>
    </div>
  );
}

export function AttendeeRowsEditor({ rows, itemLabel, addButtonLabel, emptyTitle, emptyText }: AttendeeRowsEditorProps) {
  return (
    <DynamicRowsEditor
      mode="attendee"
      rows={rows.map((row) => ({
        id: row.id,
        name: row.attendee_name ?? '',
        email: row.attendee_email ?? '',
        phone: row.attendee_phone ?? '',
        usesPrimaryContact: row.uses_primary_contact,
      }))}
      itemLabel={itemLabel}
      addButtonLabel={addButtonLabel}
      emptyTitle={emptyTitle}
      emptyText={emptyText}
    />
  );
}

export function VolunteerRowsEditor({ rows, itemLabel, addButtonLabel, emptyTitle, emptyText }: VolunteerRowsEditorProps) {
  return (
    <DynamicRowsEditor
      mode="volunteer"
      rows={rows.map((row) => ({
        id: row.id,
        name: row.volunteer_name ?? '',
        email: row.volunteer_email ?? '',
        phone: row.volunteer_phone ?? '',
        notes: row.volunteer_notes ?? '',
      }))}
      itemLabel={itemLabel}
      addButtonLabel={addButtonLabel}
      emptyTitle={emptyTitle}
      emptyText={emptyText}
    />
  );
}
