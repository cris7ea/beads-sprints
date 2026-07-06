import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App, { NewIssueModal } from './App'
import { buildMaps } from './model'

const mkIssue = (id, over = {}) => ({
  id, title: id, issue_type: 'task', priority: 2, status: 'open', labels: ['backlog'],
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', dependencies: [], ...over,
})

const projIssues = () => [
  mkIssue('e1', { title: 'Epic One', issue_type: 'epic', labels: ['sprint:Alpha'] }),
  mkIssue('t1', { title: 'Task One', labels: ['sprint:Alpha'], dependencies: [{ type: 'parent-child', depends_on_id: 'e1' }] }),
  mkIssue('t2', { title: 'Task Two', issue_type: 'bug', priority: 0, status: 'in_progress', labels: ['sprint:Alpha'] }),
  mkIssue('t3', { title: 'Task Three', status: 'closed', labels: ['sprint:Old'] }),
  mkIssue('t4', { title: 'Task Four', issue_type: 'feature', labels: ['backlog'] }),
]

const projSettings = (proj = {}) => ({
  lastProject: '/proj',
  recentProjects: ['/proj'],
  projects: { '/proj': { sprints: ['Alpha', 'Beta'], activeSprint: 'Alpha', completedSprints: ['Old'], ...proj } },
})

function setup({ settings = {}, issues = [], bd } = {}) {
  window.api = {
    bd: vi.fn(async (dir, args) => {
      const custom = bd?.(args)
      if (custom) return custom
      if (args[0] === 'list') return { ok: true, stdout: JSON.stringify(issues), stderr: '' }
      return { ok: true, stdout: '', stderr: '' }
    }),
    getSettings: vi.fn(async () => settings),
    saveSettings: vi.fn(async () => {}),
    pickFolder: vi.fn(async () => null),
    saveAttachment: vi.fn(async () => '.beads/attachments/x.png'),
    deleteAttachment: vi.fn(async () => true),
    openPath: vi.fn(),
  }
  return window.api
}

async function openApp(opts) {
  const api = setup(opts)
  render(<App />)
  await screen.findByRole('button', { name: 'proj' })
  return api
}

const goBacklog = () => fireEvent.click(screen.getByRole('button', { name: 'Backlog' }))
const sprintSelect = () => screen.getByText('Sprint').parentElement.querySelector('select')

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {})
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  window.history.pushState({}, '', '/')
})

test('project picker: remove recent, cancelled/failed/successful pick', async () => {
  const api = setup({ settings: { recentProjects: ['/one', '/two'] } })
  render(<App />)
  await screen.findByText('Select a beads project')

  fireEvent.click(screen.getAllByTitle('Remove from recents')[1])
  await waitFor(() => expect(screen.queryByText('/two')).toBeNull())
  expect(api.saveSettings).toHaveBeenCalled()

  api.pickFolder.mockResolvedValueOnce(null) // user cancelled
  fireEvent.click(screen.getByText('+ Add project'))
  api.pickFolder.mockResolvedValueOnce({ error: 'No .beads directory found in /x' })
  fireEvent.click(screen.getByText('+ Add project'))
  await waitFor(() => expect(api.pickFolder).toHaveBeenCalledTimes(2))
  screen.getByText('Select a beads project') // still on the picker

  api.pickFolder.mockResolvedValueOnce({ dir: '/one' })
  fireEvent.click(screen.getByText('+ Add project'))
  await screen.findByRole('button', { name: 'one' })
})

test('opens a recent project from the picker', async () => {
  setup({ settings: { ...projSettings(), lastProject: null }, issues: projIssues() })
  render(<App />)
  await screen.findByText('Select a beads project')
  fireEvent.click(screen.getByText('proj'))
  await screen.findByText('Task One')
})

test('auto-opens last project: board, filters, tabs, eye, refresh, switch', async () => {
  await openApp({ settings: projSettings(), issues: projIssues() })
  screen.getByText('To Do')
  await screen.findByText('Task One')
  screen.getByText(/Sprint:/)

  fireEvent.change(screen.getByDisplayValue('Priority: All'), { target: { value: '0' } })
  expect(screen.queryByText('Task One')).toBeNull()
  screen.getByText('Task Two')
  fireEvent.change(screen.getByDisplayValue('P0'), { target: { value: 'all' } })

  fireEvent.change(screen.getByDisplayValue('Type: All'), { target: { value: 'bug' } })
  expect(screen.queryByText('Task One')).toBeNull()
  fireEvent.change(screen.getByDisplayValue('bug'), { target: { value: 'all' } })

  fireEvent.click(screen.getByTitle('Show closed issues'))
  fireEvent.click(screen.getByTitle('Hide closed issues'))
  fireEvent.click(screen.getByTitle('Refresh beads data'))

  goBacklog()
  await screen.findByText('Active')

  fireEvent.click(screen.getByRole('button', { name: 'proj' })) // switch project
  screen.getByText('Select a beads project')
})

