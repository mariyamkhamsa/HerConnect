import React, { useEffect, useState } from 'react'
import GalleryImage from './GalleryImage.jsx'
import '../profileExtras.css'

// Portfolio gallery: image cards with title + description; click an image to enlarge it.
// `renderActions(item)` (optional) adds edit / delete buttons for the owner's own profile.
export default function GalleryGrid({ role, profileId, items, empty = null, renderActions }) {
  const list = Array.isArray(items) ? items : []
  const [open, setOpen] = useState(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (list.length === 0) return empty ? <p className="pe-empty">{empty}</p> : null
  return (
    <>
      <div className="pe-gallery">
        {list.map((item) => (
          <figure className="pe-card" key={item.id} style={{ margin: 0 }}>
            <button type="button" className="pe-img-btn" onClick={() => setOpen(item)} aria-label={`Enlarge ${item.title}`}>
              <GalleryImage role={role} profileId={profileId} item={item} />
            </button>
            <figcaption className="pe-card-body">
              <p className="pe-card-title">{item.title}</p>
              {item.description && <p className="pe-card-desc">{item.description}</p>}
              {renderActions && <div className="pe-card-actions">{renderActions(item)}</div>}
            </figcaption>
          </figure>
        ))}
      </div>
      {open && (
        <div className="pe-lightbox" role="dialog" aria-modal="true" aria-label={open.title} onClick={() => setOpen(null)}>
          <div className="pe-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <div style={{ aspectRatio: '4 / 3', maxHeight: '65vh', background: '#fdf2f4' }}>
              <GalleryImage role={role} profileId={profileId} item={open} />
            </div>
            <div className="pe-lightbox-body">
              <p className="pe-card-title" style={{ fontSize: 16 }}>{open.title}</p>
              {open.description && <p className="pe-card-desc">{open.description}</p>}
              <div style={{ marginTop: 12 }}><button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(null)}>Close</button></div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
