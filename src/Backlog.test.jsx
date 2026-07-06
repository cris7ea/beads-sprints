import { render, screen, fireEvent } from '@testing-library/react'
import Backlog from './Backlog'
import { buildMaps } from './model'

const issues = [
  { id: 'e1', title: 'Epic One', issue_type: 'epic', priority: 1, status: 'open', labels: ['sprint:Alpha'] },
  { id: 't1', title: 'Task One', issue_type: 'task', priority: 0, status: 'open', labels: ['sprint:Alpha'], dependencies: [{ type: 'parent-child', depends_on_id: 'e1' }] },
  { id: 't2', title: 'Closed Task', issue_type: 'task', priority: 2, status: 'closed', labels: ['sprint:Alpha'] },
  { id: 'b1', title: 'Backlog Task', issue_type: 'bug', priority: 3, status: 'open', labels: ['backlog'] },
  { id: 'o1', title: 'Old Task', issue_type: 'task', priority: 2, status: 'closed', labels: ['sprint:Old'] },
]
const maps = buildMaps(issues)
const props = over => ({
  issues, maps, sprintNames: ['Alpha', 'Beta'], completedNames: ['Old'], activeSprint: 'Alpha',
  labelFor: n => `sprint:${n}`, showClosed: false,
  onMoveSprint: vi.fn(), sortIssues: l => l, onReorder: vi.fn(), onStart: vi.fn(),
  onComplete: vi.fn(), onCreate: vi.fn(), onRename: vi.fn(), onSelect: vi.fn(), selectedId: 'b1',
  onNewIssue: vi.fn(), ...over,
})

const chevronOf = name => screen.getByText(name).parentElement.querySelector('button')

test('renders sprint, completed and backlog sections', () => {
  render(<Backlog {...props()} />)
  screen.getByText('Active')
  screen.getByText('Completed')
  screen.getByText('Backlog Task')
  expect(screen.queryByText('Closed Task')).toBeNull() // eye off hides closed
  expect(screen.queryByText('Old Task')).toBeNull() // completed sections start collapsed
  screen.getByText('Drag issues here to add them to this sprint.') // Beta is empty
})

test('showClosed reveals closed issues', () => {
  render(<Backlog {...props({ showClosed: true })} />)
  screen.getByText('Closed Task')
})

test('expanding a completed section shows its history', () => {
  render(<Backlog {...props()} />)
  fireEvent.click(chevronOf('Old'))
  screen.getByText('Old Task')
  fireEvent.click(chevronOf('Old')) // collapse again
  expect(screen.queryByText('Old Task')).toBeNull()
})

test('collapsing a live section hides its rows', () => {
  render(<Backlog {...props()} />)
  fireEvent.click(chevronOf('Backlog'))
  expect(screen.queryByText('Backlog Task')).toBeNull()
})

test('empty backlog message', () => {
  render(<Backlog {...props({ issues: issues.filter(i => i.id !== 'b1') })} />)
  screen.getByText('Backlog is empty.')
})

