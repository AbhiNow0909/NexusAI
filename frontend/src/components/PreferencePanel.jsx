const ICD10_OPTIONS = ['C341', 'C342', 'C343', 'C349', 'C3410']
const STATE_OPTIONS = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]
const VOLUME_TIERS = [
  { label: 'Low',       value: 'low' },
  { label: 'High',      value: 'high' },
  { label: 'Very High', value: 'very_high' },
]

const S = {
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: 18,
    boxShadow: '0 1px 3px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.05)',
    border: '1px solid #E8EDF3',
    position: 'sticky', top: 20,
  },
  title: { fontSize: 13, fontWeight: 700, color: '#0F2044', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 },
  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 10, fontWeight: 700, color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    marginBottom: 8, display: 'block',
  },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  select: {
    width: '100%', padding: '7px 10px', fontSize: 12.5,
    border: '1.5px solid #E2E8F0', borderRadius: 8,
    background: '#FAFBFC', color: '#0F172A',
    maxHeight: 130, transition: 'border-color 0.15s',
  },
  selectedTag: {
    marginTop: 6, fontSize: 11, color: '#0891B2', fontWeight: 500,
    background: '#E0F7FA', padding: '3px 8px', borderRadius: 99, display: 'inline-block',
  },
  clearBtn: {
    marginTop: 12, width: '100%', padding: '7px', fontSize: 12,
    background: 'none', border: '1px solid #E2E8F0', borderRadius: 7,
    color: '#64748B', cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
    fontWeight: 500,
  },
  divider: { borderTop: '1px solid #F1F5F9', margin: '14px 0' },
}

export default function PreferencePanel({ preferences, onChange }) {
  function toggleIcd(code) {
    const next = preferences.icd10_codes.includes(code)
      ? preferences.icd10_codes.filter(c => c !== code)
      : [...preferences.icd10_codes, code]
    onChange({ ...preferences, icd10_codes: next })
  }

  function toggleState(e) {
    onChange({ ...preferences, states: Array.from(e.target.selectedOptions).map(o => o.value) })
  }

  function clearAll() {
    onChange({ icd10_codes: [], states: [], volume_tier: null })
  }

  const hasFilters = preferences.icd10_codes.length > 0 || preferences.states.length > 0 || preferences.volume_tier

  return (
    <div style={S.card}>
      <div style={S.title}>
        <span>🎯</span> Filters
      </div>

      <div style={S.section}>
        <span style={S.sectionLabel}>ICD-10 Codes</span>
        <div style={S.chipRow}>
          {ICD10_OPTIONS.map(code => (
            <button
              key={code}
              className={`chip${preferences.icd10_codes.includes(code) ? ' active' : ''}`}
              onClick={() => toggleIcd(code)}
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      <div style={S.divider} />

      <div style={S.section}>
        <span style={S.sectionLabel}>States (hold Ctrl for multi-select)</span>
        <select
          multiple
          size={6}
          className="state-select"
          style={S.select}
          value={preferences.states}
          onChange={toggleState}
        >
          {STATE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {preferences.states.length > 0 && (
          <span style={S.selectedTag}>
            {preferences.states.join(', ')}
          </span>
        )}
      </div>

      <div style={S.divider} />

      <div style={S.section}>
        <span style={S.sectionLabel}>Volume Tier</span>
        <div style={S.chipRow}>
          {VOLUME_TIERS.map(t => (
            <button
              key={t.value}
              className={`chip${preferences.volume_tier === t.value ? ' active' : ''}`}
              onClick={() => onChange({ ...preferences, volume_tier: preferences.volume_tier === t.value ? null : t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {hasFilters && (
        <button
          style={S.clearBtn}
          onMouseEnter={e => { e.target.style.background = '#F8FAFC'; e.target.style.color = '#EF4444'; e.target.style.borderColor = '#FCA5A5'; }}
          onMouseLeave={e => { e.target.style.background = 'none'; e.target.style.color = '#64748B'; e.target.style.borderColor = '#E2E8F0'; }}
          onClick={clearAll}
        >
          ✕ Clear all filters
        </button>
      )}
    </div>
  )
}
