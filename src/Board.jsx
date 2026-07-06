import { useState } from 'react'
import { COLUMNS, sprintLabels } from './model'
import { TypeIcon, PriorityBadge, EpicChip, DepBadges, ProgressPill } from './ui'

// insert above or below the hovered card, split at its vertical midpoint
export const inTopHalf = e => {
  const r = e.currentTarget.getBoundingClientRect()
  return e.clientY < r.top + r.height / 2
}

// indicator: 'top' | 'bottom' | null — inline boxShadow so it wins over shadow/ring classes
export const indicatorStyle = ind =>
  ind ? { boxShadow: `inset 0 ${ind === 'top' ? '' : '-'}3px 0 0 #6366f1` } : undefined

export function IssueCard({ issue, maps, onSelect, selected, onCardOver, onCardDrop, indicator }) {
  const parent = maps.byId[maps.parentOf[issue.id]]
  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('text/plain', issue.id)}
      onDragOver={onCardOver}
      onDrop={onCardDrop}
      style={indicatorStyle(indicator)}
      onClick={() => onSelect(issue.id)}
      className={`rounded-md border p-3 shrink-0 cursor-pointer shadow-xs hover:shadow-sm transition-shadow bg-white ${
        selected ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200'
      }`}
    >
      <div className={`text-[13px] font-medium leading-snug ${issue.status === 'closed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
        {issue.title}
      </div>
      {parent && <div className="mt-1.5"><EpicChip epic={parent} onClick={onSelect} /></div>}
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
  // epics never render on the board; their children carry an epic chip instead
  const inSprint = issues.filter(i => sprintLabels(i).includes(label) && i.issue_type !== 'epic')

  return (
    <div
      className="flex-1 flex gap-3 p-4 overflow-x-auto min-h-0"
      onDragEnd={() => { setOver(null); setOverCard(null) }}
    >
      {COLUMNS.map(col => {
        const cards = sortIssues(inSprint.filter(i => i.status === col.status))
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
                return (
                  <IssueCard
                    key={i.id}
                    issue={i}
                    maps={maps}
                    onSelect={onSelect}
                    selected={i.id === selectedId}
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
