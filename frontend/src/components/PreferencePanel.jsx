const ICD10_OPTIONS = ['C341', 'C342', 'C343', 'C349', 'C3410']
const STATE_OPTIONS = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]
const VOLUME_TIERS = [
  { label: 'All', value: null },
  { label: 'High+', value: 'high' },
  { label: 'Very High', value: 'very_high' },
]

const styles = {
  card: { background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.1)' },
  heading: { fontSize: 13, fontWeight: 700, color: '#1A2E4A', marginBottom: 12 },
  section: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6, display: 'block' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 5 },
  chip: (active) => ({
    padding: '3px 9px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
    background: active ? '#1A2E4A' : '#f1f5f9',
    color: active ? '#fff' : '#475569',
    border: 'none', fontWeight: active ? 600 : 400,
  }),
  select: {
    width: '100%', padding: '6px 8px', fontSize: 12,
    border: '1px solid #e2e8f0', borderRadius: 5, background: '#f8fafc',
    maxHeight: 120,
  },
}

export default function PreferencePanel({ preferences, onChange }) {
  function toggleIcd(code) {
    const next = preferences.icd10_codes.includes(code)
      ? preferences.icd10_codes.filter(c => c !== code)
      : [...preferences.icd10_codes, code]
    onChange({ ...preferences, icd10_codes: next })
  }

  function toggleState(e) {
    const selected = Array.from(e.target.selectedOptions).map(o => o.value)
    onChange({ ...preferences, states: selected })
  }

  return (
    <div style={styles.card}>
      <div style={styles.heading}>Filters</div>

      <div style={styles.section}>
        <span style={styles.label}>ICD-10 Codes</span>
        <div style={styles.chipRow}>
          {ICD10_OPTIONS.map(code => (
            <button key={code} style={styles.chip(preferences.icd10_codes.includes(code))} onClick={() => toggleIcd(code)}>
              {code}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <span style={styles.label}>States (multi-select)</span>
        <select multiple size={6} style={styles.select} value={preferences.states} onChange={toggleState}>
          {STATE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {preferences.states.length > 0 && (
          <div style={{ fontSize: 11, color: '#008C8C', marginTop: 4 }}>
            Selected: {preferences.states.join(', ')}
          </div>
        )}
      </div>

      <div style={styles.section}>
        <span style={styles.label}>Volume Tier</span>
        <div style={styles.chipRow}>
          {VOLUME_TIERS.map(t => (
            <button
              key={String(t.value)}
              style={styles.chip(preferences.volume_tier === t.value)}
              onClick={() => onChange({ ...preferences, volume_tier: t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