test('bd failure shows a dismissible error banner', async () => {
  setup({ settings: projSettings(), bd: args => (args[0] === 'list' ? { ok: false, stderr: ' boom ' } : null) })
  render(<App />)
  await screen.findByText('boom')
  fireEvent.click(screen.getByText('Dismiss'))
  expect(screen.queryByText('boom')).toBeNull()
})

test('empty stderr falls back to a generic message', async () => {
  setup({ settings: projSettings(), bd: args => (args[0] === 'list' ? { ok: false, stderr: '' } : null) })
  render(<App />)
  await screen.findByText('bd command failed')
})

test('unparseable bd output shows an error', async () => {
  setup({ settings: projSettings(), bd: args => (args[0] === 'list' ? { ok: true, stdout: '{nope' } : null) })
  render(<App />)
  await screen.findByText('Could not parse bd output')
})

test('mirrors the backlog label onto unlabelled issues', async () => {
  const api = setup({
    settings: projSettings(),
    issues: [mkIssue('m1', { labels: [] }), mkIssue('m2', { labels: ['sprint:Alpha', 'backlog'] })],
  })
  render(<App />)
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith('/proj', ['label', 'add', 'm1', 'backlog']))
  expect(api.bd).toHaveBeenCalledWith('/proj', ['label', 'remove', 'm2', 'backlog'])
})

test('find modal: search, filters, select, close', async () => {
  await openApp({ settings: projSettings(), issues: projIssues() })
  fireEvent.keyDown(window, { key: 'f', metaKey: true })
  const input = await screen.findByPlaceholderText('Find issues by title or id…')
  const modal = input.closest('.bg-white')

  fireEvent.change(input, { target: { value: 'zzz' } })
  within(modal).getByText('No matching issues.')

  fireEvent.change(input, { target: { value: 'four' } })
  fireEvent.change(within(modal).getByDisplayValue('Type: All'), { target: { value: 'feature' } })
  fireEvent.change(within(modal).getByDisplayValue('Priority: All'), { target: { value: '2' } })
  fireEvent.change(within(modal).getByDisplayValue('Status: All'), { target: { value: 'open' } })
  fireEvent.click(within(modal).getByText('Task Four'))
  expect(screen.queryByPlaceholderText('Find issues by title or id…')).toBeNull()
  screen.getByDisplayValue('Task Four') // detail opened

  fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
  await screen.findByPlaceholderText('Find issues by title or id…')
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByPlaceholderText('Find issues by title or id…')).toBeNull()

  fireEvent.click(screen.getByTitle('Find issues (⌘F)'))
  await screen.findByPlaceholderText('Find issues by title or id…')
})

test('board drops update status and persist manual order', async () => {
  const api = await openApp({ settings: projSettings(), issues: projIssues() })
  const card = await screen.findByText('Task One')
  fireEvent.drop(card, { dataTransfer: { getData: () => 't2' } })
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith('/proj', ['update', 't2', '-s', 'open']))
  await waitFor(() => expect(api.saveSettings).toHaveBeenCalledWith(expect.objectContaining({
    projects: expect.objectContaining({ '/proj': expect.objectContaining({ order: expect.any(Array) }) }),
  })))
  fireEvent.drop(screen.getByText('Done'), { dataTransfer: { getData: () => 't1' } })
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith('/proj', ['update', 't1', '-s', 'closed']))
})

test('moving issues between sprints via the detail panel', async () => {
  const api = await openApp({ settings: projSettings(), issues: projIssues() })
  goBacklog()

  fireEvent.click(await screen.findByText('Task Four'))
  fireEvent.change(sprintSelect(), { target: { value: 'Alpha' } })
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith('/proj', ['label', 'add', 't4', 'sprint:Alpha']))

  // an epic carries its children out of the sprint
  fireEvent.click(screen.getByText('Epic One'))
  fireEvent.change(sprintSelect(), { target: { value: '' } })
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith('/proj', ['label', 'remove', 'e1', 't1', 'sprint:Alpha']))

  // completed sprint labels stay on as history
  fireEvent.click(screen.getByText('Old').parentElement.querySelector('button'))
  fireEvent.click(screen.getByText('Task Three'))
  fireEvent.change(sprintSelect(), { target: { value: 'Alpha' } })
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith('/proj', ['label', 'add', 't3', 'sprint:Alpha']))
  expect(api.bd).not.toHaveBeenCalledWith('/proj', ['label', 'remove', 't3', 'sprint:Old'])
})

