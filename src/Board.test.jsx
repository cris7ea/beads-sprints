import { render, screen, fireEvent, createEvent } from '@testing-library/react'
import Board, { inTopHalf, indicatorStyle } from './Board'
import { buildMaps } from './model'

const issues = [
  { id: 'e1', title: 'Epic One', issue_type: 'epic', priority: 1, status: 'open', labels: ['sprint:Alpha'] },
  { id: 'e2', title: 'Epic Two', issue_type: 'epic', priority: 2, status: 'open', labels: ['sprint:Alpha'] },
  { id: 't1', title: 'Task One', issue_type: 'task', priority: 0, status: 'open', labels: ['sprint:Alpha'], dependencies: [{ type: 'parent-child', depends_on_id: 'e1' }] },
  { id: 't2', title: 'Task Two', issue_type: 'bug', priority: 2, status: 'in_progress', labels: ['sprint:Alpha'] },
  { id: 'x1', title: 'Not in sprint', issue_type: 'task', priority: 3, status: 'open', labels: ['backlog'] },
]
const maps = buildMaps(issues)
const props = over => ({
  issues, maps, activeSprint: 'Alpha', labelFor: n => `sprint:${n}`,
  onDropStatus: vi.fn(), sortIssues: l => l, onReorder: vi.fn(), onSelect: vi.fn(),
  selectedId: 't2', goBacklog: vi.fn(), ...over,
})

test('inTopHalf / indicatorStyle helpers', () => {
  const ev = at => ({ clientY: at, currentTarget: { getBoundingClientRect: () => ({ top: 0, height: 40 }) } })
  expect(inTopHalf(ev(10))).toBe(true)
  expect(inTopHalf(ev(30))).toBe(false)
  expect(indicatorStyle(null)).toBeUndefined()
  expect(indicatorStyle('top').boxShadow).toContain('inset 0 3px')
  expect(indicatorStyle('bottom').boxShadow).toContain('inset 0 -3px')
})

test('empty state without an active sprint', () => {
  const p = props({ activeSprint: null })
  render(<Board {...p} />)
  screen.getByText('No active sprint')
  fireEvent.click(screen.getByText('Go to Backlog'))
  expect(p.goBacklog).toHaveBeenCalled()
})

test('renders columns with only sprint issues, epics hidden', () => {
  render(<Board {...props()} />)
  for (const title of ['To Do', 'Blocked', 'In Progress', 'Done']) screen.getByText(title)
  screen.getByText('Task One')
  expect(screen.getAllByText('Epic One')).toHaveLength(1) // only the epic chip on its child card
  expect(screen.queryByText('Epic Two')).toBeNull() // epics never render as cards
  expect(screen.queryByText('Not in sprint')).toBeNull()
})

test('clicking cards and epic chips selects them', () => {
  const p = props()
  render(<Board {...p} />)
  fireEvent.click(screen.getByText('Task One'))
  expect(p.onSelect).toHaveBeenCalledWith('t1')
  fireEvent.click(screen.getByText('Epic One')) // chip on the child card
  expect(p.onSelect).toHaveBeenCalledWith('e1')
})

test('column drag over, leave and drop', () => {
  const p = props()
  render(<Board {...p} />)
  const col = screen.getByText('To Do')
  fireEvent.dragOver(col, { dataTransfer: {} })
  fireEvent.dragLeave(col)
  fireEvent.drop(col, { dataTransfer: { getData: () => '' } }) // empty payload → no-op
  fireEvent.drop(col, { dataTransfer: { getData: () => 't2' } })
  expect(p.onDropStatus).toHaveBeenCalledWith('t2', 'open')
})

test('card drop reorders and changes status when needed', () => {
  const p = props()
  render(<Board {...p} />)
  const card = screen.getByText('Task One')
  fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn() } })
  fireEvent.dragOver(card, { dataTransfer: {} }) // sets the insert indicator
  fireEvent.drop(card, { dataTransfer: { getData: () => 't1' } }) // self-drop → no-op
  expect(p.onReorder).not.toHaveBeenCalled()
  fireEvent.drop(card, { dataTransfer: { getData: () => 't2' } })
  expect(p.onDropStatus).toHaveBeenCalledWith('t2', 'open') // t2 was in_progress
  expect(p.onReorder).toHaveBeenCalledWith('t2', 't1', false)
  fireEvent.dragEnd(card)
})

test('top-half drop inserts before the target', () => {
  const p = props()
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 0, height: 40 })
  render(<Board {...p} />)
  const card = screen.getByText('Task One')
  const drop = createEvent.drop(card, { dataTransfer: { getData: () => 't2' } })
  Object.defineProperty(drop, 'clientY', { value: 5 })
  fireEvent(card, drop)
  expect(p.onReorder).toHaveBeenCalledWith('t2', 't1', true)
})
