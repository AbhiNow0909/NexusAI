import { useState } from 'react'

const SAMPLE_QUERIES = [
  'Give me a PowerPoint slide summarizing top oncologists in California treating NSCLC',
  'Build an Excel breakdown of C341 claim volume by physician specialty and state',
  'Write a two-page market access report on NSCLC physician density in the Northeast',
  'Run an analysis showing which states have the highest concentration of high-volume NSCLC prescribers',
  'Give me a slide deck and an Excel breakdown of high-volume NSCLC oncologists in California and New York',
]

const styles = {
  card: { background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.1)' },
  label: { fontSize: 13, fontWeight: 600, color: '#1A2E4A', marginBottom: 8, display: 'block' },
  textarea: {
    width: '100%', minHeight: 90, padding: '10px 12px', fontSize: 14,
    border: '1.5px solid #cbd5e1', borderRadius: 6, resize: 'vertical',
    fontFamily: 'inherit', outline: 'none',
  },
  row: { display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' },
  btn: {
    padding: '9px 22px', background: '#1A2E4A', color: '#fff',
    border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  sampleLabel: { fontSize: 12, color: '#64748b', marginTop: 12, marginBottom: 4 },
  sampleBtn: {
    display: 'block', width: '100%', textAlign: 'left', padding: '5px 0',
    background: 'none', border: 'none', fontSize: 12, color: '#008C8C',
    cursor: 'pointer', textDecoration: 'underline',
  },
}

export default function QueryInput({ onSubmit, running }) {
  const [query, setQuery] = useState('')

  return (
    <div style={styles.card}>
      <label style={styles.label}>Natural Language Query</label>
      <textarea
        style={styles.textarea}
        placeholder="e.g. Give me a PowerPoint of top oncologists in California treating NSCLC…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && e.metaKey && !running && query.trim()) onSubmit(query.trim()) }}
      />
      <div style={styles.row}>
        <button
          style={{ ...styles.btn, ...(running || !query.trim() ? styles.btnDisabled : {}) }}
          disabled={running || !query.trim()}
          onClick={() => onSubmit(query.trim())}
        >
          {running ? 'Running…' : 'Analyze'}
        </button>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>or ⌘+Enter</span>
      </div>
      <div style={styles.sampleLabel}>Sample queries:</div>
      {SAMPLE_QUERIES.map((q, i) => (
        <button key={i} style={styles.sampleBtn} onClick={() => setQuery(q)}>{q}</button>
      ))}
    </div>
  )
}
