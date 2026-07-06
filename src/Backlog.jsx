import { useEffect, useRef, useState } from 'react'
import { sprintLabels } from './model'
import { inTopHalf, indicatorStyle } from './Board'
import { TypeIcon, PriorityBadge, StatusDot, EpicChip, DepBadges, ProgressPill, Chevron, PencilIcon } from './ui'

function Row({ issue, maps, onSelect, selected, nested, group, expanded, onToggle, onRowOver, onRowDrop, indicator }) {
  const parent = maps.byId[maps.parentOf[issue.id]]
  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('text/plain', issue.id)}
      onDragOver={onRowOver}
      onDrop={onRowDrop}
      style={indicatorStyle(indicator)}
      onClick={() => onSelect(issue.id)}
      className={`flex items-center gap-2 pr-3 h-9 border-b border-gray-100 last:border-b-0 cursor-pointer ${
        nested ? 'pl-6' : 'pl-3'
      } ${selected ? 'bg-indigo-50' : group ? 'bg-violet-50/60 hover:bg-violet-50' : 'hover:bg-gray-50'}`}
    >
      {group ? (
        <button
          onClick={e => { e.stopPropagation(); onToggle() }}
          title={expanded ? 'Collapse tasks' : 'Expand tasks'}
          className="flex items-center gap-2 shrink-0 -ml-1 pl-1 pr-0.5 py-0.5 rounded hover:bg-violet-100 text-gray-400 hover:text-gray-700"
        >
          <TypeIcon type={issue.issue_type} />
          <span className="text-[11px] text-gray-500 font-medium text-left">{issue.id}</span>
          <Chevron open={expanded} />
        </button>
      ) : (
        <>
          <TypeIcon type={issue.issue_type} />
          <span className="text-[11px] text-gray-500 font-medium w-16 shrink-0">{issue.id}</span>
        </>
      )}
      <StatusDot status={issue.status} />
      <span
        className={`text-[13px] truncate ${
          issue.status === 'closed' ? 'text-gray-400 line-through' : group ? 'text-gray-900 font-medium' : 'text-gray-800'
        }`}
      >
        {issue.title}
      </span>
      <ProgressPill issue={issue} maps={maps} />
      <DepBadges issue={issue} maps={maps} />
      <span className="flex-1" />
      {parent && !nested && <EpicChip epic={parent} onClick={onSelect} />}
      <PriorityBadge p={issue.priority} />
    </div>
  )
}

