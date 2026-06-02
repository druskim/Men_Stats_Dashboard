import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts'
import { tournamentSortKey } from '../utils.js'
import { CANADA_PLAYERS, computeOffensiveStats, computeDefensiveStats, groupByField } from '../utils.js'

export function PlayerOffenseChart({ shots }) {
  const byPlayer = groupByField(shots.filter(s => CANADA_PLAYERS.includes(s.attackingPlayer)), 'attackingPlayer')
  const data = Object.entries(byPlayer).map(([player, rows]) => {
    const stats = computeOffensiveStats(rows)
    return { player, shots: stats.total, goals: stats.goals, rate: parseFloat(stats.conversionRate) }
  }).sort((a, b) => b.shots - a.shots)

  return (
    <div className="card">
      <h3 className="card-title">Offensive Stats by Player</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="player" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
            labelStyle={{ color: '#f1f5f9' }}
            itemStyle={{ color: '#94a3b8' }}
          />
          <Bar dataKey="shots" name="Shots" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="goals" name="Goals" fill="#22c55e" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PlayerDefenseChart({ shots }) {
  const defShots = shots.filter(s => !s.isCanadaAttack)
  const byPlayer = groupByField(defShots.filter(s => s.defendingPlayer && CANADA_PLAYERS.includes(s.defendingPlayer)), 'defendingPlayer')
  const data = Object.entries(byPlayer).map(([player, rows]) => {
    const stats = computeDefensiveStats(rows)
    return {
      player,
      faced: stats.total,
      saves: stats.saves,
      goalsAgainst: stats.goalsAgainst,
      stopRate: parseFloat(stats.saveRate)
    }
  }).sort((a, b) => b.faced - a.faced)

  return (
    <div className="card">
      <h3 className="card-title">Defensive Stats by Player</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="player" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
            labelStyle={{ color: '#f1f5f9' }}
            itemStyle={{ color: '#94a3b8' }}
          />
          <Bar dataKey="faced" name="Faced" fill="#6366f1" radius={[3, 3, 0, 0]} />
          <Bar dataKey="saves" name="Saves" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="goalsAgainst" name="Goals Against" fill="#ef4444" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function OriginEfficiencyChart({ shots, isOffense }) {
  const data = [1, 2, 3, 4, 5].map(pos => {
    const posShots = shots.filter(s => s.shotOrigin === pos)
    if (isOffense) {
      const stats = computeOffensiveStats(posShots)
      return { pos: `Pos ${pos}`, shots: stats.total, goals: stats.goals, rate: parseFloat(stats.conversionRate) }
    } else {
      const stats = computeDefensiveStats(posShots)
      return { pos: `Pos ${pos}`, shots: stats.total, goalsAgainst: stats.goalsAgainst, stopRate: parseFloat(stats.saveRate) }
    }
  })

  return (
    <div className="card">
      <h3 className="card-title">{isOffense ? 'Shots & Goals by Origin' : 'Shots Faced by Opp Origin'}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="pos" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
            labelStyle={{ color: '#f1f5f9' }}
            itemStyle={{ color: '#94a3b8' }}
          />
          <Bar dataKey="shots" name="Shots" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          {isOffense
            ? <Bar dataKey="goals" name="Goals" fill="#22c55e" radius={[3, 3, 0, 0]} />
            : <Bar dataKey="goalsAgainst" name="Goals Against" fill="#ef4444" radius={[3, 3, 0, 0]} />
          }
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function OutcomePieChart({ shots, isOffense }) {
  const countByOutcome = {}
  for (const shot of shots) {
    const o = shot.shotOutcome || 'Unknown'
    countByOutcome[o] = (countByOutcome[o] || 0) + 1
  }

  const COLORS = {
    'Goal Canada': '#22c55e',
    'Goal Opponent': '#ef4444',
    'Canada Save': '#3b82f6',
    'Canada Ball Control Save': '#60a5fa',
    'Opponent Save': '#f59e0b',
    'Canada Out': '#6b7280',
    'Opponent Out': '#9ca3af',
    'High Ball': '#a78bfa',
    'Long Ball': '#c084fc',
    'Unknown': '#374151',
  }

  const data = Object.entries(countByOutcome)
    .map(([name, value]) => ({ name, value, color: COLORS[name] || '#374151' }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  return (
    <div className="card">
      <h3 className="card-title">Outcome Breakdown</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
            itemStyle={{ color: '#94a3b8' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function GameScoreTable({ allRows }) {
  const games = {}
  for (const row of allRows) {
    const key = `${row.opponent}__${row.tournament}`
    if (!games[key]) games[key] = {
      opponent: row.opponent, tournament: row.tournament,
      canadaGoals: 0, oppGoals: 0, offShots: [], defShots: []
    }
    const g = games[key]
    if (row.isCanadaAttack) {
      if (row.shotOutcome === 'Goal Canada') g.canadaGoals++
      if (!row.isPenalty) g.offShots.push(row)
    } else {
      if (row.shotOutcome === 'Goal Opponent') g.oppGoals++
      if (!row.isPenalty && !row.isOwnGoal) g.defShots.push(row)
    }
  }

  const rows = Object.values(games).sort((a, b) =>
    tournamentSortKey(a.tournament) - tournamentSortKey(b.tournament) ||
    a.tournament.localeCompare(b.tournament) ||
    a.opponent.localeCompare(b.opponent)
  )

  return (
    <div className="card">
      <h3 className="card-title">Game Results</h3>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Opponent</th>
              <th>Tournament</th>
              <th>Score</th>
              <th>Result</th>
              <th style={{ color: '#22c55e' }}>Off Eff%</th>
              <th style={{ color: '#3b82f6' }}>Def Eff%</th>
              <th>CA Shots</th>
              <th>Opp Shots</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ opponent, tournament, canadaGoals, oppGoals, offShots, defShots }, i) => {
              const off = computeOffensiveStats(offShots)
              const def = computeDefensiveStats(defShots)
              const result = canadaGoals > oppGoals ? 'W' : canadaGoals < oppGoals ? 'L' : 'D'
              const resultColor = result === 'W' ? '#22c55e' : result === 'L' ? '#ef4444' : '#f59e0b'
              const offPct = parseFloat(off.conversionRate)
              const defPct = parseFloat(def.saveRate)
              const offColor = offPct >= 25 ? '#22c55e' : offPct >= 12 ? '#f59e0b' : '#ef4444'
              const defColor = defPct >= 85 ? '#22c55e' : defPct >= 70 ? '#f59e0b' : '#ef4444'
              return (
                <tr key={i}>
                  <td>{opponent}</td>
                  <td className="cell-muted">{tournament}</td>
                  <td className="cell-score">{canadaGoals} – {oppGoals}</td>
                  <td><span className="badge" style={{ color: resultColor, borderColor: resultColor }}>{result}</span></td>
                  <td style={{ color: offColor, fontWeight: 600 }}>{off.conversionRate}%</td>
                  <td style={{ color: defColor, fontWeight: 600 }}>{def.saveRate}%</td>
                  <td className="cell-muted">{off.total}</td>
                  <td className="cell-muted">{def.total}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
