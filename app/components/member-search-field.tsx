'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type MemberOption = {
  id: string;
  name: string;
  email: string | null;
  secondaryLabel?: string | null;
  searchText?: string | null;
};

type MemberSearchFieldProps = {
  name: string;
  label: string;
  members: MemberOption[];
  placeholder?: string;
  required?: boolean;
  labelHidden?: boolean;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export default function MemberSearchField({
  name,
  label,
  members,
  placeholder = 'Type a member name',
  required = false,
  labelHidden = false,
}: MemberSearchFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const filteredMembers = useMemo(() => {
    const query = normalize(searchQuery);

    const list = !query
      ? members
      : members.filter((member) => {
          const haystack = normalize(member.searchText || `${member.name} ${member.secondaryLabel || ''} ${member.email || ''}`);
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
    if (highlightedIndex < 0) return;
    resultRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  function selectMember(member: MemberOption) {
    setSelectedPersonId(member.id);
    setSearchQuery(member.name);
    setShowResults(false);
    setHighlightedIndex(-1);
  }

  function clearSelectedMember() {
    setSelectedPersonId('');
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showResults && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) setShowResults(true);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filteredMembers.length === 0) return;
      setHighlightedIndex((current) => (current < filteredMembers.length - 1 ? current + 1 : 0));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filteredMembers.length === 0) return;
      setHighlightedIndex((current) => (current > 0 ? current - 1 : filteredMembers.length - 1));
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
            clearSelectedMember();
          }}
          onFocus={() => {
            setShowResults(true);
            setHighlightedIndex(filteredMembers.length > 0 ? 0 : -1);
          }}
          onKeyDown={handleSearchKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          required={required}
        />
      </label>

      {showResults ? (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 6, border: '1px solid var(--divider)', borderRadius: 16, background: 'var(--bg-card)', padding: 8, display: 'grid', gap: 6, maxHeight: 300, overflowY: 'auto', boxShadow: '0 10px 24px rgba(0, 0, 0, 0.08)' }}>
          {filteredMembers.length === 0 ? (
            <div style={{ padding: 12, fontSize: 14, color: 'var(--text-secondary)' }}>No matching members found.</div>
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
                  style={{ justifyContent: 'flex-start', textAlign: 'left', width: '100%', borderColor: isHighlighted ? 'var(--text-primary)' : undefined, background: isHighlighted ? 'var(--bg-sunken)' : undefined }}
                >
                  <span style={{ display: 'grid', gap: 2 }}>
                    <span>{member.name}</span>
                    {member.secondaryLabel ? <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{member.secondaryLabel}</span> : null}
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
