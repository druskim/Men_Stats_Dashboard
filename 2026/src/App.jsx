import React, { useState, useEffect, useMemo } from 'react'
import { parseRows, computeOffensiveStats, computeDefensiveStats, getUniqueValues, tournamentSortKey, CANADA_PLAYERS } from './utils.js'
import FilterBar from './components/FilterBar.jsx'
import StatCards from './components/StatCards.jsx'
import GoalFaceMap from './components/GoalFaceMap.jsx'
import CourtMap from './components/CourtMap.jsx'
import {
  PlayerOffenseChart, PlayerDefenseChart,
  OriginEfficiencyChart, GameScoreTable
} from './components/Charts.jsx'
import ShotFlowMap from './components/ShotFlowMap.jsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts'

const TABS = ['Overview', 'Offense', 'Defense', 'Penalties', 'Players', 'By Period', 'Accuracy']

const DEFAULT_FILTERS = {
  tournament: [],
  opponent: [],
  player: [],
  period: [],
  outcome: [],
  shotOrigin: 'All',
  shotLocation: 'All',
}

export default function App() {
  const [rawRows, setRawRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Overview')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data.tsv')
      .then(r => r.text())
      .then(text => {
        setRawRows(parseRows(text))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const options = useMemo(() => ({
    tournaments: getUniqueValues(rawRows, 'tournament'),
    opponents: getUniqueValues(rawRows, 'opponent'),
    players: CANADA_PLAYERS,
    outcomes: getUniqueValues(rawRows, 'shotOutcome'),
  }), [rawRows])

  const filtered = useMemo(() => {
    return rawRows.filter(row => {
      if (filters.tournament.length > 0 && !filters.tournament.includes(row.tournament)) return false
      if (filters.opponent.length > 0 && !filters.opponent.includes(row.opponent)) return false
      if (filters.period.length > 0 && !filters.period.includes(String(row.period))) return false
      if (filters.player.length > 0) {
        const involved = filters.player.some(p => row.attackingPlayer === p || row.defendingPlayer === p)
        if (!involved) return false
      }
      if (filters.outcome.length > 0 && !filters.outcome.includes(row.shotOutcome)) return false
      if (filters.shotOrigin !== 'All' && row.shotOrigin !== filters.shotOrigin) return false
      if (filters.shotLocation !== 'All' && row.shotLocation !== filters.shotLocation) return false
      return true
    })
  }, [rawRows, filters])

  // Period-filter-free rows for the By Period tab so both halves always show
  const filteredNoPeriod = useMemo(() => {
    return rawRows.filter(row => {
      if (filters.tournament.length > 0 && !filters.tournament.includes(row.tournament)) return false
      if (filters.opponent.length > 0 && !filters.opponent.includes(row.opponent)) return false
      if (filters.player.length > 0) {
        const involved = filters.player.some(p => row.attackingPlayer === p || row.defendingPlayer === p)
        if (!involved) return false
      }
      if (filters.outcome.length > 0 && !filters.outcome.includes(row.shotOutcome)) return false
      if (filters.shotOrigin !== 'All' && row.shotOrigin !== filters.shotOrigin) return false
      if (filters.shotLocation !== 'All' && row.shotLocation !== filters.shotLocation) return false
      return true
    })
  }, [rawRows, filters])

  const offenseShots = useMemo(() => filtered.filter(r => r.isCanadaAttack && !r.isPenalty), [filtered])
  const defenseShots = useMemo(() => filtered.filter(r => !r.isCanadaAttack && !r.isPenalty && !r.isOwnGoal), [filtered])
  const offensePenalties = useMemo(() => filtered.filter(r => r.isCanadaAttack && r.isPenalty), [filtered])
  const defensePenalties = useMemo(() => filtered.filter(r => !r.isCanadaAttack && r.isPenalty), [filtered])
  const offenseShotsAll = useMemo(() => filtered.filter(r => r.isCanadaAttack), [filtered])

  const offenseStats = useMemo(() => computeOffensiveStats(offenseShots), [offenseShots])
  const defenseStats = useMemo(() => computeDefensiveStats(defenseShots), [defenseShots])

  const hasActiveFilters =
    filters.tournament.length > 0 ||
    filters.opponent.length > 0 ||
    filters.player.length > 0 ||
    filters.period.length > 0 ||
    filters.outcome.length > 0 ||
    filters.shotOrigin !== 'All' ||
    filters.shotLocation !== 'All'

  function handlePositionClick(pos) {
    setFilters(f => ({ ...f, shotOrigin: f.shotOrigin === pos ? 'All' : pos }))
  }

  function handleLocationClick(loc) {
    setFilters(f => ({ ...f, shotLocation: f.shotLocation === loc ? 'All' : loc }))
  }

  function handleStatCardClick(outcomes) {
    setFilters(f => {
      const alreadyActive = outcomes.length === f.outcome.length &&
        outcomes.every(o => f.outcome.includes(o))
      return { ...f, outcome: alreadyActive ? [] : outcomes }
    })
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <p>Loading match data…</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-logo">
          <div className="maple-leaf">🍁</div>
          <div>
            <h1>2026 Men's Goalball Stats Dashboard</h1>
            <p>Shot Map &amp; Efficiency Dashboard</p>
          </div>
        </div>
        <div className="header-meta">
          <span className="badge-info">{rawRows.length} shots tracked</span>
        </div>
      </header>

      <div className="filter-container">
        <FilterBar filters={filters} onChange={setFilters} options={options} />
        {hasActiveFilters && (
          <button className="clear-filters" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Clear all filters
          </button>
        )}
      </div>

      <StatCards offense={offenseStats} defense={defenseStats} onCardClick={handleStatCardClick} activeOutcomes={filters.outcome} />

      <div className="tab-nav">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <main className="tab-content">
        {activeTab === 'Overview' && (
          <OverviewTab offenseShots={offenseShots} defenseShots={defenseShots} allRows={filtered} />
        )}
        {activeTab === 'Offense' && (
          <OffenseTab shots={offenseShots} activeOrigin={filters.shotOrigin} onPositionClick={handlePositionClick} activeLocation={filters.shotLocation} onLocationClick={handleLocationClick} />
        )}
        {activeTab === 'Defense' && (
          <DefenseTab shots={defenseShots} activeOrigin={filters.shotOrigin} onPositionClick={handlePositionClick} activeLocation={filters.shotLocation} onLocationClick={handleLocationClick} />
        )}
        {activeTab === 'Penalties' && (
          <PenaltiesTab offensePenalties={offensePenalties} defensePenalties={defensePenalties} activeLocation={filters.shotLocation} onLocationClick={handleLocationClick} />
        )}
{activeTab === 'Players' && (
          <PlayersTab
            offenseShots={offenseShots}
            defenseShots={defenseShots}
            allShots={filtered.filter(r => !r.isPenalty)}
            offensePenalties={offensePenalties}
            defensePenalties={defensePenalties}
          />
        )}
        {activeTab === 'By Period' && (
          <ByPeriodTab allRows={filteredNoPeriod} />
        )}
        {activeTab === 'Accuracy' && (
          <AccuracyTab shots={offenseShotsAll} />
        )}
      </main>
    </div>
  )
}

function OverviewTab({ offenseShots, defenseShots, allRows }) {
  const offenseStats = useMemo(() => computeOffensiveStats(offenseShots), [offenseShots])
  const defenseStats = useMemo(() => computeDefensiveStats(defenseShots), [defenseShots])

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Offensive Efficiency</div>
          <div style={{ fontSize: 52, fontWeight: 800, color: '#22c55e', lineHeight: 1 }}>{offenseStats.conversionRate}%</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{offenseStats.goals} goals / {offenseStats.total} shots</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Defensive Efficiency</div>
          <div style={{ fontSize: 52, fontWeight: 800, color: '#3b82f6', lineHeight: 1 }}>{defenseStats.saveRate}%</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{defenseStats.saves} saves / {defenseStats.total} shots faced</div>
        </div>
      </div>
      <GameScoreTable allRows={allRows} />
    </div>
  )
}

function OffenseTab({ shots, activeOrigin, onPositionClick, activeLocation, onLocationClick }) {
  const offStats = computeOffensiveStats(shots)
  const accS = accStats(shots, 1)
  const [goalsOnly, setGoalsOnly] = useState(false)
  const displayShots = goalsOnly ? shots.filter(s => s.shotOutcome === 'Goal Canada') : shots

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Offensive Efficiency</div>
          <div style={{ fontSize: 52, fontWeight: 800, color: '#22c55e', lineHeight: 1 }}>{offStats.conversionRate}%</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{offStats.goals} goals / {offStats.total} shots</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Shot Accuracy</div>
          <div style={{ fontSize: 52, fontWeight: 800, color: '#3b82f6', lineHeight: 1 }}>{accS.pct}%</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{accS.accurate} accurate / {accS.total} located</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          className={`ms-btn${goalsOnly ? ' ms-btn--active' : ''}`}
          onClick={() => setGoalsOnly(v => !v)}
        >
          {goalsOnly ? 'Goals only' : 'All shots'}
        </button>
      </div>
      <ShotFlowMap shots={displayShots} title={goalsOnly ? 'Shot Flow — Canada Goals (Origin → Landing)' : 'Shot Flow — Canada Attack (Origin → Landing)'} goalOutcome="Goal Canada" />
      <div className="grid-2">
        <CourtMap shots={displayShots} title={goalsOnly ? 'Goal Origin Map (Canada Goals)' : 'Shot Origin Map (Canada Attack)'} isOffense={true} activeOrigin={activeOrigin} onPositionClick={onPositionClick} />
        <GoalFaceMap shots={displayShots} title={goalsOnly ? 'Goal Location Map (Canada Goals)' : 'Shot Location Map (Canada Shots)'} activeLocation={activeLocation} onLocationClick={onLocationClick} />
      </div>
    </div>
  )
}

