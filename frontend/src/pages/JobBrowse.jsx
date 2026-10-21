import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'

export default function JobBrowse() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [categories, setCategories] = useState([])
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [appliedIds, setAppliedIds] = useState(new Set())
  const [applyingId, setApplyingId] = useState(null)

  // Plain list of categories + the jobs this worker has already applied to
  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data)).catch(() => {})
    api.get('/applications')
      .then((res) => setAppliedIds(new Set(res.data.map((a) => a.job_id))))
      .catch(() => {})
  }, [])

  // Manual browsing: ordinary SQL filters only - no AI involved
  useEffect(() => {
    setLoading(true)
    const params = {}
    if (category) params.category = category
    if (search.trim()) params.q = search.trim()
    api.get('/jobs', { params }).then((res) => setJobs(res.data)).finally(() => setLoading(false))
  }, [category, search])

  const handleApply = async (jobId) => {
    setApplyingId(jobId)
    try {
      await api.post('/applications', { job_id: jobId })
      setAppliedIds((prev) => new Set(prev).add(jobId))
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not apply.')
    } finally {
      setApplyingId(null)
    }
  }

  return (
    <div className="page-container">
      <h2>Browse All Open Jobs</h2>
      <p>Browse open jobs and find work that suits you.</p>

      <div className="form-row" style={{ marginBottom: '12px' }}>
        <div className="form-group">
          <input
            className="form-input" value={search} placeholder="Search title, skills or description"
            onChange={(e) => setSearch(e.target.value)} maxLength={100}
          />
        </div>
        <div className="form-group">
          <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="spinner" />}
      {!loading && jobs.length === 0 && <div className="empty-state"><p>No open jobs right now.</p></div>}
      {jobs.map((job) => (
        <Card key={job.id} hover>
          <h3>{job.title}</h3>
          <div className="tag-list">
            {job.category && <span className="badge badge-neutral">{job.category}</span>}
            {job.required_skills_text.split(',').map((s) => <span key={s} className="badge badge-pink">{s.trim()}</span>)}
          </div>
          <p>{job.description}</p>
          <p className="form-hint">
            📍 {job.locality} · 🕒 {job.availability} · {job.work_type} · min. {job.experience_required} yrs
          </p>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              size="sm"
              disabled={appliedIds.has(job.id) || applyingId === job.id}
              onClick={() => handleApply(job.id)}
            >
              {appliedIds.has(job.id) ? '✓ Applied' : (applyingId === job.id ? 'Applying...' : 'Apply')}
            </Button>
            {job.entrepreneur_id != null && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/worker/businesses/${job.entrepreneur_id}`)}>
                View Business Profile
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