test('create, duplicate-create, rename and start-sprint guards', async () => {
  const api = await openApp({ settings: projSettings(), issues: projIssues() })
  goBacklog()

  fireEvent.click(await screen.findByText('+ Create sprint'))
  fireEvent.change(screen.getByPlaceholderText('Sprint name…'), { target: { value: 'Gamma' } })
  fireEvent.keyDown(screen.getByPlaceholderText('Sprint name…'), { key: 'Enter' })
  await screen.findByText('Gamma')

  fireEvent.click(screen.getByText('+ Create sprint')) // duplicate name → no-op
  fireEvent.change(screen.getByPlaceholderText('Sprint name…'), { target: { value: 'Alpha' } })
  fireEvent.keyDown(screen.getByPlaceholderText('Sprint name…'), { key: 'Enter' })

  fireEvent.click(screen.getAllByTitle('Rename sprint')[0]) // Alpha → Beta exists
  fireEvent.change(screen.getByDisplayValue('Alpha'), { target: { value: 'Beta' } })
  fireEvent.keyDown(screen.getByDisplayValue('Beta'), { key: 'Enter' })
  expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('already exists'))

  fireEvent.click(screen.getAllByTitle('Rename sprint')[0]) // rename to itself → no-op
  fireEvent.keyDown(screen.getByDisplayValue('Alpha'), { key: 'Enter' })

  fireEvent.click(screen.getAllByTitle('Rename sprint')[0]) // real rename relabels issues
  fireEvent.change(screen.getByDisplayValue('Alpha'), { target: { value: 'Zed' } })
  fireEvent.click(screen.getByText('Save'))
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith('/proj', ['label', 'add', 'e1', 't1', 't2', 'sprint:Zed']))
  expect(api.bd).toHaveBeenCalledWith('/proj', ['label', 'remove', 'e1', 't1', 't2', 'sprint:Alpha'])

  fireEvent.click(screen.getAllByText('Start sprint')[0]) // another sprint is active
  expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('still active'))
})

test('renaming a discovered-only sprint adds it to known sprints', async () => {
  const api = await openApp({
    settings: projSettings(),
    issues: [...projIssues(), mkIssue('x5', { title: 'Legacy Task', labels: ['sprint-legacy'] })],
  })
  goBacklog()
  const pencils = await screen.findAllByTitle('Rename sprint')
  fireEvent.click(pencils[2]) // sprint-legacy, after Alpha and Beta
  fireEvent.change(screen.getByDisplayValue('sprint-legacy'), { target: { value: 'Legacy' } })
  fireEvent.keyDown(screen.getByDisplayValue('Legacy'), { key: 'Enter' })
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith('/proj', ['label', 'add', 'x5', 'sprint:Legacy']))
  expect(api.bd).toHaveBeenCalledWith('/proj', ['label', 'remove', 'x5', 'sprint-legacy'])
})

test('starting a sprint when none is active', async () => {
  await openApp({ settings: projSettings({ activeSprint: null }), issues: projIssues() })
  fireEvent.click(await screen.findByText('Go to Backlog')) // board empty state
  fireEvent.click(screen.getAllByText('Start sprint')[0]) // Alpha
  await screen.findByText('Active')
})

test('completing a sprint with unfinished issues: cancel, backdrop, move to another sprint', async () => {
  const api = await openApp({ settings: projSettings(), issues: projIssues() })
  goBacklog()
  fireEvent.click(await screen.findByText('Complete sprint'))
  let modal = (await screen.findByText('Complete "Alpha"')).parentElement
  within(modal).getByText('3') // e1, t1, t2 unfinished

  fireEvent.click(within(modal).getByText('Cancel'))
  expect(screen.queryByText('Complete "Alpha"')).toBeNull()

  fireEvent.click(screen.getByText('Complete sprint'))
  modal = screen.getByText('Complete "Alpha"').parentElement
  fireEvent.click(modal.parentElement) // backdrop closes
  expect(screen.queryByText('Complete "Alpha"')).toBeNull()

  fireEvent.click(screen.getByText('Complete sprint'))
  modal = screen.getByText('Complete "Alpha"').parentElement
  fireEvent.change(within(modal).getByRole('combobox'), { target: { value: 'Beta' } })
  fireEvent.click(within(modal).getByText('Complete sprint'))
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith('/proj', ['label', 'add', 'e1', 't1', 't2', 'sprint:Beta']))
})

test('completing a sprint to the backlog strips its label', async () => {
  const api = await openApp({ settings: projSettings(), issues: projIssues() })
  goBacklog()
  fireEvent.click(await screen.findByText('Complete sprint'))
  const modal = (await screen.findByText('Complete "Alpha"')).parentElement
  fireEvent.click(within(modal).getByText('Complete sprint')) // target stays '' = backlog
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith('/proj', ['label', 'remove', 'e1', 't1', 't2', 'sprint:Alpha']))
})

