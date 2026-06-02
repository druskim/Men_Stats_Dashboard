import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  parseRows, computeStats, getUniqueTeams, getTeamPlayers,
  getUniqueValues, preferredOrigin, playerDisplayName,
} from './utils.js'
import CourtMap from './components/CourtMap.jsx'
import GoalFaceMap from './components/GoalFaceMap.jsx'
import ShotFlowMap from './components/ShotFlowMap.jsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

export default function App() {
  const [rawRows, setRawRows]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [selectedTeam, setSelectedTeam] = useState('')
  const [viewMode, setViewMode]         = useState('offence')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [filters, setFilters]           = useState({ tournament: [], game: [] })
  const [activeOrigin, setActiveOrigin] = useState('All')
  const [activeLocation, setActiveLocation] = useState('All')

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data.tsv')
      .then(r => r.text())
      .then(text => { setRawRows(parseRows(text)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const allTeams       = useMemo(() => getUniqueTeams(rawRows), [rawRows])
  const allTournaments = useMemo(() => getUniqueValues(rawRows, 'tournament'), [rawRows])
  const allGames       = useMemo(() => getUniqueValues(rawRows, 'game'), [rawRows])

  // Rows for the selected team, with secondary filters applied
  const teamRows = useMemo(() => {
    if (!selectedTeam) return []
    return rawRows.filter(row => {
      if (row.team !== selectedTeam) return false
      if (filters.tournament.length > 0 && !filters.tournament.includes(row.tournament)) return false
      if (filters.game.length > 0 && !filters.game.includes(row.game)) return false
      return true
    })
  }, [rawRows, selectedTeam, filters])

  // Apply origin/location drill-down filters
  const filteredRows = useMemo(() => teamRows.filter(row => {
    if (activeOrigin   !== 'All' && row.shotOrigin   !== activeOrigin)   return false
    if (activeLocation !== 'All' && row.shotLocation !== activeLocation) return false
    return true
  }), [teamRows, activeOrigin, activeLocation])

  const shots     = useMemo(() => filteredRows.filter(r => !r.isPenalty), [filteredRows])
  const penalties = useMemo(() => filteredRows.filter(r =>  r.isPenalty), [filteredRows])

  const players = useMemo(() => getTeamPlayers(teamRows, selectedTeam), [teamRows, selectedTeam])

  // Reset dependent state on team change
  useEffect(() => { setSelectedPlayer(''); setActiveOrigin('All'); setActiveLocation('All') }, [selectedTeam])

  const teamStats = useMemo(() => computeStats(shots), [shots])

  // Shots fired against the selected team (they are defending)
  const defRows = useMemo(() => {
    if (!selectedTeam) return []
    return rawRows.filter(r => {
      if (r.team === selectedTeam) return false
      if (r.isPenalty) return false
      if (filters.tournament.length > 0 && !filters.tournament.includes(r.tournament)) return false
      if (filters.game.length > 0 && !filters.game.includes(r.game)) return false
      return r.game.split(' vs ').includes(selectedTeam)
    })
  }, [rawRows, selectedTeam, filters])
  const defStats = useMemo(() => computeStats(defRows), [defRows])

  const hasSecondaryFilters =
    filters.tournament.length > 0 || filters.game.length > 0 ||
    activeOrigin !== 'All' || activeLocation !== 'All'

  function clearFilters() {
    setFilters({ tournament: [], game: [] })
    setActiveOrigin('All')
    setActiveLocation('All')
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <p>Loading scouting data…</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-logo">
          <div className="maple-leaf">🎯</div>
          <div>
            <h1>Opponents Scouting Dashboard</h1>
            <p>Shooting Trends &amp; Player Analysis</p>
          </div>
        </div>
        <div className="header-meta">
          {selectedTeam && shots.length > 0 && (
            <span className="badge-info">{shots.length} shots tracked for {selectedTeam}</span>
          )}
        </div>
      </header>

      {/* Filter Bar */}
      <div className="filter-container">
        <div className="filter-bar">
          <div className="filter-group">
            <span className="filter-label">Country</span>
            <select
              className="ms-btn"
              value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
              style={{ minWidth: 160 }}
            >
              <option value="">Select a team…</option>
              {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <MultiSelect
            label="Tournament"
            options={allTournaments}
            value={filters.tournament}
            onChange={v => setFilters(f => ({ ...f, tournament: v }))}
          />

          <MultiSelect
            label="Game"
            options={allGames}
            value={filters.game}
            onChange={v => setFilters(f => ({ ...f, game: v }))}
          />
        </div>

        {hasSecondaryFilters && (
          <button className="clear-filters" onClick={clearFilters}>Clear filters</button>
        )}
      </div>

      {!selectedTeam ? (
        <EmptyState teams={allTeams} />
      ) : (
        <>
          {/* View toggle */}
          <div className="tab-nav">
            <button
              className={`tab-btn ${viewMode === 'offence' ? 'active' : ''}`}
              onClick={() => setViewMode('offence')}
            >
              Offence
            </button>
            <button
              className={`tab-btn ${viewMode === 'defense' ? 'active' : ''}`}
              onClick={() => setViewMode('defense')}
            >
              Defense
            </button>
            <button
              className={`tab-btn ${viewMode === 'penalties' ? 'active' : ''}`}
              onClick={() => setViewMode('penalties')}
            >
              Penalties
            </button>
            <button
              className={`tab-btn ${viewMode === 'teamoverview' ? 'active' : ''}`}
              onClick={() => setViewMode('teamoverview')}
            >
              Team View
            </button>
          </div>

          {viewMode === 'offence' ? (
            shots.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: '#6b7280' }}>
                No shot data found for <strong style={{ color: '#f1f5f9' }}>{selectedTeam}</strong> with the current filters.
              </div>
            ) : (
              <TeamView
                shots={shots}
                stats={teamStats}
                teamName={selectedTeam}
                players={players}
                teamRows={teamRows}
                activeOrigin={activeOrigin}
                onPositionClick={pos => setActiveOrigin(o => o === pos ? 'All' : pos)}
                activeLocation={activeLocation}
                onLocationClick={loc => setActiveLocation(l => l === loc ? 'All' : loc)}
                selectedPlayer={selectedPlayer}
                onSelectPlayer={p => { setSelectedPlayer(p); setActiveOrigin('All'); setActiveLocation('All') }}
              />
            )
          ) : viewMode === 'defense' ? (
            defRows.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: '#6b7280' }}>
                No defensive data found for <strong style={{ color: '#f1f5f9' }}>{selectedTeam}</strong> with the current filters.
              </div>
            ) : (
              <DefenseView shots={defRows} stats={defStats} teamName={selectedTeam} />
            )
          ) : viewMode === 'penalties' ? (
            <PenaltiesView penalties={penalties} teamName={selectedTeam} />
          ) : (
            <TeamOverviewView teamRows={teamRows} defRows={defRows} teamName={selectedTeam} />
          )}
        </>
      )}
    </div>
  )
}

