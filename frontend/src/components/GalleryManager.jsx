import React, { useRef, useState } from 'react'
import api from '../api.js'
import Button from './Button.jsx'
import GalleryGrid from './GalleryGrid.jsx'
import { formatApiError } from '../utils/errors.js'
import '../profileExtras.css'

export const MAX_GALLERY_ITEMS = 12

// Owner-side gallery editor. Add / edit / delete hit the API immediately (separate from the main
// "Save profile" button) and the API returns the refreshed profile, passed up through onProfile.
//   role: 'worker' | 'entrepreneur'   profile: the saved profile (needs id + gallery)
export default function GalleryManager({ role, profile, onProfile, onMessage }) {
  const base = role === 'worker' ? '/workers/me/gallery' : '/entrepreneurs/me/gallery'
  const items = profile.gallery || []
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null) // { id, title, description }

  const run = async (fn, okMessage, failMessage) => {
    setBusy(true); onMessage('', '')
    try { const res = await fn(); onProfile(res.data); onMessage('', okMessage); return true }
    catch (err) { onMessage(formatApiError(err, failMessage), ''); return false }
    finally { setBusy(false) }
  }

  const add = async (e) => {
    e.preventDefault()
    if (!file) { onMessage('Choose an image first.', ''); return }
    if (!title.trim()) { onMessage('Give the picture a title.', ''); return }
    const data = new FormData()
    data.append('file', file); data.append('title', title.trim()); data.append('description', description.trim())
    const ok = await run(() => api.post(base, data, { headers: { 'Content-Type': 'multipart/form-data' } }), 'Gallery item added.', 'Could not add the picture.')
    if (ok) { setFile(null); setTitle(''); setDescription(''); if (fileRef.current) fileRef.current.value = '' }
  }

  const saveEdit = async () => {
    if (!editing.title.trim()) { onMessage('Title cannot be empty.', ''); return }
    const ok = await run(() => api.put(`${base}/${editing.id}`, { title: editing.title.trim(), description: editing.description.trim() || null }), 'Gallery item updated.', 'Could not update the picture.')
    if (ok) setEditing(null)
  }

  const remove = (item) => {
    if (!window.confirm(`Remove “${item.title}” from your gallery?`)) return
    run(() => api.delete(`${base}/${item.id}`), 'Gallery item removed.', 'Could not remove the picture.')
  }

  return (
    <div className="pe-section">
      <h3>Portfolio gallery</h3>
      <p className="form-hint">Show your work with pictures and a short description. PNG, JPG or WEBP, up to 3 MB each, up to {MAX_GALLERY_ITEMS} items.</p>

      <GalleryGrid
        role={role} profileId={profile.id} items={items} empty="No pictures yet."
        renderActions={(item) => editing && editing.id === item.id ? null : (
          <>
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => setEditing({ id: item.id, title: item.title, description: item.description || '' })}>Edit</Button>
            <Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => remove(item)}>Remove</Button>
          </>
        )}
      />

      {editing && (
        <div className="pe-add">
          <strong style={{ fontSize: 14 }}>Edit picture details</strong>
          <div className="form-group" style={{ marginTop: 10 }}>
            <input className="form-input" aria-label="Title" maxLength={150} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
          </div>
          <div className="form-group">
            <textarea className="form-textarea" aria-label="Description" maxLength={1000} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="button" size="sm" disabled={busy} onClick={saveEdit}>Save details</Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {items.length < MAX_GALLERY_ITEMS ? (
        <form className="pe-add" onSubmit={add}>
          <strong style={{ fontSize: 14 }}>Add a picture</strong>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '10px 0' }}>
            <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>{file ? 'Choose another image' : 'Choose image'}</Button>
            <span className="form-hint" style={{ margin: 0, overflowWrap: 'anywhere' }}>{file ? file.name : 'No image selected'}</span>
          </div>
          <div className="form-group"><input className="form-input" aria-label="Picture title" maxLength={150} placeholder="Title, e.g. Embroidered bridal blouse" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="form-group"><textarea className="form-textarea" aria-label="Picture description" maxLength={1000} placeholder="Describe the work, materials or the occasion" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <Button type="submit" size="sm" disabled={busy}>{busy ? 'Working…' : 'Add to gallery'}</Button>
        </form>
      ) : <p className="form-hint">You have reached the limit of {MAX_GALLERY_ITEMS} gallery items. Remove one to add another.</p>}
    </div>
  )
}
