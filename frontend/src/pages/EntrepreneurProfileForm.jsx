import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import ProfileAvatar from '../components/ProfileAvatar.jsx'
import TagList from '../components/TagList.jsx'
import GalleryManager from '../components/GalleryManager.jsx'
import { formatApiError } from '../utils/errors.js'
import { useAuth } from '../context/AuthContext.jsx'

const EMPTY_FORM = {
  business_name: '', description: '', locality: '', phone: '',
  business_intro: '', services_products: '', years_in_business: '', collaboration_needs: '', preferred_work_arrangements: '',
}

// Only the fields the API accepts (the GET response also carries id, user_id, gallery ...).
const toFormState = (d) => ({
  business_name: d.business_name ?? '', description: d.description ?? '', locality: d.locality ?? '', phone: d.phone ?? '',
  business_intro: d.business_intro ?? '', services_products: d.services_products ?? '',
  years_in_business: d.years_in_business ?? '', collaboration_needs: d.collaboration_needs ?? '',
  preferred_work_arrangements: d.preferred_work_arrangements ?? '',
})

export default function EntrepreneurProfileForm() {
  const { email } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const photoInputRef = useRef(null)
  const bannerRef = useRef(null)

  // Keep the success / error message in view (gallery actions happen far below the banner).
  useEffect(() => {
    if ((error || success) && bannerRef.current && bannerRef.current.scrollIntoView) {
      bannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [error, success])

  useEffect(() => {
    api.get('/entrepreneurs/me').then((res) => { setForm(toFormState(res.data)); setProfile(res.data) }).catch(() => {})
  }, [])

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const years = String(form.years_in_business ?? '').trim()
      if (years !== '' && (!Number.isInteger(Number(years)) || Number(years) < 0 || Number(years) > 100)) {
        setError('Years in business must be a whole number between 0 and 100.')
        return
      }
      const payload = { ...toFormState(form), years_in_business: years === '' ? null : Number(years) }
      const res = await api.post('/entrepreneurs/me', payload)
      setProfile(res.data)
      setForm(toFormState(res.data)) // show exactly what was stored (tags are normalised server-side)
      setSuccess('Business profile saved.')

    } catch (err) {
      setError(formatApiError(err, 'Could not save profile.'))
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoUpload = async (e) => {
    e.preventDefault(); if (!photoFile || !profile) return
    setPhotoBusy(true); setError(''); setSuccess('')
    try { const data = new FormData(); data.append('file', photoFile)
      const res = await api.post('/entrepreneurs/me/photo', data, { headers: { 'Content-Type': 'multipart/form-data' } })
      setProfile(res.data); setPhotoFile(null); if (photoInputRef.current) photoInputRef.current.value = ''
      setSuccess('Profile photo updated.')
    } catch (err) { setError(err.response?.data?.detail || 'Could not upload profile photo.') } finally { setPhotoBusy(false) }
  }
  const handlePhotoRemove = async () => {
    setPhotoBusy(true); setError(''); setSuccess('')
    try { const res = await api.delete('/entrepreneurs/me/photo'); setProfile(res.data); setSuccess('Profile photo removed.') }
    catch (err) { setError(err.response?.data?.detail || 'Could not remove profile photo.') } finally { setPhotoBusy(false) }
  }

  return (
    <div className="page-container narrow">
      <h2>Your Business Profile</h2>
      <p>This helps skilled women understand who they'd be working with.</p>
      <Card>
        <div ref={bannerRef}>
          {error && <div className="error-banner">{error}</div>}
          {success && <div className="success-banner">{success}</div>}
        </div>
        {profile && <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #f1d5dc' }}>
          <h3 style={{ fontSize: 16, fontWeight: 500, marginTop: 0 }}>Profile picture</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <ProfileAvatar role="entrepreneur" profileId={profile.id} hasPhoto={!!profile.profile_photo_path} photoPath={profile.profile_photo_path} email={email} size={76} />
            <div style={{ flex: '1 1 220px' }}><p className="form-hint">Add a photo of yourself or your business. PNG, JPG, or WEBP, up to 3 MB.</p>
              <form onSubmit={handlePhotoUpload} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input ref={photoInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                <Button type="button" variant="secondary" size="sm" onClick={() => photoInputRef.current?.click()}>{photoFile ? 'Choose another photo' : 'Choose photo'}</Button>
                <span className="form-hint">{photoFile ? photoFile.name : 'No photo selected'}</span>
                <Button type="submit" size="sm" disabled={!photoFile || photoBusy}>{photoBusy ? 'Uploading…' : 'Upload photo'}</Button>
                {profile.profile_photo_path && <Button type="button" variant="danger" size="sm" disabled={photoBusy} onClick={handlePhotoRemove}>Remove</Button>}
              </form>
            </div>
          </div>
        </div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Business name <span style={{ color: '#D66B88' }}>*</span></label>
            <input className="form-input" required value={form.business_name} onChange={handleChange('business_name')} placeholder="e.g. Rose Petal Bridal Boutique" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description || ''} onChange={handleChange('description')} placeholder="Tell workers a bit about your business" />
          </div>
          <div className="form-group">
            <label className="form-label">Business introduction</label>
            <textarea className="form-textarea" maxLength={3000} value={form.business_intro} onChange={handleChange('business_intro')} placeholder="Introduce your business: your story, your values and the kind of people you like to work with." />
          </div>
          <div className="form-group">
            <label className="form-label">Services and products (comma-separated)</label>
            <input className="form-input" value={form.services_products} onChange={handleChange('services_products')} placeholder="e.g. bridal blouses, custom lehengas, alterations" />
            <TagList value={form.services_products} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Years in business</label>
              <input className="form-input" type="number" min="0" max="100" step="1" value={form.years_in_business} onChange={handleChange('years_in_business')} placeholder="e.g. 5" />
            </div>
            <div className="form-group">
              <label className="form-label">Preferred work arrangements (comma-separated)</label>
              <input className="form-input" value={form.preferred_work_arrangements} onChange={handleChange('preferred_work_arrangements')} placeholder="e.g. part-time, seasonal, weekends" />
            </div>
          </div>
          <TagList value={form.preferred_work_arrangements} />
          <div className="form-group">
            <label className="form-label">Collaboration needs: skills or workers you are looking for (comma-separated)</label>
            <input className="form-input" value={form.collaboration_needs} onChange={handleChange('collaboration_needs')} placeholder="e.g. embroidery artists, tailors, cake decorators" />
            <TagList value={form.collaboration_needs} />
            <div className="form-hint">Shown on your business profile. Job matching still uses the jobs you post.</div>
          </div>
          <div className="form-group">
            <label className="form-label">Locality <span style={{ color: '#D66B88' }}>*</span></label>
            <input className="form-input" required value={form.locality} onChange={handleChange('locality')} placeholder="e.g. Kochi" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" type="tel" value={form.phone || ''} onChange={handleChange('phone')} placeholder="e.g. +91 98765 43210" />
            <div className="form-hint">Your phone number is shared only with your consent after a connection is accepted.</div>
            <div className="form-hint">Your account email{email ? ` (${email})` : ''} is always shown on your public business profile.</div>
          </div>
          <Button type="submit" block disabled={loading}>{loading ? 'Saving...' : 'Save profile'}</Button>
        </form>
        {profile && <GalleryManager role="entrepreneur" profile={profile} onProfile={setProfile} onMessage={(err, ok) => { setError(err); setSuccess(ok) }} />}
      </Card>
    </div>
  )
}
