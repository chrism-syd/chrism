'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type PersonOption = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
};

type HostManualVolunteerFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  people: PersonOption[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export default function HostManualVolunteerForm({
  action,
  people,
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

  const filteredPeople = useMemo(() => {
    const query = normalize(searchQuery);

    const list = !query
      ? people
      : people.filter((person) => {
          const haystack = normalize(
            `${person.display_name} ${person.email ?? ''} ${person.phone ?? ''}`
          );

          return haystack.includes(query);
        });

    return list.slice(0, 12);
  }, [people, searchQuery]);

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

  function selectPerson(person: PersonOption) {
    setSelectedPersonId(person.id);
    setSearchQuery(person.display_name);
    setPrimaryName(person.display_name);
    setPrimaryEmail(person.email ?? '');
    setPrimaryPhone(person.phone ?? '');
    setShowResults(false);
    setHighlightedIndex(-1);
  }

  function clearSelectedPerson() {
    setSelectedPersonId('');
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showResults && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setShowResults(true);
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filteredPeople.length === 0) {
        return;
      }
      setHighlightedIndex((current) =>
        current < filteredPeople.length - 1 ? current + 1 : 0
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filteredPeople.length === 0) {
        return;
      }
      setHighlightedIndex((current) =>
        current > 0 ? current - 1 : filteredPeople.length - 1
      );
      return;
    }

    if (event.key === 'Enter') {
      if (showResults && highlightedIndex >= 0 && filteredPeople[highlightedIndex]) {
        event.preventDefault();
        selectPerson(filteredPeople[highlightedIndex]);
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
          <span className="qv-label">Find person</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setShowResults(true);
              setHighlightedIndex(0);
              clearSelectedPerson();
            }}
            onFocus={() => {
              setShowResults(true);
              setHighlightedIndex(filteredPeople.length > 0 ? 0 : -1);
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
            {filteredPeople.length === 0 ? (
              <div
                style={{
                  padding: 12,
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                }}
              >
                No matching people found.
              </div>
            ) : (
              filteredPeople.map((person, index) => {
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    key={person.id}
                    ref={(node) => {
                      resultRefs.current[index] = node;
                    }}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectPerson(person);
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
                      <span>{person.display_name}</span>

                      <span
                        style={{
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        {person.email ? <span>{person.email}</span> : <span>No Email</span>}
                        {person.phone ? <span>{person.phone}</span> : <span>No phone #</span>}
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