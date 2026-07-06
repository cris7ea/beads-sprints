// Tests for task creation (toolbar / backlog sections / epic children) and deletion.
// Kept in its own file — repo-wide test coverage is being added separately.
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
  onAddChild: vi.fn(), onDelete: vi.fn(), ...over,
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
