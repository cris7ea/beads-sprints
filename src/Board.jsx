import { useState } from 'react'
import { COLUMNS, sprintLabels } from './model'
import { TypeIcon, PriorityBadge, EpicChip, DepBadges, ProgressPill, Chevron } from './ui'

// insert above or below the hovered card, split at its vertical midpoint
export const inTopHalf = e => {
  const r = e.currentTarget.getBoundingClientRect()
  return e.clientY < r.top + r.height / 2
}

// indicator: 'top' | 'bottom' | null — inline boxShadow so it wins over shadow/ring classes
export const indicatorStyle = ind =>
  ind ? { boxShadow: `inset 0 ${ind === 'top' ? '' : '-'}3px 0 0 #6366f1` } : undefined

export function IssueCard({ issue, maps, onSelect, selected, group, expanded, onToggle, onCardOver, onCardDrop, indicator }) {
  const parent = maps.byId[maps.parentOf[issue.id]]
  const isEpic = issue.issue_type === 'epic'
  if (isEpic) {
    // epics render as a slim list row (like the backlog), not a card
    return (
      <div
        draggable
        onDragStart={e => e.dataTransfer.setData('text/plain', issue.id)}
        onDragOver={onCardOver}
        onDrop={onCardDrop}
        style={indicatorStyle(indicator)}
        onClick={() => onSelect(issue.id)}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 h-11 shrink-0 cursor-pointer bg-violet-50/60 hover:bg-violet-50 ${
          selected ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-violet-200'
        }`}
      >
        {group ? (
          <button
            onClick={e => { e.stopPropagation(); onToggle() }}
            title={expanded ? 'Hide tasks in this sprint' : 'Show tasks in this sprint'}
            className="flex items-center gap-1.5 shrink-0 -ml-1 pl-1 pr-0.5 py-0.5 rounded hover:bg-violet-100 text-gray-400 hover:text-gray-700"
          >
            <TypeIcon type="epic" size={12} />
            <span className="text-[10px] text-gray-500 font-medium">{issue.id}</span>
            <Chevron open={expanded} />
          </button>
        ) : (
          <>
            <TypeIcon type="epic" size={12} />
            <span className="text-[10px] text-gray-500 font-medium shrink-0">{issue.id}</span>
          </>
        )}
        <span title={issue.title} className={`text-[12px] font-medium truncate flex-1 ${issue.status === 'closed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {issue.title}
        </span>
        <ProgressPill issue={issue} maps={maps} />
        <PriorityBadge p={issue.priority} />
      </div>
    )
  }
  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('text/plain', issue.id)}
      onDragOver={onCardOver}
      onDrop={onCardDrop}
      style={indicatorStyle(indicator)}
      onClick={() => onSelect(issue.id)}
      className={`rounded-md border p-3 shrink-0 cursor-pointer shadow-xs hover:shadow-sm transition-shadow ${
        selected ? 'border-indigo-500 ring-1 ring-indigo-500' : isEpic ? 'border-violet-200' : 'border-gray-200'
      } ${isEpic ? 'bg-violet-50/60' : 'bg-white'}`}
    >
      <div className="flex items-start gap-1">
        <div className={`flex-1 text-[13px] font-medium leading-snug ${issue.status === 'closed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {issue.title}
        </div>
        {group && (
          <button
            onClick={e => { e.stopPropagation(); onToggle() }}
            title={expanded ? 'Hide tasks in this sprint' : 'Show tasks in this sprint'}
            className="text-gray-400 hover:text-gray-700 p-0.5 rounded hover:bg-violet-100 shrink-0"
          >
            <Chevron open={expanded} />
          </button>
        )}
      </div>
      {parent && !isEpic && <div className="mt-1.5"><EpicChip epic={parent} onClick={onSelect} /></div>}
      <div className="flex items-center gap-1.5 mt-2.5">
        <TypeIcon type={issue.issue_type} />
        <span className="text-[11px] text-gray-500 font-medium">{issue.id}</span>
        <ProgressPill issue={issue} maps={maps} />
        <DepBadges issue={issue} maps={maps} />
        <span className="flex-1" />
        <PriorityBadge p={issue.priority} />
      </div>
    </div>
  )
}

export default function Board({ issues, maps, activeSprint, labelFor, onDropStatus, sortIssues, onReorder, onSelect, selectedId, goBacklog }) {
  const [over, setOver] = useState(null)
  const [overCard, setOverCard] = useState(null) // { id, before } — insert-position indicator
  const [folded, setFolded] = useState(() => new Set()) // epic ids whose children are hidden

  if (!activeSprint) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
        <div className="text-[15px] font-medium text-gray-700">No active sprint</div>
        <div className="text-[13px]">Start a sprint from the backlog to see the board.</div>
        <button onClick={goBacklog} className="mt-1 text-[13px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md px-3 py-1.5">
          Go to Backlog
        </button>
      </div>
    )
  }

  const label = labelFor(activeSprint)
  const inSprint = issues.filter(i => sprintLabels(i).includes(label))
  const inIds = new Set(inSprint.map(i => i.id))
  const hidden = new Set(
    inSprint.filter(i => folded.has(maps.parentOf[i.id]) && inIds.has(maps.parentOf[i.id])).map(i => i.id)
  )
  const toggleFold = id => setFolded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  return (
    <div
      className="flex-1 flex gap-3 p-4 overflow-x-auto min-h-0"
      onDragEnd={() => { setOver(null); setOverCard(null) }}
    >
      {COLUMNS.map(col => {
        const cards = sortIssues(inSprint.filter(i => i.status === col.status && !hidden.has(i.id)))
        return (
          <div
            key={col.status}
            onDragOver={e => { e.preventDefault(); setOver(col.status); setOverCard(null) }}
            onDragLeave={() => setOver(o => (o === col.status ? null : o))}
            onDrop={e => {
              e.preventDefault()
              setOver(null)
              setOverCard(null)
              const id = e.dataTransfer.getData('text/plain')
              if (id) onDropStatus(id, col.status)
            }}
            className={`w-72 shrink-0 flex flex-col rounded-lg border transition-colors ${
              over === col.status ? 'border-indigo-400 bg-indigo-50/60' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{col.title}</span>
              <span className="text-[11px] text-gray-400 font-medium">{cards.length}</span>
            </div>
            <div className="flex flex-col gap-2 px-2 pb-2 overflow-y-auto min-h-24">
              {cards.map(i => {
                const isGroup = i.issue_type === 'epic' && (maps.childrenOf[i.id] || []).some(k => inIds.has(k))
                return (
                  <IssueCard
                    key={i.id}
                    issue={i}
                    maps={maps}
                    onSelect={onSelect}
                    selected={i.id === selectedId}
                    group={isGroup}
                    expanded={!folded.has(i.id)}
                    onToggle={() => toggleFold(i.id)}
                    onCardOver={e => {
                      e.preventDefault()
                      e.stopPropagation() // keep the column highlight off while over a card
                      setOver(null)
                      setOverCard({ id: i.id, before: inTopHalf(e) })
                    }}
                    onCardDrop={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      setOver(null)
                      setOverCard(null)
                      const id = e.dataTransfer.getData('text/plain')
                      if (!id || id === i.id) return
                      if (maps.byId[id]?.status !== col.status) onDropStatus(id, col.status)
                      onReorder(id, i.id, inTopHalf(e))
                    }}
                    indicator={overCard?.id === i.id ? (overCard.before ? 'top' : 'bottom') : null}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
