// Tests for task creation (toolbar / backlog sections / epic children) and deletion.
// Kept in its own file — repo-wide test coverage is being added separately.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App, { NewIssueModal, CreatedToast } from './App'
import Backlog from './Backlog'
import IssueDetail from './IssueDetail'
import { buildMaps } from './model'

const mk = (id, over = {}) => ({
  id, title: id, issue_type: 'task', priority: 2, status: 'open', labels: ['backlog'],
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', dependencies: [], ...over,
})

const epic = mk('e1', { title: 'Epic One', issue_type: 'epic', priority: 1, labels: ['sprint:Alpha'] })
const kid = mk('t1', { title: 'Task One', labels: ['sprint:Alpha'], dependencies: [{ type: 'parent-child', depends_on_id: 'e1' }] })

// --- NewIssueModal ---

const modalProps = over => ({
  preset: {}, maps: buildMaps([]), types: ['task', 'bug', 'epic'], sprintNames: ['Alpha', 'Beta'],
  onCreate: vi.fn(), onClose: vi.fn(), ...over,
})

test('create is disabled until a title is entered, then submits the picked fields', () => {
  const p = modalProps({ preset: { sprint: 'Beta' } })
  render(<NewIssueModal {...p} />)
  const create = screen.getByRole('button', { name: 'Create task' })
  expect(create.disabled).toBe(true)
  fireEvent.change(screen.getByPlaceholderText('What needs to be done?'), { target: { value: '  My task  ' } })
  fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'bug' } })
  fireEvent.change(screen.getByLabelText('Priority'), { target: { value: '1' } })
  expect(create.disabled).toBe(false)
  fireEvent.click(create)
  expect(p.onCreate).toHaveBeenCalledWith({ title: 'My task', type: 'bug', priority: 1, sprint: 'Beta', parentId: null })
  expect(p.onClose).toHaveBeenCalled()
})

