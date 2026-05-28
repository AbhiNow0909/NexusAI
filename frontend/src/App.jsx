import { useState } from 'react'
import QueryInput from './components/QueryInput.jsx'
import PreferencePanel from './components/PreferencePanel.jsx'
import AgentTrace from './components/AgentTrace.jsx'
import ResultsPanel from './components/ResultsPanel.jsx'

const styles = {
  app: { maxWidth: 1100, margin: '0 auto', padding: '24px 16px' },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 700, color: '#1A2E4A' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  grid: { display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 },
  left: { display: 'flex', flexDirection: 'column', gap: 16 },
  right: { display: 'flex', flexDirection: 'column', gap: 16 },
}

export default function App() {
  const [preferences, setPreferences] = useState({ icd10_codes: [], states: [], volume_tier: null })
  const [traceEvents, setTraceEvents] = useState([])
  const [results, setResults] = useState({ markdown: '', artifacts: [], chartB64: null, stdout: '' })
  const [running, setRunning] = useState(false)

  function handleQuery(query) {
    setTraceEvents([])
    setResults({ markdown: '', artifacts: [], chartB64: null, stdout: '' })
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
                if (event.type === 'tool_done' && event.markdown) {
                  setResults(prev => ({ ...prev, markdown: event.markdown }))
                }
                if (event.type === 'tool_done' && event.artifact_id) {
                  setResults(prev => ({
                    ...prev,
                    artifacts: [...prev.artifacts, { id: event.artifact_id, filename: event.filename, tool: event.tool }],
                  }))
                }
                if (event.type === 'tool_done' && event.chart_b64) {
                  setResults(prev => ({ ...prev, chartB64: event.chart_b64 }))
                }
                if (event.type === 'tool_done' && event.stdout) {
                  setResults(prev => ({ ...prev, stdout: event.stdout }))
                }
                if (event.type === 'done' || event.type === 'error') {
                  setRunning(false)
                }
              } catch (_) {}
            }
          })
          read()
        })
      }
      read()
    }).catch(() => setRunning(false))
  }

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <div style={styles.title}>DocNexus AI</div>
        <div style={styles.subtitle}>Physician Intelligence · Multi-Agent Orchestration</div>
      </div>
      <div style={styles.grid}>
        <div style={styles.left}>
          <PreferencePanel preferences={preferences} onChange={setPreferences} />
        </div>
        <div style={styles.right}>
          <QueryInput onSubmit={handleQuery} running={running} />
          {traceEvents.length > 0 && <AgentTrace events={traceEvents} />}
          {(results.markdown || results.artifacts.length > 0 || results.chartB64) && (
            <ResultsPanel results={results} />
          )}
        </div>
      </div>
    </div>
  )
}
