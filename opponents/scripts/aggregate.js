import { writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const gamesDir = join(__dirname, '../public/games')
const outputPath = join(__dirname, '../public/data.tsv')

const HEADER = 'Game\tCategory\tStart\tClick\tEnd\tTournament\tAttacking Player\tShot Origin\tShot Outcome\tShot Location\tDefending Player'

const HEADER_ALIASES = {
  'n#':               'shotNum',
  'opponent/game':    'opponent',
  'category':         'category',
  'start':            'start',
  'click':            'click',
  'end':              'end',
  'xy':               'tournament',
  'des 1':            'attackingPlayer',
  'attacking player': 'attackingPlayer',
  'des 2':            'shotOrigin',
  'shot origin':      'shotOrigin',
  'des 3':            'shotOutcome',
  'shot outcome':     'shotOutcome',
  'des 4':            'shotLocation',
  'shot location':    'shotLocation',
  'des 5':            'defendingPlayer',
  'defending player': 'defendingPlayer',
}

const OUTPUT_FIELDS = [
  'game', 'category', 'start', 'click', 'end',
  'tournament', 'attackingPlayer', 'shotOrigin',
  'shotOutcome', 'shotLocation', 'defendingPlayer',
]

// Canada_OPPONENT_[G#|QF|SF|GMG|BMG|PL]_TOURNAMENT_YEAR.xlsx
function isCanadaFormat(filename) {
  return filename.split('_')[0].toLowerCase() === 'canada'
}

function extractCanadaGameInfo(filename) {
  const base = filename.replace(/\.(xlsx|xls)$/i, '').replace(/^~\$/, '')
  const parts = base.split('_')
  const opponent = parts[1]
  const hasGameNum = /^(G\d+|QF|SF|GMG|BMG|PL)$/i.test(parts[2] || '')
  const gameNum = hasGameNum ? parts[2] : 'G1'
  const year = parts[parts.length - 1]
  const tournamentParts = hasGameNum ? parts.slice(3, parts.length - 1) : parts.slice(2, parts.length - 1)
  const tournament = [...tournamentParts, gameNum, year].join(' ')
  return { teamA: 'Canada', teamB: opponent, game: `Canada vs ${opponent}`, tournament }
}

// TEAMA_TEAMB_[G#|QF|SF|GMG|BMG|PL]_TOURNAMENT_YEAR.xlsx
function extractTeamGameInfo(filename) {
  const base = filename.replace(/\.(xlsx|xls)$/i, '').replace(/^~\$/, '')
  const parts = base.split('_')
  const teamA = parts[0]
  const teamB = parts[1]
  const hasGameNum = /^(G\d+|QF|SF|GMG|BMG|PL)$/i.test(parts[2] || '')
  const gameNum = hasGameNum ? parts[2] : 'G1'
  const year = parts[parts.length - 1]
  const tournamentParts = hasGameNum ? parts.slice(3, parts.length - 1) : parts.slice(2, parts.length - 1)
  const tournament = [...tournamentParts, gameNum, year].join(' ')
  return { teamA, teamB, game: `${teamA} vs ${teamB}`, tournament }
}

// Normalize outcome to attacker-perspective terms regardless of team names in the string.
// "Goal Canada", "Goal Opponent", "Goal A", "Goal Korea" etc. → "Goal"
// "Canada Save", "Opponent Save", "Team B Save" etc. → "Save"
// "Canada Ball Control Save", "Team A Ball Control Save" etc. → "Ball Control Save"
// "Canada Out", "Opponent Out" etc. → "Out"
function normalizeOutcome(raw) {
  if (!raw) return ''
  const o = raw.toLowerCase().trim()
  if (o.startsWith('goal')) return 'Goal'
  if (o.includes('ball control')) return 'Ball Control Save'
  if (o.includes('save')) return 'Save'
  if (o.includes('out')) return 'Out'
  if (o.includes('high ball')) return 'High Ball'
  if (o.includes('long ball')) return 'Long Ball'
  return raw.trim()
}

function tagPlayer(name, team) {
  if (!name || !name.trim()) return ''
  return `${team} - ${name.trim()}`
}

// Returns { category, attacker, defender } for shot rows, or null for non-shot rows.
function mapCategory(raw, teamA, teamB, isCanada) {
  const r = raw.toLowerCase().trim()

  if (isCanada) {
    if (r === 'canada' || r === 'shot canada')
      return { category: `Shot ${teamA}`, attacker: teamA, defender: teamB }
    if (r === 'opponent' || r === 'shot opponent')
      return { category: `Shot ${teamB}`, attacker: teamB, defender: teamA }
    if (r === 'penalty shot canada')
      return { category: `Penalty Shot ${teamA}`, attacker: teamA, defender: teamB }
    if (r === 'penalty shot opponent')
      return { category: `Penalty Shot ${teamB}`, attacker: teamB, defender: teamA }
    // Ambiguous "Penalty Shot" — default to Canada (teamA)
    if (r === 'penalty shot')
      return { category: `Penalty Shot ${teamA}`, attacker: teamA, defender: teamB }
  } else {
    // TEAMA_TEAMB format: categories are "Team A", "Team B", "Penalty Shot A", "Penalty Shot B"
    if (r === 'team a')
      return { category: `Shot ${teamA}`, attacker: teamA, defender: teamB }
    if (r === 'team b')
      return { category: `Shot ${teamB}`, attacker: teamB, defender: teamA }
    if (r === 'penalty shot a')
      return { category: `Penalty Shot ${teamA}`, attacker: teamA, defender: teamB }
    if (r === 'penalty shot b')
      return { category: `Penalty Shot ${teamB}`, attacker: teamB, defender: teamA }
  }

  return null
}

function findHeaderRowIndex(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    if (!row) continue
    const first = String(row[0] ?? '').toLowerCase().trim()
    if (first.includes('opponent') || first === 'n#') return i
  }
  return 0
}

