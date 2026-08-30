import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'

const EMPTY_JOB = {
  title: '', description: '', required_skills_text: '', experience_required: 0,
  locality: '', availability: '', work_type: 'part-time',
}

export default function JobPostingForm() {
  const navigate = useNavigate()
  const { jobId } = useParams()
  const isEdit = Boolean(jobId)
  const [form, setForm] = useState(EMPTY_JOB)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isEdit) {
      api.get(`/jobs/${jobId}`).then((res) => setForm(res.data))
    }
  }, [jobId])

  const handleChange = (field) => (e) => {
    const value = field === 'experience_required' ? Number(e.target.value) : e.target.value
    setForm({ ...form, [field]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isEdit) {
        await api.put(`/jobs/${jobId}`, form)
      } else {
        await api.post('/jobs', form)
      }
      navigate('/entrepreneur')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save job. Make sure your business profile is set up first.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container narrow">
      <h2>{isEdit ? 'Edit Job' : 'Post a New Job'}</h2>
      <p>Structured fields power both manual browsing and the AI recommendation pipeline.</p>
      <Card>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Job title</label>
            <input className="form-input" required value={form.title} onChange={handleChange('title')} placeholder="e.g. Bridal Blouse Embroidery Specialist" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" required value={form.description} onChange={handleChange('description')} placeholder="Describe the work in your own words - this feeds the AI semantic matching." />
          </div>
          <div className="form-group">
            <label className="form-label">Required skills (comma-separated)</label>
            <input className="form-input" required value={form.required_skills_text} onChange={handleChange('required_skills_text')} placeholder="e.g. embroidery, zardozi, bridal wear" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Minimum experience (years)</label>
              <input className="form-input" type="number" min="0" step="0.5" value={form.experience_required} onChange={handleChange('experience_required')} />
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
              <label className="form-label">Availability needed (comma-separated)</label>
              <input className="form-input" required value={form.availability} onChange={handleChange('availability')} placeholder="e.g. weekdays, evenings" />
            </div>
          </div>
          <Button type="submit" block disabled={loading}>{loading ? 'Saving...' : (isEdit ? 'Update job' : 'Post job')}</Button>
        </form>
      </Card>
    </div>
  )
}
