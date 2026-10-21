import React from 'react'
import '../profileExtras.css'

// Read-only list of certifications: [{ title, issuer, year }].
export default function CertificationList({ items, empty = null }) {
  const list = Array.isArray(items) ? items : []
  if (list.length === 0) return empty ? <p className="pe-empty">{empty}</p> : null
  return (
    <div>
      {list.map((c, i) => (
        <div className="pe-cert" key={`${c.title}-${i}`}>
          <div className="pe-cert-icon" aria-hidden="true">✦</div>
          <div style={{ minWidth: 0 }}>
            <div className="pe-cert-title">{c.title}</div>
            {(c.issuer || c.year) && <div className="pe-cert-meta">{[c.issuer, c.year].filter(Boolean).join(' · ')}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
