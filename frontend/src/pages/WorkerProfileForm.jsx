import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import PortfolioLink from '../components/PortfolioLink.jsx'
import ProfileAvatar from '../components/ProfileAvatar.jsx'
import ConsentCheckbox from '../components/ConsentCheckbox.jsx'
import TagList from '../components/TagList.jsx'
import CertificationsEditor, { certificationsPayload } from '../components/CertificationsEditor.jsx'
import GalleryManager from '../components/GalleryManager.jsx'
import { formatApiError } from '../utils/errors.js'
import { useAuth } from '../context/AuthContext.jsx'

const EMPTY_PROFILE = {
  full_name: '', structured_skills: '', about_description: '', experience_years: 0,
  locality: '', availability: '', work_type: 'part-time', phone: '',
  show_email_publicly: false,
  services_offered: '', languages: '', professional_intro: '', certifications: [],
}

const FIELD_LABELS = {
  full_name: 'Full name',
  structured_skills: 'Skills',
  about_description: 'About / Description',
  experience_years: 'Experience (years)',
  locality: 'Locality',
  availability: 'Availability',
  work_type: 'Work type',
  phone: 'Phone',
  services_offered: 'Services offered',
  languages: 'Languages spoken',
  professional_intro: 'Professional introduction',
  certifications: 'Certifications',
}

// Only the fields the API accepts - the GET response also carries id, user_id and
// portfolio_file_path, which must never be sent back with the profile form.
const toFormState = (data) => ({
  full_name: data.full_name ?? '',
  structured_skills: data.structured_skills ?? '',
  about_description: data.about_description ?? '',
  experience_years: data.experience_years ?? 0,
  locality: data.locality ?? '',
  availability: data.availability ?? '',
  work_type: data.work_type ?? 'part-time',
  phone: data.phone ?? '',
  show_email_publicly: !!data.show_email_publicly,
  services_offered: data.services_offered ?? '',
  languages: data.languages ?? '',
  professional_intro: data.professional_intro ?? '',
  certifications: (data.certifications ?? []).map((c) => ({ title: c.title ?? '', issuer: c.issuer ?? '', year: c.year ?? '' })),
})

const hasTag = (value) => String(value ?? '').split(',').some((t) => t.trim() !== '')

// Mirrors the server-side rules so the user gets a clear message before any request.
function validate(form) {
  const problems = []
  if (!String(form.full_name ?? '').trim()) problems.push('Full name is required.')
  if (!hasTag(form.structured_skills)) problems.push('Enter at least one skill (comma-separated).')
  if (!String(form.about_description ?? '').trim()) problems.push('About / Description is required.')
  if (!String(form.locality ?? '').trim()) problems.push('Locality is required.')
  if (!hasTag(form.availability)) problems.push('Enter at least one availability value (comma-separated).')
  const exp = Number(form.experience_years)
  if (!Number.isFinite(exp) || exp < 0 || exp > 60) problems.push('Experience must be between 0 and 60 years.')
  const badCert = (form.certifications ?? []).some((c) => !String(c.title ?? '').trim() && (String(c.issuer ?? '').trim() || String(c.year ?? '').trim()))
  if (badCert) problems.push('Each certification needs a title (or remove the empty row).')
  return problems
}