test('defaults to backlog and submits on Enter', () => {
  const p = modalProps()
  render(<NewIssueModal {...p} />)
  expect(screen.getByLabelText('Sprint').value).toBe('')
  const input = screen.getByPlaceholderText('What needs to be done?')
  fireEvent.change(input, { target: { value: 'Loose end' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(p.onCreate).toHaveBeenCalledWith({ title: 'Loose end', type: 'task', priority: 2, sprint: null, parentId: null })
})

test('Enter without a title does not create; Escape closes', () => {
  const p = modalProps()
  render(<NewIssueModal {...p} />)
  const input = screen.getByPlaceholderText('What needs to be done?')
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(p.onCreate).not.toHaveBeenCalled()
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(p.onClose).toHaveBeenCalled()
})

test('shows the target epic and passes parentId through', () => {
  const p = modalProps({ preset: { parentId: 'e1', sprint: 'Alpha' }, maps: buildMaps([epic]) })
  render(<NewIssueModal {...p} />)
  screen.getByText('Epic One')
  expect(screen.getByLabelText('Sprint').value).toBe('Alpha')
  fireEvent.change(screen.getByPlaceholderText('What needs to be done?'), { target: { value: 'Child task' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create task' }))
  expect(p.onCreate).toHaveBeenCalledWith({ title: 'Child task', type: 'task', priority: 2, sprint: 'Alpha', parentId: 'e1' })
})

// --- Backlog section footers ---

const backlogProps = over => {
  const issues = [epic, kid, mk('b1', { title: 'Backlog Task' }), mk('o1', { title: 'Old Task', status: 'closed', labels: ['sprint:Old'] })]
  return {
    issues, maps: buildMaps(issues), sprintNames: ['Alpha', 'Beta'], completedNames: ['Old'], activeSprint: 'Alpha',
    labelFor: n => `sprint:${n}`, showClosed: false,
    onMoveSprint: vi.fn(), sortIssues: l => l, onReorder: vi.fn(), onStart: vi.fn(), onComplete: vi.fn(),
    onCreate: vi.fn(), onRename: vi.fn(), onSelect: vi.fn(), selectedId: null, onNewIssue: vi.fn(), ...over,
  }
}

test('each open section has a + Create footer targeting that sprint (none for completed)', () => {
  const p = backlogProps()
  render(<Backlog {...p} />)
  const btns = screen.getAllByText('+ Create')
  expect(btns.length).toBe(3) // Alpha, Beta, Backlog — not the completed "Old" section
  fireEvent.click(btns[0])
  expect(p.onNewIssue).toHaveBeenCalledWith('Alpha')
  fireEvent.click(btns[1])
  expect(p.onNewIssue).toHaveBeenCalledWith('Beta')
  fireEvent.click(btns[2])
  expect(p.onNewIssue).toHaveBeenCalledWith(null)
})

// --- IssueDetail: add child + delete ---

const detailProps = over => ({
  issue: epic, maps: buildMaps([epic, kid]), types: ['task', 'epic'], sprintNames: ['Alpha', 'Beta'],
  projectDir: '/proj', onUpdate: vi.fn(), onMoveSprint: vi.fn(), onSelect: vi.fn(), onClose: vi.fn(),
  onAddChild: vi.fn(), onDelete: vi.fn(), onDep: vi.fn(), ...over,
})

test('epic children header has an Add task button that auto-detects the sprint', () => {
  const p = detailProps()
  render(<IssueDetail {...p} />)
  fireEvent.click(screen.getByText('+ Add task'))
  expect(p.onAddChild).toHaveBeenCalledWith({ parentId: 'e1', sprint: 'Alpha' })
})

test('an epic in the backlog reports sprint null when adding a task', () => {
  const bEpic = { ...epic, labels: ['backlog'] }
  const p = detailProps({ issue: bEpic, maps: buildMaps([bEpic, kid]) })
  render(<IssueDetail {...p} />)
  fireEvent.click(screen.getByText('+ Add task'))
  expect(p.onAddChild).toHaveBeenCalledWith({ parentId: 'e1', sprint: null })
})

test('delete task button at the end of the pane calls onDelete', () => {
  const p = detailProps()
  render(<IssueDetail {...p} />)
  fireEvent.click(screen.getByText('Delete task'))
  expect(p.onDelete).toHaveBeenCalledWith('e1')
})

// --- App integration: toolbar create + detail-pane delete drive bd ---

function setupApp(issues) {
  window.api = {
    bd: vi.fn(async (dir, args) => {
      if (args[0] === 'list') return { ok: true, stdout: JSON.stringify(issues), stderr: '' }
      if (args[0] === 'create') {
        issues.push(mk('n1', { title: args[1] })) // next list call sees the new issue
        return { ok: true, stdout: 'n1\n', stderr: '' }
      }
      return { ok: true, stdout: '', stderr: '' }
    }),
    getSettings: vi.fn(async () => ({
      lastProject: '/proj', recentProjects: ['/proj'],
      projects: { '/proj': { sprints: ['Alpha', 'Beta'], activeSprint: 'Alpha' } },
    })),
    saveSettings: vi.fn(async () => {}),
    pickFolder: vi.fn(async () => null),
  }
  return window.api
}

test('toolbar + Create task opens the modal preset to the active sprint and runs bd create', async () => {
  const api = setupApp([kid])
  render(<App />)
  fireEvent.click(await screen.findByText('+ Create task'))
  expect(screen.getByLabelText('Sprint').value).toBe('Alpha') // board tab → active sprint
  fireEvent.change(screen.getByPlaceholderText('What needs to be done?'), { target: { value: 'From toolbar' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create task' }))
  await waitFor(() =>
    expect(api.bd).toHaveBeenCalledWith('/proj', ['create', 'From toolbar', '-t', 'task', '-p', '2', '-l', 'sprint:Alpha', '--silent'])
  )
  fireEvent.click(await screen.findByText('✕')) // dismiss the toast
  expect(screen.queryByText('n1')).toBeNull()
})

// --- IssueDetail: bottom Save/Cancel bar + keyboard shortcuts ---

test('Save/Cancel are disabled until an edit is made, then save both title and description', () => {
  const p = detailProps()
  render(<IssueDetail {...p} />)
  const save = screen.getByText('Save changes')
  const cancel = screen.getByText('Cancel')
  expect(save.disabled).toBe(true)
  expect(cancel.disabled).toBe(true)
  fireEvent.change(screen.getByDisplayValue('Epic One'), { target: { value: 'New name' } })
  fireEvent.change(screen.getByPlaceholderText('Add a description… (paste or drop images)'), { target: { value: 'new words' } })
  expect(save.disabled).toBe(false)
  fireEvent.mouseDown(save) // must not steal focus (would trigger the title blur-save)
  fireEvent.mouseDown(cancel)
  fireEvent.click(save)
  expect(p.onUpdate).toHaveBeenCalledWith('e1', ['--title', 'New name', '-d', 'new words'])
})

test('Cancel reverts pending edits without saving', () => {
  const p = detailProps()
  render(<IssueDetail {...p} />)
  const title = screen.getByDisplayValue('Epic One')
  const area = screen.getByPlaceholderText('Add a description… (paste or drop images)')
  fireEvent.change(title, { target: { value: 'Oops' } })
  fireEvent.change(area, { target: { value: 'scratch that' } })
  fireEvent.click(screen.getByText('Cancel'))
  expect(title.value).toBe('Epic One')
  expect(area.value).toBe('')
  expect(p.onUpdate).not.toHaveBeenCalled()
})

test('⌘S saves pending edits and Escape discards them', () => {
  const p = detailProps()
  render(<IssueDetail {...p} />)
  const area = screen.getByPlaceholderText('Add a description… (paste or drop images)')
  fireEvent.change(area, { target: { value: 'typed' } })
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(area.value).toBe('')
  fireEvent.change(area, { target: { value: 'typed again' } })
  fireEvent.keyDown(window, { key: 's', metaKey: true })
  expect(p.onUpdate).toHaveBeenCalledWith('e1', ['-d', 'typed again'])
})

// --- IssueDetail: dependency add/update/remove ---

const blocker = mk('x1', { title: 'Blocker One' })
const free = mk('x2', { title: 'Free Agent' })
const depTask = mk('t9', { title: 'Dep Holder', dependencies: [{ type: 'blocks', depends_on_id: 'x1' }] })
const depMaps = () => buildMaps([depTask, blocker, free])

test('removing a blocker calls onDep with (remove, blocked, blocker)', () => {
  const p = detailProps({ issue: depTask, maps: depMaps() })
  render(<IssueDetail {...p} />)
  screen.getByText('Blocker One')
  fireEvent.click(screen.getByTitle('Remove link'))
  expect(p.onDep).toHaveBeenCalledWith('remove', 't9', 'x1')
})

test('removing from the Blocks list reverses the direction', () => {
  const p = detailProps({ issue: blocker, maps: depMaps() })
  render(<IssueDetail {...p} />)
  screen.getByText('Dep Holder') // t9 is listed under Blocks
  fireEvent.click(screen.getByTitle('Remove link'))
  expect(p.onDep).toHaveBeenCalledWith('remove', 't9', 'x1')
})

test('adding a blocker: picker excludes self and existing links, then calls onDep add', () => {
  const p = detailProps({ issue: depTask, maps: depMaps() })
  render(<IssueDetail {...p} />)
  fireEvent.click(screen.getAllByText('+ Add')[0]) // Blocked by section
  const picker = screen.getByPlaceholderText('Search issues…').parentElement
  expect(within(picker).queryByText('Dep Holder')).toBeNull() // self
  expect(within(picker).queryByText('Blocker One')).toBeNull() // already linked
  fireEvent.change(screen.getByPlaceholderText('Search issues…'), { target: { value: 'free' } })
  fireEvent.click(within(picker).getByText('Free Agent'))
  expect(p.onDep).toHaveBeenCalledWith('add', 't9', 'x2')
  expect(screen.queryByPlaceholderText('Search issues…')).toBeNull() // picker closed
})

test('adding to Blocks links the picked issue as the blocked one', () => {
  const p = detailProps({ issue: depTask, maps: depMaps() })
  render(<IssueDetail {...p} />)
  fireEvent.click(screen.getAllByText('+ Add')[1]) // Blocks section
  const picker = screen.getByPlaceholderText('Search issues…').parentElement
  fireEvent.click(within(picker).getByText('Free Agent'))
  expect(p.onDep).toHaveBeenCalledWith('add', 'x2', 't9')
})

test('Escape closes either dep picker without adding', () => {
  const p = detailProps({ issue: depTask, maps: depMaps() })
  render(<IssueDetail {...p} />)
  for (const section of [0, 1]) {
    fireEvent.click(screen.getAllByText('+ Add')[section])
    fireEvent.keyDown(screen.getByPlaceholderText('Search issues…'), { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Search issues…')).toBeNull()
  }
  expect(p.onDep).not.toHaveBeenCalled()
})

test('adding a dependency from the detail pane runs bd dep add', async () => {
  const api = setupApp([kid, epic])
  render(<App />)
  fireEvent.click(await screen.findByText('Task One'))
  fireEvent.click((await screen.findAllByText('+ Add'))[0]) // Blocked by
  const picker = screen.getByPlaceholderText('Search issues…').parentElement
  fireEvent.click(within(picker).getByText('Epic One'))
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith('/proj', ['dep', 'add', 't1', 'e1']))
})

test('assigning an epic from the detail pane runs bd dep add with parent-child type', async () => {
  const orphan = mk('t2', { title: 'Orphan Task', labels: ['sprint:Alpha'] })
  const api = setupApp([orphan, epic])
  render(<App />)
  fireEvent.click(await screen.findByText('Orphan Task'))
  fireEvent.click(await screen.findByTitle('Edit epic'))
  const select = screen.getByText('Epic').parentElement.parentElement.querySelector('select')
  fireEvent.change(select, { target: { value: 'e1' } })
  fireEvent.click(screen.getByTitle('Save'))
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith('/proj', ['dep', 'add', 't2', 'e1', '--type', 'parent-child']))
})

test('clearing the epic from the detail pane runs bd dep remove', async () => {
  const api = setupApp([kid, epic])
  render(<App />)
  fireEvent.click(await screen.findByText('Task One'))
  fireEvent.click(await screen.findByTitle('Edit epic'))
  const select = screen.getByText('Epic').parentElement.parentElement.querySelector('select')
  expect(select.value).toBe('e1')
  fireEvent.change(select, { target: { value: '' } })
  fireEvent.click(screen.getByTitle('Save'))
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith('/proj', ['dep', 'remove', 't1', 'e1']))
})

// --- CreatedToast ---

test('toast shows id + title, copies the id, and wires View/close', () => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn() }, configurable: true })
  const p = { toast: { id: 'x-1', title: 'Some task' }, onView: vi.fn(), onClose: vi.fn() }
  render(<CreatedToast {...p} />)
  screen.getByText('x-1')
  screen.getByText('Some task')
  fireEvent.click(screen.getByText('Copy ID'))
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('x-1')
  screen.getByText('Copied!')
  fireEvent.click(screen.getByText('View'))
  expect(p.onView).toHaveBeenCalled()
  fireEvent.click(screen.getByText('✕'))
  expect(p.onClose).toHaveBeenCalled()
})

test('creating a task shows a toast whose View opens the detail pane', async () => {
  setupApp([kid])
  render(<App />)
  fireEvent.click(await screen.findByText('+ Create task'))
  fireEvent.change(screen.getByPlaceholderText('What needs to be done?'), { target: { value: 'Fresh task' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create task' }))
  await screen.findByText('n1') // toast carries the new id
  screen.getByText('Fresh task')
  fireEvent.click(screen.getByText('View'))
  await screen.findByText('Delete task') // right-side detail pane opened for the new task
  fireEvent.click(screen.getByText('✕')) // pane close button
  expect(screen.queryByText('Delete task')).toBeNull()
})

test('deleting from the detail pane confirms and runs bd delete --force', async () => {
  const api = setupApp([kid])
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<App />)
  fireEvent.click(await screen.findByText('Task One')) // board card → detail pane
  fireEvent.click(await screen.findByText('Delete task'))
  expect(window.confirm).toHaveBeenCalled()
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith('/proj', ['delete', 't1', '--force']))
})
