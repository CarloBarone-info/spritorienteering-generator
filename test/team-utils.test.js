import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseDelimited, rosterFromRows, capacityFor, reconcileAssignments,
  assignRandomly, setIncludedTotal, rowsToCsv, exportRows,
} from '../src/lib/assignments.js'

const csv = 'Orchestra 1,Orchestra 2,Orchestra 3,Orchestra 4,Orchestra 5\n' +
  'Ada,Bea,Cora,Dara,Elin\n' +
  'Alex,Bri,Cami,,Eli\n' +
  ',,Carl,,\n'

test('parses uneven orchestra columns', () => {
  const roster = rosterFromRows(parseDelimited(csv))
  assert.equal(roster.orchestras.length, 5)
  assert.equal(roster.participants.length, 10)
  assert.equal(roster.participants.filter((p) => p.orchestra === 'Orchestra 3').length, 3)
})

test('parses quoted commas, escaped quotes, and tabs', () => {
  assert.deepEqual(parseDelimited('A,B\n"Ada, X","B""C"'), [['A', 'B'], ['Ada, X', 'B"C']])
  assert.deepEqual(parseDelimited('A\tB\nAda\tBea'), [['A', 'B'], ['Ada', 'Bea']])
})

test('capacities are balanced and cover all participants', () => {
  const capacities = Array.from({ length: 4 }, (_, i) => capacityFor(17, 4, i))
  assert.deepEqual(capacities, [5, 4, 4, 4])
  assert.equal(Math.ceil(17 / 6), 3)
})

test('random fill respects locks and balances teams', () => {
  const { participants } = rosterFromRows(parseDelimited(csv))
  participants[0].teamIndex = 0
  participants[0].locked = true
  const assigned = assignRandomly(participants, 3, false, () => 0.4)
  assert.equal(assigned[0].teamIndex, 0)
  assert.equal(assigned[0].locked, true)
  assert.equal(assigned.filter((p) => p.teamIndex !== null).length, 10)
  assert.deepEqual([0, 1, 2].map((i) => assigned.filter((p) => p.teamIndex === i).length), [4, 3, 3])
  const shuffled = assignRandomly(assigned, 3, true, () => 0.6)
  assert.equal(shuffled[0].teamIndex, 0)
  assert.equal(shuffled[0].locked, true)
})

test('reconciling removes overflow before locked assignments', () => {
  const { participants } = rosterFromRows(parseDelimited(csv))
  participants[0].teamIndex = 0
  participants[0].locked = true
  for (let i = 1; i < 6; i += 1) participants[i].teamIndex = 0
  const reconciled = reconcileAssignments(participants, 3)
  assert.equal(reconciled[0].teamIndex, 0)
  assert.equal(reconciled.filter((p) => p.teamIndex === 0).length, 4)
})

test('changing included total preserves manually assigned people where possible', () => {
  const { participants } = rosterFromRows(parseDelimited(csv))
  participants[0].teamIndex = 0
  participants[0].locked = true
  const fewer = setIncludedTotal(participants, 5, 2)
  assert.equal(fewer.filter((p) => p.included).length, 5)
  assert.equal(fewer[0].included, true)
  const all = setIncludedTotal(fewer, 10, 2)
  assert.equal(all.filter((p) => p.included).length, 10)
})

test('CSV export quotes values safely', () => {
  assert.equal(rowsToCsv([['a,b', 'X "Y"']]), '"a,b","X ""Y"""')
  const { participants } = rosterFromRows(parseDelimited(csv))
  participants[0].teamIndex = 0
  assert.deepEqual(exportRows(participants, ['Trailblazers'])[1], ['Trailblazers', 'Orchestra 1', 'Ada'])
})

test('fully random mode balances team sizes, but ignores orchestra membership', () => {
  const { participants } = rosterFromRows(parseDelimited(csv))
  const alternateOrchestras = participants.map((person, i) => ({
    ...person,
    orchestraId: 'entirely-different-' + (i % 3),
  }))
  const deterministicRandom = () => 0.25
  const randomTeams = assignRandomly(participants, 3, false, deterministicRandom, false)
  const renamedTeams = assignRandomly(alternateOrchestras, 3, false, deterministicRandom, false)
  assert.deepEqual(
    randomTeams.map((person) => person.teamIndex),
    renamedTeams.map((person) => person.teamIndex),
  )
  assert.deepEqual(
    [0, 1, 2].map((i) => randomTeams.filter((person) => person.teamIndex === i).length),
    [4, 3, 3],
  )
})

test('fully random mode respects manual locks during fill and reshuffle', () => {
  const { participants } = rosterFromRows(parseDelimited(csv))
  participants[0].teamIndex = 0
  participants[0].locked = true
  participants[1].teamIndex = 1
  participants[1].locked = false
  const filled = assignRandomly(participants, 3, false, () => 0.4, false)
  assert.equal(filled[0].teamIndex, 0)
  assert.equal(filled[0].locked, true)
  assert.equal(filled[1].teamIndex, 1)
  assert.equal(filled.filter((p) => p.teamIndex !== null).length, 10)
  const reshuffled = assignRandomly(filled, 3, true, () => 0.6, false)
  assert.equal(reshuffled[0].teamIndex, 0)
  assert.equal(reshuffled[0].locked, true)
  assert.equal(reshuffled.filter((p) => p.teamIndex !== null).length, 10)
  assert.deepEqual(
    [0, 1, 2].map((i) => reshuffled.filter((p) => p.teamIndex === i).length),
    [4, 3, 3],
  )
})