export default function WorkerProfileForm() {
  const { email } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_PROFILE)
  const [profile, setProfile] = useState(null)
  const [file, setFile] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const photoInputRef = useRef(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const savingRef = useRef(false)
  const bannerRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    api.get('/workers/me')
      .then((res) => { setForm(toFormState(res.data)); setProfile(res.data) })
      .catch(() => {})
  }, [])

  // Make sure the success / error message is actually in view after clicking Save.
  useEffect(() => {
    if ((error || success) && bannerRef.current && bannerRef.current.scrollIntoView) {
      bannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [error, success])

  const handleChange = (field) => (e) => {
    const value = field === 'experience_years' ? Number(e.target.value) : e.target.value
    setForm({ ...form, [field]: value })
  }

  // Used by both the Save Profile button (onClick) and the form (Enter key). onClick calls
  // preventDefault, so a single click can never trigger two saves; savingRef guards double-clicks.
  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (savingRef.current) return
    setError('')
    setSuccess('')

    const problems = validate(form)
    if (problems.length > 0) {
      setError(problems.join(' '))
      return
    }

    savingRef.current = true
    setLoading(true)
    try {
      const payload = toFormState(form)
      payload.experience_years = Number(payload.experience_years)
      payload.certifications = certificationsPayload(form.certifications)
      const res = await api.post('/workers/me', payload)
      setProfile(res.data)
      setForm(toFormState(res.data)) // show exactly what was stored (tags are normalised server-side)
      setSuccess('Profile saved. Your match embedding has been updated.')
    } catch (err) {
      setError(formatApiError(err, 'Could not save profile.', FIELD_LABELS))
    } finally {
      savingRef.current = false
      setLoading(false)
    }
  }

  const handlePhotoUpload = async (e) => {
    e.preventDefault(); if (!photoFile || !profile) return
    setPhotoBusy(true); setError(''); setSuccess('')
    try { const data = new FormData(); data.append('file', photoFile)
      const res = await api.post('/workers/me/photo', data, { headers: { 'Content-Type': 'multipart/form-data' } })
      setProfile(res.data); setPhotoFile(null); if (photoInputRef.current) photoInputRef.current.value = ''
      setSuccess('Profile photo updated.')
    } catch (err) { setError(formatApiError(err, 'Could not upload profile photo.')) } finally { setPhotoBusy(false) }
  }
  const handlePhotoRemove = async () => {
    setPhotoBusy(true); setError(''); setSuccess('')
    try { const res = await api.delete('/workers/me/photo'); setProfile(res.data); setSuccess('Profile photo removed.') }
    catch (err) { setError(formatApiError(err, 'Could not remove profile photo.')) } finally { setPhotoBusy(false) }
  }

  const handleRemovePortfolio = async () => {
    setError('')
    setSuccess('')
    try {
      const res = await api.delete('/workers/me/portfolio')
      setProfile(res.data)
      setSuccess('Portfolio removed.')
    } catch (err) {
      setError(formatApiError(err, 'Could not remove file.'))
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setError('')
    setSuccess('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/workers/me/portfolio', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setProfile(res.data)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setSuccess('Portfolio uploaded.')
    } catch (err) {
      setError(formatApiError(err, 'Could not upload file.'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="page-container narrow">
      <h2>Your Profile</h2>
      <p>Add your skills and experience so businesses can find you.</p>
      <Card>
        <div ref={bannerRef}>
          {error && <div className="error-banner">{error}</div>}
          {success && <div className="success-banner">{success}</div>}
        </div>
        <form onSubmit={handleSave} noValidate>
          <div className="form-group">
            <label className="form-label">Full name <span style={{ color: '#d66b88' }}>*</span></label>
            <input className="form-input" required value={form.full_name} onChange={handleChange('full_name')} />
          </div>
          <div className="form-group">
            <label className="form-label">Skills (comma-separated) <span style={{ color: '#d66b88' }}>*</span></label>
            <input className="form-input" required value={form.structured_skills} onChange={handleChange('structured_skills')} placeholder="e.g. tailoring, embroidery, bridal wear" />
          </div>
          <div className="form-group">
            <label className="form-label">About / Description <span style={{ color: '#d66b88' }}>*</span></label>
            <textarea className="form-textarea" required value={form.about_description} onChange={handleChange('about_description')} placeholder="Describe your experience, skills and the work you are comfortable doing." />
            <div className="form-hint">Describe your skills and the work you're comfortable doing, even if you don't have formal experience.</div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Experience (years)</label>
              <input className="form-input" type="number" min="0" step="0.5" value={form.experience_years} onChange={handleChange('experience_years')} />
            </div>
            <div className="form-group">
              <label className="form-label">Work type</label>
              <select className="form-select" value={form.work_type} onChange={handleChange('work_type')}>
                <option value="part-time">Part-time</option>
                <option value="seasonal">Seasonal</option>
                <option value="short-term">Short-term</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Locality <span style={{ color: '#d66b88' }}>*</span></label>
              <input className="form-input" required value={form.locality} onChange={handleChange('locality')} placeholder="e.g. Kochi" />
            </div>
            <div className="form-group">
              <label className="form-label">Availability (comma-separated) <span style={{ color: '#d66b88' }}>*</span></label>
              <input className="form-input" required value={form.availability} onChange={handleChange('availability')} placeholder="e.g. weekdays, mornings" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Professional introduction</label>
            <textarea className="form-textarea" value={form.professional_intro} onChange={handleChange('professional_intro')} maxLength={3000} placeholder="Introduce yourself to businesses: who you are, how you work and what you are proud of." />
            <div className="form-hint">Shown at the top of your profile. It is for display only and is not used for job matching.</div>
          </div>
          <div className="form-group">
            <label className="form-label">Services offered (comma-separated)</label>
            <input className="form-input" value={form.services_offered} onChange={handleChange('services_offered')} placeholder="e.g. custom blouse stitching, bridal alterations" />
            <TagList value={form.services_offered} />
            <div className="form-hint">The specific services you offer, shown as tags on your profile (display only).</div>
          </div>
          <div className="form-group">
            <label className="form-label">Languages spoken (comma-separated)</label>
            <input className="form-input" value={form.languages} onChange={handleChange('languages')} placeholder="e.g. Malayalam, English, Hindi" />
            <TagList value={form.languages} variant="lang" />
          </div>
          <div className="form-group">
            <label className="form-label">Certifications and training</label>
            <CertificationsEditor value={form.certifications} onChange={(rows) => setForm((prev) => ({ ...prev, certifications: rows }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" type="tel" value={form.phone} onChange={handleChange('phone')} placeholder="e.g. +91 98470 12345" />
            <div className="form-hint">Your phone number isn't shown on your profile. It's shared only if you choose to share it after a connection is accepted.</div>
          </div>
          <div className="form-group">
            <ConsentCheckbox
              checked={form.show_email_publicly}
              onChange={(v) => setForm((prev) => ({ ...prev, show_email_publicly: v }))}
            >
              Show my email publicly
            </ConsentCheckbox>
            <div className="form-hint">
              Off by default. When on, your account email{email ? ` (${email})` : ''} appears on your profile for businesses that can view it. Your phone number is never shown. Click Save profile to apply.
            </div>
          </div>
        </form>

      {profile && (
        <>
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f1d5dc' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 500, marginTop: 0 }}>Profile picture</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <ProfileAvatar role="worker" profileId={profile.id} hasPhoto={!!profile.profile_photo_path} photoPath={profile.profile_photo_path} email={email} size={76} />
            <div style={{ flex: '1 1 220px' }}><p className="form-hint">Use a clear photo of yourself. PNG, JPG, or WEBP, up to 3 MB.</p>
              <form onSubmit={handlePhotoUpload} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input ref={photoInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                <Button type="button" variant="secondary" size="sm" onClick={() => photoInputRef.current?.click()}>{photoFile ? 'Choose another photo' : 'Choose photo'}</Button>
                <span className="form-hint">{photoFile ? photoFile.name : 'No photo selected'}</span>
                <Button type="submit" size="sm" disabled={!photoFile || photoBusy}>{photoBusy ? 'Uploading…' : 'Upload photo'}</Button>
                {profile.profile_photo_path && <Button type="button" variant="danger" size="sm" disabled={photoBusy} onClick={handlePhotoRemove}>Remove</Button>}
              </form>
            </div>
          </div>
        </div>
        <GalleryManager role="worker" profile={profile} onProfile={setProfile} onMessage={(err, ok) => { setError(err); setSuccess(ok) }} />
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f1d5dc' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 500, marginTop: 0 }}>Portfolio / Certificate</h3>
          <p className="form-hint">Upload one PDF, PNG or JPG file (under 5 MB).</p>
          {profile.portfolio_file_path && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: '8px 0' }}>
              <span className="form-hint">Current file: {profile.portfolio_file_path.split(/[\\/]/).pop()}</span>
              <PortfolioLink workerId={profile.id} label="View" />
              <Button variant="danger" size="sm" onClick={handleRemovePortfolio}>Remove</Button>
            </div>
          )}
          <form onSubmit={handleUpload} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginTop: '8px' }}>
            <input
              ref={fileInputRef}
              id="portfolio-file-input"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ display: 'none' }}
            />
            <Button type="button" variant="secondary" size="sm" style={{ padding: '6px 10px', fontSize: '13px' }} onClick={() => fileInputRef.current?.click()}>
              {file ? 'Choose another file' : 'Choose a new file'}
            </Button>
            <span className="form-hint" style={{ flex: '1 1 180px', minWidth: 0, overflowWrap: 'anywhere' }}>
              {file ? `Selected: ${file.name}` : 'No new file selected'}
            </span>
            <Button type="submit" size="sm" disabled={uploading || !file}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </form>
        </div>
        </>
      )}
      </Card>

      <div style={{ marginTop: '16px' }}>
        <Button type="button" block disabled={loading} onClick={handleSave}>
          {loading ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>

      {profile && (
        <div style={{ marginTop: '16px' }}>
          <Button variant="secondary" onClick={() => navigate('/worker')}>Back to dashboard</Button>
        </div>
      )}
    </div>
  )
}
