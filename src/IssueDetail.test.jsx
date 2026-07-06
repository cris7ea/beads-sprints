import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import IssueDetail from './IssueDetail'
import { buildMaps } from './model'

const desc = 'Hello\n![shot](.beads/attachments/a.png)\n![](/abs/b.png)\n'
const issues = [
  { id: 'e1', title: 'Big Epic', issue_type: 'epic', priority: 1, status: 'open', labels: [], created_at: '2026-01-01', updated_at: '2026-01-02' },
  {
    id: 't1', title: 'Task', issue_type: 'task', priority: 2, status: 'open', description: desc,
    labels: ['sprint:Alpha', 'ui'], created_at: '2026-01-01', updated_at: '2026-01-02',
    dependencies: [{ type: 'parent-child', depends_on_id: 'e1' }, { type: 'blocks', depends_on_id: 'b1' }, { type: 'related', depends_on_id: 'r1' }],
  },
  { id: 'b1', title: 'Blocker', issue_type: 'task', priority: 2, status: 'open', created_at: '2026-01-01', updated_at: '2026-01-02' },
  { id: 'r1', title: 'Related item', issue_type: 'task', priority: 2, status: 'open', created_at: '2026-01-01', updated_at: '2026-01-02' },
  { id: 'k1', title: 'Kid', issue_type: 'task', priority: 2, status: 'closed', created_at: '2026-01-01', updated_at: '2026-01-02', dependencies: [{ type: 'parent-child', depends_on_id: 'e1' }, { type: 'blocks', depends_on_id: 't1' }] },
]
const maps = buildMaps(issues)
maps.childrenOf.e1.push('ghost') // unknown id → LinkRow fallback

const props = over => ({
  issue: maps.byId.t1, maps, types: ['task', 'bug', 'epic'], sprintNames: ['Alpha', 'Beta'],
  projectDir: '/proj', onUpdate: vi.fn(), onMoveSprint: vi.fn(), onSelect: vi.fn(), onClose: vi.fn(),
  onAddChild: vi.fn(), onDelete: vi.fn(), ...over,
})

beforeEach(() => {
  window.api = {
    deleteAttachment: vi.fn(async () => true),
    saveAttachment: vi.fn(async () => '.beads/attachments/new.png'),
    openPath: vi.fn(),
  }
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn() }, configurable: true })
})

test('renders relations, labels and dates', () => {
  const p = props({ issue: maps.byId.e1 })
  render(<IssueDetail {...p} />)
  screen.getByText('Children · 1/3 done') // k1 closed of t1, k1, ghost
  screen.getByText('Kid')
  screen.getByText('ghost') // unknown link id fallback
  fireEvent.click(screen.getByText('Kid'))
  expect(p.onSelect).toHaveBeenCalledWith('k1')
  fireEvent.click(screen.getByText('+ Add task'))
  expect(p.onAddChild).toHaveBeenCalledWith({ parentId: 'e1', sprint: null })
})

test('delete button hands off to onDelete', () => {
  const p = props()
  render(<IssueDetail {...p} />)
  fireEvent.click(screen.getByText('Delete task'))
  expect(p.onDelete).toHaveBeenCalledWith('t1')
})

test('task view: epic chip, blocked by, blocks, related, labels', () => {
  const p = props()
  render(<IssueDetail {...p} />)
  screen.getByText('Big Epic') // parent chip
  screen.getByText('Blocked by')
  screen.getByText('Blocker') // b1 blocks t1
  screen.getByText('Blocks')
  screen.getByText('Kid') // t1 blocks k1
  screen.getByText('Related item')
  screen.getByText('ui') // plain label, sprint label filtered out
  screen.getByText(/Created .* Updated/)
  fireEvent.click(screen.getAllByText('✕')[0]) // panel close, not the image delete buttons
  expect(p.onClose).toHaveBeenCalled()
})

test('copying the id shows transient feedback', () => {
  vi.useFakeTimers()
  render(<IssueDetail {...props()} />)
  fireEvent.click(screen.getByText('t1'))
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('t1')
  expect(screen.getByText('Copied!').className).toContain('opacity-100')
  act(() => vi.advanceTimersByTime(2000))
  expect(screen.getByText('Copied!').className).toContain('opacity-0')
  vi.useRealTimers()
})

test('title edits save on blur only when changed', () => {
  const p = props()
  render(<IssueDetail {...p} />)
  const title = screen.getByDisplayValue('Task')
  fireEvent.blur(title) // unchanged → no update
  fireEvent.change(title, { target: { value: '  ' } })
  fireEvent.blur(title) // blank → no update
  expect(p.onUpdate).not.toHaveBeenCalled()
  fireEvent.change(title, { target: { value: 'New title' } })
  fireEvent.blur(title)
  expect(p.onUpdate).toHaveBeenCalledWith('t1', ['--title', 'New title'])
})

