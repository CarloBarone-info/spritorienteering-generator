import { useState } from 'react'
import { readSheet } from 'read-excel-file/browser'
import {
  parseDelimited,
  rosterFromRows,
  capacityFor,
  reconcileAssignments,
  assignRandomly,
  setIncludedTotal,
  makeTeamNames,
  exportRows,
  rowsToCsv,
  teamWorkbookSheets,
} from './lib/assignments.js'
import './App.css'

const SAMPLE_ROWS = [
  ['Orchestra 1', 'Orchestra 2', 'Orchestra 3', 'Orchestra 4', 'Orchestra 5'],
  ['Ada', 'Bea', 'Cora', 'Dara', 'Elin'],
  ['Alex', 'Ben', 'Cami', 'David', 'Emil'],
  ['Ari', 'Bella', 'Chris', 'Dina', 'Erik'],
  ['Alva', 'Boris', 'Clara', '', 'Eva'],
  ['Amir', '', 'Cleo', '', 'Ella'],
  ['', '', 'Carl', '', 'Elsa'],
  ['', '', 'Cecil', '', ''],
]

function Header({ number, kicker, title, description }) {
  return (
    <div className="panel-heading">
      <span className="panel-number">{number}</span>
      <div>
        <span className="section-kicker">{kicker}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </div>
  )
}

