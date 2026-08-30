import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'

const STATUS_BADGE = {
  pending: 'badge-warning',
  accepted: 'badge-success',
  rejected: 'badge-danger',
}

/**
 * mode="received"  -> entrepreneur reviewing applications for one of her jobs (jobId from route)
 * mode="mine"      -> worker reviewing her own submitted applications (workerId from route)
 */
export default function ApplicationsView({ mode }) {
  const params = useParams()
  const [applications, setApplications] = useState([])
  const [jobsById, setJobsById] = useState({})
  const [workersById, setWorkersById] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const queryParam = mode === 'received' ? `job_id=${params.jobId}` : `worker_id=${params.workerId}`

  useEffect(() => {
    setLoading(true)
    api.get(`/applications?${queryParam}`)
      .then(async (res) => {
        setApplications(res.data)
        if (mode === 'received') {
          const workerIds = [...new Set(res.data.map((a) => a.worker_id))]
          const workers = await Promise.all(workerIds.map((id) => api.get(`/workers/${id}`)))
          const map = {}
          workers.forEach((w) => { map[w.data.id] = w.data })
          setWorkersById(map)
        } else {
          const jobIds = [...new Set(res.data.map((a) => a.job_id))]
          const jobs = await Promise.all(jobIds.map((id) => api.get(`/jobs/${id}`)))
          const map = {}
          jobs.forEach((j) => { map[j.data.id] = j.data })
          setJobsById(map)
        }
      })
      .catch((err) => setError(err.response?.data?.detail || 'Could not load applications.'))
      .finally(() => setLoading(false))
  }, [queryParam])

  const updateStatus = async (applicationId, status) => {
    try {
      await api.put(`/applications/${applicationId}`, { status })
      setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, status } : a)))
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not update application.')
    }
  }

  return (
    <div className="page-container">
      <h2>{mode === 'received' ? 'Applications Received' : 'Your Applications'}</h2>
      {loading && <div className="spinner" />}
      {error && <div className="error-banner">{error}</div>}
      {!loading && applications.length === 0 && (
        <div className="empty-state"><p>No applications yet.</p></div>
      )}

      {applications.map((app) => {
        const worker = workersById[app.worker_id]
        const job = jobsById[app.job_id]
        return (
          <Card key={app.id}>
            <div className="section-heading">
              <div>
                <h3>{mode === 'received' ? (worker?.full_name || `Worker #${app.worker_id}`) : (job?.title || `Job #${app.job_id}`)}</h3>
                {mode === 'received' && worker && (
                  <p className="form-hint">📍 {worker.locality} · {worker.experience_years} yrs · {worker.structured_skills}</p>
                )}
                {mode === 'mine' && job && (
                  <p className="form-hint">📍 {job.locality} · {job.work_type}</p>
                )}
              </div>
              <span className={`badge ${STATUS_BADGE[app.status]}`}>{app.status}</span>
            </div>
            {mode === 'received' && worker && <p>{worker.about_description}</p>}
            {mode === 'mine' && job && <p>{job.description}</p>}
            {mode === 'received' && app.status === 'pending' && (
              <div className="card-actions">
                <Button variant="success" size="sm" onClick={() => updateStatus(app.id, 'accepted')}>Accept</Button>
                <Button variant="danger" size="sm" onClick={() => updateStatus(app.id, 'rejected')}>Reject</Button>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
