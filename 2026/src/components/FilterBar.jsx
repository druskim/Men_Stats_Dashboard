import React, { useState, useRef, useEffect } from 'react'

export default function FilterBar({ filters, onChange, options }) {
  return (
    <div className="filter-bar">
      <MultiSelect
        label="Tournament"
        value={filters.tournament}
        options={options.tournaments}
        onChange={v => onChange({ ...filters, tournament: v })}
      />
      <MultiSelect
        label="Opponent"
        value={filters.opponent}
        options={options.opponents}
        onChange={v => onChange({ ...filters, opponent: v })}
      />
      <MultiSelect
        label="CA Player"
        value={filters.player}
        options={options.players}
        onChange={v => onChange({ ...filters, player: v })}
      />
      <MultiSelect
        label="Period"
        value={filters.period}
        options={['1', '2']}
        onChange={v => onChange({ ...filters, period: v })}
      />
      <MultiSelect
        label="Shot Outcome"
        value={filters.outcome}
        options={options.outcomes}
        onChange={v => onChange({ ...filters, outcome: v })}
      />
    </div>
  )
}

function MultiSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function toggle(opt) {
    if (value.includes(opt)) {
      onChange(value.filter(v => v !== opt))
    } else {
      onChange([...value, opt])
    }
  }

  const allSelected = options.length > 0 && value.length === options.length
  const someSelected = value.length > 0 && !allSelected

  function toggleAll() {
    if (allSelected) {
      onChange([])
    } else {
      onChange([...options])
    }
  }

  const buttonLabel =
    value.length === 0 ? 'All' :
    allSelected ? 'All (selected)' :
    value.length === 1 ? value[0] :
    `${value.length} selected`

  const hasSelection = value.length > 0

  return (
    <div className="filter-group" ref={ref} style={{ position: 'relative' }}>
      <label className="filter-label">{label}</label>
      <button
        className={`ms-btn ${open ? 'ms-btn--open' : ''} ${hasSelection ? 'ms-btn--active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="ms-btn-label">{buttonLabel}</span>
        <svg className="ms-btn-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="ms-dropdown">
          <div className="ms-header">
            <label className={`ms-option ms-select-all ${allSelected ? 'ms-option--checked' : ''}`}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected }}
                onChange={toggleAll}
                className="ms-checkbox"
              />
              <span style={{ fontWeight: 600 }}>Select All</span>
            </label>
            {hasSelection && (
              <button className="ms-clear" onClick={() => { onChange([]); setOpen(false) }}>
                Clear
              </button>
            )}
          </div>
          <div className="ms-divider" />
          <div className="ms-options">
            {options.map(opt => {
              const checked = value.includes(opt)
              return (
                <label key={opt} className={`ms-option ${checked ? 'ms-option--checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(opt)}
                    className="ms-checkbox"
                  />
                  <span>{opt}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
