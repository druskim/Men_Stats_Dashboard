import React, { useState } from 'react'
import { computeStats } from '../utils.js'

const W = 420
const H = 280
const CX = 40
const CY = 20
const CW = W - 80
const CH = H - 60
const POSITIONS = [1, 2, 3, 4, 5]

function posToX(pos) {
  return CX + ((pos - 1) / 4) * CW
}

export default function CourtMap({ shots, title, teamName, activeOrigin, onPositionClick }) {
  const [tooltip, setTooltip] = useState(null)

  const byOrigin = {}
  for (const shot of shots) {
    if (!shot.shotOrigin) continue
    if (!byOrigin[shot.shotOrigin]) byOrigin[shot.shotOrigin] = []
    byOrigin[shot.shotOrigin].push(shot)
  }

  const maxShots = Math.max(...POSITIONS.map(p => (byOrigin[p] || []).length), 1)

  return (
    <div className="card">
      <h3 className="card-title">
        {title}
        {activeOrigin !== 'All' && (
          <span style={{ marginLeft: 8, fontSize: 12, color: '#f59e0b', fontWeight: 400 }}>
            — Pos {activeOrigin} selected (click again to clear)
          </span>
        )}
      </h3>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        <rect x={CX} y={CY} width={CW} height={CH}
          fill="#1e3a5f" stroke="#2d6a9f" strokeWidth={2} rx={2} />
        <line x1={CX} y1={CY + CH / 2} x2={CX + CW} y2={CY + CH / 2}
          stroke="#2d6a9f" strokeWidth={1} strokeDasharray="6,4" />
        <line x1={CX} y1={CY + CH - 1} x2={CX + CW} y2={CY + CH - 1}
          stroke="#f59e0b" strokeWidth={2} />

        {POSITIONS.map(pos => {
          const posShots = byOrigin[pos] || []
          const total = posShots.length
          const isActive = activeOrigin === pos
          const px = posToX(pos)
          const py = CY + CH * 0.65

          if (total === 0) {
            return (
              <g key={pos} style={{ cursor: onPositionClick ? 'pointer' : 'default' }}
                onClick={() => onPositionClick && onPositionClick(pos)}>
                <circle cx={px} cy={py} r={12}
                  fill={isActive ? '#f59e0b' : '#1f2937'}
                  stroke={isActive ? '#f59e0b' : '#374151'}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  fillOpacity={isActive ? 0.3 : 0.6} />
                <text x={px} y={py} textAnchor="middle" dominantBaseline="middle"
                  fill="#6b7280" fontSize={10}>0</text>
                <text x={px} y={CY + CH + 16} textAnchor="middle"
                  fill="#6b7280" fontSize={11}>{pos}</text>
              </g>
            )
          }

          const stats = computeStats(posShots)
          const radius = 14 + (total / maxShots) * 28
          const rate = parseFloat(stats.goalRate)
          const hue = isActive
            ? '#f59e0b'
            : rate > 15 ? '#22c55e' : rate > 8 ? '#f59e0b' : '#ef4444'

          return (
            <g key={pos}
              style={{ cursor: onPositionClick ? 'pointer' : 'default' }}
              onClick={() => onPositionClick && onPositionClick(pos)}
              onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, pos, stats })}
              onMouseLeave={() => setTooltip(null)}>
              <circle cx={px} cy={py} r={radius}
                fill={hue} fillOpacity={isActive ? 0.45 : 0.25}
                stroke={hue} strokeWidth={isActive ? 3 : 2} />
              {isActive && (
                <circle cx={px} cy={py} r={radius + 5}
                  fill="none" stroke={hue} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.6} />
              )}
              <text x={px} y={py - 6} textAnchor="middle" dominantBaseline="middle"
                fill="#f1f5f9" fontSize={11} fontWeight={600}>{total}</text>
              <text x={px} y={py + 8} textAnchor="middle" dominantBaseline="middle"
                fill="#94a3b8" fontSize={9}>{stats.goals}G</text>
              <text x={px} y={CY + CH + 16} textAnchor="middle"
                fill={isActive ? '#f59e0b' : '#9ca3af'} fontSize={11} fontWeight={isActive ? 700 : 500}>
                Pos {pos}
              </text>
            </g>
          )
        })}

        <text x={CX + CW / 2} y={CY + CH + 32} textAnchor="middle"
          fill="#f59e0b" fontSize={11} fontWeight={600}>▼ GOAL ▼</text>
        <text x={CX + CW / 2} y={CY + CH / 2}
          textAnchor="middle" dominantBaseline="middle"
          fill="#2d6a9f" fontSize={13} fontWeight={600} fillOpacity={0.5}>
          {teamName ? `${teamName.toUpperCase()} ATTACK` : 'ATTACK HALF'}
        </text>
      </svg>

      <div className="court-legend">
        <span className="court-legend-item">Bubble size = shot volume · Click a position to filter</span>
        <span className="court-legend-item">
          Color = goal rate
          {' '}<span style={{ color: '#22c55e' }}>■</span> &gt;15%
          {' '}<span style={{ color: '#f59e0b' }}>■</span> 8–15%
          {' '}<span style={{ color: '#ef4444' }}>■</span> &lt;8%
        </span>
      </div>

      {tooltip && <TooltipBox tooltip={tooltip} />}
    </div>
  )
}

function TooltipBox({ tooltip }) {
  const { pos, stats } = tooltip
  return (
    <div className="tooltip" style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}>
      <div><strong>Position {pos}</strong></div>
      <div>Total shots: {stats.total}</div>
      <div>Goals: {stats.goals}</div>
      <div>Saves: {stats.saves + stats.bcSaves}</div>
      <div>Out: {stats.out}</div>
      <div>Goal rate: {stats.goalRate}%</div>
    </div>
  )
}
