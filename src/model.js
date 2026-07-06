export const COLUMNS = [
  { status: 'open', title: 'To Do' },
  { status: 'blocked', title: 'Blocked' },
  { status: 'in_progress', title: 'In Progress' },
  { status: 'closed', title: 'Done' },
]

export const STATUS_LABEL = Object.fromEntries(COLUMNS.map(c => [c.status, c.title]))
export const PRIORITY_LABELS = ['P0 · Critical', 'P1 · High', 'P2 · Medium', 'P3 · Low', 'P4 · Backlog']
export const BASE_TYPES = ['task', 'bug', 'feature', 'epic', 'chore']

// Sprint membership is a label: "sprint:Name" (ours) or pre-existing "sprint-*" labels.
// A ticket can carry several (completed sprints stay on as history).
export const sprintLabels = issue => (issue.labels || []).filter(l => /^sprint[:-]/.test(l))
export const sprintNameOf = label => (label && label.startsWith('sprint:') ? label.slice(7) : label)

export function buildMaps(issues) {
  const byId = {}
  for (const i of issues) byId[i.id] = i
  const parentOf = {}, childrenOf = {}, blockedBy = {}, blocks = {}, related = {}
  for (const i of issues) {
    for (const d of i.dependencies || []) {
      if (d.type === 'parent-child') {
        parentOf[i.id] = d.depends_on_id
        ;(childrenOf[d.depends_on_id] ||= []).push(i.id)
      } else if (d.type === 'blocks') {
        ;(blockedBy[i.id] ||= []).push(d.depends_on_id)
        ;(blocks[d.depends_on_id] ||= []).push(i.id)
      } else {
        ;(related[i.id] ||= []).push(d.depends_on_id)
      }
    }
  }
  return { byId, parentOf, childrenOf, blockedBy, blocks, related }
}

export function epicProgress(id, maps) {
  const kids = maps.childrenOf[id] || []
  return { done: kids.filter(k => maps.byId[k]?.status === 'closed').length, total: kids.length }
}

export const openBlockers = (issue, maps) =>
  (maps.blockedBy[issue.id] || []).filter(id => maps.byId[id] && maps.byId[id].status !== 'closed')

export const openBlocking = (issue, maps) =>
  (maps.blocks[issue.id] || []).filter(id => maps.byId[id] && maps.byId[id].status !== 'closed')

// Manual ordering is app state (settings), not bd data: an id array per project.
// index = Map(id -> position); ids not in it keep bd order at the end (stable sort).
export function sortByOrder(list, index) {
  return [...list].sort((a, b) => (index.get(a.id) ?? 1e9) - (index.get(b.id) ?? 1e9))
}

// move dragId next to targetId in ids; returns the new array, or null if a no-op
export function moveId(ids, dragId, targetId, before) {
  if (dragId === targetId) return null
  const out = ids.filter(id => id !== dragId)
  const at = out.indexOf(targetId)
  if (at < 0) return null
  out.splice(before ? at : at + 1, 0, dragId)
  return out
}

// live-find: substring match on id/title plus facet filters ('all' = no filter)
export function matchIssue(i, { q = '', type = 'all', priority = 'all', status = 'all' }) {
  const n = q.trim().toLowerCase()
  return (
    (!n || i.id.toLowerCase().includes(n) || (i.title || '').toLowerCase().includes(n)) &&
    (type === 'all' || i.issue_type === type) &&
    (priority === 'all' || i.priority === Number(priority)) &&
    (status === 'all' || i.status === status)
  )
}

// distinct sprint name -> raw label, from live data
export function discoverSprints(issues) {
  const m = new Map()
  for (const i of issues) for (const l of sprintLabels(i)) m.set(sprintNameOf(l), l)
  return m
}
