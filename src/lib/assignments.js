export function parseDelimited(text) {
  const source = String(text || '').replace(/^\uFEFF/, '')
  const firstLine = source.split(/\r?\n/).find((line) => line.trim()) || ''
  const candidates = ['\t', ',', ';', '|']
  let delimiter = ','
  let best = 0
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1
    if (count > best) {
      best = count
      delimiter = candidate
    }
  }

  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (quoted || cell.length === 0) {
        quoted = !quoted
      } else {
        cell += char
      }
    } else if (char === delimiter && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i += 1
      row.push(cell)
      if (row.some((entry) => String(entry).trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  if (quoted) throw new Error('The file contains an unfinished quoted cell.')
  row.push(cell)
  if (row.some((entry) => String(entry).trim())) rows.push(row)
  return rows
}

export function rosterFromRows(rows) {
  if (!Array.isArray(rows) || rows.length < 2) {
    throw new Error('Please use a file with an orchestra header row and participant names below it.')
  }
  const headers = rows[0].map((value) => String(value ?? '').trim())
  const columns = headers
    .map((name, index) => ({ name, index }))
    .filter(({ name }) => name && !/^:?-+:?$/.test(name))
  if (!columns.length) throw new Error('No orchestra column headers were found.')

  const participants = []
  const orchestras = columns.map(({ name, index }) => ({
    id: 'orchestra-' + index,
    name,
  }))
  columns.forEach(({ name, index }) => {
    rows.slice(1).forEach((row, rowIndex) => {
      const participantName = String(row?.[index] ?? '').trim()
      if (!participantName || /^:?-+:?$/.test(participantName)) return
      participants.push({
        id: 'person-' + index + '-' + rowIndex,
        name: participantName,
        orchestra: name,
        orchestraId: 'orchestra-' + index,
        included: true,
        teamIndex: null,
        locked: false,
      })
    })
  })
  if (!participants.length) throw new Error('No participant names were found under the orchestra headers.')
  return { orchestras, participants }
}

export function capacityFor(total, teamCount, teamIndex) {
  if (teamCount <= 0 || teamIndex < 0 || teamIndex >= teamCount) return 0
  return Math.floor(total / teamCount) + (teamIndex < total % teamCount ? 1 : 0)
}

export function reconcileAssignments(participants, teamCount) {
  const total = participants.filter((person) => person.included).length
  const capacities = Array.from({ length: teamCount }, (_, i) => capacityFor(total, teamCount, i))
  const result = participants.map((person) => {
    if (!person.included || !Number.isInteger(person.teamIndex) ||
        person.teamIndex < 0 || person.teamIndex >= teamCount) {
      return { ...person, teamIndex: null, locked: false }
    }
    return { ...person }
  })
  for (let team = 0; team < teamCount; team += 1) {
    const members = result
      .map((person, index) => ({ person, index }))
      .filter(({ person }) => person.teamIndex === team)
      .sort((a, b) => Number(b.person.locked) - Number(a.person.locked))
    members.slice(capacities[team]).forEach(({ index }) => {
      result[index] = { ...result[index], teamIndex: null, locked: false }
    })
  }
  return result
}

function shuffle(items, random) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(random() * (i + 1)))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function assignRandomly(participants, teamCount, reshuffle = false, random = Math.random, balanceOrchestras = true) {
  const prepared = participants.map((person) => {
    if (reshuffle && person.included && !person.locked) {
      return { ...person, teamIndex: null }
    }
    return person
  })
  const result = reconcileAssignments(prepared, teamCount)
  const total = result.filter((person) => person.included).length
  const capacities = Array.from({ length: teamCount }, (_, i) => capacityFor(total, teamCount, i))
  const counts = Array.from({ length: teamCount }, () => 0)
  const orchestraCounts = Array.from({ length: teamCount }, () => new Map())

  result.forEach((person) => {
    if (!person.included || person.teamIndex === null) return
    counts[person.teamIndex] += 1
    const orchestraCountsForTeam = orchestraCounts[person.teamIndex]
    orchestraCountsForTeam.set(
      person.orchestraId,
      (orchestraCountsForTeam.get(person.orchestraId) || 0) + 1,
    )
  })

  if (!balanceOrchestras) {
    // Draw uniformly from the remaining team slots, without considering orchestra.
    // Manual assignments and existing allocations have already claimed their slots.
    const slots = capacities.flatMap((capacity, team) =>
      Array.from({ length: capacity - counts[team] }, () => team),
    )
    const shuffledSlots = shuffle(slots, random)
    let nextSlot = 0
    result.forEach((person, index) => {
      if (person.included && person.teamIndex === null) {
        result[index] = { ...person, teamIndex: shuffledSlots[nextSlot], locked: false }
        nextSlot += 1
      }
    })
    return result
  }

  // Default mode: prefer spreading each orchestra across as many teams as possible.
  const groups = new Map()
  result.forEach((person, index) => {
    if (!person.included || person.teamIndex !== null) return
    if (!groups.has(person.orchestraId)) groups.set(person.orchestraId, [])
    groups.get(person.orchestraId).push(index)
  })
  const grouped = shuffle([...groups.values()], random)
    .sort((a, b) => b.length - a.length)

  for (const indexes of grouped) {
    for (const index of shuffle(indexes, random)) {
      const person = result[index]
      const choices = []
      for (let team = 0; team < teamCount; team += 1) {
        if (counts[team] >= capacities[team]) continue
        choices.push({
          team,
          sameOrchestra: orchestraCounts[team].get(person.orchestraId) || 0,
          fill: counts[team] / capacities[team],
          tie: random(),
        })
      }
      choices.sort((a, b) =>
        a.sameOrchestra - b.sameOrchestra ||
        a.fill - b.fill ||
        a.tie - b.tie,
      )
      if (!choices.length) continue
      const team = choices[0].team
      result[index] = { ...person, teamIndex: team, locked: false }
      counts[team] += 1
      orchestraCounts[team].set(
        person.orchestraId,
        (orchestraCounts[team].get(person.orchestraId) || 0) + 1,
      )
    }
  }
  return result
}

export function setIncludedTotal(participants, desiredTotal, teamCount) {
  const wanted = Math.max(0, Math.min(participants.length, Math.trunc(desiredTotal)))
  const result = participants.map((person) => ({ ...person }))
  const orchestraTotals = new Map()
  result.forEach((person) => {
    orchestraTotals.set(person.orchestraId, (orchestraTotals.get(person.orchestraId) || 0) + 1)
  })
  const expected = (orchestraId) =>
    (orchestraTotals.get(orchestraId) || 0) * wanted / Math.max(1, result.length)
  const currentCounts = () => {
    const counts = new Map()
    result.filter((person) => person.included).forEach((person) => {
      counts.set(person.orchestraId, (counts.get(person.orchestraId) || 0) + 1)
    })
    return counts
  }
  let included = result.filter((person) => person.included).length

  while (included > wanted) {
    const counts = currentCounts()
    const surplus = (person) => (counts.get(person.orchestraId) || 0) - expected(person.orchestraId)
    const candidates = result
      .map((person, index) => ({ person, index }))
      .filter(({ person }) => person.included)
    candidates.sort((a, b) => {
      const priority = (person) => person.teamIndex === null ? 0 : person.locked ? 2 : 1
      const keepOne = wanted >= orchestraTotals.size
      const protectedLast = (person) => keepOne && counts.get(person.orchestraId) === 1 ? 1 : 0
      return priority(a.person) - priority(b.person) ||
        protectedLast(a.person) - protectedLast(b.person) ||
        surplus(b.person) - surplus(a.person) ||
        b.index - a.index
    })
    const index = candidates[0].index
    result[index] = { ...result[index], included: false, teamIndex: null, locked: false }
    included -= 1
  }
  while (included < wanted) {
    const counts = currentCounts()
    const surplus = (person) => (counts.get(person.orchestraId) || 0) - expected(person.orchestraId)
    const candidates = result
      .map((person, index) => ({ person, index }))
      .filter(({ person }) => !person.included)
    candidates.sort((a, b) => surplus(a.person) - surplus(b.person) || a.index - b.index)
    result[candidates[0].index].included = true
    included += 1
  }
  return reconcileAssignments(result, teamCount)
}

export function makeTeamNames(count, existing = []) {
  return Array.from({ length: count }, (_, i) => existing[i] ?? ('Team ' + (i + 1)))
}

export function exportRows(participants, teamNames) {
  const rows = [['Team', 'Orchestra', 'Participant']]
  for (let team = 0; team < teamNames.length; team += 1) {
    participants
      .filter((person) => person.included && person.teamIndex === team)
      .forEach((person) => rows.push([teamNames[team] || 'Team ' + (team + 1), person.orchestra, person.name]))
  }
  return rows
}

export function rowsToCsv(rows) {
  return rows.map((row) => row.map((entry) => {
    const value = String(entry ?? '')
    return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value
  }).join(',')).join('\r\n')
}


// Shape expected by write-excel-file v4: separate sheet data and sheet options.
// Kept separate from the download library so the output can be unit-tested.
export function teamWorkbookSheets(participants, teamNames) {
  const teams = teamNames.map((name, index) => ({
    name: String(name || '').trim() || 'Team ' + (index + 1),
    members: participants.filter((person) =>
      person.included && person.teamIndex === index
    ),
  }))
  const unassigned = participants.filter((person) =>
    person.included && person.teamIndex === null
  )
  const header = (value) => ({
    value,
    fontWeight: 'bold',
    backgroundColor: '#17543F',
    textColor: '#FFFFFF',
  })
  const subtitle = (value) => ({
    value,
    fontWeight: 'bold',
    backgroundColor: '#EAF3E9',
    textColor: '#376F50',
  })
  const maxTeamSize = Math.max(0, ...teams.map((team) => team.members.length))
  const teamsSheet = [
    teams.map((team) => header(team.name)),
    teams.map((team) => subtitle(team.members.length + ' participants')),
    ...Array.from({ length: maxTeamSize }, (_, row) =>
      teams.map((team) => {
        const person = team.members[row]
        return person ? person.name + ' (' + person.orchestra + ')' : null
      }),
    ),
  ]
  const details = [[header('Team'), header('Participant'), header('Orchestra')]]
  for (const team of teams) {
    for (const person of team.members) {
      details.push([team.name, person.name, person.orchestra])
    }
  }
  const sheets = [
    {
      sheet: 'Teams',
      data: teamsSheet,
      columns: teams.map(() => ({ width: 34 })),
      stickyRowsCount: 2,
      orientation: 'landscape',
      showGridLines: false,
    },
    {
      sheet: 'Detailed assignments',
      data: details,
      columns: [{ width: 26 }, { width: 28 }, { width: 28 }],
      stickyRowsCount: 1,
      showGridLines: false,
    },
  ]
  if (unassigned.length) {
    sheets.push({
      sheet: 'Unassigned',
      data: [
        [header('Participant'), header('Orchestra')],
        ...unassigned.map((person) => [person.name, person.orchestra]),
      ],
      columns: [{ width: 28 }, { width: 28 }],
      stickyRowsCount: 1,
      showGridLines: false,
    })
  }
  return sheets
}
