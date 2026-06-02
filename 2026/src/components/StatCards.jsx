import React from 'react'

export default function StatCards({ offense, defense, onCardClick, activeOutcomes = [] }) {
  function isActive(outcomes) {
    return outcomes.length === activeOutcomes.length &&
      outcomes.every(o => activeOutcomes.includes(o))
  }

  return (
    <div className="stat-grid">
      <StatCard
        label="Canada Goals"
        value={offense.goals}
        sub={`${offense.conversionRate}% conversion`}
        accent="#22c55e"
        active={isActive(['Goal Canada'])}
        onClick={() => onCardClick && onCardClick(['Goal Canada'])}
      />
      <StatCard
        label="Total Shots"
        value={offense.total}
        sub={`${offense.out} out of bounds`}
        accent="#3b82f6"
      />
      <StatCard
        label="Goals Against"
        value={defense.goalsAgainst}
        sub={`from ${defense.total} opp shots`}
        accent="#ef4444"
        active={isActive(['Goal Opponent'])}
        onClick={() => onCardClick && onCardClick(['Goal Opponent'])}
      />
      <StatCard
        label="Canada Saves"
        value={defense.saves}
        sub={`+${defense.opponentOut} opp out | ${defense.saveRate}% stop rate`}
        accent="#3b82f6"
        active={isActive(['Canada Save', 'Canada Ball Control Save'])}
        onClick={() => onCardClick && onCardClick(['Canada Save', 'Canada Ball Control Save'])}
      />
    </div>
  )
}

function StatCard({ label, value, sub, accent, onClick, active }) {
  return (
    <div
      className="stat-card"
      style={{
        borderTopColor: accent,
        cursor: onClick ? 'pointer' : 'default',
        outline: active ? `2px solid ${accent}` : 'none',
        outlineOffset: '-2px',
      }}
      onClick={onClick}
    >
      <div className="stat-value" style={{ color: accent }}>{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-sub">{active ? 'Click to clear filter' : sub}</div>
    </div>
  )
}
