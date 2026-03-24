'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type MemberOption = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
};

type HostManualVolunteerFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  members: MemberOption[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export default function HostManualVolunteerForm({
  action,
  members,
}: HostManualVolunteerFormProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [primaryName, setPrimaryName] = useState('');
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [responseNotes, setResponseNotes] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const filteredMembers = useMemo(() => {
    const query = normalize(searchQuery);

    const list = !query
      ? members
      : members.filter((member) => {
          const haystack = normalize(
            `${member.display_name} ${member.email ?? ''} ${member.phone ?? ''}`
          );

          return haystack.includes(query);
        });

    return list.slice(0, 12);
  }, [members, searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setShowResults(false);
        setHighlightedIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightedIndex < 0) {
      return;
    }

    resultRefs.current[highlightedIndex]?.scrollIntoView({
      block: 'nearest',
    });
  }, [highlightedIndex]);

  function selectMember(member: MemberOption) {
    setSelectedPersonId(member.id);
    setSearchQuery(member.display_name);
    setPrimaryName(member.display_name);
    setPrimaryEmail(member.email ?? '');
    setPrimaryPhone(member.phone ?? '');
    setShowResults(false);
    setHighlightedIndex(-1);
  }

  function clearSelectedMember() {
    setSelectedPersonId('');
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showResults && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setShowResults(true);
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filteredMembers.length === 0) {
        return;
      }
      setHighlightedIndex((current) =>
        current < filteredMembers.length - 1 ? current + 1 : 0
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filteredMembers.length === 0) {
        return;
      }
      setHighlightedIndex((current) =>
        current > 0 ? current - 1 : filteredMembers.length - 1
      );
      return;
    }

    if (event.key === 'Enter') {
      if (showResults && highlightedIndex >= 0 && filteredMembers[highlightedIndex]) {
        event.preventDefault();
        selectMember(filteredMembers[highlightedIndex]);
      }
      return;
    }

    if (event.key === 'Escape') {
      setShowResults(false);
      setHighlightedIndex(-1);
    }
  }

  return (
    <form action={action} className="qv-form-grid">
      <input type="hidden" name="selected_person_id" value={selectedPersonId} />

      <div ref={containerRef} className="qv-form-row" style={{ position: 'relative' }}>
        <label className="qv-control">
          <span className="qv-label">Find member</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setShowResults(true);
              setHighlightedIndex(0);
              clearSelectedMember();
            }}
            onFocus={() => {
              setShowResults(true);
              setHighlightedIndex(filteredMembers.length > 0 ? 0 : -1);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Start typing a name, email, or phone"
            autoComplete="off"
          />
        </label>

        {showResults ? (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 20,
              marginTop: 6,
              border: '1px solid var(--divider)',
              borderRadius: 16,
              background: 'var(--surface, var(--bg))',
              padding: 8,
              display: 'grid',
              gap: 6,
              maxHeight: 300,
              overflowY: 'auto',
              boxShadow: '0 10px 24px rgba(0, 0, 0, 0.08)',
            }}
          >
            {filteredMembers.length === 0 ? (
              <div
                style={{
                  padding: 12,
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                }}
              >
                No matching members found.
              </div>
            ) : (
              filteredMembers.map((member, index) => {
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    key={member.id}
                    ref={(node) => {
                      resultRefs.current[index] = node;
                    }}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectMember(member);
                    }}
                    className="qv-link-button qv-button-secondary"
                    style={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      width: '100%',
                      borderColor: isHighlighted ? 'var(--text-primary)' : undefined,
                      background: isHighlighted ? 'var(--bg-sunken)' : undefined,
                    }}
                  >
                    <span style={{ display: 'grid', gap: 4 }}>
                      <span>{member.display_name}</span>

                      <span
                        style={{
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        {member.email ? <span>{member.email}</span> : <span>No Email</span>}
                        {member.phone ? <span>{member.phone}</span> : <span>No phone #</span>}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      <div className="qv-form-row qv-form-row-3">
        <label className="qv-control">
          <span className="qv-label">Volunteer name</span>
          <input
            type="text"
            name="primary_name"
            value={primaryName}
            onChange={(event) => setPrimaryName(event.target.value)}
            required
          />
        </label>

        <label className="qv-control">
          <span className="qv-label">Volunteer email</span>
          <input
            type="email"
            name="primary_email"
            value={primaryEmail}
            onChange={(event) => setPrimaryEmail(event.target.value)}
            placeholder="Optional"
          />
        </label>

        <label className="qv-control">
          <span className="qv-label">Volunteer phone</span>
          <input
            type="text"
            name="primary_phone"
            value={primaryPhone}
            onChange={(event) => setPrimaryPhone(event.target.value)}
            placeholder="Optional"
          />
        </label>
      </div>

      <div className="qv-form-row">
        <label className="qv-control">
          <span className="qv-label">Notes</span>
          <textarea
            name="response_notes"
            value={responseNotes}
            onChange={(event) => setResponseNotes(event.target.value)}
            placeholder="Optional host note"
          />
        </label>
      </div>

      <div className="qv-form-actions">
        <button type="submit" className="qv-button-primary">
          Add volunteer
        </button>
      </div>
    </form>
  );
}