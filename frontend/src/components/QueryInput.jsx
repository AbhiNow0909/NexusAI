import { useState } from 'react'

const SAMPLE_QUERIES = [
  'Give me a PowerPoint slide summarizing top oncologists in California treating NSCLC',
  'Build an Excel breakdown of C341 claim volume by physician specialty and state',
  'Write a two-page market access report on NSCLC physician density in the Northeast',
  'Run an analysis and show me which states have the highest concentration of high-volume NSCLC prescribers',
  'Give me a slide deck and an Excel breakdown of high-volume NSCLC oncologists in California and New York',
]

const S = {
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.05)',
    border: '1px solid #E8EDF3',
  },
  label: { fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'block' },
  textarea: {
    width: '100%', minHeight: 110, padding: '12px 14px',
    fontSize: 14, lineHeight: 1.6,
    border: '1.5px solid #E2E8F0', borderRadius: 8,
    resize: 'vertical', fontFamily: 'inherit',
    color: '#0F172A', background: '#FAFBFC',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    outline: 'none',
  },
  row: { display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' },
  hint: { fontSize: 12, color: '#94A3B8' },
  divider: { borderTop: '1px solid #F1F5F9', margin: '14px 0 10px' },
  samplesLabel: { fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
}

export default function QueryInput({ onSubmit, running }) {
  const [query, setQuery] = useState('')

  return (
    <div style={S.card}>
      <label style={S.label}>Natural Language Query</label>
      <textarea
        className="query-textarea"
        style={S.textarea}
        placeholder="e.g. Give me a PowerPoint of top oncologists in California treating NSCLC…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !running && query.trim())
            onSubmit(query.trim())
        }}
      />

      <div style={S.row}>
        <button
          className="btn-primary"
          disabled={running || !query.trim()}
          onClick={() => onSubmit(query.trim())}
        >
          {running ? (
            <>
              <span className="spinner" />
              Analyzing…
            </>
          ) : (
            <>
              ⚡ Analyze
            </>
          )}
        </button>
        <span style={S.hint}>or Ctrl+Enter</span>
      </div>

      <div style={S.divider} />
      <div style={S.samplesLabel}>Sample queries</div>
      {SAMPLE_QUERIES.map((q, i) => (
        <button key={i} className="sample-link" onClick={() => setQuery(q)}>
          → {q}
        </button>
      ))}
    </div>
  )
}