function buildColumnMap(headerRow) {
  const map = {}
  headerRow.forEach((cell, idx) => {
    const key = String(cell ?? '').toLowerCase().trim()
    const field = HEADER_ALIASES[key]
    if (field) map[field] = idx
  })
  return map
}

function rowToTsvLine(row, colMap, gameInfo, isCanada) {
  const { teamA, teamB, game, tournament } = gameInfo

  const rawCategory = String(row[colMap.category] ?? '').trim()
  if (!rawCategory) return null

  const r = rawCategory.toLowerCase()

  // Pass period markers and game markers through with the game field set
  if (r.startsWith('@@@') || r === 't-start' || r === 't-end') {
    const rawTournament = colMap.tournament !== undefined
      ? String(row[colMap.tournament] ?? '').trim()
      : ''
    return `${game}\t${rawCategory}\t\t\t\t${rawTournament || tournament}\t\t\t\t\t`
  }

  const mapped = mapCategory(rawCategory, teamA, teamB, isCanada)
  if (!mapped) return null

  const { category, attacker, defender } = mapped

  const rawAttacker   = colMap.attackingPlayer !== undefined ? String(row[colMap.attackingPlayer] ?? '').trim() : ''
  const rawDefender   = colMap.defendingPlayer !== undefined ? String(row[colMap.defendingPlayer] ?? '').trim() : ''
  const rawOutcome    = colMap.shotOutcome     !== undefined ? String(row[colMap.shotOutcome]     ?? '').trim() : ''
  const rawTournament = colMap.tournament      !== undefined ? String(row[colMap.tournament]      ?? '').trim() : ''

  const fields = {
    game,
    category,
    start:           colMap.start      !== undefined ? String(row[colMap.start]      ?? '').trim() : '',
    click:           colMap.click      !== undefined ? String(row[colMap.click]      ?? '').trim() : '',
    end:             colMap.end        !== undefined ? String(row[colMap.end]        ?? '').trim() : '',
    tournament:      rawTournament || tournament,
    attackingPlayer: rawAttacker  ? tagPlayer(rawAttacker, attacker) : '',
    shotOrigin:      colMap.shotOrigin !== undefined ? String(row[colMap.shotOrigin] ?? '').trim() : '',
    shotOutcome:     normalizeOutcome(rawOutcome),
    shotLocation:    colMap.shotLocation !== undefined ? String(row[colMap.shotLocation] ?? '').trim() : '',
    defendingPlayer: rawDefender  ? tagPlayer(rawDefender, defender) : '',
  }

  const line = OUTPUT_FIELDS.map(f => fields[f] ?? '').join('\t')
  return line.replace(/\t/g, '').trim() === '' ? null : line
}

// Scan these folders for game files. Canada dashboard folders are included so
// files don't need to be copied — drop them in one place and both dashboards update.
const GAME_DIRS = [
  join(__dirname, '../../2026/public/games'),
  join(__dirname, '../../2026-scrimmage/public/games'),
  join(__dirname, '../public/games'),  // TEAMA_TEAMB files specific to opponents
]

// Collect all XLSX files across all directories, deduplicating by filename.
const seenFiles = new Set()
const fileEntries = []  // { file, dir }

for (const dir of GAME_DIRS) {
  if (!existsSync(dir)) continue
  for (const file of readdirSync(dir).sort()) {
    if (!file.match(/\.(xlsx|xls)$/i) || file.startsWith('~$')) continue
    if (seenFiles.has(file)) continue
    seenFiles.add(file)
    fileEntries.push({ file, dir })
  }
}

if (fileEntries.length === 0) {
  writeFileSync(outputPath, HEADER + '\n')
  console.log('No game files found — wrote empty data.tsv')
  process.exit(0)
}

const allLines = [HEADER]

for (const { file, dir } of fileEntries) {
  console.log(`Processing ${file}...`)
  const isCanada = isCanadaFormat(file)
  const gameInfo = isCanada ? extractCanadaGameInfo(file) : extractTeamGameInfo(file)
  console.log(`  Format: ${isCanada ? 'Canada' : 'Team A vs Team B'}`)
  console.log(`  Teams: ${gameInfo.teamA} vs ${gameInfo.teamB} | Tournament: ${gameInfo.tournament}`)

  try {
    const workbook = XLSX.readFile(join(dir, file))
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

    const headerIdx = findHeaderRowIndex(rows)
    const colMap = buildColumnMap(rows[headerIdx])
    const dataRows = rows.slice(headerIdx + 1)

    let count = 0
    for (const row of dataRows) {
      if (!row || row.length < 2) continue
      const line = rowToTsvLine(row, colMap, gameInfo, isCanada)
      if (!line) continue
      allLines.push(line)
      count++
    }
    console.log(`  → ${count} rows`)
  } catch (err) {
    console.error(`  Error reading ${file}: ${err.message}`)
  }
}

writeFileSync(outputPath, allLines.join('\n') + '\n')
console.log(`\nDone — ${allLines.length - 1} total rows from ${fileEntries.length} file(s)`)