function DefenseTab({ shots, activeOrigin, onPositionClick, activeLocation, onLocationClick }) {
  const defStats = computeDefensiveStats(shots)
  const [goalsOnly, setGoalsOnly] = useState(false)
  const displayShots = goalsOnly ? shots.filter(s => s.shotOutcome === 'Goal Opponent') : shots

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Defensive Efficiency</div>
          <div style={{ fontSize: 52, fontWeight: 800, color: '#3b82f6', lineHeight: 1 }}>{defStats.saveRate}%</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{defStats.saves} saves / {defStats.total} shots faced</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Ball Control</div>
          <div style={{ fontSize: 52, fontWeight: 800, color: '#60a5fa', lineHeight: 1 }}>{defStats.ballControlRate}%</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{defStats.ballControlSaves} BC saves / {defStats.saves} saves</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          className={`ms-btn${goalsOnly ? ' ms-btn--active' : ''}`}
          onClick={() => setGoalsOnly(v => !v)}
        >
          {goalsOnly ? 'Goals only' : 'All shots'}
        </button>
      </div>
      <ShotFlowMap shots={displayShots} title={goalsOnly ? 'Shot Flow — Goals Against (Origin → Landing)' : 'Shot Flow — Shots Against (Origin → Landing)'} goalOutcome="Goal Opponent" />
      <div className="grid-2">
        <CourtMap shots={displayShots} title={goalsOnly ? 'Goal Origin Map (Goals Against)' : 'Opponent Shot Origin Map'} isOffense={false} activeOrigin={activeOrigin} onPositionClick={onPositionClick} />
        <GoalFaceMap shots={displayShots} title={goalsOnly ? 'Goal Location Map (Goals Against)' : 'Shot Location Map (Shots Faced)'} activeLocation={activeLocation} onLocationClick={onLocationClick} />
      </div>
    </div>
  )
}

