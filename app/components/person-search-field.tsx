'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type PersonOption = {
  id: string;
  name: string;
  email: string | null;
  subtitle?: string | null;
  searchTokens?: string[];
};

type PersonSearchFieldProps = {
  name: string;
  label: string;
  members: PersonOption[];
  placeholder?: string;
  required?: boolean;
  labelHidden?: boolean;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function buildSearchHaystack(person: PersonOption) {
  return normalize(
    [
      person.name,
      person.email ?? '',
      ...(person.searchTokens ?? []),
    ].join(' ')
  );
}

export default function PersonSearchField({
  name,
  label,
  members: people,
  placeholder = 'Type a person name',
  required = false,
  labelHidden = false,
}: PersonSearchFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const filteredPeople = useMemo(() => {
    const query = normalize(searchQuery);

    const list = !query
      ? people
      : people.filter((person) => buildSearchHaystack(person).includes(query));

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

    resultRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  function selectPerson(person: PersonOption) {
    setSelectedPersonId(person.id);
    setSearchQuery(person.name);
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
      if (filteredPeople.length === 0) return;
      setHighlightedIndex((current) => (current < filteredPeople.length - 1 ? current + 1 : 0));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filteredPeople.length === 0) return;
      setHighlightedIndex((current) => (current > 0 ? current - 1 : filteredPeople.length - 1));
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
    <div ref={containerRef} className="qv-form-row" style={{ position: 'relative' }}>
      <input type="hidden" name={name} value={selectedPersonId} />

      <label className={`qv-control${labelHidden ? ' qv-control-label-hidden' : ''}`}>
        <span className="qv-label">{label}</span>
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
          placeholder={placeholder}
          autoComplete="off"
          required={required}
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
            background: 'var(--bg-card)',
            padding: 8,
            display: 'grid',
            gap: 6,
            maxHeight: 300,
            overflowY: 'auto',
            boxShadow: '0 10px 24px rgba(0, 0, 0, 0.08)',
          }}
        >
          {filteredPeople.length === 0 ? (
            <div style={{ padding: 12, fontSize: 14, color: 'var(--text-secondary)' }}>
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
                    paddingBlock: person.subtitle ? 10 : undefined,
                  }}
                >
                  <span style={{ display: 'grid', gap: person.subtitle ? 3 : 0 }}>
                    <span>{person.name}</span>
                    {person.subtitle ? (
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {person.subtitle}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