export default function Backlog({
  issues, maps, sprintNames, completedNames = [], activeSprint, labelFor, showClosed,
  onMoveSprint, sortIssues, onReorder, onStart, onComplete, onCreate, onRename, onSelect, selectedId, onNewIssue,
  collapseTick,
}) {
  const [over, setOver] = useState() // sprint name | null (backlog) | undefined (none)
  const [overRow, setOverRow] = useState(null) // { id, before } — insert-position indicator
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState(null) // sprint name being edited
  const [renameVal, setRenameVal] = useState('')
  const [secOpen, setSecOpen] = useState({}) // user overrides; completed sections default collapsed
  const [foldedEpics, setFoldedEpics] = useState(() => new Set()) // epic ids with hidden children

  // ⌘⇧H in App bumps the tick → fold every epic; ref guard skips the mount run so tab switches stay unfolded
  const lastTick = useRef(collapseTick)
  useEffect(() => {
    if (collapseTick === lastTick.current) return
    lastTick.current = collapseTick
    setFoldedEpics(new Set(issues.filter(i => i.issue_type === 'epic').map(i => i.id)))
  }, [collapseTick])

  const sections = [
    ...sprintNames.map(n => ({ name: n })),
    ...completedNames.map(n => ({ name: n, done: true })),
    { name: null },
  ]

  const toggleSet = (set, setter, key) => {
    const next = new Set(set)
    next.has(key) ? next.delete(key) : next.add(key)
    setter(next)
  }

  const rowsFor = (name, done) => {
    let list = name
      ? issues.filter(i => sprintLabels(i).includes(labelFor(name)))
      : issues.filter(i => sprintLabels(i).length === 0)
    // the eye toggle hides closed issues everywhere in the backlog; completed sprints are all-closed history
    if (!showClosed && !done) list = list.filter(i => i.status !== 'closed')
    return list
  }

  const submitCreate = () => {
    const n = newName.trim()
    if (n) onCreate(n)
    setNewName('')
    setCreating(false)
  }

  return (
    <div
      className="flex-1 overflow-y-auto p-4 min-h-0"
      onDragEnd={() => { setOver(undefined); setOverRow(null) }}
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-end">
          {creating ? (
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitCreate()
                if (e.key === 'Escape') { setCreating(false); setNewName('') }
              }}
              onBlur={() => { setCreating(false); setNewName('') }}
              placeholder="Sprint name…"
              className="text-[13px] border border-indigo-400 rounded-md px-2 py-1 outline-none w-56"
            />
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="text-[13px] font-medium text-indigo-600 hover:bg-indigo-50 rounded-md px-2.5 py-1"
            >
              + Create sprint
            </button>
          )}
        </div>

        {sections.map(({ name, done }) => {
          const rows = rowsFor(name, done)
          const isActive = name && name === activeSprint
          const key = (done ? 'done:' : '') + (name ?? '__backlog__')
          const isCollapsed = key in secOpen ? !secOpen[key] : !!done
          const idsHere = new Set(rows.map(i => i.id))
          const top = sortIssues(rows.filter(i => !(maps.parentOf[i.id] && idsHere.has(maps.parentOf[i.id]))))
          const rowOver = r => e => {
            if (done) return
            e.preventDefault()
            e.stopPropagation() // row indicator instead of section highlight
            setOver(undefined)
            setOverRow({ id: r.id, before: inTopHalf(e) })
          }
          const rowDrop = r => e => {
            if (done) return
            e.preventDefault()
            e.stopPropagation()
            setOver(undefined)
            setOverRow(null)
            const id = e.dataTransfer.getData('text/plain')
            if (!id || id === r.id) return
            if (!idsHere.has(id)) onMoveSprint(id, name)
            onReorder(id, r.id, inTopHalf(e))
          }
          const rowIndicator = r => (overRow?.id === r.id ? (overRow.before ? 'top' : 'bottom') : null)
          return (
            <div
              key={key}
              onDragOver={e => { if (done) return; e.preventDefault(); setOver(name) }}
              onDragLeave={() => setOver(o => (o === name ? undefined : o))}
              onDrop={e => {
                if (done) return
                e.preventDefault()
                setOver(undefined)
                const id = e.dataTransfer.getData('text/plain')
                if (id) onMoveSprint(id, name)
              }}
              className={`rounded-lg border bg-white transition-colors ${
                over === name ? 'border-indigo-400 ring-1 ring-indigo-300' : 'border-gray-200'
              }`}
            >
              <div className={`flex items-center gap-2 px-3 py-2.5 ${isCollapsed ? '' : 'border-b border-gray-100'}`}>
                <button
                  onClick={() => setSecOpen(s => ({ ...s, [key]: isCollapsed }))}
                  className="text-gray-400 hover:text-gray-700 p-0.5 rounded hover:bg-gray-100"
                >
                  <Chevron open={!isCollapsed} />
                </button>
                {name && renaming === name && !done ? (
                  <span className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { onRename(name, renameVal); setRenaming(null) }
                        if (e.key === 'Escape') setRenaming(null)
                      }}
                      className="text-[13px] font-semibold text-gray-800 border border-indigo-400 rounded px-1.5 py-0.5 outline-none w-44"
                    />
                    <button
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { onRename(name, renameVal); setRenaming(null) }}
                      className="text-[12px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md px-2 py-0.5"
                    >
                      Save
                    </button>
                    <button
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => setRenaming(null)}
                      className="text-[12px] font-medium text-gray-600 hover:bg-gray-100 rounded-md px-2 py-0.5"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span className="text-[13px] font-semibold text-gray-800">{name ?? 'Backlog'}</span>
                )}
                {name && !done && renaming !== name && (
                  <button
                    onClick={() => { setRenaming(name); setRenameVal(name) }}
                    title="Rename sprint"
                    className="text-gray-300 hover:text-gray-600 p-0.5 rounded hover:bg-gray-100"
                  >
                    <PencilIcon />
                  </button>
                )}
                <span className="text-[11px] text-gray-400 font-medium">{rows.length} issue{rows.length === 1 ? '' : 's'}</span>
                {isActive && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700 bg-indigo-50 rounded px-1.5 py-0.5">
                    Active
                  </span>
                )}
                {done && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                    Completed
                  </span>
                )}
                <span className="flex-1" />
                {name && !isActive && !done && (
                  <button
                    onClick={() => onStart(name)}
                    className="text-[12px] font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-md px-2.5 py-1"
                  >
                    Start sprint
                  </button>
                )}
                {isActive && (
                  <button
                    onClick={() => onComplete(name)}
                    className="text-[12px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md px-2.5 py-1"
                  >
                    Complete sprint
                  </button>
                )}
              </div>
              {!isCollapsed && (<>
                {rows.length === 0 ? (
                  <div className="px-3 py-4 text-[12px] text-gray-400">
                    {name ? 'Drag issues here to add them to this sprint.' : 'Backlog is empty.'}
                  </div>
                ) : (
                  top.map(i => {
                    const kidsHere = sortIssues(rows.filter(x => maps.parentOf[x.id] === i.id))
                    const isGroup = i.issue_type === 'epic' && kidsHere.length > 0
                    const expanded = !foldedEpics.has(i.id)
                    return (
                      <div key={i.id}>
                        <Row
                          issue={i}
                          maps={maps}
                          onSelect={onSelect}
                          selected={i.id === selectedId}
                          group={isGroup}
                          expanded={expanded}
                          onToggle={() => toggleSet(foldedEpics, setFoldedEpics, i.id)}
                          onRowOver={rowOver(i)}
                          onRowDrop={rowDrop(i)}
                          indicator={rowIndicator(i)}
                        />
                        {isGroup && expanded && kidsHere.map(k => (
                          <Row
                            key={k.id} issue={k} maps={maps} onSelect={onSelect} selected={k.id === selectedId} nested
                            onRowOver={rowOver(k)} onRowDrop={rowDrop(k)} indicator={rowIndicator(k)}
                          />
                        ))}
                      </div>
                    )
                  })
                )}
                {!done && (
                  <button
                    onClick={() => onNewIssue(name)}
                    className="w-full flex items-center gap-1.5 px-3 h-9 text-[13px] font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 border-t border-gray-100 rounded-b-lg"
                  >
                    + Create
                  </button>
                )}
              </>)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
