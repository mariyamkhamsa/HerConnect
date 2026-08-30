import React, { useEffect, useState } from 'react'
import api from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'

export default function JobBrowse() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [appliedIds, setAppliedIds] = useState(new Set())
  const [applyingId, setApplyingId] = useState(null)

  useEffect(() => {
    api.get('/jobs').then((res) => setJobs(res.data)).finally(() => setLoading(false))
  }, [])

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
      <p>A plain, unranked list - independent of AI recommendations, so you can compare the two.</p>
      {loading && <div className="spinner" />}
      {!loading && jobs.length === 0 && <div className="empty-state"><p>No open jobs right now.</p></div>}
      {jobs.map((job) => (
        <Card key={job.id} hover>
          <h3>{job.title}</h3>
          <div className="tag-list">
            {job.required_skills_text.split(',').map((s) => <span key={s} className="badge badge-pink">{s.trim()}</span>)}
          </div>
          <p>{job.description}</p>
          <p className="form-hint">
            📍 {job.locality} · 🕒 {job.availability} · {job.work_type} · min. {job.experience_required} yrs
          </p>
          <Button
            size="sm"
            disabled={appliedIds.has(job.id) || applyingId === job.id}
            onClick={() => handleApply(job.id)}
          >
            {appliedIds.has(job.id) ? '✓ Applied' : (applyingId === job.id ? 'Applying...' : 'Apply')}
          </Button>
        </Card>
      ))}
    </div>
  )
}
