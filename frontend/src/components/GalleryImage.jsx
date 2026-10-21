import React, { useEffect, useState } from 'react'
import api from '../api.js'
import { externalPhotoUrl } from '../utils/avatar.js'
import '../profileExtras.css'

// Gallery picture. Sample items carry an https `external_url` (loaded directly); uploaded files are
// fetched with the JWT from the authenticated image endpoint and shown through a blob URL.
// A missing / broken image falls back to a soft pink tile.
export default function GalleryImage({ role, profileId, item, alt }) {
  const external = externalPhotoUrl(item.external_url)
  const [src, setSrc] = useState(external)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    if (external) { setSrc(external); return undefined }
    let active = true; let objectUrl = ''
    setSrc('')
    const base = role === 'worker' ? 'workers' : 'entrepreneurs'
    api.get(`/${base}/${profileId}/gallery/${item.id}/image`, { responseType: 'blob' })
      .then((res) => { if (!active) return; objectUrl = URL.createObjectURL(res.data); setSrc(objectUrl) })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [role, profileId, item.id, external])

  if (!src || failed) return <div className="pe-img-fallback" aria-hidden="true">▧</div>
  return <img src={src} alt={alt || item.title} referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed(true)} />
}
