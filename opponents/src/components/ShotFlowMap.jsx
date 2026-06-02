import React from 'react'

const W = 500
const H = 260
const LEFT_X = 90
const RIGHT_X = W - 90
const MARGIN_Y = 30
const POSITIONS = [1, 2, 3, 4, 5]
const STEP = (H - 2 * MARGIN_Y) / (POSITIONS.length - 1)

// Pos 1 at bottom, Pos 5 at top
function originY(pos) {
  return MARGIN_Y + (5 - pos) * STEP
}

// Pos 1 at top, Pos 5 at bottom
function landingY(pos) {
  return MARGIN_Y + (pos - 1) * STEP
}

function bucketLocation(loc) {
  if (loc === null || loc === undefined) return null
  if (loc === 0 || loc === 6) return null
  const rounded = Math.round(loc)
  if (rounded < 1 || rounded > 5) return null
  return rounded
}

export default function ShotFlowMap({ shots, title }) {
  const routes = {}
  for (const shot of shots) {
    if (!shot.shotOrigin) continue
    const loc = bucketLocation(shot.shotLocation)
    if (loc === null) continue
    const key = `${shot.shotOrigin}-${loc}`
    if (!routes[key]) routes[key] = { origin: shot.shotOrigin, landing: loc, count: 0, goals: 0 }
    routes[key].count++
    if (shot.shotOutcome === 'Goal') routes[key].goals++
  }

  const routeList = Object.values(routes).sort((a, b) => a.count - b.count)
  const maxCount = Math.max(...routeList.map(r => r.count), 1)

  const midX = (LEFT_X + RIGHT_X) / 2

  return (
    <div className="card">
      <h3 className="card-title">{title}</h3>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>

        {/* Column headers */}
        <text x={LEFT_X} y={MARGIN_Y - 14} textAnchor="middle"
          fill="#94a3b8" fontSize={11} fontWeight={600}>ORIGIN</text>
        <text x={RIGHT_X} y={MARGIN_Y - 14} textAnchor="middle"
          fill="#94a3b8" fontSize={11} fontWeight={600}>LANDING</text>

        {/* Routes — drawn back to front so thickest lines are on top */}
        {routeList.map(({ origin, landing, count, goals }) => {
          const x1 = LEFT_X, y1 = originY(origin)
          const x2 = RIGHT_X, y2 = landingY(landing)
          const t = count / maxCount
          const strokeWidth = 1 + t * 11
          const opacity = 0.12 + t * 0.78
          const goalRate = goals / count
          const color = goalRate > 0.2 ? '#ef4444' : goalRate > 0.1 ? '#f59e0b' : '#22c55e'

          return (
            <path
              key={`${origin}-${landing}`}
              d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              opacity={opacity}
              strokeLinecap="round"
            />
          )
        })}

        {/* Left nodes (origins) */}
        {POSITIONS.map(pos => (
          <g key={`orig-${pos}`}>
            <circle cx={LEFT_X} cy={originY(pos)} r={7}
              fill="#1e3a5f" stroke="#2d6a9f" strokeWidth={1.5} />
            <text x={LEFT_X - 14} y={originY(pos)} textAnchor="end" dominantBaseline="middle"
              fill="#9ca3af" fontSize={11}>Pos {pos}</text>
          </g>
        ))}

        {/* Right nodes (landings) */}
        {POSITIONS.map(pos => (
          <g key={`land-${pos}`}>
            <circle cx={RIGHT_X} cy={landingY(pos)} r={7}
              fill="#1e3a5f" stroke="#2d6a9f" strokeWidth={1.5} />
            <text x={RIGHT_X + 14} y={landingY(pos)} textAnchor="start" dominantBaseline="middle"
              fill="#9ca3af" fontSize={11}>Pos {pos}</text>
          </g>
        ))}
      </svg>

      <div className="court-legend">
        <span className="court-legend-item">Line thickness &amp; opacity = shot frequency · Color = goal rate on that route</span>
        <span className="court-legend-item">
          <span style={{ color: '#22c55e' }}>■</span> Low goal rate
          {' '}<span style={{ color: '#f59e0b' }}>■</span> Mid
          {' '}<span style={{ color: '#ef4444' }}>■</span> High goal rate
        </span>
      </div>
    </div>
  )
}
