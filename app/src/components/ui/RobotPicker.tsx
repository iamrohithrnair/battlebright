'use client';

import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export interface RobotPickerProps {
  /** Visible label — every input in the app gets a real <label>. */
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: string[];
  /** Names to grey out (e.g. the bot already chosen on the other side). */
  disabledOptions?: string[];
  placeholder?: string;
  /** Small accent bar shown next to the label, e.g. a weapon-class colour. */
  accent?: string;
  className?: string;
  /** Hint text under the field. */
  hint?: string;
}

/**
 * Searchable single-select combobox. Built by hand rather than pulled from a
 * library so it can match the instrument-panel styling and stay keyboard-first.
 */
export function RobotPicker({
  label,
  value,
  onChange,
  options,
  disabledOptions = [],
  placeholder = 'Search robots…',
  accent,
  className,
  hint,
}: RobotPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputId = useId();
  const listId = useId();

  const disabled = useMemo(() => new Set(disabledOptions), [disabledOptions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery('');
  }, [open]);

  // Keep the highlighted option scrolled into view during keyboard nav.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  useEffect(() => setActive(0), [query]);

  const commit = (name: string) => {
    if (disabled.has(name)) return;
    onChange(name);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActive((i) => {
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
        if (next < 0) return filtered.length - 1;
        if (next >= filtered.length) return 0;
        return next;
      });
      return;
    }
    if (e.key === 'Enter' && open && filtered[active]) {
      e.preventDefault();
      commit(filtered[active]);
    }
  };

  return (
    <div className={cn('relative', className)} ref={rootRef}>
      <label
        htmlFor={inputId}
        className="label-mono mb-1.5 flex items-center gap-2"
        onClick={() => setOpen(true)}
      >
        {accent ? (
          <span
            aria-hidden="true"
            className="h-2.5 w-0.5 rounded-full"
            style={{ backgroundColor: accent }}
          />
        ) : null}
        {label}
      </label>

      <button
        type="button"
        id={inputId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={cn(
          'flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md border bg-pit-850 px-3 text-left transition-colors duration-200',
          open ? 'border-volt/70' : 'border-pit-600 hover:border-pit-500',
        )}
      >
        <span
          className={cn(
            'truncate font-display text-sm font-medium',
            value ? 'text-ink' : 'text-ink-mute',
          )}
        >
          {value || 'Select a robot'}
        </span>
        <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-mute" />
      </button>

      {hint ? <p className="mt-1.5 text-xs text-ink-mute">{hint}</p> : null}

      {open ? (
        <div className="z-overlay absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-md border border-pit-500 bg-pit-900 shadow-panel">
          <div className="relative border-b border-pit-600">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              aria-label={`Search within ${label}`}
              className="h-11 w-full bg-transparent pl-9 pr-9 font-sans text-sm text-ink placeholder:text-ink-mute focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-ink-mute transition-colors duration-200 hover:bg-pit-800 hover:text-ink"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            className="max-h-64 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-ink-mute">
                No robot matches “{query}”.
              </li>
            ) : (
              filtered.map((name, i) => {
                const isDisabled = disabled.has(name);
                const isSelected = name === value;
                return (
                  <li key={name}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={isDisabled}
                      data-active={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => commit(name)}
                      className={cn(
                        'flex min-h-[40px] w-full items-center justify-between gap-2 px-3 py-2 text-left font-display text-sm transition-colors duration-150',
                        i === active && !isDisabled && 'bg-pit-800',
                        isSelected ? 'text-ember-light' : 'text-ink-soft',
                        isDisabled && 'cursor-not-allowed text-ink-mute/50',
                      )}
                    >
                      <span className="truncate">{name}</span>
                      {isSelected ? (
                        <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
                      ) : isDisabled ? (
                        <span className="font-mono text-[10px] uppercase tracking-widest">
                          in use
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
