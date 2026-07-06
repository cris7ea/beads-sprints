import { render, screen, fireEvent } from '@testing-library/react'
import { buildMaps } from './model'
import {
  TypeIcon, PriorityBadge, StatusDot, EpicChip, DepBadges, ProgressPill,
  Chevron, SprintMark, PencilIcon, RefreshIcon, SearchIcon, EyeIcon,
} from './ui'

test('TypeIcon renders every type plus a fallback', () => {
  for (const t of ['task', 'bug', 'feature', 'epic', 'chore', 'mystery']) {
    const { container, unmount } = render(<TypeIcon type={t} />)
    expect(container.querySelector('svg')).toBeTruthy()
    unmount()
  }
})

test('PriorityBadge titles known and unknown priorities', () => {
  render(<PriorityBadge p={0} />)
  expect(screen.getByText('P0').title).toBe('Critical')
  render(<PriorityBadge p={9} />)
  expect(screen.getByText('P9').title).toBe('P9')
})

test('StatusDot titles known and unknown statuses', () => {
  render(<StatusDot status="open" />)
  screen.getByTitle('To Do')
  render(<StatusDot status="weird" />)
  screen.getByTitle('weird')
})

test('EpicChip fires onClick with the epic id, tolerates no handler', () => {
  const onClick = vi.fn()
  render(<EpicChip epic={{ id: 'e1', title: 'Epic' }} onClick={onClick} />)
  fireEvent.click(screen.getByText('Epic'))
  expect(onClick).toHaveBeenCalledWith('e1')
  render(<EpicChip epic={{ id: 'e2', title: 'Orphan' }} />)
  fireEvent.click(screen.getByText('Orphan')) // no crash without onClick
})

test('DepBadges shows blocked-by and blocks counts', () => {
  const iss = [
    { id: 'a', status: 'open' },
    { id: 'b', status: 'open', dependencies: [{ type: 'blocks', depends_on_id: 'a' }] },
    { id: 'c', status: 'open', dependencies: [{ type: 'blocks', depends_on_id: 'a' }] },
    { id: 'd', status: 'open', dependencies: [{ type: 'blocks', depends_on_id: 'a' }, { type: 'blocks', depends_on_id: 'b' }] },
  ]
  const maps = buildMaps(iss)
  render(<DepBadges issue={iss[0]} maps={maps} />) // a blocks b, c, d
  expect(screen.getByText('→ 3').dataset.tip).toBe('Blocks 3 open issues')
  render(<DepBadges issue={iss[1]} maps={maps} />) // b blocked by a, blocks d
  expect(screen.getByText('⊘ 1').dataset.tip).toBe('Blocked by 1 open issue')
  expect(screen.getByText('→ 1').dataset.tip).toBe('Blocks 1 open issue')
  render(<DepBadges issue={iss[3]} maps={maps} />) // d blocked by a and b
  expect(screen.getByText('⊘ 2').dataset.tip).toBe('Blocked by 2 open issues')
})

test('ProgressPill shows done/total, hides without children', () => {
  const iss = [
    { id: 'e', issue_type: 'epic', status: 'open' },
    { id: 'k1', status: 'closed', dependencies: [{ type: 'parent-child', depends_on_id: 'e' }] },
    { id: 'k2', status: 'open', dependencies: [{ type: 'parent-child', depends_on_id: 'e' }] },
  ]
  const maps = buildMaps(iss)
  render(<ProgressPill issue={iss[0]} maps={maps} />)
  screen.getByText('1/2')
  const { container } = render(<ProgressPill issue={iss[1]} maps={maps} />)
  expect(container.innerHTML).toBe('')
})

test('icons render both variants', () => {
  for (const el of [
    <Chevron open />, <Chevron />, <SprintMark />, <PencilIcon />,
    <RefreshIcon spinning />, <RefreshIcon />, <SearchIcon />, <EyeIcon off />, <EyeIcon />,
  ]) {
    const { container, unmount } = render(el)
    expect(container.firstChild).toBeTruthy()
    unmount()
  }
})