test('completing an empty sprint asks for confirmation', async () => {
  const api = await openApp({
    settings: projSettings({ sprints: ['Empty'], activeSprint: 'Empty', completedSprints: [] }),
    issues: projIssues(),
  })
  goBacklog()
  window.confirm.mockReturnValueOnce(false)
  fireEvent.click(await screen.findByText('Complete sprint'))
  expect(window.confirm).toHaveBeenCalledWith('Complete "Empty"?')
  screen.getByText('Complete sprint') // declined → still active

  fireEvent.click(screen.getByText('Complete sprint'))
  await waitFor(() => expect(api.saveSettings).toHaveBeenCalledWith(expect.objectContaining({
    projects: expect.objectContaining({
      '/proj': expect.objectContaining({ completedSprints: ['Empty'], activeSprint: null }),
    }),
  })))
})

test('NewIssueModal: guards, presets and payload', () => {
  const onCreate = vi.fn()
  const onClose = vi.fn()
  render(
    <NewIssueModal
      preset={{ parentId: 'e1', sprint: 'Ghost' }}
      maps={buildMaps(projIssues())}
      types={['task', 'bug']}
      sprintNames={['Alpha']}
      onCreate={onCreate}
      onClose={onClose}
    />
  )
  screen.getByText('In epic')
  screen.getByText('Epic One')
  const input = screen.getByPlaceholderText('What needs to be done?')
  fireEvent.keyDown(input, { key: 'Enter' }) // empty title → no create
  expect(onCreate).not.toHaveBeenCalled()
  expect(screen.getByText('Create task').disabled).toBe(true)

  fireEvent.change(input, { target: { value: '  Child task ' } })
  fireEvent.change(screen.getByDisplayValue('task'), { target: { value: 'bug' } })
  fireEvent.change(screen.getByDisplayValue('P2 · Medium'), { target: { value: '1' } })
  fireEvent.change(screen.getByDisplayValue('Ghost'), { target: { value: '' } }) // unknown preset sprint kept as option
  fireEvent.click(screen.getByText('Create task'))
  expect(onCreate).toHaveBeenCalledWith({ title: 'Child task', type: 'bug', priority: 1, sprint: null, parentId: 'e1' })
  expect(onClose).toHaveBeenCalledTimes(1)

  fireEvent.keyDown(input, { key: 'Escape' })
  fireEvent.click(screen.getByText('Cancel'))
  fireEvent.click(screen.getByText('New task').parentElement.parentElement) // backdrop
  expect(onClose).toHaveBeenCalledTimes(4)
})

test('creating tasks from the header, a backlog section and an epic', async () => {
  const api = await openApp({ settings: projSettings(), issues: projIssues() })

  fireEvent.click(screen.getByText('+ Create task')) // board tab → presets the active sprint
  let input = await screen.findByPlaceholderText('What needs to be done?')
  fireEvent.change(input, { target: { value: 'Board task' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith('/proj', ['create', 'Board task', '-t', 'task', '-p', '2', '-l', 'sprint:Alpha', '--silent']))
  expect(screen.queryByPlaceholderText('What needs to be done?')).toBeNull()

  goBacklog()
  fireEvent.click((await screen.findAllByText('+ Create'))[2]) // backlog section → no sprint
  input = await screen.findByPlaceholderText('What needs to be done?')
  fireEvent.change(input, { target: { value: 'Backlog task' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith('/proj', ['create', 'Backlog task', '-t', 'task', '-p', '2', '-l', 'backlog', '--silent']))

  fireEvent.click(screen.getByText('Epic One')) // add a child from the detail panel
  fireEvent.click(screen.getByText('+ Add task'))
  input = await screen.findByPlaceholderText('What needs to be done?')
  fireEvent.change(input, { target: { value: 'Child' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith(
    '/proj',
    ['create', 'Child', '-t', 'task', '-p', '2', '-l', 'sprint:Alpha', '--silent', '--parent', 'e1', '--no-inherit-labels'],
  ))
})

test('deleting an issue asks for confirmation first', async () => {
  const api = await openApp({ settings: projSettings(), issues: projIssues() })
  goBacklog()
  fireEvent.click(await screen.findByText('Task Four'))

  window.confirm.mockReturnValueOnce(false)
  fireEvent.click(screen.getByText('Delete task'))
  expect(api.bd).not.toHaveBeenCalledWith('/proj', ['delete', 't4', '--force'])

  fireEvent.click(screen.getByText('Delete task'))
  await waitFor(() => expect(api.bd).toHaveBeenCalledWith('/proj', ['delete', 't4', '--force']))
  await waitFor(() => expect(screen.queryByText('Delete task')).toBeNull()) // detail closed
})

test('tab and selection come from the URL', async () => {
  window.history.pushState({}, '', '/?tab=backlog&sel=t4')
  await openApp({ settings: projSettings(), issues: projIssues() })
  await screen.findByText('Active') // backlog tab
  await screen.findByDisplayValue('Task Four') // detail open from sel
})