test('status, priority, type and sprint selects', () => {
  const p = props()
  render(<IssueDetail {...p} />)
  const selectFor = label => screen.getByText(label).parentElement.querySelector('select')
  fireEvent.change(selectFor('Status'), { target: { value: 'closed' } })
  expect(p.onUpdate).toHaveBeenCalledWith('t1', ['-s', 'closed'])
  fireEvent.change(selectFor('Priority'), { target: { value: '0' } })
  expect(p.onUpdate).toHaveBeenCalledWith('t1', ['-p', '0'])
  fireEvent.change(selectFor('Type'), { target: { value: 'bug' } })
  expect(p.onUpdate).toHaveBeenCalledWith('t1', ['-t', 'bug'])
  fireEvent.change(selectFor('Sprint'), { target: { value: 'Beta' } })
  expect(p.onMoveSprint).toHaveBeenCalledWith('t1', 'Beta')
  fireEvent.change(selectFor('Sprint'), { target: { value: '' } })
  expect(p.onMoveSprint).toHaveBeenCalledWith('t1', null)
})

test('sprint select keeps an unknown membership as an extra option', () => {
  render(<IssueDetail {...props({ sprintNames: ['Beta'] })} />)
  const select = screen.getByText('Sprint').parentElement.querySelector('select')
  expect(select.value).toBe('Alpha')
  expect([...select.options].map(o => o.value)).toContain('Alpha')
})

test('description edit with save and cancel', () => {
  const p = props()
  render(<IssueDetail {...p} />)
  const area = screen.getByPlaceholderText('Add a description… (paste or drop images)')
  fireEvent.change(area, { target: { value: 'changed' } })
  fireEvent.click(screen.getByText('Cancel'))
  expect(area.value).toBe(desc)
  fireEvent.change(area, { target: { value: 'changed' } })
  fireEvent.click(screen.getByText('Save changes'))
  expect(p.onUpdate).toHaveBeenCalledWith('t1', ['-d', 'changed'])
})

test('images render, open and delete', async () => {
  const p = props()
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<IssueDetail {...p} />)
  const imgs = document.querySelectorAll('img')
  expect(imgs).toHaveLength(2)
  expect(imgs[0].src).toContain('/proj/.beads/attachments/a.png') // relative resolved
  expect(imgs[1].src).toContain('/abs/b.png') // absolute kept
  fireEvent.click(imgs[0])
  expect(window.api.openPath).toHaveBeenCalledWith('/proj/.beads/attachments/a.png')

  fireEvent.click(screen.getAllByTitle('Delete image')[0])
  expect(window.api.deleteAttachment).not.toHaveBeenCalled() // confirm declined

  window.confirm.mockReturnValue(true)
  fireEvent.click(screen.getAllByTitle('Delete image')[0])
  await waitFor(() => expect(window.api.deleteAttachment).toHaveBeenCalledWith('/proj', '.beads/attachments/a.png'))
  expect(p.onUpdate).toHaveBeenCalledWith('t1', ['-d', 'Hello\n![](/abs/b.png)'])
})

test('pasting an image uploads it and appends markdown', async () => {
  render(<IssueDetail {...props()} />)
  const area = screen.getByPlaceholderText('Add a description… (paste or drop images)')
  const file = { name: 'shot.png', type: 'image/png', arrayBuffer: async () => new ArrayBuffer(4) }
  fireEvent.paste(area, { clipboardData: { items: [{ type: 'text/plain' }, { type: 'image/png', getAsFile: () => file }] } })
  await waitFor(() => expect(window.api.saveAttachment).toHaveBeenCalled())
  await waitFor(() => expect(area.value).toContain('![shot.png](.beads/attachments/new.png)'))
  fireEvent.paste(area, { clipboardData: { items: [{ type: 'text/plain' }] } }) // no image → ignored
})

test('dropping an image file uploads it', async () => {
  render(<IssueDetail {...props()} />)
  const area = screen.getByPlaceholderText('Add a description… (paste or drop images)')
  fireEvent.dragOver(area, { dataTransfer: {} })
  const file = { type: 'image/png', arrayBuffer: async () => new ArrayBuffer(4) } // no name → ext from mime
  fireEvent.drop(area, { dataTransfer: { files: [{ type: 'text/plain' }, file] } })
  await waitFor(() => expect(area.value).toContain('![image.png](.beads/attachments/new.png)'))
  fireEvent.drop(area, { dataTransfer: { files: [] } }) // no image → ignored
})

test('resets local edits when the issue changes', () => {
  const p = props()
  const { rerender } = render(<IssueDetail {...p} />)
  fireEvent.change(screen.getByDisplayValue('Task'), { target: { value: 'dirty' } })
  rerender(<IssueDetail {...p} issue={maps.byId.b1} />)
  screen.getByDisplayValue('Blocker')
})
