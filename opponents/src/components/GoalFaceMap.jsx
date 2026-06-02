import React, { useState } from 'react'
import { getOutcomeColor } from '../utils.js'

const W = 560
const H = 160
const MARGIN = { left: 40, right: 40, top: 20, bottom: 20 }
const GOAL_W = W - MARGIN.left - MARGIN.right
const GOAL_H = H - MARGIN.top - MARGIN.bottom

const LOCATIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
const SEC_W = GOAL_W / LOCATIONS.length

function locationToX(loc) {
  const idx = LOCATIONS.indexOf(loc)
  if (idx === -1) return null
  return MARGIN.left + idx * SEC_W + SEC_W / 2
}

export default function GoalFaceMap({ shots, title, activeLocation, onLocationClick }) {
  const [tooltip, setTooltip] = useState(null)

  const goalsInGoal = shots.filter(s => s.shotLocation >= 1 && s.shotLocation <= 5)
  const outLeft     = shots.filter(s => s.shotLocation === 0)
  const outRight    = shots.filter(s => s.shotLocation === 6)

  const sectionStats = LOCATIONS.map(sec => {
    const secShots = shots.filter(s => s.shotLocation === sec)
    const goals = secShots.filter(s => s.shotOutcome === 'Goal').length
    const saves = secShots.filter(s => s.shotOutcome === 'Save' || s.shotOutcome === 'Ball Control Save').length
    return { sec, total: secShots.length, goals, saves }
  })

  const maxTotal = Math.max(...sectionStats.map(s => s.total), 1)
  const isOutLeftActive  = activeLocation === 0
  const isOutRightActive = activeLocation === 6

  return (
    <div className="card">
      <h3 className="card-title">
        {title}
        {activeLocation !== 'All' && (
          <span style={{ marginLeft: 8, fontSize: 12, color: '#f59e0b', fontWeight: 400 }}>
            — {activeLocation === 0 ? 'Out Left' : activeLocation === 6 ? 'Out Right' : `Section ${activeLocation}`} selected (click again to clear)
          </span>
        )}
      </h3>
      <svg width="100%" viewBox={`0 0 ${W} ${H + 60}`} style={{ overflow: 'visible' }}>
        {/* Out left */}
        <rect x={0} y={MARGIN.top} width={MARGIN.left} height={GOAL_H}
          fill={isOutLeftActive ? 'rgba(245,158,11,0.2)' : '#1f2937'}
          stroke={isOutLeftActive ? '#f59e0b' : '#374151'}
          strokeWidth={isOutLeftActive ? 2 : 1}
          style={{ cursor: onLocationClick ? 'pointer' : 'default' }}
          onClick={() => onLocationClick && onLocationClick(0)} />
        <text x={MARGIN.left / 2} y={MARGIN.top + GOAL_H / 2} textAnchor="middle"
          dominantBaseline="middle"
          fill={isOutLeftActive ? '#f59e0b' : '#6b7280'}
          fontSize={10} fontWeight={600}
          style={{ pointerEvents: 'none' }}>OUT</text>

        {/* Goal sections */}
        {LOCATIONS.map((sec, idx) => {
          const x    = MARGIN.left + idx * SEC_W
          const stat = sectionStats[idx]
          const intensity = stat.total / maxTotal
          const isActive  = activeLocation === sec
          return (
            <g key={sec} style={{ cursor: onLocationClick ? 'pointer' : 'default' }}
              onClick={() => onLocationClick && onLocationClick(sec)}>
              <rect x={x} y={MARGIN.top} width={SEC_W} height={GOAL_H}
                fill={isActive
                  ? `rgba(245,158,11,${0.15 + intensity * 0.35})`
                  : `rgba(30,58,138,${0.15 + intensity * 0.5})`}
                stroke={isActive ? '#f59e0b' : '#1d4ed8'}
                strokeWidth={isActive ? 2.5 : 1.5} />
              <text x={x + SEC_W / 2} y={MARGIN.top + GOAL_H + 14}
                textAnchor="middle"
                fill={isActive ? '#f59e0b' : '#9ca3af'}
                fontSize={10} fontWeight={isActive ? 700 : 500}>{sec}</text>
              <text x={x + SEC_W / 2} y={MARGIN.top + GOAL_H + 28}
                textAnchor="middle"
                fill={isActive ? '#fcd34d' : '#d1d5db'}
                fontSize={9}>{stat.total}</text>
            </g>
          )
        })}

        {/* Goal posts */}
        <line x1={MARGIN.left}     y1={MARGIN.top}          x2={MARGIN.left}     y2={MARGIN.top + GOAL_H} stroke="#f59e0b" strokeWidth={3} />
        <line x1={W - MARGIN.right} y1={MARGIN.top}          x2={W - MARGIN.right} y2={MARGIN.top + GOAL_H} stroke="#f59e0b" strokeWidth={3} />
        <line x1={MARGIN.left}     y1={MARGIN.top}          x2={W - MARGIN.right} y2={MARGIN.top}          stroke="#f59e0b" strokeWidth={3} />
        <line x1={MARGIN.left}     y1={MARGIN.top + GOAL_H} x2={W - MARGIN.right} y2={MARGIN.top + GOAL_H} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4,4" />

        {/* Out right */}
        <rect x={W - MARGIN.right} y={MARGIN.top} width={MARGIN.right} height={GOAL_H}
          fill={isOutRightActive ? 'rgba(245,158,11,0.2)' : '#1f2937'}
          stroke={isOutRightActive ? '#f59e0b' : '#374151'}
          strokeWidth={isOutRightActive ? 2 : 1}
          style={{ cursor: onLocationClick ? 'pointer' : 'default' }}
          onClick={() => onLocationClick && onLocationClick(6)} />
        <text x={W - MARGIN.right / 2} y={MARGIN.top + GOAL_H / 2} textAnchor="middle"
          dominantBaseline="middle"
          fill={isOutRightActive ? '#f59e0b' : '#6b7280'}
          fontSize={10} fontWeight={600}
          style={{ pointerEvents: 'none' }}>OUT</text>

        {/* Shot dots */}
        {goalsInGoal.map((shot, i) => {
          const x = locationToX(shot.shotLocation)
          if (!x) return null
          const yRange  = GOAL_H - 20
          const seed    = i * 7919
          const yOffset = ((seed % 233) / 233 - 0.5) * yRange
          const y       = MARGIN.top + GOAL_H / 2 + yOffset
          return (
            <circle key={i} cx={x} cy={y} r={5}
              fill={getOutcomeColor(shot.shotOutcome)} fillOpacity={0.85}
              stroke="#000" strokeWidth={0.5}
              style={{ cursor: 'pointer' }}
              onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, shot })}
              onMouseLeave={() => setTooltip(null)} />
          )
        })}

        {/* Out left dots */}
        {outLeft.slice(0, 6).map((shot, i) => (
          <circle key={`outl-${i}`} cx={15} cy={MARGIN.top + 15 + i * 14} r={4}
            fill={getOutcomeColor(shot.shotOutcome)} fillOpacity={0.7} stroke="#000" strokeWidth={0.5} />
        ))}
        {outLeft.length > 6 && (
          <text x={15} y={MARGIN.top + 15 + 6 * 14} textAnchor="middle"
            fill="#9ca3af" fontSize={9}>+{outLeft.length - 6}</text>
        )}

        {/* Out right dots */}
        {outRight.slice(0, 6).map((shot, i) => (
          <circle key={`outr-${i}`} cx={W - 15} cy={MARGIN.top + 15 + i * 14} r={4}
            fill={getOutcomeColor(shot.shotOutcome)} fillOpacity={0.7} stroke="#000" strokeWidth={0.5} />
        ))}
        {outRight.length > 6 && (
          <text x={W - 15} y={MARGIN.top + 15 + 6 * 14} textAnchor="middle"
            fill="#9ca3af" fontSize={9}>+{outRight.length - 6}</text>
        )}

        <text x={W / 2} y={MARGIN.top + GOAL_H + 50}
          textAnchor="middle" fill="#6b7280" fontSize={11}>
          Goal Sections (1 = Left Post → 5 = Right Post) · Click a section to filter
        </text>
      </svg>

      <div className="legend">
        <LegendDot color="#22c55e" label="Goal" />
        <LegendDot color="#3b82f6" label="Ball Control Save" />
        <LegendDot color="#60a5fa" label="Save" />
        <LegendDot color="#6b7280" label="Out" />
        <LegendDot color="#f59e0b" label="High/Long Ball" />
      </div>

      {tooltip && (
        <div className="tooltip" style={{ left: tooltip.x + 10, top: tooltip.y - 30 }}>
          <div><strong>{tooltip.shot.attackingPlayer || 'Unknown'}</strong></div>
          <div>{tooltip.shot.shotOutcome}</div>
          <div>Origin: {tooltip.shot.shotOrigin} → Loc: {tooltip.shot.shotLocation}</div>
          <div className="tooltip-sub">{tooltip.shot.game} ({tooltip.shot.tournament})</div>
        </div>
      )}
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <div className="legend-item">
      <span className="legend-dot" style={{ background: color }} />
      <span>{label}</span>
    </div>
  )
}