function PenaltiesTab({ offensePenalties, defensePenalties, activeLocation, onLocationClick }) {
  const offStats = computeOffensiveStats(offensePenalties)
  const defStats = computeDefensiveStats(defensePenalties)

  return (
    <div>
      <div className="grid-2">
        <div className="card">
          <h3 className="card-title">Canada Penalty Shots</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <StatItem label="Shots" value={offStats.total} />
            <StatItem label="Goals" value={offStats.goals} color="#22c55e" />
            <StatItem label="Conv%" value={`${offStats.conversionRate}%`} color="#22c55e" />
            <StatItem label="Saved" value={offStats.saved} />
            <StatItem label="Out" value={offStats.out} />
          </div>
          <GoalFaceMap shots={offensePenalties} title="Penalty Shot Locations (Canada)" activeLocation={activeLocation} onLocationClick={onLocationClick} />
        </div>
        <div className="card">
          <h3 className="card-title">Opponent Penalty Shots</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <StatItem label="Shots Faced" value={defStats.total} />
            <StatItem label="Goals Against" value={defStats.goalsAgainst} color="#ef4444" />
            <StatItem label="Stop%" value={`${defStats.saveRate}%`} color="#3b82f6" />
            <StatItem label="Saves" value={defStats.saves} color="#3b82f6" />
            <StatItem label="BC%" value={`${defStats.ballControlRate}%`} color="#60a5fa" />
            <StatItem label="Opp Out" value={defStats.opponentOut} />
          </div>
          <GoalFaceMap shots={defensePenalties} title="Penalty Shot Locations (Opponent)" activeLocation={activeLocation} onLocationClick={onLocationClick} />
        </div>
      </div>
      <PenaltyTable offensePenalties={offensePenalties} defensePenalties={defensePenalties} />
    </div>
  )
}

