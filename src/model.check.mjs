// self-check for the drag-reorder helpers: node src/model.check.mjs
import assert from 'node:assert'
import { matchIssue, moveId, sortByOrder } from './model.js'

const ids = ['a', 'b', 'c', 'd']
assert.deepEqual(moveId(ids, 'd', 'a', true), ['d', 'a', 'b', 'c'])   // drag up, before target
assert.deepEqual(moveId(ids, 'a', 'd', false), ['b', 'c', 'd', 'a'])  // drag down, after target
assert.deepEqual(moveId(ids, 'a', 'c', true), ['b', 'a', 'c', 'd'])
assert.equal(moveId(ids, 'a', 'a', true), null)                       // drop on self = no-op
assert.equal(moveId(ids, 'a', 'x', true), null)                       // unknown target = no-op

const idx = new Map([['c', 0], ['a', 1]])
assert.deepEqual(
  sortByOrder([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'x' }], idx).map(i => i.id),
  ['c', 'a', 'b', 'x'] // ordered ids first, unknown ids keep bd order at the end
)
const iss = [
  { id: 'bd-1', title: 'Fix login bug', issue_type: 'bug', priority: 1, status: 'open' },
  { id: 'bd-2', title: 'Add search', issue_type: 'feature', priority: 2, status: 'closed' },
]
const find = opts => iss.filter(i => matchIssue(i, opts)).map(i => i.id)
assert.deepEqual(find({ q: 'LOGIN' }), ['bd-1'])                 // case-insensitive title
assert.deepEqual(find({ q: 'bd-2' }), ['bd-2'])                  // matches id too
assert.deepEqual(find({ q: '' }), ['bd-1', 'bd-2'])              // empty query = all
assert.deepEqual(find({ q: '', priority: '2' }), ['bd-2'])       // priority arrives as string
assert.deepEqual(find({ q: 'bug', status: 'closed' }), [])       // facets AND the query

console.log('model.check ok')
