import { epicProgress, openBlockers, openBlocking, STATUS_LABEL } from './model'

const TYPE_COLORS = {
  task: '#3b82f6',
  bug: '#ef4444',
  feature: '#10b981',
  epic: '#8b5cf6',
  chore: '#6b7280',
}

export function TypeIcon({ type, size = 14 }) {
  const bg = TYPE_COLORS[type] || '#94a3b8'
  const glyph = {
    task: <path d="M4 7.2l2.1 2.1L10 5.2" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    bug: <circle cx="7" cy="7" r="2.4" fill="#fff" />,
    feature: <path d="M7 4v6M4 7h6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />,
    epic: <path d="M7.8 3.2L4.6 7.6h2.1L6.2 10.8l3.2-4.4H7.3z" fill="#fff" />,
    chore: <path d="M4 7h6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />,
  }[type] || <circle cx="7" cy="7" r="1.8" fill="#fff" />
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0">
      <rect width="14" height="14" rx="3" fill={bg} />
      {glyph}
    </svg>
  )
}

const PRIORITY_COLORS = ['#dc2626', '#ea580c', '#d97706', '#64748b', '#94a3b8']

export function PriorityBadge({ p }) {
  const color = PRIORITY_COLORS[p] ?? '#94a3b8'
  return (
    <span
      title={['Critical', 'High', 'Medium', 'Low', 'Backlog'][p] ?? `P${p}`}
      className="text-[10px] font-semibold px-1 py-px rounded"
      style={{ color, background: color + '18' }}
    >
      P{p}
    </span>
  )
}

const STATUS_COLORS = { open: '#94a3b8', in_progress: '#eab308', blocked: '#ef4444', closed: '#22c55e' }

export function StatusDot({ status }) {
  return (
    <span
      title={STATUS_LABEL[status] || status}
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ background: STATUS_COLORS[status] || '#94a3b8' }}
    />
  )
}

const CHIP_PALETTE = [
  ['#f3e8ff', '#7e22ce'], ['#dbeafe', '#1d4ed8'], ['#dcfce7', '#15803d'],
  ['#fef3c7', '#b45309'], ['#fce7f3', '#be185d'], ['#e0f2fe', '#0369a1'],
]

export function EpicChip({ epic, onClick }) {
  let h = 0
  for (const c of epic.id) h = (h * 31 + c.charCodeAt(0)) % 997
  const [bg, fg] = CHIP_PALETTE[h % CHIP_PALETTE.length]
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick?.(epic.id) }}
      title={epic.title}
      className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded truncate max-w-40 cursor-pointer"
      style={{ background: bg, color: fg }}
    >
      {epic.title}
    </button>
  )
}

// ponytail: pure-CSS instant tooltip (::after shows data-tip on hover); swap for a
// positioning lib only if clipping at scroll-container edges ever bites
const TIP =
  'relative after:pointer-events-none after:absolute after:bottom-full after:left-1/2 after:-translate-x-1/2 after:mb-1 ' +
  'after:hidden hover:after:block after:content-[attr(data-tip)] after:w-max after:max-w-64 ' +
  'after:rounded-md after:bg-gray-900 after:px-2 after:py-1 after:text-[11px] after:font-normal after:text-white after:z-50'

export function DepBadges({ issue, maps }) {
  const blockers = openBlockers(issue, maps)
  const blocking = openBlocking(issue, maps)
  return (
    <>
      {blockers.length > 0 && (
        <span
          data-tip={`Blocked by ${blockers.length} open issue${blockers.length === 1 ? '' : 's'}`}
          className={`text-[10px] font-semibold px-1 py-px rounded bg-red-50 text-red-600 ${TIP}`}
        >
          ⊘ {blockers.length}
        </span>
      )}
      {blocking.length > 0 && (
        <span
          data-tip={`Blocks ${blocking.length} open issue${blocking.length === 1 ? '' : 's'}`}
          className={`text-[10px] font-semibold px-1 py-px rounded bg-amber-50 text-amber-700 ${TIP}`}
        >
          → {blocking.length}
        </span>
      )}
    </>
  )
}

export function ProgressPill({ issue, maps }) {
  const { done, total } = epicProgress(issue.id, maps)
  if (!total) return null
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-gray-500">
      <span className="w-8 h-1 rounded-full bg-gray-200 overflow-hidden inline-block">
        <span className="block h-full bg-indigo-500" style={{ width: `${(done / total) * 100}%` }} />
      </span>
      {done}/{total}
    </span>
  )
}

export function Chevron({ open }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${open ? 'rotate-90' : ''}`}>
      <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// sprint cycle: two arrows chasing each other around a circle
export function SprintMark({ size = 20 }) {
  return (
    <span
      className="flex items-center justify-center rounded-md shrink-0"
      style={{ width: size, height: size, background: '#5e6ad2' }}
    >
      <svg
        width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24"
        fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
      </svg>
    </span>
  )
}

export function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M11.3 2.2l2.5 2.5L5.5 13H3v-2.5l8.3-8.3zM10 3.5L12.5 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function RefreshIcon({ spinning }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className={spinning ? 'animate-spin' : ''}>
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 1.5v3h-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function EyeIcon({ off }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
      {off && <path d="M2.5 13.5l11-11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />}
    </svg>
  )
}