function App() {
  const [participants, setParticipants] = useState([])
  const [orchestras, setOrchestras] = useState([])
  const [teamNames, setTeamNames] = useState(makeTeamNames(4))
  const [balanceOrchestras, setBalanceOrchestras] = useState(true)
  const [sourceName, setSourceName] = useState('')
  const [search, setSearch] = useState('')
  const [totalDraft, setTotalDraft] = useState(null)
  const [countDraft, setCountDraft] = useState(null)
  const [sizeDraft, setSizeDraft] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [exportingExcel, setExportingExcel] = useState(false)

  const total = participants.filter((person) => person.included).length
  const assigned = participants.filter((person) => person.included && person.teamIndex !== null).length
  const teamCount = teamNames.length
  const peoplePerTeam = total ? Math.ceil(total / teamCount) : 0
  const membersByTeam = teamNames.map((_, index) =>
    participants.filter((person) => person.included && person.teamIndex === index),
  )
  const visibleParticipants = participants.filter((person) => {
    const term = search.trim().toLowerCase()
    return !term || person.name.toLowerCase().includes(term) ||
      person.orchestra.toLowerCase().includes(term)
  })

  function showRoster(rows, label) {
    const roster = rosterFromRows(rows)
    setParticipants(roster.participants)
    setOrchestras(roster.orchestras)
    setSourceName(label)
    setSearch('')
    setError('')
    setNotice('Imported ' + roster.participants.length + ' participants from ' +
      roster.orchestras.length + ' orchestras.')
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Please use a file smaller than 5 MB.')
      return
    }
    try {
      const filename = file.name.toLowerCase()
      let rows
      if (filename.endsWith('.xlsx')) {
        rows = await readSheet(file)
      } else if (/\.(csv|tsv|txt)$/.test(filename)) {
        rows = parseDelimited(await file.text())
      } else {
        throw new Error('Unsupported file type. Please upload .xlsx, .csv, or .tsv.')
      }
      showRoster(rows, file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This file could not be read.')
      setNotice('')
    }
  }

  function changeTotal(raw) {
    if (raw === '') return
    const value = Number(raw)
    if (!Number.isFinite(value)) return
    setParticipants((previous) => setIncludedTotal(previous, value, teamCount))
    setError('')
    setNotice('Change the individual checkboxes below if you want to choose who is included.')
  }

  function changeTeamCount(raw) {
    if (raw === '') return
    const value = Number(raw)
    if (!Number.isFinite(value)) return
    const next = Math.max(1, Math.min(200, Math.max(1, total), Math.trunc(value)))
    setTeamNames((previous) => makeTeamNames(next, previous))
    setParticipants((previous) => reconcileAssignments(previous, next))
    setError('')
    setNotice('Team capacities recalculated. Assignments that no longer fit are unassigned.')
  }

  function changeTeamSize(raw) {
    if (raw === '' || total === 0) return
    const value = Number(raw)
    if (!Number.isFinite(value)) return
    const size = Math.max(1, Math.trunc(value))
    changeTeamCount(Math.ceil(total / size))
  }

  function toggleIncluded(id, included) {
    setParticipants((previous) => reconcileAssignments(previous.map((person) => (
      person.id === id
        ? { ...person, included, teamIndex: included ? person.teamIndex : null,
            locked: included ? person.locked : false }
        : person
    )), teamCount))
    setError('')
  }

  function assignPerson(id, value) {
    const person = participants.find((entry) => entry.id === id)
    if (!person || !person.included) return
    const team = value === '' ? null : Number(value)
    if (team !== null && (!Number.isInteger(team) || team < 0 || team >= teamCount)) return
    if (team !== null && person.teamIndex !== team &&
        membersByTeam[team].length >= capacityFor(total, teamCount, team)) {
      setError('That team is full. Choose another team or change the team settings.')
      return
    }
    setParticipants((previous) => previous.map((entry) => (
      entry.id === id ? { ...entry, teamIndex: team, locked: team !== null } : entry
    )))
    setError('')
    setNotice('')
  }

  function fillRemaining(reshuffle = false) {
    setParticipants((previous) => assignRandomly(previous, teamCount, reshuffle, Math.random, balanceOrchestras))
    setError('')
    setNotice(reshuffle
      ? 'Random assignments reshuffled. Manual assignments were preserved.'
      : 'Unassigned people have been placed into teams.')
  }

  function clearAssignments() {
    if (!window.confirm('Clear all team assignments, including manually selected ones?')) return
    setParticipants((previous) => previous.map((person) => ({
      ...person, teamIndex: null, locked: false,
    })))
    setNotice('All assignments cleared.')
    setError('')
  }

  async function downloadExcel() {
    if (!assigned || exportingExcel) return
    setExportingExcel(true)
    setError('')
    try {
      // Load the Excel writer only when needed to keep the initial app lightweight.
      const { default: writeExcelFile } = await import('write-excel-file/browser')
      const sheets = teamWorkbookSheets(participants, teamNames)
      await writeExcelFile(sheets).toFile('spritorienteering-teams.xlsx')
      setNotice('Downloaded ' + assigned + ' assigned participants as an Excel file.')
    } catch (err) {
      setError(err instanceof Error ? 'Could not download Excel: ' + err.message : 'Could not download Excel.')
    } finally {
      setExportingExcel(false)
    }
  }

  function exportCsv() {
    if (!assigned) return
    const csv = '\uFEFF' + rowsToCsv(exportRows(participants, teamNames))
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'spritorienteering-teams.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('Exported ' + assigned + ' assigned participants to CSV.')
  }

  return (
    <div className="app">
      <header className="site-header">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Spritorienteering Generator home">
          <span className="brand-mark" aria-hidden="true">↗</span>
          <span>Spritorienteering <span className="brand-light">Generator</span></span>
        </a>
        <span className="header-tag">Team builder</span>
      </header>

      <main className="main-content">
        <section className="hero">
          <div className="eyebrow"><span className="eyebrow-dot" /> ORGANIZE THE ORCHESTRAS</div>
          <h1>Better together.<br /><em>Better mixed.</em></h1>
          <p>Import your orchestra lists, choose your team sizes, and build balanced
            teams while keeping full control over who goes where.</p>
        </section>

        <section className="stats" aria-label="Event summary">
          <div className="stat"><strong>{participants.length}</strong><span>Imported people</span></div>
          <div className="stat"><strong>{total}</strong><span>Included people</span></div>
          <div className="stat"><strong>{teamCount}</strong><span>Teams</span></div>
          <div className="stat"><strong>{assigned}/{total}</strong><span>Assigned</span></div>
        </section>

        {error && <div className="alert error" role="alert">{error}</div>}
        {notice && <div className="alert notice" role="status">{notice}</div>}

        <div className="setup-grid">
          <section className="panel">
            <Header number="01" kicker="START HERE" title="Import participants"
              description="Each column is one orchestra. Put its name in the first row and the people underneath." />

            <label className="upload-area">
              <span className="upload-symbol" aria-hidden="true">↑</span>
              <strong>Choose a spreadsheet</strong>
              <span>Excel (.xlsx), CSV, or TSV · First sheet only</span>
              <input type="file" accept=".xlsx,.csv,.tsv,.txt" onChange={handleFile}
                aria-label="Upload orchestra participant list" />
            </label>
            <div className="import-footer">
              <span className="source-name">{sourceName || 'No file imported yet'}</span>
              <button type="button" className="link-button"
                onClick={() => showRoster(SAMPLE_ROWS, 'Example roster')}>Try example</button>
            </div>

            {orchestras.length > 0 && (
              <div className="orchestra-summary">
                <h3>Orchestras <span>{orchestras.length}</span></h3>
                {orchestras.map((orchestra, index) => (
                  <div className="orchestra-row" key={orchestra.id}>
                    <span className={'orchestra-dot tone-' + (index % 5)} />
                    <span>{orchestra.name}</span>
                    <strong>{participants.filter((person) =>
                      person.orchestraId === orchestra.id && person.included).length}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <Header number="02" kicker="SET THINGS UP" title="Team settings"
              description="Change the team count or the target size. The other value updates automatically." />

            <div className="field-grid">
              <label className="number-field">
                <span>Participants to assign</span>
                <input type="number" min="0" max={participants.length}
                  value={totalDraft ?? total}
                  onChange={(event) => setTotalDraft(event.target.value)}
                  onBlur={() => { if (totalDraft !== null && totalDraft !== '') changeTotal(totalDraft); setTotalDraft(null) }}
                  onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
                  disabled={!participants.length} />
                <small>Out of {participants.length} imported</small>
              </label>
              <label className="number-field">
                <span>Number of teams</span>
                <input type="number" min="1" max={Math.max(1, total)} value={countDraft ?? teamCount}
                  onChange={(event) => setCountDraft(event.target.value)}
                  onBlur={() => { if (countDraft !== null && countDraft !== '') changeTeamCount(countDraft); setCountDraft(null) }}
                  onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} />
                <small>Editable</small>
              </label>
              <label className="number-field">
                <span>People per team</span>
                <input type="number" min="1" max={Math.max(1, total)}
                  value={sizeDraft ?? peoplePerTeam}
                  onChange={(event) => setSizeDraft(event.target.value)}
                  onBlur={() => { if (sizeDraft !== null && sizeDraft !== '') changeTeamSize(sizeDraft); setSizeDraft(null) }}
                  onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
                  disabled={!total} />
                <small>Maximum; sizes may differ by one</small>
              </label>
            </div>
            <p className="setting-help">
              Team sizes are kept as even as possible. If there are {total || 17} people and
              {total ? ' ' + teamCount : ' 4'} teams, everyone is split across them without duplicates.
            </p>
            <div className="team-name-heading">
              <h3>Name your teams</h3>
              <span>Optional</span>
            </div>
            <div className="team-name-grid">
              {teamNames.map((name, index) => (
                <label className="team-name-field" key={index}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <input type="text" maxLength="60" value={name}
                    aria-label={'Name for team ' + (index + 1)}
                    onChange={(event) => setTeamNames((previous) => previous.map(
                      (value, i) => i === index ? event.target.value : value,
                    ))} />
                </label>
              ))}
            </div>
          </section>
        </div>

        <section className="assignments panel">
          <div className="assignments-head">
            <Header number="03" kicker="BRING EVERYONE TOGETHER" title="Build your teams"
              description="Manual selections stay locked when you fill or reshuffle the other places." />
            <div className="action-row">
              <button className="button-primary" type="button" disabled={!total || assigned === total}
                onClick={() => fillRemaining(false)}>Fill unassigned</button>
              <button className="button-secondary" type="button" disabled={!total}
                onClick={() => fillRemaining(true)}>Reshuffle unlocked</button>
              <button className="button-quiet" type="button" disabled={!assigned}
                onClick={clearAssignments}>Clear all</button>
              <button className="button-export" type="button" disabled={!assigned || exportingExcel}
                onClick={downloadExcel}>{exportingExcel ? 'Preparing Excel…' : 'Download Excel ↓'}</button>
              <button className="button-secondary" type="button" disabled={!assigned}
                onClick={exportCsv}>Download CSV ↓</button>
            </div>
          </div>

          <fieldset className="distribution-settings">
            <legend>Random assignment style</legend>
            <div className="distribution-options">
              <label className={'distribution-option' + (balanceOrchestras ? ' selected' : '')}>
                <input type="radio" name="assignment-style" checked={balanceOrchestras}
                  onChange={() => { setBalanceOrchestras(true); setNotice('') }} />
                <span>
                  <strong>Mix orchestras evenly</strong>
                  <small>Spread each orchestra across teams as evenly as possible.</small>
                </span>
              </label>
              <label className={'distribution-option' + (!balanceOrchestras ? ' selected' : '')}>
                <input type="radio" name="assignment-style" checked={!balanceOrchestras}
                  onChange={() => { setBalanceOrchestras(false); setNotice('') }} />
                <span>
                  <strong>Fully random</strong>
                  <small>Ignore orchestra membership when assigning people to teams.</small>
                </span>
              </label>
            </div>
            <p>Both styles keep team sizes balanced and respect manual assignments.
              Changing the style applies when you click Fill unassigned or Reshuffle unlocked.</p>
          </fieldset>

          <div className="progress-info">
            <span><strong>{assigned}</strong> of {total} participants assigned</span>
            <span>{total - assigned} remaining</span>
          </div>
          <div className="progress-track" aria-hidden="true">
            <div style={{ width: (total ? assigned / total * 100 : 0) + '%' }} />
          </div>

          <div className="teams-grid">
            {teamNames.map((teamName, index) => {
              const members = membersByTeam[index]
              const capacity = capacityFor(total, teamCount, index)
              return (
                <article className="team-card" key={index}>
                  <div className="team-card-head">
                    <div>
                      <span className="team-overline">TEAM {String(index + 1).padStart(2, '0')}</span>
                      <h3>{teamName.trim() || 'Team ' + (index + 1)}</h3>
                    </div>
                    <span className="team-count">{members.length} / {capacity}</span>
                  </div>
                  {members.length ? (
                    <ul className="member-list">
                      {members.map((person) => (
                        <li key={person.id}>
                          <span className="member-name">{person.name}{person.locked &&
                            <span className="manual-marker" title="Manually assigned"> · Manual</span>}
                          </span>
                          <span className="member-orchestra">{person.orchestra}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-team">No participants assigned yet.</p>
                  )}
                </article>
              )
            })}
          </div>

          <div className="roster-section">
            <div className="roster-heading">
              <div>
                <h3>Participant roster</h3>
                <p>Choose teams manually using the dropdowns. Uncheck anyone who isn't taking part.</p>
              </div>
              <input className="search-input" type="search" value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search names or orchestras"
                aria-label="Search participants" />
            </div>
            {participants.length ? (
              <div className="table-scroll">
                <table className="roster-table">
                  <thead>
                    <tr>
                      <th scope="col">Include</th>
                      <th scope="col">Participant</th>
                      <th scope="col">Orchestra</th>
                      <th scope="col">Team assignment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleParticipants.map((person) => (
                      <tr key={person.id} className={person.included ? '' : 'excluded-row'}>
                        <td>
                          <input type="checkbox" checked={person.included}
                            aria-label={'Include ' + person.name + ' from ' + person.orchestra}
                            onChange={(event) => toggleIncluded(person.id, event.target.checked)} />
                        </td>
                        <td className="roster-name">{person.name}</td>
                        <td className="roster-orchestra">{person.orchestra}</td>
                        <td>
                          <select value={person.teamIndex === null ? '' : String(person.teamIndex)}
                            disabled={!person.included}
                            aria-label={'Assign ' + person.name + ' to a team'}
                            onChange={(event) => assignPerson(person.id, event.target.value)}>
                            <option value="">Unassigned</option>
                            {teamNames.map((teamName, index) => (
                              <option value={index} key={index}
                                disabled={person.teamIndex !== index &&
                                  membersByTeam[index].length >= capacityFor(total, teamCount, index)}>
                                {teamName.trim() || 'Team ' + (index + 1)}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visibleParticipants.length && <p className="no-results">No matching participants.</p>}
              </div>
            ) : (
              <div className="empty-roster">
                <span aria-hidden="true">✳</span>
                <h3>Your participants will appear here</h3>
                <p>Upload an orchestra file or load the example roster to start.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>Spritorienteering Generator</span>
        <span>Made for student orchestras · Runs entirely in your browser</span>
      </footer>
    </div>
  )
}

export default App