test('create sprint: enter, escape and blur', () => {
  const p = props()
  render(<Backlog {...p} />)
  fireEvent.click(screen.getByText('+ Create sprint'))
  const input = screen.getByPlaceholderText('Sprint name…')
  fireEvent.change(input, { target: { value: '  Gamma ' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(p.onCreate).toHaveBeenCalledWith('Gamma')

  fireEvent.click(screen.getByText('+ Create sprint'))
  fireEvent.keyDown(screen.getByPlaceholderText('Sprint name…'), { key: 'Escape' })
  fireEvent.click(screen.getByText('+ Create sprint'))
  fireEvent.blur(screen.getByPlaceholderText('Sprint name…'))
  expect(p.onCreate).toHaveBeenCalledTimes(1) // empty submits don't create
})

test('rename sprint: save, cancel, enter, escape', () => {
  const p = props()
  render(<Backlog {...p} />)
  fireEvent.click(screen.getAllByTitle('Rename sprint')[0]) // Alpha
  fireEvent.change(screen.getByDisplayValue('Alpha'), { target: { value: 'Renamed' } })
  fireEvent.click(screen.getByText('Save'))
  expect(p.onRename).toHaveBeenCalledWith('Alpha', 'Renamed')

  fireEvent.click(screen.getAllByTitle('Rename sprint')[0])
  fireEvent.click(screen.getByText('Cancel'))

  fireEvent.click(screen.getAllByTitle('Rename sprint')[1]) // Beta
  fireEvent.keyDown(screen.getByDisplayValue('Beta'), { key: 'Enter' })
  expect(p.onRename).toHaveBeenCalledWith('Beta', 'Beta')

  fireEvent.click(screen.getAllByTitle('Rename sprint')[1])
  fireEvent.keyDown(screen.getByDisplayValue('Beta'), { key: 'Escape' })
})

test('start and complete buttons', () => {
  const p = props()
  render(<Backlog {...p} />)
  fireEvent.click(screen.getByText('Start sprint')) // Beta (Alpha is active)
  expect(p.onStart).toHaveBeenCalledWith('Beta')
  fireEvent.click(screen.getByText('Complete sprint'))
  expect(p.onComplete).toHaveBeenCalledWith('Alpha')
})

test('epic group rows expand and collapse', () => {
  render(<Backlog {...props()} />)
  screen.getByText('Task One') // nested under Epic One
  fireEvent.click(screen.getByTitle('Collapse tasks'))
  expect(screen.queryByText('Task One')).toBeNull()
  fireEvent.click(screen.getByTitle('Expand tasks'))
  screen.getByText('Task One')
})

test('dropping on a section moves the issue to that sprint', () => {
  const p = props()
  render(<Backlog {...p} />)
  const beta = screen.getByText('Drag issues here to add them to this sprint.')
  fireEvent.dragOver(beta, { dataTransfer: {} })
  fireEvent.dragLeave(beta)
  fireEvent.drop(beta, { dataTransfer: { getData: () => '' } }) // empty payload → no-op
  fireEvent.drop(beta, { dataTransfer: { getData: () => 'b1' } })
  expect(p.onMoveSprint).toHaveBeenCalledWith('b1', 'Beta')
})

test('dropping on a row moves and reorders', () => {
  const p = props()
  render(<Backlog {...p} />)
  const row = screen.getByText('Task One')
  fireEvent.dragStart(row, { dataTransfer: { setData: vi.fn() } })
  fireEvent.dragOver(row, { dataTransfer: {} })
  fireEvent.drop(row, { dataTransfer: { getData: () => 't1' } }) // self-drop → no-op
  expect(p.onReorder).not.toHaveBeenCalled()
  fireEvent.drop(row, { dataTransfer: { getData: () => 'b1' } }) // from outside the section
  expect(p.onMoveSprint).toHaveBeenCalledWith('b1', 'Alpha')
  expect(p.onReorder).toHaveBeenCalledWith('b1', 't1', false)
  fireEvent.drop(row, { dataTransfer: { getData: () => 'e1' } }) // same section → reorder only
  expect(p.onMoveSprint).toHaveBeenCalledTimes(1)
  fireEvent.dragEnd(row)
})

test('completed sections ignore drag and drop', () => {
  const p = props()
  render(<Backlog {...p} />)
  fireEvent.click(chevronOf('Old'))
  const row = screen.getByText('Old Task')
  fireEvent.dragOver(row, { dataTransfer: {} })
  fireEvent.drop(row, { dataTransfer: { getData: () => 'b1' } })
  fireEvent.drop(screen.getByText('Old'), { dataTransfer: { getData: () => 'b1' } })
  expect(p.onMoveSprint).not.toHaveBeenCalled()
  expect(p.onReorder).not.toHaveBeenCalled()
})

test('per-section create buttons pass the sprint name', () => {
  const p = props()
  render(<Backlog {...p} />)
  const buttons = screen.getAllByText('+ Create') // Alpha, Beta, Backlog — none on completed
  expect(buttons).toHaveLength(3)
  fireEvent.click(buttons[0])
  expect(p.onNewIssue).toHaveBeenCalledWith('Alpha')
  fireEvent.click(buttons[2])
  expect(p.onNewIssue).toHaveBeenCalledWith(null)
})

test('clicking a row selects it', () => {
  const p = props()
  render(<Backlog {...p} />)
  fireEvent.click(screen.getByText('Backlog Task'))
  expect(p.onSelect).toHaveBeenCalledWith('b1')
})
