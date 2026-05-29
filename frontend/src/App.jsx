import { useState } from 'react'
import QueryInput from './components/QueryInput.jsx'
import PreferencePanel from './components/PreferencePanel.jsx'
import AgentTrace from './components/AgentTrace.jsx'
import ResultsPanel from './components/ResultsPanel.jsx'

const S = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: {
    background: 'linear-gradient(135deg, #0F2044 0%, #1a3a6e 100%)',
    padding: '14px 32px',
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 2px 12px rgba(15,32,68,0.25)',
  },
  headerIcon: {
    width: 34, height: 34, borderRadius: 8,
    background: 'rgba(255,255,255,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, flexShrink: 0,
  },
  headerTitle: { fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  headerBadge: {
    marginLeft: 'auto', background: 'rgba(8,145,178,0.3)',
    border: '1px solid rgba(8,145,178,0.5)',
    borderRadius: 99, padding: '3px 10px',
    fontSize: 11, color: '#7DD3FC', fontWeight: 500,
  },
  body: { flex: 1, maxWidth: 1200, margin: '0 auto', padding: '24px 20px', width: '100%' },
  grid: { display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' },
}

export default function App() {
  const [preferences, setPreferences] = useState({ icd10_codes: [], states: [], volume_tier: null })
  const [traceEvents, setTraceEvents] = useState([])
  const [results, setResults] = useState({ markdown: '', artifacts: [], chartB64: null, stdout: '', code: '' })
  const [running, setRunning] = useState(false)

  function handleQuery(query) {
    setTraceEvents([])
    setResults({ markdown: '', artifacts: [], chartB64: null, stdout: '', code: '' })
    setRunning(true)

    fetch('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, preferences }),
    }).then(res => {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      function read() {
        reader.read().then(({ done, value }) => {
          if (done) { setRunning(false); return }
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop()
          lines.forEach(line => {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6))
                setTraceEvents(prev => [...prev, event])
                if (event.type === 'tool_done' && event.markdown)
                  setResults(prev => ({ ...prev, markdown: event.markdown }))
                if (event.type === 'tool_done' && event.artifact_id)
                  setResults(prev => ({
                    ...prev,
                    artifacts: [...prev.artifacts, { id: event.artifact_id, filename: event.filename, tool: event.tool }],
                  }))
                if (event.type === 'tool_done' && event.chart_b64)
                  setResults(prev => ({ ...prev, chartB64: event.chart_b64 }))
                if (event.type === 'tool_done' && event.stdout)
                  setResults(prev => ({ ...prev, stdout: event.stdout }))
                if (event.type === 'tool_done' && event.code)
                  setResults(prev => ({ ...prev, code: event.code }))
                if (event.type === 'done' || event.type === 'error')
                  setRunning(false)
              } catch (_) {}
            }
          })
          read()
        })
      }
      read()
    }).catch(() => setRunning(false))
  }

  const hasResults = results.markdown || results.artifacts.length > 0 || results.chartB64 || results.code

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.headerIcon}>🏥</div>
        <div>
          <div style={S.headerTitle}>DocNexus AI</div>
          <div style={S.headerSub}>Physician Intelligence · Multi-Agent Orchestration</div>
        </div>
        <div style={S.headerBadge}>Gemini · E2B</div>
      </header>

      <div style={S.body}>
        <div style={S.grid}>
          <PreferencePanel preferences={preferences} onChange={setPreferences} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <QueryInput onSubmit={handleQuery} running={running} />
            {traceEvents.length > 0 && <AgentTrace events={traceEvents} />}
            {hasResults && <ResultsPanel results={results} />}
          </div>
        </div>
      </div>
    </div>
  )
}
