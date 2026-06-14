import { writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const gamesDir = join(__dirname, '../public/games')
const outputPath = join(__dirname, '../public/data.tsv')

const HEADER = 'Opponent/Game\tCategory\tStart\tClick\tEnd\tXY\tAttacking Player\tShot Origin\tShot Outcome\tShot Location\tDefending Player\tDescriptor'

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
  'des 6':            'descriptor',
}

// Normalise category values from the new format to the original parser format
const CATEGORY_MAP = {
  'canada':   'Shot Canada',
  'opponent': 'Shot Opponent',
}

const OUTPUT_FIELDS = [
  'opponent', 'category', 'start', 'click', 'end',
  'tournament', 'attackingPlayer', 'shotOrigin',
  'shotOutcome', 'shotLocation', 'defendingPlayer', 'descriptor',
]

// Extract opponent and tournament label from filename.
//
// New format: TEAMA_TEAMB_GameType_Tournament_Year_Gender.xlsx
//   Canada can be in either position; identified by the 'CAN' code.
//   e.g. CAN_TUR_Preliminary_Worlds_2026_M.xlsx
//     → opponent: TUR, tournament: Worlds Preliminary 2026 M
//
// Legacy format: Canada_OPPONENT_G#_TOURNAMENT_YEAR.xlsx
//   e.g. Canada_Korea_G1_IBSA_Americas_2026.xlsx
//     → opponent: Korea, tournament: IBSA Americas G1 2026
function extractGameInfo(filename) {
  const base = filename.replace(/\.(xlsx|xls)$/i, '').replace(/^~\$/, '')
  const parts = base.split('_')

  // New format: last part is gender (M/W), second-to-last is a 4-digit year
  if (
    parts.length >= 5 &&
    /^[mw]$/i.test(parts[parts.length - 1]) &&
    /^\d{4}$/.test(parts[parts.length - 2])
  ) {
    const teamA = parts[0].toUpperCase()
    const teamB = parts[1].toUpperCase()
    const opponent = /^CAN(ADA)?$/i.test(teamA) ? teamB : teamA
    const gameType = parts[2]
    const year = parts[parts.length - 2]
    const gender = parts[parts.length - 1].toUpperCase()
    const tournamentParts = parts.slice(3, parts.length - 2)
    const tournament = [...tournamentParts, gameType, year, gender].join(' ')
    return { opponent, tournament }
  }

  // Legacy format: Canada_OPPONENT_G#_TOURNAMENT_YEAR.xlsx
  if (parts.length >= 4 && parts[0].toLowerCase() === 'canada') {
    const opponent = parts[1]
    const gameNum = parts[2]                          // e.g. G1, G2
    const year = parts[parts.length - 1]
    const tournamentParts = parts.slice(3, parts.length - 1)
    const tournament = [...tournamentParts, gameNum, year].join(' ')
    return { opponent, tournament }
  }

  // Fallback
  const vsMatch = base.match(/[Vv][Ss][_ ]([^_]+)/i)
  const opponent = vsMatch ? vsMatch[1] : 'Unknown'
  const afterOpponent = vsMatch
    ? base.slice(base.indexOf(vsMatch[0]) + vsMatch[0].length).replace(/^[_ ]/, '')
    : base
  const tournament = afterOpponent.replace(/_/g, ' ').trim() || base.replace(/_/g, ' ')
  return { opponent, tournament }
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

function rowToTsv(row, colMap, opponent, tournament) {
  return OUTPUT_FIELDS.map(field => {
    if (field === 'opponent') return opponent
    if (field === 'tournament') {
      const raw = colMap.tournament !== undefined ? String(row[colMap.tournament] ?? '').trim() : ''
      return raw || tournament
    }
    if (field === 'category') {
      const raw = String(row[colMap.category] ?? '').trim()
      return CATEGORY_MAP[raw.toLowerCase()] || raw
    }
    const idx = colMap[field]
    if (idx === undefined) return ''
    const val = row[idx]
    return (val === null || val === undefined) ? '' : String(val).trim()
  }).join('\t')
}

if (!existsSync(gamesDir)) {
  mkdirSync(gamesDir, { recursive: true })
  writeFileSync(outputPath, HEADER + '\n')
  console.log('No games folder — wrote empty data.tsv')
  process.exit(0)
}

const files = readdirSync(gamesDir)
  .filter(f => f.match(/\.(xlsx|xls)$/i) && !f.startsWith('~$'))
  .sort()

if (files.length === 0) {
  writeFileSync(outputPath, HEADER + '\n')
  console.log('No game files found — wrote empty data.tsv')
  process.exit(0)
}

const allLines = [HEADER]

for (const file of files) {
  console.log(`Processing ${file}...`)
  const { opponent, tournament } = extractGameInfo(file)
  console.log(`  Opponent: ${opponent} | Tournament: ${tournament}`)
  try {
    const workbook = XLSX.readFile(join(gamesDir, file))
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

    const headerIdx = findHeaderRowIndex(rows)
    const colMap = buildColumnMap(rows[headerIdx])
    const dataRows = rows.slice(headerIdx + 1)

    let count = 0
    for (const row of dataRows) {
      if (!row || row.length < 2) continue
      const line = rowToTsv(row, colMap, opponent, tournament)
      if (line.replace(/\t/g, '').trim() === '') continue
      allLines.push(line)
      count++
    }
    console.log(`  → ${count} rows`)
  } catch (err) {
    console.error(`  Error reading ${file}: ${err.message}`)
  }
}

writeFileSync(outputPath, allLines.join('\n') + '\n')
console.log(`\nDone — ${allLines.length - 1} total rows from ${files.length} file(s)`)