// ── Offence View ──────────────────────────────────────────────────────────────

function TeamView({ shots, stats, teamName, players, teamRows, activeOrigin, onPositionClick, activeLocation, onLocationClick, selectedPlayer, onSelectPlayer }) {
  const mapShots    = useMemo(() =>
    selectedPlayer ? shots.filter(r => r.attackingPlayer === selectedPlayer) : shots,
    [shots, selectedPlayer]
  )
  const displayStats = useMemo(() => selectedPlayer ? computeStats(mapShots) : stats, [mapShots, selectedPlayer, stats])
  const prefOrigin   = useMemo(() => selectedPlayer ? preferredOrigin(mapShots) : null, [mapShots, selectedPlayer])

  const mapTitle = label => selectedPlayer
    ? `${playerDisplayName(selectedPlayer)} — ${label}`
    : `${teamName} — ${label}`

  const [goalsOnly, setGoalsOnly] = useState(false)
  const goalShots = useMemo(() => mapShots.filter(r => r.shotOutcome === 'Goal'), [mapShots])
  const courtShots = goalsOnly ? goalShots : mapShots

  return (
    <div>
      <StatGrid cards={selectedPlayer ? [
        { label: 'Shots',               value: displayStats.total,             color: '#3b82f6', sub: playerDisplayName(selectedPlayer) },
        { label: 'Goals',               value: displayStats.goals,             color: '#22c55e', sub: `${displayStats.goalRate}% conversion` },
        { label: 'Off. Efficiency',     value: `${displayStats.goalRate}%`,    color: '#22c55e', sub: `${displayStats.goals} of ${displayStats.total}` },
        { label: 'Pref. Origin',        value: prefOrigin ?? '—',              color: '#f59e0b', sub: 'most used position' },
      ] : [
        { label: 'Total Shots',         value: stats.total,          color: '#3b82f6', sub: 'regular play' },
        { label: 'Goals',               value: stats.goals,          color: '#22c55e', sub: `${stats.goalRate}% conversion` },
        { label: 'Off. Efficiency',     value: `${stats.goalRate}%`, color: '#22c55e', sub: `${stats.goals} of ${stats.total}` },
        { label: 'Def. Efficiency',     value: `${stats.saveRate}%`, color: '#3b82f6', sub: `Canada save rate` },
      ]} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          className={`ms-btn${goalsOnly ? ' ms-btn--active' : ''}`}
          onClick={() => setGoalsOnly(v => !v)}
        >
          {goalsOnly ? 'Goals only' : 'All shots'}
        </button>
      </div>

      <ShotFlowMap shots={courtShots} title={mapTitle(goalsOnly ? 'Shot Flow — Goals Only' : 'Shot Flow — Origin to Landing')} />

      <div className="grid-2">
        <CourtMap
          shots={courtShots}
          title={mapTitle(goalsOnly ? 'Goal Origin Map' : 'Shot Origin Map')}
          teamName={teamName}
          activeOrigin={activeOrigin}
          onPositionClick={onPositionClick}
        />
        <GoalFaceMap
          shots={courtShots}
          title={mapTitle(goalsOnly ? 'Goal Location Map' : 'Shot Location Map')}
          activeLocation={activeLocation}
          onLocationClick={onLocationClick}
        />
      </div>

      <PlayerSummaryTable
        players={players}
        shots={shots}
        teamName={teamName}
        selectedPlayer={selectedPlayer}
        onSelectPlayer={onSelectPlayer}
      />

    </div>
  )
}

