const TOOL_META = {
  get_physician_data:  { icon: '🔍', color: '#0891B2', label: 'Fetching physician data' },
  call_ppt_agent:      { icon: '📊', color: '#8B5CF6', label: 'Generating PowerPoint' },
  call_excel_agent:    { icon: '📋', color: '#059669', label: 'Building Excel workbook' },
  call_sandbox_agent:  { icon: '⚡', color: '#F59E0B', label: 'Running sandbox analysis' },
  call_report_agent:   { icon: '📝', color: '#3B82F6', label: 'Writing report' },
  orchestrator_thinking: { icon: '🧠', color: '#EC4899', label: 'Thinking' },
  done:  { icon: '✅', color: '#059669', label: 'Complete' },
  error: { icon: '❌', color: '#EF4444', label: 'Error' },
}

const SKIP_ARGS = new Set(['dataset', 'physician_list'])

const S = {
  card: {
    background: '#fff', borderRadius: 12, padding: '18px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.05)',
    border: '1px solid #E8EDF3',
  },
  heading: { fontSize: 13, fontWeight: 700, color: '#0F2044', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 },
  timeline: { position: 'relative', paddingLeft: 28 },
  timelineLine: {
    position: 'absolute', left: 10, top: 10, bottom: 10,
    width: 2, background: 'linear-gradient(to bottom, #E2E8F0, #E2E8F0)',
    borderRadius: 99,
  },
  row: { position: 'relative', paddingBottom: 14, paddingLeft: 4 },
  dot: (color, done) => ({
    position: 'absolute', left: -22, top: 3,
    width: 14, height: 14, borderRadius: '50%',
    background: done ? color : '#fff',
    border: `2px solid ${color}`,
    boxShadow: done ? `0 0 0 3px ${color}22` : 'none',
    transition: 'all 0.2s ease',
  }),
  labelRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  label: { fontSize: 13.5, fontWeight: 600, color: '#0F172A' },
  badge: (status) => ({
    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
    background: status === 'done' ? '#D1FAE5' : status === 'error' ? '#FEE2E2' : '#F1F5F9',
    color:      status === 'done' ? '#065F46' : status === 'error' ? '#991B1B' : '#475569',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  }),
  detail: {
    marginTop: 3, fontSize: 11.5, color: '#64748B', lineHeight: 1.5,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  doneText: {
    marginTop: 3, fontSize: 12.5, color: '#374151', lineHeight: 1.6,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    background: '#F0FDF4', borderRadius: 6, padding: '6px 10px',
    border: '1px solid #BBF7D0',
  },
}

export default function AgentTrace({ events }) {
  return (
    <div style={S.card}>
      <div style={S.heading}><span>📡</span> Agent Trace</div>
      <div style={S.timeline}>
        <div style={S.timelineLine} />
        {events.map((ev, i) => {
          const meta = TOOL_META[ev.tool] || TOOL_META[ev.type] || { icon: '•', color: '#94A3B8', label: ev.type }
          const isDone = ev.type === 'tool_done' || ev.type === 'done'
          const isError = ev.type === 'error'

          let label = ''
          let detail = ''
          let showBadge = false

          if (ev.type === 'orchestrator_thinking') {
            label = ev.message || 'Thinking…'
          } else if (ev.type === 'tool_called') {
            label = `${meta.label}…`
            const argStr = Object.entries(ev.args || {})
              .filter(([k, v]) => v != null && !SKIP_ARGS.has(k))
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v).slice(0, 80)}`)
              .join('  ·  ')
            detail = argStr
          } else if (ev.type === 'tool_done') {
            label = `${meta.label}`
            detail = ev.message || ''
            showBadge = true
          } else if (ev.type === 'done') {
            label = 'Complete'
            showBadge = true
          } else if (ev.type === 'error') {
            label = `Error`
            detail = ev.message || ''
            showBadge = true
          }

          return (
            <div key={i} className="trace-row" style={S.row}>
              <div style={S.dot(isError ? '#EF4444' : meta.color, isDone || ev.type === 'done' || isError)} />
              <div style={S.labelRow}>
                <span style={{ ...S.label, color: isError ? '#EF4444' : isDone ? '#0F172A' : '#374151' }}>
                  {meta.icon} {label}
                </span>
                {showBadge && (
                  <span style={S.badge(isError ? 'error' : 'done')}>
                    {isError ? 'Error' : 'Done'}
                  </span>
                )}
              </div>
              {detail && ev.type !== 'done' && <div style={S.detail}>{detail}</div>}
              {ev.type === 'done' && ev.text && <div style={S.doneText}>{ev.text}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