function StatItem({ label, value, color }) {
  return (
    <div style={{ background: '#0f172a', borderRadius: 6, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || '#f1f5f9' }}>{value}</div>
    </div>
  )
}

function PenaltyTable({ offensePenalties, defensePenalties }) {
  if (offensePenalties.length === 0 && defensePenalties.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Penalty Shot Log</h3>
        <p style={{ color: '#6b7280', textAlign: 'center', padding: '24px 0' }}>No penalty shots match current filters.</p>
      </div>
    )
  }
  const allPenalties = [...offensePenalties, ...defensePenalties].sort((a, b) => a.start < b.start ? -1 : 1)
  return (
    <div className="card">
      <h3 className="card-title">Penalty Shot Log</h3>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th><th>Attacker</th><th>Defender</th>
              <th>Origin</th><th>Location</th><th>Outcome</th>
              <th>Opponent</th><th>Tournament</th>
            </tr>
          </thead>
          <tbody>
            {allPenalties.map((shot, i) => (
              <tr key={i}>
                <td className="cell-muted">{shot.start || '—'}</td>
                <td className="player-name">{shot.attackingPlayer || '—'}</td>
                <td className="player-name">{shot.defendingPlayer || '—'}</td>
                <td>{shot.shotOrigin ?? '—'}</td>
                <td>{shot.shotLocation ?? '—'}</td>
                <td style={{ color: outcomeColor(shot.shotOutcome) }}>{shot.shotOutcome || '—'}</td>
                <td className="cell-muted">{shot.opponent}</td>
                <td className="cell-muted">{shot.tournament}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function outcomeColor(outcome) {
  if (outcome === 'Goal Canada') return '#22c55e'
  if (outcome === 'Goal Opponent') return '#ef4444'
  if (outcome === 'Canada Save' || outcome === 'Canada Ball Control Save') return '#3b82f6'
  if (outcome === 'Opponent Save') return '#f59e0b'
  return '#9ca3af'
}

function PlayersTab({ offenseShots, defenseShots, allShots, offensePenalties, defensePenalties }) {
  return (
    <PlayerDetailTable
      offenseShots={offenseShots}
      defenseShots={defenseShots}
      offensePenalties={offensePenalties}
      defensePenalties={defensePenalties}
    />
  )
}

function GoalLocationChart({ shots, isOffense }) {
  const data = [0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6].map(loc => {
    const locShots = shots.filter(s => s.shotLocation === loc)
    const goals = locShots.filter(s => s.shotOutcome === 'Goal Canada' || s.shotOutcome === 'Goal Opponent').length
    const label = loc === 0 ? 'Out L' : loc === 6 ? 'Out R' : String(loc)
    return { label, total: locShots.length, goals }
  })
  return (
    <div className="card">
      <h3 className="card-title">{isOffense ? 'Goals by Location (Canada)' : 'Goals Conceded by Location'}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
            labelStyle={{ color: '#f1f5f9' }}
            itemStyle={{ color: '#94a3b8' }}
          />
          <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="goals" name="Goals" fill={isOffense ? '#22c55e' : '#ef4444'} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ByPeriodTab({ allRows }) {
  const offenseShots = allRows.filter(r => r.isCanadaAttack)
  const defenseShots = allRows.filter(r => !r.isCanadaAttack && !r.isOwnGoal)

  const p1Off = offenseShots.filter(r => r.period === 1)
  const p2Off = offenseShots.filter(r => r.period === 2)
  const p1Def = defenseShots.filter(r => r.period === 1)
  const p2Def = defenseShots.filter(r => r.period === 2)

  const p1OffStats = computeOffensiveStats(p1Off)
  const p2OffStats = computeOffensiveStats(p2Off)
  const p1DefStats = computeDefensiveStats(p1Def)
  const p2DefStats = computeDefensiveStats(p2Def)

  const gamesMap = {}
  for (const row of [...offenseShots, ...defenseShots]) {
    const key = `${row.opponent}__${row.tournament}`
    if (!gamesMap[key]) gamesMap[key] = {
      opponent: row.opponent, tournament: row.tournament,
      p1: { caGoals: 0, oppGoals: 0, caShots: 0, oppShots: 0 },
      p2: { caGoals: 0, oppGoals: 0, caShots: 0, oppShots: 0 },
    }
    const pd = row.period === 2 ? 'p2' : 'p1'
    const g = gamesMap[key][pd]
    if (row.isCanadaAttack) {
      g.caShots++
      if (row.shotOutcome === 'Goal Canada') g.caGoals++
    } else {
      g.oppShots++
      if (row.shotOutcome === 'Goal Opponent') g.oppGoals++
    }
  }
  const gameList = Object.values(gamesMap).sort((a, b) =>
    tournamentSortKey(a.tournament) - tournamentSortKey(b.tournament) ||
    a.tournament.localeCompare(b.tournament) ||
    a.opponent.localeCompare(b.opponent)
  )

  return (
    <div>
      <div className="grid-2">
        <div className="card">
          <h3 className="card-title">Offense — 1st Half vs 2nd Half</h3>
          <PeriodStatTable rows={[
            { label: 'Shots', p1: p1OffStats.total, p2: p2OffStats.total, higher: null },
            { label: 'Goals', p1: p1OffStats.goals, p2: p2OffStats.goals, higher: true },
            { label: 'Saved', p1: p1OffStats.saved, p2: p2OffStats.saved, higher: false },
            { label: 'Out', p1: p1OffStats.out, p2: p2OffStats.out, higher: false },
            { label: 'Conv%', p1: `${p1OffStats.conversionRate}%`, p2: `${p2OffStats.conversionRate}%`, higher: true, raw1: parseFloat(p1OffStats.conversionRate), raw2: parseFloat(p2OffStats.conversionRate) },
          ]} />
        </div>
        <div className="card">
          <h3 className="card-title">Defense — 1st Half vs 2nd Half</h3>
          <PeriodStatTable rows={[
            { label: 'Shots Faced', p1: p1DefStats.total, p2: p2DefStats.total, higher: null },
            { label: 'Goals Against', p1: p1DefStats.goalsAgainst, p2: p2DefStats.goalsAgainst, higher: false },
            { label: 'Saves', p1: p1DefStats.saves, p2: p2DefStats.saves, higher: true },
            { label: 'BC Saves', p1: p1DefStats.ballControlSaves, p2: p2DefStats.ballControlSaves, higher: true },
            { label: 'BC%', p1: `${p1DefStats.ballControlRate}%`, p2: `${p2DefStats.ballControlRate}%`, higher: true, raw1: parseFloat(p1DefStats.ballControlRate), raw2: parseFloat(p2DefStats.ballControlRate) },
            { label: 'Stop%', p1: `${p1DefStats.saveRate}%`, p2: `${p2DefStats.saveRate}%`, higher: true, raw1: parseFloat(p1DefStats.saveRate), raw2: parseFloat(p2DefStats.saveRate) },
          ]} />
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Per-Game Period Breakdown</h3>
        {gameList.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '24px 0' }}>No data matches current filters.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Opponent</th>
                  <th>Tournament</th>
                  <th style={{ color: '#3b82f6' }}>P1 Score</th>
                  <th style={{ color: '#a78bfa' }}>P2 Score</th>
                  <th>Final</th>
                  <th>Result</th>
                  <th style={{ color: '#3b82f6' }}>P1 CA Shots</th>
                  <th style={{ color: '#a78bfa' }}>P2 CA Shots</th>
                  <th style={{ color: '#3b82f6' }}>P1 Opp Shots</th>
                  <th style={{ color: '#a78bfa' }}>P2 Opp Shots</th>
                </tr>
              </thead>
              <tbody>
                {gameList.map((g, i) => {
                  const totalCA = g.p1.caGoals + g.p2.caGoals
                  const totalOpp = g.p1.oppGoals + g.p2.oppGoals
                  const result = totalCA > totalOpp ? 'W' : totalCA < totalOpp ? 'L' : 'D'
                  const resultColor = result === 'W' ? '#22c55e' : result === 'L' ? '#ef4444' : '#f59e0b'
                  return (
                    <tr key={i}>
                      <td>{g.opponent}</td>
                      <td className="cell-muted">{g.tournament}</td>
                      <td className="cell-score" style={{ color: '#3b82f6' }}>{g.p1.caGoals} – {g.p1.oppGoals}</td>
                      <td className="cell-score" style={{ color: '#a78bfa' }}>{g.p2.caGoals} – {g.p2.oppGoals}</td>
                      <td className="cell-score">{totalCA} – {totalOpp}</td>
                      <td><span className="badge" style={{ color: resultColor, borderColor: resultColor }}>{result}</span></td>
                      <td className="cell-muted">{g.p1.caShots}</td>
                      <td className="cell-muted">{g.p2.caShots}</td>
                      <td className="cell-muted">{g.p1.oppShots}</td>
                      <td className="cell-muted">{g.p2.oppShots}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function PeriodStatTable({ rows }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th style={{ color: '#3b82f6' }}>1st Half</th>
          <th style={{ color: '#a78bfa' }}>2nd Half</th>
          <th>Δ P2</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ label, p1, p2, higher, raw1, raw2 }) => {
          const v1 = raw1 !== undefined ? raw1 : (typeof p1 === 'number' ? p1 : parseFloat(p1))
          const v2 = raw2 !== undefined ? raw2 : (typeof p2 === 'number' ? p2 : parseFloat(p2))
          const diff = v2 - v1
          let deltaText = '—'
          let deltaColor = '#6b7280'
          if (!isNaN(diff) && diff !== 0 && higher !== null) {
            const improved = higher ? diff > 0 : diff < 0
            deltaColor = improved ? '#22c55e' : '#ef4444'
            deltaText = `${diff > 0 ? '+' : ''}${Number.isInteger(v1) && Number.isInteger(v2) ? Math.round(diff) : diff.toFixed(1)}`
          }
          return (
            <tr key={label}>
              <td className="cell-muted">{label}</td>
              <td style={{ color: '#3b82f6' }}>{p1}</td>
              <td style={{ color: '#a78bfa' }}>{p2}</td>
              <td style={{ fontWeight: 600, color: deltaColor }}>{deltaText}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Accuracy helpers ──────────────────────────────────────────────────────────

const ACC_ALWAYS_M1 = new Set([1, 1.5, 2, 2.5, 3.5, 4, 4.5, 5])
const ACC_GOAL_M1   = new Set([3])
const ACC_ALWAYS_M2 = new Set([1, 2, 2.5, 3.5, 4, 5])
const ACC_GOAL_M2   = new Set([1.5, 3, 4.5])

function isAccurateShot(shot, method) {
  const loc = shot.shotLocation
  if (loc === null || loc === undefined) return null
  const isGoal = shot.shotOutcome === 'Goal Canada'
  if (method === 1) {
    if (ACC_ALWAYS_M1.has(loc)) return true
    if (ACC_GOAL_M1.has(loc))   return isGoal
    return false
  }
  if (ACC_ALWAYS_M2.has(loc)) return true
  if (ACC_GOAL_M2.has(loc))   return isGoal
  return false
}

function accStats(shots, method) {
  const withLoc   = shots.filter(s => s.shotLocation !== null && s.shotLocation !== undefined)
  const accurate  = withLoc.filter(s => isAccurateShot(s, method)).length
  const pct       = withLoc.length > 0 ? ((accurate / withLoc.length) * 100).toFixed(1) : '0.0'
  return { total: withLoc.length, accurate, inaccurate: withLoc.length - accurate, pct, untracked: shots.length - withLoc.length }
}

const METHOD_DESC = {
  1: 'Spots 1–2 & 4–5 (inc. half-positions) always accurate · Spot 3 accurate if scored · 0 & 6 inaccurate',
  2: 'Spots 1, 2, 2.5, 3.5, 4, 5 always accurate · Spots 1.5, 3, 4.5 accurate if scored · 0 & 6 inaccurate',
}

// ── Accuracy Tab ──────────────────────────────────────────────────────────────

function AccuracyTab({ shots }) {
  const [method, setMethod] = useState(1)

  const stats = useMemo(() => accStats(shots, method), [shots, method])

  const playerRows = useMemo(() =>
    CANADA_PLAYERS.map(player => {
      const ps = shots.filter(s => s.attackingPlayer === player && s.shotLocation !== null && s.shotLocation !== undefined)
      if (ps.length === 0) return null
      const accurate = ps.filter(s => isAccurateShot(s, method) === true).length
      const pct = ((accurate / ps.length) * 100).toFixed(1)
      return { player, total: ps.length, accurate, inaccurate: ps.length - accurate, pct }
    }).filter(Boolean),
    [shots, method]
  )

  const pieData = [
    { name: 'Accurate',   value: stats.accurate,   color: '#22c55e' },
    { name: 'Inaccurate', value: stats.inaccurate, color: '#ef4444' },
  ]

  return (
    <div>
      {/* Method toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={`tab-btn ${method === 1 ? 'active' : ''}`} onClick={() => setMethod(1)}>Classic</button>
        <button className={`tab-btn ${method === 2 ? 'active' : ''}`} onClick={() => setMethod(2)}>Advanced</button>
        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>{METHOD_DESC[method]}</span>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <StatItem label="Shots (located)" value={stats.total} />
        <StatItem label="Accurate"        value={stats.accurate}   color="#22c55e" />
        <StatItem label="Accuracy %"      value={`${stats.pct}%`}  color="#22c55e" />
        <StatItem label="Inaccurate"      value={stats.inaccurate} color="#ef4444" />
      </div>

      {stats.untracked > 0 && (
        <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
          {stats.untracked} shot{stats.untracked !== 1 ? 's' : ''} excluded — no location recorded.
        </p>
      )}

      <div className="grid-2">
        {/* Pie chart */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 className="card-title" style={{ alignSelf: 'flex-start' }}>Shot Accuracy</h3>
          <PieChart width={280} height={280}>
            <Pie
              data={pieData}
              cx={135} cy={125}
              innerRadius={70}
              outerRadius={110}
              dataKey="value"
              paddingAngle={2}
              labelLine={{ stroke: '#4b5563' }}
              label={({ cx, cy, midAngle, outerRadius, name, percent }) => {
                const RADIAN = Math.PI / 180
                const r = outerRadius + 28
                const x = cx + r * Math.cos(-midAngle * RADIAN)
                const y = cy + r * Math.sin(-midAngle * RADIAN)
                const anchor = x > cx ? 'start' : 'end'
                return (
                  <text x={x} y={y} textAnchor={anchor} dominantBaseline="central" fontSize={12} fill="#9ca3af">
                    <tspan x={x} dy="-0.6em">{name}</tspan>
                    <tspan x={x} dy="1.3em" fill="white" fontWeight="600">{(percent * 100).toFixed(1)}%</tspan>
                  </text>
                )
              }}
            >
              {pieData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} shots`, name]}
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
              itemStyle={{ color: '#94a3b8' }}
            />
          </PieChart>
        </div>

        {/* Player table */}
        <div className="card">
          <h3 className="card-title">Accuracy by Player</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Shots</th>
                <th>Accurate</th>
                <th>Inaccurate</th>
                <th>Accuracy %</th>
              </tr>
            </thead>
            <tbody>
              {playerRows.map(({ player, total, accurate, inaccurate, pct }) => {
                const p = parseFloat(pct)
                const color = p >= 70 ? '#22c55e' : p >= 50 ? '#f59e0b' : '#ef4444'
                return (
                  <tr key={player}>
                    <td className="player-name">{player}</td>
                    <td>{total}</td>
                    <td style={{ color: '#22c55e' }}>{accurate}</td>
                    <td style={{ color: '#ef4444' }}>{inaccurate}</td>
                    <td style={{ color, fontWeight: 600 }}>{pct}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PlayerDetailTable({ offenseShots, defenseShots, offensePenalties, defensePenalties }) {
  const stats = CANADA_PLAYERS.map(player => {
    const pOff = offenseShots.filter(s => s.attackingPlayer === player)
    const pDef = defenseShots.filter(s => s.defendingPlayer === player)
    const pOffPen = offensePenalties.filter(s => s.attackingPlayer === player)
    const pDefPen = defensePenalties.filter(s => s.defendingPlayer === player)
    const offStats = computeOffensiveStats(pOff)
    const defStats = computeDefensiveStats(pDef)
    const offPenStats = computeOffensiveStats(pOffPen)
    const defPenStats = computeDefensiveStats(pDefPen)
    return { player, offStats, defStats, offPenStats, defPenStats }
  }).filter(s => s.offStats.total > 0 || s.defStats.total > 0 || s.offPenStats.total > 0 || s.defPenStats.total > 0)

  return (
    <div className="card">
      <h3 className="card-title">Full Player Statistics</h3>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Player</th>
              <th colSpan={4} style={{ textAlign: 'center', color: '#22c55e' }}>Offense</th>
              <th colSpan={5} style={{ textAlign: 'center', color: '#3b82f6' }}>Defense</th>
              <th colSpan={3} style={{ textAlign: 'center', color: '#a78bfa' }}>Pen. Offense</th>
              <th colSpan={4} style={{ textAlign: 'center', color: '#818cf8' }}>Pen. Defense</th>
            </tr>
            <tr>
              <th></th>
              <th>Shots</th><th>Goals</th><th>Saved</th><th>Conv%</th>
              <th>Faced</th><th>Saves</th><th title="Ball control saves as % of total saves">BC%</th><th>GA</th><th>Stop%</th>
              <th>Shots</th><th>Goals</th><th>Conv%</th>
              <th>Faced</th><th>Saves</th><th>GA</th><th>Stop%</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(({ player, offStats, defStats, offPenStats, defPenStats }) => (
              <tr key={player}>
                <td className="player-name">{player}</td>
                {/* Offense */}
                <td>{offStats.total}</td>
                <td style={{ color: '#22c55e' }}>{offStats.goals}</td>
                <td className="cell-muted">{offStats.saved}</td>
                <td>{offStats.conversionRate}%</td>
                {/* Defense */}
                <td>{defStats.total}</td>
                <td style={{ color: '#3b82f6' }}>{defStats.saves}</td>
                <td style={{ color: '#60a5fa' }}>{defStats.ballControlRate}%</td>
                <td style={{ color: '#ef4444' }}>{defStats.goalsAgainst}</td>
                <td>{defStats.saveRate}%</td>
                {/* Pen. Offense */}
                <td style={{ color: offPenStats.total > 0 ? '#f1f5f9' : '#374151' }}>{offPenStats.total}</td>
                <td style={{ color: offPenStats.goals > 0 ? '#a78bfa' : '#374151' }}>{offPenStats.goals}</td>
                <td style={{ color: offPenStats.total > 0 ? '#f1f5f9' : '#374151' }}>{offPenStats.total > 0 ? `${offPenStats.conversionRate}%` : '—'}</td>
                {/* Pen. Defense */}
                <td style={{ color: defPenStats.total > 0 ? '#f1f5f9' : '#374151' }}>{defPenStats.total}</td>
                <td style={{ color: defPenStats.saves > 0 ? '#818cf8' : '#374151' }}>{defPenStats.saves}</td>
                <td style={{ color: defPenStats.goalsAgainst > 0 ? '#ef4444' : '#374151' }}>{defPenStats.goalsAgainst}</td>
                <td style={{ color: defPenStats.total > 0 ? '#f1f5f9' : '#374151' }}>{defPenStats.total > 0 ? `${defPenStats.saveRate}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
