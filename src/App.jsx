import { useEffect, useMemo, useState } from 'react'
import { BASE_TYPES, COLUMNS, PRIORITY_LABELS, buildMaps, discoverSprints, matchIssue, moveId, sortByOrder, sprintLabels } from './model'
import Board from './Board'
import Backlog from './Backlog'
import IssueDetail from './IssueDetail'
import { RefreshIcon, EyeIcon, SprintMark, Chevron, SearchIcon, TypeIcon, StatusDot, PriorityBadge, EpicChip } from './ui'

function ProjectPicker({ settings, onOpen, onPick, onRemove }) {
  const recents = settings?.recentProjects || []
  return (
    <div className="h-screen bg-white flex flex-col">
      <div className="app-drag h-12 shrink-0" />
      <div className="flex-1 flex flex-col items-center justify-center gap-6 pb-24">
        <div className="text-center">
          <div className="text-xl font-semibold text-gray-900">Select a beads project</div>
          <div className="text-[13px] text-gray-500 mt-1">Pick a folder that contains a .beads directory</div>
        </div>
        <div className="flex gap-3 flex-wrap justify-center max-w-3xl px-6">
          {recents.map(d => (
            <div key={d} className="relative group">
              <button
                onClick={() => onOpen(d)}
                className="w-64 text-left border border-gray-200 rounded-xl p-4 hover:border-indigo-400 hover:shadow-sm transition-all"
              >
                <div className="text-[14px] font-medium text-gray-900">{d.split('/').pop()}</div>
                <div className="text-[11px] text-gray-500 truncate mt-1">{d}</div>
              </button>
              <button
                onClick={() => onRemove(d)}
                title="Remove from recents"
                className="absolute top-2 right-2 hidden group-hover:flex items-center justify-center w-5 h-5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={onPick}
            className="w-64 border border-dashed border-gray-300 rounded-xl p-4 text-left hover:border-indigo-400 transition-all"
          >
            <div className="text-[14px] font-medium text-gray-700">+ Add project</div>
            <div className="text-[11px] text-gray-500 mt-1">Browse for a beads project</div>
          </button>
        </div>
      </div>
    </div>
  )
}

function FindModal({ issues, types, onSelect, onClose }) {
  const [q, setQ] = useState('')
  const [f, setF] = useState({ type: 'all', priority: 'all', status: 'all' })
  const results = issues.filter(i => matchIssue(i, { q, ...f }))
  const selCls = 'text-[12px] text-gray-600 border border-gray-200 rounded-md px-1.5 py-1 bg-white outline-none'
  return (
    <div className="fixed inset-0 bg-black/25 flex items-start justify-center pt-24 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl border border-gray-200 w-[640px] max-w-[90vw] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 p-3 border-b border-gray-100">
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Find issues by title or id…"
            className="flex-1 min-w-0 text-[13px] border border-gray-200 rounded-md px-2.5 py-1.5 outline-none focus:border-indigo-400"
          />
          <select value={f.type} onChange={e => setF(v => ({ ...v, type: e.target.value }))} className={selCls}>
            <option value="all">Type: All</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={f.priority} onChange={e => setF(v => ({ ...v, priority: e.target.value }))} className={selCls}>
            <option value="all">Priority: All</option>
            {[0, 1, 2, 3, 4].map(p => <option key={p} value={p}>P{p}</option>)}
          </select>
          <select value={f.status} onChange={e => setF(v => ({ ...v, status: e.target.value }))} className={selCls}>
            <option value="all">Status: All</option>
            {COLUMNS.map(c => <option key={c.status} value={c.status}>{c.title}</option>)}
          </select>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-gray-400">No matching issues.</div>
          ) : (
            results.map(i => (
              <div
                key={i.id}
                onClick={() => { onSelect(i.id); onClose() }}
                className="flex items-center gap-2 px-3 h-9 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50"
              >
                <TypeIcon type={i.issue_type} />
                <span className="text-[11px] text-gray-500 font-medium w-16 shrink-0">{i.id}</span>
                <StatusDot status={i.status} />
                <span className={`text-[13px] truncate ${i.status === 'closed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {i.title}
                </span>
                <span className="flex-1" />
                <PriorityBadge p={i.priority} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// exported for tests
export function NewIssueModal({ preset, maps, types, sprintNames, onCreate, onClose }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState('task')
  const [priority, setPriority] = useState(2)
  const [sprint, setSprint] = useState(preset.sprint ?? '')
  const parent = preset.parentId ? maps.byId[preset.parentId] : null
  const submit = () => {
    const t = title.trim()
    if (!t) return
    onCreate({ title: t, type, priority, sprint: sprint || null, parentId: preset.parentId || null })
    onClose()
  }
  const capCls = 'text-[11px] font-semibold uppercase tracking-wide text-gray-400'
  const selCls = 'w-full text-[12px] text-gray-800 border border-gray-200 rounded-md px-1.5 py-1 bg-white outline-none focus:border-indigo-400'
  return (
    <div className="fixed inset-0 bg-black/25 flex items-start justify-center pt-24 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-[420px] max-w-[90vw] p-5" onClick={e => e.stopPropagation()}>
        <div className="text-[15px] font-semibold text-gray-900">New task</div>
        {parent && (
          <div className="flex items-center gap-1.5 mt-1.5 text-[12px] text-gray-500">
            In epic <EpicChip epic={parent} />
          </div>
        )}
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onClose()
          }}
          placeholder="What needs to be done?"
          className="w-full mt-3 text-[13px] border border-gray-200 rounded-md px-2.5 py-1.5 outline-none focus:border-indigo-400"
        />
        <div className="grid grid-cols-3 gap-2 mt-3">
          <label className="flex flex-col gap-1">
            <span className={capCls}>Type</span>
            <select value={type} onChange={e => setType(e.target.value)} className={selCls}>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={capCls}>Priority</span>
            <select value={priority} onChange={e => setPriority(Number(e.target.value))} className={selCls}>
              {PRIORITY_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={capCls}>Sprint</span>
            <select value={sprint} onChange={e => setSprint(e.target.value)} className={selCls}>
              <option value="">Backlog</option>
              {sprintNames.map(n => <option key={n} value={n}>{n}</option>)}
              {sprint && !sprintNames.includes(sprint) && <option value={sprint}>{sprint}</option>}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-[13px] font-medium text-gray-600 hover:bg-gray-100 rounded-md px-3 py-1.5">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="text-[13px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-md px-3 py-1.5"
          >
            Create task
          </button>
        </div>
      </div>
    </div>
  )
}

// exported for tests
export function ShortcutsModal({ onClose }) {
  const shortcuts = [
    ['⌘F', 'Find issues'],
    ['⌘S', 'Save changes (open task)'],
    ['⌘⇧H', 'Collapse all epic tasks (backlog)'],
    ['?', 'Keyboard shortcuts'],
    ['Esc', 'Close dialogs & panels'],
  ]
  return (
    <div className="fixed inset-0 bg-black/25 flex items-start justify-center pt-24 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-[320px] p-5" onClick={e => e.stopPropagation()}>
        <div className="text-[15px] font-semibold text-gray-900">Keyboard shortcuts</div>
        <div className="mt-3 flex flex-col gap-2">
          {shortcuts.map(([keys, label]) => (
            <div key={keys} className="flex items-center justify-between">
              <span className="text-[13px] text-gray-700">{label}</span>
              <kbd className="text-[12px] font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">{keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// exported for tests
export function CreatedToast({ toast, onView, onClose }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-900 text-white rounded-lg shadow-lg pl-3.5 pr-1.5 py-1.5">
      <span className="text-[12px] font-medium text-gray-400 shrink-0">{toast.id}</span>
      <span className="text-[13px] truncate max-w-64">{toast.title}</span>
      <button
        onClick={() => { navigator.clipboard.writeText(toast.id); setCopied(true) }}
        className="text-[12px] font-medium text-indigo-300 hover:text-white hover:bg-white/10 rounded-md px-2 py-1 shrink-0"
      >
        {copied ? 'Copied!' : 'Copy ID'}
      </button>
      <button
        onClick={onView}
        className="text-[12px] font-medium text-indigo-300 hover:text-white hover:bg-white/10 rounded-md px-2 py-1"
      >
        View
      </button>
      <button onClick={onClose} className="text-gray-500 hover:text-white px-1.5 text-[14px] leading-none">✕</button>
    </div>
  )
}

export default function App() {
  const [settings, setSettings] = useState(null)
  const [dir, setDir] = useState(null)
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState(new URLSearchParams(location.search).get('tab') || 'board')
  const [filters, setFilters] = useState({ priority: 'all', type: 'all' })
  const [showClosed, setShowClosed] = useState(false)
  const [selectedId, setSelectedId] = useState(new URLSearchParams(location.search).get('sel'))
  const [completing, setCompleting] = useState(null) // { name, count } while the complete-sprint modal is open
  const [moveTarget, setMoveTarget] = useState('') // '' = backlog
  const [finding, setFinding] = useState(false)
  const [newTask, setNewTask] = useState(null) // { sprint?, parentId? } while the create-task modal is open
  const [created, setCreated] = useState(null) // { id, title } — "task created" toast
  const [showHelp, setShowHelp] = useState(false)
  const [collapseTick, setCollapseTick] = useState(0) // bumping it tells Board/Backlog to fold all epics

  useEffect(() => {
    if (!created) return
    const t = setTimeout(() => setCreated(null), 6000)
    return () => clearTimeout(t)
  }, [created])

  useEffect(() => {
    if (!dir) return
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); setFinding(true) }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault()
        setCollapseTick(t => t + 1)
      }
      if (e.key === '?' && !/input|textarea|select/i.test(e.target.tagName)) setShowHelp(v => !v)
      if (e.key === 'Escape') { setFinding(false); setShowHelp(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dir])

  async function persist(next) {
    setSettings(next)
    await window.api.saveSettings(next)
  }

  async function refresh(d = dir, synced = false) {
    if (!d) return
    setLoading(true)
    setError(null)
    const r = await window.api.bd(d, ['list', '--json', '--all', '--limit', '0'])
    if (!r.ok) {
      setError((r.stderr || 'bd command failed').trim().slice(0, 300))
      setLoading(false)
      return
    }
    let list
    try { list = JSON.parse(r.stdout || '[]') || [] } catch {
      setError('Could not parse bd output')
      setLoading(false)
      return
    }
    // mirror a literal "backlog" label onto issues in no sprint (visible to bd/agents)
    if (!synced) {
      const needAdd = list.filter(i => sprintLabels(i).length === 0 && !(i.labels || []).includes('backlog')).map(i => i.id)
      const needRemove = list.filter(i => sprintLabels(i).length > 0 && (i.labels || []).includes('backlog')).map(i => i.id)
      if (needAdd.length) await window.api.bd(d, ['label', 'add', ...needAdd, 'backlog'])
      if (needRemove.length) await window.api.bd(d, ['label', 'remove', ...needRemove, 'backlog'])
      if (needAdd.length || needRemove.length) return refresh(d, true)
    }
    setIssues(list)
    setLoading(false)
  }

  function openProject(d, base) {
    const s = base ?? settings ?? {}
    persist({ ...s, lastProject: d, recentProjects: [d, ...(s.recentProjects || []).filter(x => x !== d)].slice(0, 8) })
    setDir(d)
    setIssues([])
    refresh(d)
  }

  useEffect(() => {
    window.api.getSettings().then(s => {
      setSettings(s || {})
      if (s?.lastProject) openProject(s.lastProject, s)
    })
  }, [])

  async function bdRun(args) {
    const r = await window.api.bd(dir, args)
    if (!r.ok) setError((r.stderr || 'bd command failed').trim().slice(0, 300))
    return r
  }

  const proj = settings?.projects?.[dir] || {}
  const knownSprints = proj.sprints || []
  const activeSprint = proj.activeSprint || null
  const completed = proj.completedSprints || []

  function saveProj(patch) {
    const s = settings || {}
    persist({ ...s, projects: { ...(s.projects || {}), [dir]: { ...proj, ...patch } } })
  }

  const orderIdx = useMemo(() => new Map((proj.order || []).map((id, i) => [id, i])), [proj.order])
  const sortIssues = list => sortByOrder(list, orderIdx)
  // drag-to-reorder: persist the full id order so relative positions survive filters/refreshes
  function reorder(dragId, targetId, before) {
    const next = moveId(sortIssues(issues).map(i => i.id), dragId, targetId, before)
    if (next) saveProj({ order: next })
  }

  const maps = useMemo(() => buildMaps(issues), [issues])
  const discovered = useMemo(() => discoverSprints(issues), [issues])

  const sprintNames = useMemo(() => {
    const seen = new Set(completed)
    const out = []
    for (const n of [...knownSprints, ...discovered.keys()]) {
      if (n && !seen.has(n)) { seen.add(n); out.push(n) }
    }
    return out
  }, [knownSprints, discovered, completed])

  const labelFor = name => discovered.get(name) || `sprint:${name}`
  // completed sprints still holding (closed) issues — shown as history in the backlog
  const completedNames = useMemo(() => completed.filter(n => discovered.has(n)), [completed, discovered])

  const types = useMemo(() => {
    const t = new Set(BASE_TYPES)
    for (const i of issues) t.add(i.issue_type)
    return [...t]
  }, [issues])

  const filtered = useMemo(
    () => issues.filter(i =>
      (filters.priority === 'all' || i.priority === Number(filters.priority)) &&
      (filters.type === 'all' || i.issue_type === filters.type)
    ),
    [issues, filters]
  )

  async function updateIssue(id, args) {
    await bdRun(['update', id, ...args])
    await refresh()
  }

  async function createIssue({ title, type, priority, sprint, parentId }) {
    // the sprint label is set explicitly, so don't let a parented task inherit the epic's labels
    const args = ['create', title, '-t', type, '-p', String(priority), '-l', sprint ? labelFor(sprint) : 'backlog', '--silent']
    if (parentId) args.push('--parent', parentId, '--no-inherit-labels')
    const r = await bdRun(args)
    if (r.ok) {
      const id = r.stdout.trim() // --silent prints only the new issue id
      if (id) setCreated({ id, title })
      await refresh()
    }
  }

  // bd dep add/remove <blocked-id> <blocker-id> — first arg depends on the second
  async function editDep(action, blockedId, blockerId) {
    await bdRun(['dep', action, blockedId, blockerId])
    await refresh()
  }

  // epic membership = a parent-child dep on the child; swapping means remove old, add new
  async function setEpic(childId, epicId) {
    const cur = maps.parentOf[childId]
    if (cur === epicId) return
    if (cur) await bdRun(['dep', 'remove', childId, cur])
    if (epicId) await bdRun(['dep', 'add', childId, epicId, '--type', 'parent-child'])
    await refresh()
  }

  async function deleteIssue(id) {
    if (!window.confirm(`Delete ${id}? This cannot be undone.`)) return
    const r = await bdRun(['delete', id, '--force'])
    if (r.ok) {
      setSelectedId(null)
      await refresh()
    }
  }

  async function moveToSprint(issueId, name) {
    const issue = maps.byId[issueId]
    if (!issue) return
    const completedLabels = new Set(completed.map(labelFor))
    const target = name ? labelFor(name) : null
    // epics carry their children into (and out of) the sprint
    const ids = [issueId, ...(issue.issue_type === 'epic' ? maps.childrenOf[issueId] || [] : [])]
    // strip open-sprint labels (completed ones stay on as history), then add the target
    const byLabel = {}
    let changed = false
    for (const id of ids) {
      for (const l of sprintLabels(maps.byId[id] || {})) {
        if (completedLabels.has(l) || l === target) continue
        ;(byLabel[l] ||= []).push(id)
      }
    }
    for (const [l, group] of Object.entries(byLabel)) {
      await bdRun(['label', 'remove', ...group, l])
      changed = true
    }
    if (target) {
      const need = ids.filter(id => !sprintLabels(maps.byId[id] || {}).includes(target))
      if (need.length) {
        await bdRun(['label', 'add', ...need, target])
        changed = true
      }
    }
    if (changed) await refresh()
  }

  async function renameSprint(oldName, newName) {
    newName = newName.trim()
    if (!newName || newName === oldName) return
    if (sprintNames.includes(newName) || completed.includes(newName)) {
      window.alert(`A sprint named "${newName}" already exists.`)
      return
    }
    const oldLabel = labelFor(oldName)
    const newLabel = `sprint:${newName}`
    const ids = issues.filter(i => sprintLabels(i).includes(oldLabel)).map(i => i.id)
    if (ids.length) {
      await bdRun(['label', 'add', ...ids, newLabel])
      await bdRun(['label', 'remove', ...ids, oldLabel])
    }
    saveProj({
      sprints: knownSprints.includes(oldName)
        ? knownSprints.map(n => (n === oldName ? newName : n))
        : [...knownSprints, newName],
      activeSprint: activeSprint === oldName ? newName : activeSprint,
    })
    await refresh()
  }

  function createSprint(name) {
    if (sprintNames.includes(name)) return
    saveProj({
      sprints: [...knownSprints.filter(n => n !== name), name],
      completedSprints: completed.filter(n => n !== name),
    })
  }

  function completeSprint(name) {
    const label = labelFor(name)
    const count = issues.filter(i => sprintLabels(i).includes(label) && i.status !== 'closed').length
    if (!count) {
      if (window.confirm(`Complete "${name}"?`)) doCompleteSprint(name, '')
      return
    }
    setMoveTarget('')
    setCompleting({ name, count })
  }

  async function doCompleteSprint(name, target) {
    const label = labelFor(name)
    const unfinished = issues.filter(i => sprintLabels(i).includes(label) && i.status !== 'closed').map(i => i.id)
    if (unfinished.length) {
      if (target) {
        // keep the completed sprint's label as history; the new label drives visibility
        await bdRun(['label', 'add', ...unfinished, labelFor(target)])
      } else {
        await bdRun(['label', 'remove', ...unfinished, label])
      }
    }
    saveProj({
      activeSprint: activeSprint === name ? null : activeSprint,
      sprints: knownSprints.filter(n => n !== name),
      completedSprints: [...completed, name],
    })
    setCompleting(null)
    await refresh()
  }

  async function pickFolder() {
    const r = await window.api.pickFolder()
    if (!r) return
    if (r.error) { setError(r.error); return }
    setError(null)
    openProject(r.dir)
  }

  function removeProject(d) {
    const s = settings || {}
    persist({
      ...s,
      lastProject: s.lastProject === d ? null : s.lastProject,
      recentProjects: (s.recentProjects || []).filter(x => x !== d),
    })
  }

  if (!dir) return <ProjectPicker settings={settings} onOpen={openProject} onPick={pickFolder} onRemove={removeProject} />

  const selected = selectedId ? maps.byId[selectedId] : null
  const btnCls = 'flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800'

  return (
    <div className="h-screen bg-white flex flex-col text-gray-900">
      <div className="app-drag flex items-center gap-3 h-12 pl-20 pr-3 border-b border-gray-200 shrink-0">
        <SprintMark />
        <button
          onClick={() => { setDir(null); setSelectedId(null) }}
          title="Switch project"
          className="flex items-center gap-1 text-[13px] font-semibold text-gray-900 hover:bg-gray-100 rounded-md px-2 py-1"
        >
          {dir.split('/').pop()}
          <span className="text-gray-400"><Chevron open /></span>
        </button>

        <div className="flex bg-gray-100 rounded-md p-0.5">
          {['backlog', 'board'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-[12px] font-medium px-3 py-1 rounded ${
                tab === t ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t === 'board' ? 'Board' : 'Backlog'}
            </button>
          ))}
        </div>

        <button onClick={() => setFinding(true)} title="Find issues (⌘F)" className={btnCls}>
          <SearchIcon />
        </button>

        {activeSprint && tab === 'board' && (
          <span className="text-[12px] text-gray-500">
            Sprint: <span className="font-medium text-gray-800">{activeSprint}</span>
          </span>
        )}

        <span className="flex-1" />

        <button
          onClick={() => setNewTask({ sprint: tab === 'board' ? activeSprint : null })}
          className="text-[12px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md px-2.5 py-1"
        >
          + Create task
        </button>
        <select
          value={filters.priority}
          onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}
          className="text-[12px] text-gray-600 border border-gray-200 rounded-md px-1.5 py-1 bg-white outline-none"
        >
          <option value="all">Priority: All</option>
          {[0, 1, 2, 3, 4].map(p => <option key={p} value={p}>P{p}</option>)}
        </select>
        <select
          value={filters.type}
          onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
          className="text-[12px] text-gray-600 border border-gray-200 rounded-md px-1.5 py-1 bg-white outline-none"
        >
          <option value="all">Type: All</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <button
          onClick={() => setShowClosed(v => !v)}
          title={showClosed ? 'Hide closed issues' : 'Show closed issues'}
          className={`${btnCls} ${showClosed ? 'text-indigo-600 bg-indigo-50' : ''}`}
        >
          <EyeIcon off={!showClosed} />
        </button>
        <button onClick={() => refresh()} title="Refresh beads data" className={btnCls}>
          <RefreshIcon spinning={loading} />
        </button>
        <button onClick={() => setShowHelp(true)} title="Keyboard shortcuts (?)" className={`${btnCls} text-[13px] font-semibold`}>
          ?
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 text-[12px] border-b border-red-100">
          <span className="truncate">{error}</span>
          <span className="flex-1" />
          <button onClick={() => setError(null)} className="font-medium hover:underline">Dismiss</button>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {tab === 'board' ? (
          <Board
            issues={filtered}
            maps={maps}
            activeSprint={activeSprint}
            labelFor={labelFor}
            onDropStatus={(id, status) => updateIssue(id, ['-s', status])}
            sortIssues={sortIssues}
            onReorder={reorder}
            onSelect={setSelectedId}
            selectedId={selectedId}
            goBacklog={() => setTab('backlog')}
          />
        ) : (
          <Backlog
            issues={filtered}
            maps={maps}
            sprintNames={sprintNames}
            completedNames={completedNames}
            activeSprint={activeSprint}
            labelFor={labelFor}
            showClosed={showClosed}
            onMoveSprint={moveToSprint}
            sortIssues={sortIssues}
            onReorder={reorder}
            onStart={name => {
              if (activeSprint && activeSprint !== name) {
                window.alert(`"${activeSprint}" is still active. Complete it first — only one sprint can be on the board at a time.`)
                return
              }
              saveProj({ activeSprint: name })
            }}
            onComplete={completeSprint}
            onCreate={createSprint}
            onRename={renameSprint}
            onSelect={setSelectedId}
            selectedId={selectedId}
            onNewIssue={name => setNewTask({ sprint: name })}
            collapseTick={collapseTick}
          />
        )}

        {newTask && (
          <NewIssueModal
            preset={newTask}
            maps={maps}
            types={types}
            sprintNames={sprintNames}
            onCreate={createIssue}
            onClose={() => setNewTask(null)}
          />
        )}

        {showHelp && <ShortcutsModal onClose={() => setShowHelp(false)} />}

        {finding && (
          <FindModal
            issues={issues}
            types={types}
            onSelect={setSelectedId}
            onClose={() => setFinding(false)}
          />
        )}

        {completing && (
          <div className="fixed inset-0 bg-black/25 flex items-center justify-center z-50" onClick={() => setCompleting(null)}>
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-[380px] p-5" onClick={e => e.stopPropagation()}>
              <div className="text-[15px] font-semibold text-gray-900">Complete "{completing.name}"</div>
              <p className="text-[13px] text-gray-600 mt-2 leading-relaxed">
                This sprint still has <span className="font-semibold text-gray-900">{completing.count}</span> unfinished
                issue{completing.count === 1 ? '' : 's'}. Where should they go?
              </p>
              <select
                value={moveTarget}
                onChange={e => setMoveTarget(e.target.value)}
                className="w-full mt-3 text-[13px] text-gray-800 border border-gray-200 rounded-md px-2 py-1.5 bg-white outline-none focus:border-indigo-400"
              >
                <option value="">Backlog</option>
                {sprintNames.filter(n => n !== completing.name).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setCompleting(null)}
                  className="text-[13px] font-medium text-gray-600 hover:bg-gray-100 rounded-md px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => doCompleteSprint(completing.name, moveTarget)}
                  className="text-[13px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md px-3 py-1.5"
                >
                  Complete sprint
                </button>
              </div>
            </div>
          </div>
        )}

        {selected && (
          <IssueDetail
            issue={selected}
            maps={maps}
            types={types}
            sprintNames={sprintNames}
            projectDir={dir}
            onUpdate={updateIssue}
            onMoveSprint={moveToSprint}
            onSelect={setSelectedId}
            onClose={() => setSelectedId(null)}
            onAddChild={preset => setNewTask(preset)}
            onDelete={deleteIssue}
            onDep={editDep}
            onSetEpic={setEpic}
          />
        )}

        {created && (
          <CreatedToast
            key={created.id}
            toast={created}
            onView={() => { setSelectedId(created.id); setCreated(null) }}
            onClose={() => setCreated(null)}
          />
        )}
      </div>
    </div>
  )
}
