import {
  COLUMNS, STATUS_LABEL, PRIORITY_LABELS, BASE_TYPES,
  sprintLabels, sprintNameOf, buildMaps, epicProgress,
  openBlockers, openBlocking, sortByOrder, moveId, matchIssue, discoverSprints,
} from './model'

const issues = [
  { id: 'e1', issue_type: 'epic', status: 'open', labels: ['sprint:Alpha'] },
  { id: 't1', title: 'Fix login bug', issue_type: 'bug', priority: 1, status: 'open', labels: ['sprint:Alpha'], dependencies: [{ type: 'parent-child', depends_on_id: 'e1' }] },
  { id: 't2', title: 'Add search', issue_type: 'feature', priority: 2, status: 'closed', labels: ['sprint-legacy'], dependencies: [{ type: 'parent-child', depends_on_id: 'e1' }, { type: 'blocks', depends_on_id: 't1' }] },
  { id: 't3', title: 'Docs', issue_type: 'task', priority: 3, status: 'open', labels: ['backlog'], dependencies: [{ type: 'related', depends_on_id: 't1' }, { type: 'blocks', depends_on_id: 'gone' }] },
]
const maps = buildMaps(issues)

test('constants', () => {
  expect(COLUMNS).toHaveLength(4)
  expect(STATUS_LABEL.open).toBe('To Do')
  expect(PRIORITY_LABELS).toHaveLength(5)
  expect(BASE_TYPES).toContain('epic')
})

test('sprintLabels / sprintNameOf', () => {
  expect(sprintLabels(issues[0])).toEqual(['sprint:Alpha'])
  expect(sprintLabels({})).toEqual([])
  expect(sprintNameOf('sprint:Alpha')).toBe('Alpha')
  expect(sprintNameOf('sprint-legacy')).toBe('sprint-legacy')
  expect(sprintNameOf(null)).toBe(null)
})

test('buildMaps wires parents, blockers and related', () => {
  expect(maps.byId.t1.title).toBe('Fix login bug')
  expect(maps.parentOf.t1).toBe('e1')
  expect(maps.childrenOf.e1).toEqual(['t1', 't2'])
  expect(maps.blockedBy.t2).toEqual(['t1'])
  expect(maps.blocks.t1).toEqual(['t2'])
  expect(maps.related.t3).toEqual(['t1'])
})

test('epicProgress counts closed children', () => {
  expect(epicProgress('e1', maps)).toEqual({ done: 1, total: 2 })
  expect(epicProgress('t1', maps)).toEqual({ done: 0, total: 0 })
})

test('openBlockers / openBlocking skip closed and unknown issues', () => {
  expect(openBlockers(issues[2], maps)).toEqual(['t1']) // t1 is open
  expect(openBlocking(issues[1], maps)).toEqual([])     // t2 is closed
  expect(openBlockers(issues[3], maps)).toEqual([])     // 'gone' does not exist
  expect(openBlocking(issues[3], maps)).toEqual([])
})

test('sortByOrder keeps unknown ids at the end in original order', () => {
  const idx = new Map([['c', 0], ['a', 1]])
  expect(sortByOrder([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'x' }], idx).map(i => i.id))
    .toEqual(['c', 'a', 'b', 'x'])
})

test('moveId', () => {
  const ids = ['a', 'b', 'c', 'd']
  expect(moveId(ids, 'd', 'a', true)).toEqual(['d', 'a', 'b', 'c'])
  expect(moveId(ids, 'a', 'd', false)).toEqual(['b', 'c', 'd', 'a'])
  expect(moveId(ids, 'a', 'c', true)).toEqual(['b', 'a', 'c', 'd'])
  expect(moveId(ids, 'a', 'a', true)).toBe(null)
  expect(moveId(ids, 'a', 'x', true)).toBe(null)
})

test('matchIssue', () => {
  const find = opts => issues.slice(1, 3).filter(i => matchIssue(i, opts)).map(i => i.id)
  expect(find({ q: 'LOGIN' })).toEqual(['t1'])
  expect(find({ q: 't2' })).toEqual(['t2'])
  expect(find({ q: '' })).toEqual(['t1', 't2'])
  expect(find({ q: '', priority: '2' })).toEqual(['t2'])
  expect(find({ q: '', type: 'bug' })).toEqual(['t1'])
  expect(find({ q: 'bug', status: 'closed' })).toEqual([])
  expect(matchIssue({ id: 'x', issue_type: 'task', priority: 0, status: 'open' }, { q: 'x' })).toBe(true) // no title
})

test('discoverSprints maps name to raw label', () => {
  const m = discoverSprints(issues)
  expect(m.get('Alpha')).toBe('sprint:Alpha')
  expect(m.get('sprint-legacy')).toBe('sprint-legacy')
  expect(m.size).toBe(2)
})
