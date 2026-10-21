import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'

export default function EntrepreneurDashboard() {
  const [jobs, setJobs] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const toggleStatus = async (job) => {
    const next = job.status === 'open' ? 'closed' : 'open'
    try {
      const res = await api.put(`/jobs/${job.id}/status`, { status: next })
      setJobs((prev) => prev.map((j) => (j.id === job.id ? res.data : j)))
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not update job status.')
    }
  }

  useEffect(() => {
    Promise.all([
      api.get('/jobs/mine').then((res) => setJobs(res.data)),
      api.get('/entrepreneurs/me').then((res) => setProfile(res.data)).catch(() => setProfile(null)),
    ]).finally(() => setLoading(false))
  }, [])

  return (
    <div className="page-container">
      <div className="section-heading">
        <div>
          <h2>{profile ? profile.business_name : 'Your Dashboard'}</h2>
          <p>{profile ? `Based in ${profile.locality}` : 'Set up your business profile to get started.'}</p>
        </div>
        <div className="header-actions">
          <Link to="/entrepreneur/jobs/new"><Button>+ Post a job</Button></Link>
        </div>
      </div>

      {!profile && !loading && (
        <Card>
          <p>You haven't created a business profile yet. <Link to="/entrepreneur/profile/edit">Create one</Link> before posting jobs.</p>
        </Card>
      )}

      <h3 style={{ marginTop: '28px' }}>Your Job Postings</h3>
      {loading && <div className="spinner" />}
      {!loading && jobs.length === 0 && (
        <div className="empty-state">
          <p>You haven't posted any jobs yet.</p>
        </div>
      )}
      {jobs.map((job) => (
        <Card key={job.id} hover>
          <div className="section-heading">
            <div>
              <h3>{job.title}</h3>
              <div className="tag-list">
                {job.category && <span className="badge badge-neutral">{job.category}</span>}
                {job.required_skills_text.split(',').map((s) => (
                  <span key={s} className="badge badge-pink">{s.trim()}</span>
                ))}
              </div>
            </div>
            <span className={`badge ${job.status === 'open' ? 'badge-success' : 'badge-neutral'}`}>{job.status}</span>
          </div>
          <p>{job.description}</p>
          <p className="form-hint">
            📍 {job.locality} · 🕒 {job.availability} · {job.work_type} · min. {job.experience_required} yrs experience
          </p>
          <div className="card-actions">
            <Link to={`/entrepreneur/jobs/${job.id}/recommendations`}>
              <Button variant="primary" size="sm">✨ Recommended workers</Button>
            </Link>
            <Link to={`/entrepreneur/jobs/${job.id}/applications`}>
              <Button variant="secondary" size="sm">View applications</Button>
            </Link>
            <Link to={`/entrepreneur/jobs/${job.id}/edit`}>
              <Button variant="outline" size="sm">Edit</Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => toggleStatus(job)}>
              {job.status === 'open' ? 'Close job' : 'Reopen job'}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
