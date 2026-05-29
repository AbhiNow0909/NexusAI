import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

const EXT_META = {
  pptx: { icon: '📊', label: 'PowerPoint' },
  xlsx: { icon: '📋', label: 'Excel' },
  docx: { icon: '📝', label: 'Word Report' },
}

const S = {
  card: {
    background: '#fff', borderRadius: 12, padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.05)',
    border: '1px solid #E8EDF3',
  },
  heading: { fontSize: 13, fontWeight: 700, color: '#0F2044', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 },
  section: { marginBottom: 20 },
  sectionHeader: {
    fontSize: 11, fontWeight: 700, color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    marginBottom: 8,
  },
  artifactGrid: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  downloadBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '9px 18px',
    background: 'linear-gradient(135deg, #0F2044 0%, #1e3a6e 100%)',
    color: '#fff', borderRadius: 8,
    fontSize: 13, fontWeight: 600, textDecoration: 'none',
    border: 'none', cursor: 'pointer',
  },
  chartImg: { maxWidth: '100%', borderRadius: 10, border: '1px solid #E8EDF3', display: 'block' },
  codeHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6,
  },
  copyBtn: {
    padding: '4px 12px', fontSize: 11, fontWeight: 600,
    background: '#F8FAFC', color: '#475569',
    border: '1px solid #E2E8F0', borderRadius: 6,
  },
  copyBtnDone: {
    padding: '4px 12px', fontSize: 11, fontWeight: 600,
    background: '#D1FAE5', color: '#065F46',
    border: '1px solid #A7F3D0', borderRadius: 6,
  },
  codePre: {
    background: '#0D1117', color: '#C9D1D9', padding: '14px 16px',
    borderRadius: 8, fontSize: 12.5, overflow: 'auto', maxHeight: 420,
    margin: 0, fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    border: '1px solid #21262D',
  },
  stdoutPre: {
    background: '#0D1117', color: '#56D364', padding: '12px 16px',
    borderRadius: 8, fontSize: 12, overflow: 'auto', maxHeight: 200,
    margin: 0, fontFamily: 'Consolas, Monaco, monospace', lineHeight: 1.6,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    border: '1px solid #21262D',
  },
  divider: { borderTop: '1px solid #F1F5F9', margin: '16px 0' },
  markdownWrap: { fontSize: 14, lineHeight: 1.75, color: '#1E293B' },
}

export default function ResultsPanel({ results }) {
  const { markdown, artifacts, chartB64, stdout, code } = results
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={S.card}>
      <div style={S.heading}><span>✨</span> Results</div>

      {artifacts.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionHeader}>Downloads</div>
          <div style={S.artifactGrid}>
            {artifacts.map((a, i) => {
              const ext = a.filename?.split('.').pop() || ''
              const meta = EXT_META[ext] || { icon: '📄', label: 'File' }
              return (
                <a key={i} href={`/artifacts/${a.id}`} download={a.filename}
                   className="download-btn" style={S.downloadBtn}>
                  {meta.icon} Download {meta.label}
                </a>
              )
            })}
          </div>
        </div>
      )}

      {chartB64 && (
        <>
          {artifacts.length > 0 && <div style={S.divider} />}
          <div style={S.section}>
            <div style={S.sectionHeader}>📈 Analysis Chart</div>
            <img src={`data:image/png;base64,${chartB64}`} alt="Analysis chart" style={S.chartImg} />
          </div>
        </>
      )}

      {code && (
        <>
          <div style={S.divider} />
          <div style={S.section}>
            <div style={S.codeHeader}>
              <span style={S.sectionHeader}>🐍 Generated Python Code</span>
              <button
                className={`copy-btn${copied ? ' copied' : ''}`}
                style={copied ? S.copyBtnDone : S.copyBtn}
                onClick={handleCopy}
              >
                {copied ? '✓ Copied!' : 'Copy code'}
              </button>
            </div>
            <pre style={S.codePre}>{code}</pre>
          </div>
        </>
      )}

      {stdout && (
        <>
          <div style={S.divider} />
          <div style={S.section}>
            <div style={S.sectionHeader}>💻 Sandbox Output</div>
            <pre style={S.stdoutPre}>{stdout}</pre>
          </div>
        </>
      )}

      {markdown && (
        <>
          <div style={S.divider} />
          <div style={S.markdownWrap}>
            <ReactMarkdown>{markdown}</ReactMarkdown>
          </div>
        </>
      )}
    </div>
  )
}
