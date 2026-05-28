import ReactMarkdown from 'react-markdown'

const EXT_ICONS = { pptx: '📊', xlsx: '📋', docx: '📝' }

const styles = {
  card: { background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.1)' },
  heading: { fontSize: 13, fontWeight: 700, color: '#1A2E4A', marginBottom: 12 },
  downloadRow: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  downloadBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', background: '#1A2E4A', color: '#fff',
    borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: 'none',
  },
  markdownWrap: {
    fontSize: 14, lineHeight: 1.7, color: '#1e293b',
    borderTop: '1px solid #f1f5f9', paddingTop: 16,
  },
  chartWrap: { marginTop: 16 },
  chartImg: { maxWidth: '100%', borderRadius: 8, border: '1px solid #e2e8f0' },
  stdoutWrap: { marginTop: 12 },
  stdoutPre: {
    background: '#0f172a', color: '#a5f3fc', padding: 12, borderRadius: 6,
    fontSize: 12, overflow: 'auto', maxHeight: 200,
  },
}

export default function ResultsPanel({ results }) {
  const { markdown, artifacts, chartB64, stdout } = results

  return (
    <div style={styles.card}>
      <div style={styles.heading}>Results</div>

      {artifacts.length > 0 && (
        <div style={styles.downloadRow}>
          {artifacts.map((a, i) => {
            const ext = a.filename?.split('.').pop() || ''
            const icon = EXT_ICONS[ext] || '📄'
            return (
              <a key={i} href={`/artifacts/${a.id}`} download={a.filename} style={styles.downloadBtn}>
                {icon} Download {a.filename || 'artifact'}
              </a>
            )
          })}
        </div>
      )}

      {chartB64 && (
        <div style={styles.chartWrap}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Analysis chart</div>
          <img src={`data:image/png;base64,${chartB64}`} alt="Analysis chart" style={styles.chartImg} />
        </div>
      )}

      {stdout && (
        <div style={styles.stdoutWrap}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Sandbox output</div>
          <pre style={styles.stdoutPre}>{stdout}</pre>
        </div>
      )}

      {markdown && (
        <div style={styles.markdownWrap}>
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}
