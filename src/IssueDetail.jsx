import { useEffect, useState } from 'react'
import { COLUMNS, PRIORITY_LABELS, sprintLabels, sprintNameOf, epicProgress } from './model'
import { TypeIcon, StatusDot, EpicChip } from './ui'

function LinkRow({ id, maps, onSelect }) {
  const it = maps.byId[id]
  if (!it) return <div className="text-[12px] text-gray-400 px-2 py-1">{id}</div>
  return (
    <button
      onClick={() => onSelect(id)}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-left"
    >
      <StatusDot status={it.status} />
      <span className="text-[11px] text-gray-500 font-medium shrink-0">{it.id}</span>
      <span className={`text-[12px] truncate ${it.status === 'closed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
        {it.title}
      </span>
    </button>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{title}</div>
      {children}
    </div>
  )
}

const selectCls =
  'w-full text-[13px] text-gray-800 border border-gray-200 rounded-md px-2 py-1.5 bg-white hover:border-gray-300 outline-none focus:border-indigo-400'

export default function IssueDetail({
  issue, maps, types, sprintNames, projectDir, onUpdate, onMoveSprint, onSelect, onClose,
}) {
  const [title, setTitle] = useState(issue.title)
  const [desc, setDesc] = useState(issue.description || '')

  useEffect(() => {
    setTitle(issue.title)
    setDesc(issue.description || '')
  }, [issue.id, issue.updated_at])

  const parent = maps.byId[maps.parentOf[issue.id]]
  const kids = maps.childrenOf[issue.id] || []
  const prog = epicProgress(issue.id, maps)
  const blockers = maps.blockedBy[issue.id] || []
  const blocking = maps.blocks[issue.id] || []
  const related = maps.related[issue.id] || []
  const sprintMemberships = sprintLabels(issue).map(sprintNameOf)
  // prefer the open sprint; completed ones are just history
  const curSprint = sprintMemberships.find(n => sprintNames.includes(n)) ?? sprintMemberships[0] ?? null
  const plainLabels = (issue.labels || []).filter(l => !/^sprint[:-]/.test(l))
  const images = [...desc.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].map(m => ({ match: m[0], alt: m[1], src: m[2] }))

  async function removeImage(img) {
    if (!window.confirm(`Delete ${img.alt || img.src.split('/').pop()}? The file is removed from disk.`)) return
    await window.api.deleteAttachment(projectDir, img.src)
    const next = desc.replace(`${img.match}\n`, '').replace(img.match, '').trim()
    setDesc(next)
    onUpdate(issue.id, ['-d', next])
  }

  async function insertImage(file) {
    const ext = (file.name?.split('.').pop() || file.type.split('/')[1] || 'png').toLowerCase()
    const rel = await window.api.saveAttachment(projectDir, `${issue.id}-${Date.now()}.${ext}`, await file.arrayBuffer())
    setDesc(d => `${d}${d && !d.endsWith('\n') ? '\n' : ''}![${file.name || `image.${ext}`}](${rel})\n`)
  }

  return (
    <div className="w-96 shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-y-auto">
      <div className="flex items-center gap-2 px-4 pt-4">
        <TypeIcon type={issue.issue_type} />
        <span
          className="text-[12px] text-gray-500 font-medium cursor-pointer hover:text-gray-700"
          title="Click to copy"
          onClick={() => navigator.clipboard.writeText(issue.id)}
        >{issue.id}</span>
        <span className="flex-1" />
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-[16px] leading-none px-1">✕</button>
      </div>

      <div className="px-4 pt-2 pb-4 flex flex-col gap-4">
        <textarea
          value={title}
          rows={1}
          onChange={e => setTitle(e.target.value)}
          onBlur={() => { const t = title.trim(); if (t && t !== issue.title) onUpdate(issue.id, ['--title', t]) }}
          className="w-full [field-sizing:content] text-[15px] font-semibold text-gray-900 leading-snug resize-none outline-none rounded-md -mx-1 px-1 py-0.5 hover:bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-300"
        />

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Status</span>
            <select className={selectCls} value={issue.status} onChange={e => onUpdate(issue.id, ['-s', e.target.value])}>
              {COLUMNS.map(c => <option key={c.status} value={c.status}>{c.title}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Priority</span>
            <select className={selectCls} value={issue.priority} onChange={e => onUpdate(issue.id, ['-p', e.target.value])}>
              {PRIORITY_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Type</span>
            <select className={selectCls} value={issue.issue_type} onChange={e => onUpdate(issue.id, ['-t', e.target.value])}>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Sprint</span>
            <select className={selectCls} value={curSprint ?? ''} onChange={e => onMoveSprint(issue.id, e.target.value || null)}>
              <option value="">Backlog</option>
              {sprintNames.map(n => <option key={n} value={n}>{n}</option>)}
              {curSprint && !sprintNames.includes(curSprint) && <option value={curSprint}>{curSprint}</option>}
            </select>
          </label>
        </div>

        <Section title="Description">
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            onPaste={e => {
              const f = [...e.clipboardData.items].find(i => i.type.startsWith('image/'))?.getAsFile()
              if (f) { e.preventDefault(); insertImage(f) }
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'))
              if (f) { e.preventDefault(); e.stopPropagation(); insertImage(f) }
            }}
            rows={6}
            placeholder="Add a description… (paste or drop images)"
            className="w-full [field-sizing:content] min-h-32 text-[13px] text-gray-800 leading-relaxed border border-gray-200 rounded-md px-2.5 py-2 outline-none resize-y focus:border-indigo-400"
          />
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1.5">
              {images.map(img => {
                const abs = img.src.startsWith('/') ? img.src : `${projectDir}/${img.src}`
                return (
                  <figure key={img.src} className="flex flex-col gap-0.5">
                    <div className="relative">
                      <img
                        src={`file://${abs}`}
                        title={img.src}
                        onClick={() => window.api.openPath(abs)}
                        className="h-24 rounded-md border border-gray-200 cursor-zoom-in object-cover"
                      />
                      <button
                        onClick={() => removeImage(img)}
                        title="Delete image"
                        className="absolute top-1 right-1 w-4.5 h-4.5 flex items-center justify-center rounded-full bg-white/90 border border-gray-200 text-gray-500 text-[10px] leading-none hover:text-red-600 hover:border-red-300 shadow-xs"
                      >
                        ✕
                      </button>
                    </div>
                    <figcaption className="text-[10px] text-gray-400 truncate max-w-32">
                      {img.alt || img.src.split('/').pop()}
                    </figcaption>
                  </figure>
                )
              })}
            </div>
          )}
          {desc !== (issue.description || '') && (
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={() => onUpdate(issue.id, ['-d', desc])}
                className="text-[12px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md px-2.5 py-1"
              >
                Save
              </button>
              <button
                onClick={() => setDesc(issue.description || '')}
                className="text-[12px] font-medium text-gray-600 hover:bg-gray-100 rounded-md px-2.5 py-1"
              >
                Cancel
              </button>
            </div>
          )}
        </Section>

        {parent && (
          <Section title="Epic">
            <EpicChip epic={parent} onClick={onSelect} />
          </Section>
        )}

        {kids.length > 0 && (
          <Section title={`Children · ${prog.done}/${prog.total} done`}>
            <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden mb-2">
              <div className="h-full bg-indigo-500" style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }} />
            </div>
            <div className="flex flex-col">
              {kids.map(id => <LinkRow key={id} id={id} maps={maps} onSelect={onSelect} />)}
            </div>
          </Section>
        )}

        {blockers.length > 0 && (
          <Section title="Blocked by">
            <div className="flex flex-col">{blockers.map(id => <LinkRow key={id} id={id} maps={maps} onSelect={onSelect} />)}</div>
          </Section>
        )}

        {blocking.length > 0 && (
          <Section title="Blocks">
            <div className="flex flex-col">{blocking.map(id => <LinkRow key={id} id={id} maps={maps} onSelect={onSelect} />)}</div>
          </Section>
        )}

        {related.length > 0 && (
          <Section title="Related">
            <div className="flex flex-col">{related.map(id => <LinkRow key={id} id={id} maps={maps} onSelect={onSelect} />)}</div>
          </Section>
        )}

        {plainLabels.length > 0 && (
          <Section title="Labels">
            <div className="flex flex-wrap gap-1">
              {plainLabels.map(l => (
                <span key={l} className="text-[11px] text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">{l}</span>
              ))}
            </div>
          </Section>
        )}

        <div className="text-[11px] text-gray-400 pt-2 border-t border-gray-100">
          Created {new Date(issue.created_at).toLocaleDateString()} · Updated {new Date(issue.updated_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  )
}
