import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'

const EMPTY_PROFILE = {
  full_name: '', structured_skills: '', about_description: '', experience_years: 0,
  locality: '', availability: '', work_type: 'part-time',
}

export default function WorkerProfileForm() {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_PROFILE)
  const [profile, setProfile] = useState(null)
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    api.get('/workers/me').then((res) => { setForm(res.data); setProfile(res.data) }).catch(() => {})
  }, [])

  const handleChange = (field) => (e) => {
    const value = field === 'experience_years' ? Number(e.target.value) : e.target.value
    setForm({ ...form, [field]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const res = await api.post('/workers/me', form)
      setProfile(res.data)
      setSuccess('Profile saved. Your match embedding has been updated.')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save profile.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/workers/me/portfolio', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setProfile(res.data)
      setSuccess('Portfolio uploaded.')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not upload file.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="page-container narrow">
      <h2>Your Profile</h2>
      <p>Structured skills power exact matching; your description powers AI semantic matching. Portfolio upload is optional.</p>
      <Card>
        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input className="form-input" required value={form.full_name} onChange={handleChange('full_name')} />
          </div>
          <div className="form-group">
            <label className="form-label">Structured skills (comma-separated)</label>
            <input className="form-input" required value={form.structured_skills} onChange={handleChange('structured_skills')} placeholder="e.g. tailoring, embroidery, bridal wear" />
          </div>
          <div className="form-group">
            <label className="form-label">About / Description</label>
            <textarea className="form-textarea" required value={form.about_description} onChange={handleChange('about_description')} placeholder="Describe your experience and skills in your own words - this is what the AI uses for semantic matching." />
            <div className="form-hint">Even without formal experience, a good description can still be matched well.</div>
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
              <label className="form-label">Locality</label>
              <input className="form-input" required value={form.locality} onChange={handleChange('locality')} placeholder="e.g. Kochi" />
            </div>
            <div className="form-group">
              <label className="form-label">Availability (comma-separated)</label>
              <input className="form-input" required value={form.availability} onChange={handleChange('availability')} placeholder="e.g. weekdays, mornings" />
            </div>
          </div>
          <Button type="submit" block disabled={loading}>{loading ? 'Saving...' : 'Save profile'}</Button>
        </form>
      </Card>

      {profile && (
        <Card>
          <h3>Portfolio / Certificate (optional)</h3>
          <p className="form-hint">Single PDF, PNG or JPG, under 5MB. Never required to receive recommendations.</p>
          {profile.portfolio_file_path && (
            <p className="form-hint">Current file: {profile.portfolio_file_path.split('/').pop()}</p>
          )}
          <form onSubmit={handleUpload} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '8px' }}>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files[0])} />
            <Button type="submit" size="sm" disabled={uploading || !file}>{uploading ? 'Uploading...' : 'Upload'}</Button>
          </form>
        </Card>
      )}

      {profile && (
        <div style={{ marginTop: '16px' }}>
          <Button variant="secondary" onClick={() => navigate('/worker')}>Back to dashboard</Button>
        </div>
      )}
    </div>
  )
}
