const TOOL_ICONS = {
  get_physician_data: '🔍',
  call_ppt_agent: '📊',
  call_excel_agent: '📋',
  call_sandbox_agent: '⚡',
  call_report_agent: '📝',
  orchestrator_thinking: '🧠',
  done: '✅',
  error: '❌',
}

const TOOL_LABELS = {
  get_physician_data: 'Fetching physician data',
  call_ppt_agent: 'Generating PowerPoint',
  call_excel_agent: 'Building Excel workbook',
  call_sandbox_agent: 'Running sandbox analysis',
  call_report_agent: 'Writing report',
}

const styles = {
  card: { background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.1)' },
  heading: { fontSize: 13, fontWeight: 700, color: '#1A2E4A', marginBottom: 12 },
  row: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', borderBottom: '1px solid #f1f5f9' },
  icon: { fontSize: 16, minWidth: 20, marginTop: 1 },
  content: { flex: 1, minWidth: 0 },
  label: { fontSize: 13, color: '#1e293b', fontWeight: 500 },
  detail: { fontSize: 11, color: '#64748b', marginTop: 2, wordBreak: 'break-all' },
  status: (type) => ({
    fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 99,
    background: type === 'tool_done' ? '#dcfce7' : type === 'error' ? '#fee2e2' : '#f1f5f9',
    color: type === 'tool_done' ? '#166534' : type === 'error' ? '#991b1b' : '#475569',
  }),
}

export default function AgentTrace({ events }) {
  return (
    <div style={styles.card}>
      <div style={styles.heading}>Agent Trace</div>
      {events.map((ev, i) => {
        const icon = TOOL_ICONS[ev.tool] || TOOL_ICONS[ev.type] || '•'
        let label = ''
        let detail = ''

        if (ev.type === 'orchestrator_thinking') {
          label = ev.message || 'Thinking…'
        } else if (ev.type === 'tool_called') {
          label = `${TOOL_LABELS[ev.tool] || ev.tool}…`
          if (ev.args) {
            const argStr = Object.entries(ev.args)
              .filter(([, v]) => v !== undefined && v !== null)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v).slice(0, 50)}`)
              .join(' · ')
            detail = argStr
          }
        } else if (ev.type === 'tool_done') {
          label = `${TOOL_LABELS[ev.tool] || ev.tool} — done`
          detail = ev.message || ''
        } else if (ev.type === 'done') {
          label = ev.text ? ev.text.slice(0, 120) : 'Complete'
        } else if (ev.type === 'error') {
          label = `Error: ${ev.message}`
        }

        return (
          <div key={i} style={styles.row}>
            <span style={styles.icon}>{icon}</span>
            <div style={styles.content}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={styles.label}>{label}</span>
                {(ev.type === 'tool_done' || ev.type === 'error') && (
                  <span style={styles.status(ev.type)}>{ev.type === 'tool_done' ? 'done' : 'error'}</span>
                )}
              </div>
              {detail && <div style={styles.detail}>{detail}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
