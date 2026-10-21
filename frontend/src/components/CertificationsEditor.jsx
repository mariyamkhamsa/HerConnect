import React from 'react'
import Button from './Button.jsx'
import '../profileExtras.css'

export const MAX_CERTIFICATIONS = 10

// Editable certification rows. `value` is [{ title, issuer, year }]; changes go to onChange(newList).
export default function CertificationsEditor({ value, onChange }) {
  const rows = Array.isArray(value) ? value : []
  const update = (i, field, v) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: v } : r)))
  return (
    <div>
      {rows.map((r, i) => (
        <div className="pe-row" key={i}>
          <input className="form-input" aria-label="Certification title" placeholder="Certificate / training" value={r.title ?? ''} onChange={(e) => update(i, 'title', e.target.value)} />
          <input className="form-input" aria-label="Issuing organisation" placeholder="Issued by (optional)" value={r.issuer ?? ''} onChange={(e) => update(i, 'issuer', e.target.value)} />
          <input className="form-input" aria-label="Year" type="number" min="1950" max="2100" placeholder="Year" value={r.year ?? ''} onChange={(e) => update(i, 'year', e.target.value)} />
          <Button type="button" variant="danger" size="sm" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>Remove</Button>
        </div>
      ))}
      {rows.length < MAX_CERTIFICATIONS && (
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...rows, { title: '', issuer: '', year: '' }])}>+ Add certification</Button>
      )}
    </div>
  )
}

// Form rows -> API payload: drops blank rows, year '' -> null.
export function certificationsPayload(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => String(r.title ?? '').trim() !== '')
    .map((r) => ({
      title: String(r.title).trim(),
      issuer: String(r.issuer ?? '').trim() || null,
      year: r.year === '' || r.year == null ? null : Number(r.year),
    }))
}
