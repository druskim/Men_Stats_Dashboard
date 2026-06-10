export const CANADA_PLAYERS = ['Blair', 'Harry', 'Mason', 'Nick', 'Peter', 'Raki']

export const OUTCOME_GROUPS = {
  CANADA_GOAL: ['Goal Canada'],
  OPPONENT_GOAL: ['Goal Opponent'],
  CANADA_SAVE: ['Canada Save', 'Canada Ball Control Save'],
  OPPONENT_SAVE: ['Opponent Save'],
  CANADA_OUT: ['Canada Out'],
  OPPONENT_OUT: ['Opponent Out'],
  OTHER: ['High Ball', 'Long Ball', 'Other Penalty'],
}

export function isCanadaPlayer(name) {
  return CANADA_PLAYERS.includes(name)
}

export function parseRows(text) {
  const lines = text.trim().split('\n')
  const rows = []
  let currentPeriod = 1

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t').map(s => s.trim())
    if (cols.length < 2) continue

    const opponent = cols[0] || ''
    const category = cols[1] || ''
    const start = cols[2] || ''
    const tournament = cols[5] || ''
    const attackingPlayer = cols[6] || ''
    const shotOriginRaw = cols[7] || ''
    const shotOutcome = cols[8] || ''
    const shotLocationRaw = cols[9] || ''
    const defendingPlayer = cols[10] || ''

    // Period tracking
    if (category === '@@@P1') { currentPeriod = 1; continue }
    if (category === '@@@P2') { currentPeriod = 2; continue }
    if (category === 'T-START' || category === 'T-END') continue

    const isPenalty =
      category === 'Penalty Shot Canada' ||
      category === 'Penalty Shot Opponent' ||
      category === 'Penalty Shot'

    const isShotRow =
      category === 'Shot Canada' ||
      category === 'Shot Opponent' ||
      isPenalty

    if (!isShotRow || !opponent) continue

    const descriptor = cols[11] || ''
    const shotOrigin = shotOriginRaw !== '' ? parseInt(shotOriginRaw) : null
    const shotLocation = shotLocationRaw !== '' ? parseFloat(shotLocationRaw) : null

    // Determine attack direction
    let isCanadaAttack
    if (category === 'Shot Canada' || category === 'Penalty Shot Canada') {
      isCanadaAttack = true
    } else if (category === 'Shot Opponent' || category === 'Penalty Shot Opponent') {
      isCanadaAttack = false
    } else {
      // 'Penalty Shot' — infer from attacking player
      isCanadaAttack = isCanadaPlayer(attackingPlayer)
    }

    // Detect own goal: only when 'Goal Opponent' is explicitly set in the descriptor column
    const isOwnGoal = !isCanadaAttack && descriptor === 'Goal Opponent'

    // Infer empty outcomes from location
    let outcome = isOwnGoal ? 'Goal Opponent' : shotOutcome
    if (!outcome && shotLocation !== null && shotLocation >= 1 && shotLocation <= 5) {
      outcome = isCanadaAttack ? 'Opponent Save' : 'Canada Save'
    }

    rows.push({
      opponent,
      category,
      start,
      tournament,
      attackingPlayer,
      shotOrigin,
      shotOutcome: outcome,
      shotLocation,
      defendingPlayer,
      isCanadaAttack,
      isPenalty,
      isOwnGoal,
      period: currentPeriod,
    })
  }

  return rows
}

export function getOutcomeColor(outcome) {
  if (!outcome) return '#6b7280'
  if (outcome === 'Goal Canada') return '#22c55e'
  if (outcome === 'Goal Opponent') return '#ef4444'
  if (outcome === 'Canada Save' || outcome === 'Canada Ball Control Save') return '#3b82f6'
  if (outcome === 'Opponent Save') return '#f59e0b'
  if (outcome === 'Canada Out' || outcome === 'Opponent Out') return '#6b7280'
  return '#6b7280'
}

export function computeOffensiveStats(shots) {
  const total = shots.length
  const goals = shots.filter(s => s.shotOutcome === 'Goal Canada').length
  const saved = shots.filter(s => s.shotOutcome === 'Opponent Save').length
  const out = shots.filter(s => s.shotOutcome === 'Canada Out').length
  const conversionRate = total > 0 ? ((goals / total) * 100).toFixed(1) : '0.0'

  return { total, goals, saved, out, conversionRate }
}

export function computeDefensiveStats(shots) {
  const total = shots.length
  const goalsAgainst = shots.filter(s => s.shotOutcome === 'Goal Opponent').length
  const ballControlSaves = shots.filter(s => s.shotOutcome === 'Canada Ball Control Save').length
  const saves = shots.filter(s =>
    s.shotOutcome === 'Canada Save' || s.shotOutcome === 'Canada Ball Control Save'
  ).length
  const opponentOut = shots.filter(s => s.shotOutcome === 'Opponent Out').length
  const saveRate = total > 0 ? (((total - goalsAgainst) / total) * 100).toFixed(1) : '0.0'
  const ballControlRate = saves > 0 ? ((ballControlSaves / saves) * 100).toFixed(1) : '0.0'

  return { total, goalsAgainst, saves, ballControlSaves, ballControlRate, opponentOut, saveRate }
}

export function groupByField(rows, field) {
  const map = {}
  for (const row of rows) {
    const key = row[field] || 'Unknown'
    if (!map[key]) map[key] = []
    map[key].push(row)
  }
  return map
}

const STAGE_ORDER = { PL: 1, QF: 2, SF: 3, BMG: 4, GMG: 5 }

export function tournamentSortKey(t) {
  if (!t) return 0
  for (const word of t.split(' ')) {
    const u = word.toUpperCase()
    if (u in STAGE_ORDER) return STAGE_ORDER[u]
    if (/^G\d+$/i.test(word)) return 0
  }
  return 0
}

export function getUniqueValues(rows, field) {
  return [...new Set(rows.map(r => r[field]).filter(Boolean))]
    .sort((a, b) => tournamentSortKey(a) - tournamentSortKey(b) || a.localeCompare(b))
}