// ── Penalties View ────────────────────────────────────────────────────────────

function PenaltiesView({ penalties, teamName }) {
  const stats        = useMemo(() => computeStats(penalties), [penalties])
  const [goalsOnly, setGoalsOnly] = useState(false)
  const goalPenalties  = useMemo(() => penalties.filter(r => r.shotOutcome === 'Goal'), [penalties])
  const displayShots = goalsOnly ? goalPenalties : penalties

  if (penalties.length === 0) return (
    <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: '#6b7280' }}>
      No penalty shot data for <strong style={{ color: '#f1f5f9' }}>{teamName}</strong> with the current filters.
    </div>
  )

  return (
    <div>
      <StatGrid cards={[
        { label: 'Penalty Shots', value: stats.total,                    color: '#3b82f6', sub: 'total taken' },
        { label: 'Goals',         value: stats.goals,                    color: '#22c55e', sub: `${stats.goalRate}% conversion` },
        { label: 'Stopped',       value: stats.saves + stats.bcSaves,   color: '#ef4444', sub: 'saves + ball control' },
        { label: 'Goal Rate',     value: `${stats.goalRate}%`,           color: '#22c55e', sub: `${stats.goals} of ${stats.total}` },
      ]} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          className={`ms-btn${goalsOnly ? ' ms-btn--active' : ''}`}
          onClick={() => setGoalsOnly(v => !v)}
        >
          {goalsOnly ? 'Goals only' : 'All penalties'}
        </button>
      </div>

      <ShotFlowMap shots={displayShots} title={`${teamName} — Penalty Shot Flow`} />

      <div className="grid-2">
        <CourtMap
          shots={displayShots}
          title={`${teamName} — Penalty Shot Origin`}
          teamName={teamName}
          activeOrigin="All"
          onPositionClick={null}
        />
        <GoalFaceMap
          shots={displayShots}
          title={`${teamName} — Penalty Shot Location`}
          activeLocation="All"
          onLocationClick={null}
        />
      </div>

      <div className="card">
        <h3 className="card-title">{teamName} — Penalty Shot Details</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th><th>Attacker</th><th>Defender</th>
                <th>Origin</th><th>Location</th><th>Outcome</th><th>Game</th>
              </tr>
            </thead>
            <tbody>
              {penalties.map((shot, i) => (
                <tr key={i}>
                  <td className="cell-muted">{shot.start || '—'}</td>
                  <td className="player-name">{playerDisplayName(shot.attackingPlayer) || '—'}</td>
                  <td className="player-name">{playerDisplayName(shot.defendingPlayer) || '—'}</td>
                  <td>{shot.shotOrigin ?? '—'}</td>
                  <td>{shot.shotLocation ?? '—'}</td>
                  <td style={{ color: outcomeColor(shot.shotOutcome) }}>{shot.shotOutcome || '—'}</td>
                  <td className="cell-muted">{shot.tournament || shot.game}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Defense View ──────────────────────────────────────────────────────────────

function DefenseView({ shots, stats, teamName }) {
  const [goalsOnly, setGoalsOnly] = useState(false)
  const goalShots    = useMemo(() => shots.filter(r => r.shotOutcome === 'Goal'), [shots])
  const displayShots = goalsOnly ? goalShots : shots

  return (
    <div>
      <StatGrid cards={[
        { label: 'Shots Against', value: stats.total,          color: '#3b82f6', sub: 'regular play' },
        { label: 'Goals Against', value: stats.goals,          color: '#ef4444', sub: `${stats.goalRate}% conversion rate` },
        { label: 'Stop Rate',     value: `${stats.saveRate}%`, color: '#22c55e', sub: `${stats.total - stats.goals} shots stopped` },
      ]} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          className={`ms-btn${goalsOnly ? ' ms-btn--active' : ''}`}
          onClick={() => setGoalsOnly(v => !v)}
        >
          {goalsOnly ? 'Goals only' : 'All shots'}
        </button>
      </div>

      <ShotFlowMap
        shots={displayShots}
        title={`${teamName} — ${goalsOnly ? 'Goals Against Flow' : 'Shots Against Flow'}`}
      />

      <div className="grid-2">
        <CourtMap
          shots={displayShots}
          title={`${teamName} — ${goalsOnly ? 'Goal' : 'Shot'} Origin Against`}
          teamName={teamName}
          activeOrigin="All"
          onPositionClick={null}
        />
        <GoalFaceMap
          shots={displayShots}
          title={`${teamName} — ${goalsOnly ? 'Goal' : 'Shot'} Location Against`}
          activeLocation="All"
          onLocationClick={null}
        />
      </div>

      <DefensivePlayerTable shots={shots} teamName={teamName} />
    </div>
  )
}

function DefensivePlayerTable({ shots, teamName }) {
  const rows = useMemo(() => {
    const byPlayer = {}
    for (const shot of shots) {
      if (!shot.defendingPlayer) continue
      if (!byPlayer[shot.defendingPlayer]) byPlayer[shot.defendingPlayer] = []
      byPlayer[shot.defendingPlayer].push(shot)
    }
    return Object.entries(byPlayer)
      .map(([player, ps]) => ({ player, stats: computeStats(ps) }))
      .sort((a, b) => b.stats.total - a.stats.total)
  }, [shots])

  if (rows.length === 0) return null

  return (
    <div className="card">
      <h3 className="card-title">{teamName} — Defensive Player Breakdown</h3>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Shots Faced</th>
              <th>Goals Against</th>
              <th>Saves</th>
              <th>Stop Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player, stats }) => (
              <tr key={player}>
                <td className="player-name">{playerDisplayName(player)}</td>
                <td>{stats.total}</td>
                <td style={{ color: '#ef4444' }}>{stats.goals}</td>
                <td style={{ color: '#22c55e' }}>{stats.saves + stats.bcSaves}</td>
                <td style={{ color: stats.saveRate > 80 ? '#22c55e' : stats.saveRate > 60 ? '#f59e0b' : '#ef4444' }}>
                  {stats.saveRate}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Team Overview View ────────────────────────────────────────────────────────

function TeamOverviewView({ teamRows, defRows, teamName }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  const offShots = useMemo(() => teamRows.filter(r => !r.isPenalty), [teamRows])

  const allPlayers = useMemo(() => {
    const ps = new Set()
    offShots.forEach(r => { if (r.attackingPlayer) ps.add(r.attackingPlayer) })
    defRows.forEach(r => { if (r.defendingPlayer) ps.add(r.defendingPlayer) })
    return [...ps].sort((a, b) => playerDisplayName(a).localeCompare(playerDisplayName(b)))
  }, [offShots, defRows])

  if (selectedPlayer) {
    const playerOffShots = offShots.filter(r => r.attackingPlayer === selectedPlayer)
    const playerDefShots = defRows.filter(r => r.defendingPlayer === selectedPlayer)
    const offStats = computeStats(playerOffShots)
    const defStats = computeStats(playerDefShots)

    return (
      <div>
        <button
          className="ms-btn"
          onClick={() => setSelectedPlayer(null)}
          style={{ marginBottom: 16 }}
        >
          ← Back to team
        </button>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="card-title">{playerDisplayName(selectedPlayer)} — {teamName}</h3>
        </div>

        <StatGrid cards={[
          { label: 'Off. Shots',     value: offStats.total,          color: '#3b82f6', sub: 'shots taken' },
          { label: 'Off. Goals',     value: offStats.goals,          color: '#22c55e', sub: `${offStats.goalRate}% rate` },
          { label: 'Def. Shots',     value: defStats.total,          color: '#3b82f6', sub: 'shots faced' },
          { label: 'Goals Against',  value: defStats.goals,          color: '#ef4444', sub: `${defStats.saveRate}% stop rate` },
        ]} />

        <ShotFlowMap
          shots={playerOffShots}
          title={`${playerDisplayName(selectedPlayer)} — Offensive Shot Flow`}
        />
        <ShotFlowMap
          shots={playerDefShots}
          title={`${playerDisplayName(selectedPlayer)} — Defensive Shot Flow`}
        />
      </div>
    )
  }

  return (
    <div className="card">
      <h3 className="card-title">{teamName} — Player Overview (click a player for details)</h3>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Off. Shots</th><th>Off. Goals</th><th>Off. Rate</th>
              <th>Def. Shots</th><th>Goals Against</th><th>Stop Rate</th>
            </tr>
          </thead>
          <tbody>
            {allPlayers.map(player => {
              const os = computeStats(offShots.filter(r => r.attackingPlayer === player))
              const ds = computeStats(defRows.filter(r => r.defendingPlayer === player))
              return (
                <tr key={player} onClick={() => setSelectedPlayer(player)}
                  style={{ cursor: 'pointer' }}>
                  <td className="player-name">{playerDisplayName(player)}</td>
                  <td>{os.total || '—'}</td>
                  <td style={{ color: '#22c55e' }}>{os.total > 0 ? os.goals : '—'}</td>
                  <td>{os.total > 0 ? `${os.goalRate}%` : '—'}</td>
                  <td>{ds.total || '—'}</td>
                  <td style={{ color: '#ef4444' }}>{ds.total > 0 ? ds.goals : '—'}</td>
                  <td style={{ color: ds.total > 0 ? (ds.saveRate > 80 ? '#22c55e' : ds.saveRate > 60 ? '#f59e0b' : '#ef4444') : '#6b7280' }}>
                    {ds.total > 0 ? `${ds.saveRate}%` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Trend Chart ───────────────────────────────────────────────────────────────

function TrendChart({ shots, teamName }) {
  const data = useMemo(() => {
    const byGame = {}
    for (const shot of shots) {
      const key = shot.tournament || shot.game || 'Unknown'
      if (!byGame[key]) byGame[key] = { game: key, shots: 0, goals: 0 }
      byGame[key].shots++
      if (shot.shotOutcome === 'Goal') byGame[key].goals++
    }
    return Object.values(byGame).sort((a, b) => a.game.localeCompare(b.game))
  }, [shots])

  if (data.length < 2) return null

  return (
    <div className="card">
      <h3 className="card-title">{teamName} — Shots &amp; Goals by Game</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="game"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
            labelStyle={{ color: '#f1f5f9' }}
            itemStyle={{ color: '#94a3b8' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="shots" name="Shots" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="goals" name="Goals" fill="#22c55e" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Player Summary Table (Team View) ─────────────────────────────────────────

function PlayerSummaryTable({ players, shots, teamName, selectedPlayer, onSelectPlayer }) {
  const rows = useMemo(() => players.map(player => {
    const ps      = shots.filter(s => s.attackingPlayer === player)
    const stats   = computeStats(ps)
    const origin  = preferredOrigin(ps)
    return { player, stats, origin }
  }).filter(r => r.stats.total > 0), [players, shots])

  if (rows.length === 0) return null

  return (
    <div className="card">
      <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {teamName} — Player Breakdown
        {selectedPlayer && (
          <span style={{ fontSize: 12, fontWeight: 400, color: '#f59e0b' }}>
            filtering: {playerDisplayName(selectedPlayer)}
            <button
              onClick={() => onSelectPlayer('')}
              style={{ marginLeft: 6, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}
              title="Clear player filter"
            >×</button>
          </span>
        )}
      </h3>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Shots</th>
              <th>Goals</th>
              <th>Off. Eff.</th>
              <th>Def. Eff.</th>
              <th>Saves vs</th>
              <th>BC Saves vs</th>
              <th>Out</th>
              <th>Pref. Origin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player, stats, origin }) => {
              const isActive = player === selectedPlayer
              return (
                <tr
                  key={player}
                  onClick={() => onSelectPlayer(isActive ? '' : player)}
                  style={{
                    cursor: 'pointer',
                    background: isActive ? 'rgba(245,158,11,0.1)' : undefined,
                    outline: isActive ? '1px solid rgba(245,158,11,0.4)' : undefined,
                  }}
                >
                  <td className="player-name" style={{ color: isActive ? '#f59e0b' : undefined }}>
                    {playerDisplayName(player)}
                  </td>
                  <td>{stats.total}</td>
                  <td style={{ color: '#22c55e' }}>{stats.goals}</td>
                  <td style={{ color: stats.goals > 0 ? '#22c55e' : '#9ca3af' }}>{stats.goalRate}%</td>
                  <td style={{ color: '#3b82f6' }}>{stats.saveRate}%</td>
                  <td style={{ color: '#60a5fa' }}>{stats.saves}</td>
                  <td style={{ color: '#3b82f6' }}>{stats.bcSaves}</td>
                  <td className="cell-muted">{stats.out}</td>
                  <td style={{ color: origin ? '#f59e0b' : '#374151', fontWeight: origin ? 600 : 400 }}>
                    {origin ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Penalty Section ───────────────────────────────────────────────────────────

function PenaltySection({ penalties, teamName }) {
  const stats = computeStats(penalties)
  return (
    <div className="card">
      <h3 className="card-title">{teamName} — Penalty Shots</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        <StatItem label="Penalty Shots" value={stats.total} />
        <StatItem label="Goals" value={stats.goals} color="#22c55e" />
        <StatItem label="Goal Rate" value={`${stats.goalRate}%`} color="#22c55e" />
        <StatItem label="Stopped" value={stats.saves + stats.bcSaves} color="#3b82f6" />
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th><th>Attacker</th><th>Defender</th>
              <th>Origin</th><th>Location</th><th>Outcome</th><th>Game</th>
            </tr>
          </thead>
          <tbody>
            {penalties.map((shot, i) => (
              <tr key={i}>
                <td className="cell-muted">{shot.start || '—'}</td>
                <td className="player-name">{playerDisplayName(shot.attackingPlayer) || '—'}</td>
                <td className="player-name">{playerDisplayName(shot.defendingPlayer) || '—'}</td>
                <td>{shot.shotOrigin ?? '—'}</td>
                <td>{shot.shotLocation ?? '—'}</td>
                <td style={{ color: outcomeColor(shot.shotOutcome) }}>{shot.shotOutcome || '—'}</td>
                <td className="cell-muted">{shot.tournament || shot.game}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function outcomeColor(o) {
  if (o === 'Goal') return '#22c55e'
  if (o === 'Ball Control Save') return '#3b82f6'
  if (o === 'Save') return '#60a5fa'
  return '#9ca3af'
}

// ── Shared UI components ──────────────────────────────────────────────────────

function StatGrid({ cards }) {
  return (
    <div className="stat-grid">
      {cards.map(({ label, value, color, sub }) => (
        <div key={label} className="stat-card" style={{ borderTopColor: color }}>
          <div className="stat-label">{label}</div>
          <div className="stat-value" style={{ color }}>{value}</div>
          {sub && <div className="stat-sub">{sub}</div>}
        </div>
      ))}
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

function EmptyState({ teams }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Select a country to begin scouting</h2>
      {teams.length > 0 ? (
        <p style={{ color: '#6b7280' }}>
          {teams.length} team{teams.length !== 1 ? 's' : ''} available: {teams.join(', ')}
        </p>
      ) : (
        <p style={{ color: '#6b7280' }}>
          No game data loaded yet. Add XLSX files to <code style={{ color: '#a78bfa' }}>public/games/</code> and run <code style={{ color: '#a78bfa' }}>npm run aggregate</code>.
        </p>
      )}
    </div>
  )
}

// ── MultiSelect component ─────────────────────────────────────────────────────

function MultiSelect({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allSelected    = value.length === options.length && options.length > 0
  const someSelected   = value.length > 0 && !allSelected
  const isActive       = value.length > 0

  function toggle(opt) {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  }

  function toggleAll() {
    onChange(allSelected ? [] : [...options])
  }

  const btnLabel = value.length === 0
    ? `All ${label}s`
    : value.length === 1
      ? value[0]
      : `${value.length} ${label}s`

  if (options.length === 0) return null

  return (
    <div className="filter-group">
      <span className="filter-label">{label}</span>
      <div style={{ position: 'relative' }} ref={ref}>
        <button
          className={`ms-btn ${open ? 'ms-btn--open' : ''} ${isActive ? 'ms-btn--active' : ''}`}
          onClick={() => setOpen(o => !o)}
        >
          <span className="ms-btn-label">{btnLabel}</span>
          <span className="ms-btn-chevron">▾</span>
        </button>
        {open && (
          <div className="ms-dropdown">
            <div className="ms-header">
              <label className="ms-option ms-select-all">
                <input
                  type="checkbox"
                  className="ms-checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected }}
                  onChange={toggleAll}
                />
                Select all
              </label>
              {isActive && (
                <button className="ms-clear" onClick={() => { onChange([]); setOpen(false) }}>
                  Clear
                </button>
              )}
            </div>
            <div className="ms-divider" />
            <div className="ms-options">
              {options.map(opt => (
                <label key={opt} className={`ms-option ${value.includes(opt) ? 'ms-option--checked' : ''}`}>
                  <input
                    type="checkbox"
                    className="ms-checkbox"
                    checked={value.includes(opt)}
                    onChange={() => toggle(opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
