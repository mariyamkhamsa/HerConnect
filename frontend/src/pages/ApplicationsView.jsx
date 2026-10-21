import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import MatchExplanation from '../components/MatchExplanation.jsx'
import PortfolioLink from '../components/PortfolioLink.jsx'
import ConsentCheckbox from '../components/ConsentCheckbox.jsx'

const STATUS_BADGE = {
  pending: 'badge-warning',
  accepted: 'badge-success',
  rejected: 'badge-danger',
}

/**
 * mode="received"  -> entrepreneur reviewing applications for one of her jobs (jobId from route)
 * mode="mine"      -> worker reviewing her own submitted applications (workerId from route)
 *
 * For "received", each applicant also shows her portfolio (if any) and the
 * "Why this match?" breakdown, so the entrepreneur can make the final hiring
 * decision from profile + portfolio + explanation (FR8). The AI is decision support only.
 */
export default function ApplicationsView({ mode }) {
  const params = useParams()
  const navigate = useNavigate()
  const [applications, setApplications] = useState([])
  const [jobsById, setJobsById] = useState({})
  const [workersById, setWorkersById] = useState({})
  const [matchByWorker, setMatchByWorker] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [shareById, setShareById] = useState({})   // entrepreneur's contact-sharing consent per application
  const [decidingId, setDecidingId] = useState(null)

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

          // Match explanations are a bonus - never block the applications list on them.
          if (workerIds.length > 0) {
            api.get(`/recommendations/applicants/${params.jobId}`)
              .then((m) => {
                const byId = {}
                m.data.forEach((x) => { byId[x.worker_id] = x })
                setMatchByWorker(byId)
              })
              .catch(() => {})
          }
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
    if (decidingId !== null) return
    setDecidingId(applicationId)
    try {
      await api.put(`/applications/${applicationId}`, {
        status,
        share_contact: status === 'accepted' && !!shareById[applicationId],
      })
      setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, status } : a)))
      window.dispatchEvent(new Event('herconnect:notifications-changed'))
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not update application.')
    } finally {
      setDecidingId(null)
    }
  }

  return (
    <div className="page-container">
      <h2>{mode === 'received' ? 'Applications Received' : 'Your Applications'}</h2>
      {mode === 'received' && (
        <p>Review each applicant's profile, portfolio and match details before making your decision.</p>
      )}
      {loading && <div className="spinner" />}
      {error && <div className="error-banner">{error}</div>}
      {!loading && applications.length === 0 && (
        <div className="empty-state"><p>No applications yet.</p></div>
      )}

      {applications.map((app) => {
        const worker = workersById[app.worker_id]
        const job = jobsById[app.job_id]
        const match = matchByWorker[app.worker_id]
        return (
          <Card key={app.id}>
            <div className="section-heading">
              <div>
                <h3>{mode === 'received' ? (worker?.full_name || `Worker #${app.worker_id}`) : (job?.title || `Job #${app.job_id}`)}</h3>
                {mode === 'received' && worker && (
                  <p className="form-hint">
                    📍 {worker.locality} · 🕒 {worker.availability} · {worker.work_type} · {worker.experience_years} yrs · {worker.structured_skills}
                  </p>
                )}
                {mode === 'mine' && job && (
                  <p className="form-hint">📍 {job.locality} · {job.work_type}</p>
                )}
              </div>
              <span className={`badge ${STATUS_BADGE[app.status]}`}>{app.status}</span>
            </div>
            {mode === 'received' && worker && <p>{worker.about_description}</p>}
            {mode === 'mine' && job && <p>{job.description}</p>}

            {mode === 'received' && match && (
              <>
                <MatchExplanation explanation={match.explanation} finalScore={match.final_score} semanticScore={match.semantic_score} />
                {!match.eligible && (
                  <p className="form-hint" style={{ marginTop: '8px' }}>
                    Note: this applicant would not have passed the automatic eligibility filter (see the factors marked above). Applying is still her choice - review her profile and decide.
                  </p>
                )}
              </>
            )}

            {mode === 'mine' && job && job.entrepreneur_id != null && (
              <div className="card-actions">
                <Button variant="outline" size="sm" onClick={() => navigate(`/worker/businesses/${job.entrepreneur_id}`)}>
                  View Business Profile
                </Button>
                {app.status === 'accepted' && (
                  <Button variant="secondary" size="sm" onClick={() => navigate('/connections')}>Contact details</Button>
                )}
              </div>
            )}

            {mode === 'received' && app.status === 'pending' && (
              <ConsentCheckbox
                checked={shareById[app.id]}
                onChange={(v) => setShareById((prev) => ({ ...prev, [app.id]: v }))}
                disabled={decidingId !== null}
              >
                If I accept, share my contact details with this worker
              </ConsentCheckbox>
            )}

            {mode === 'received' && (
              <div className="card-actions">
                {worker?.portfolio_file_path
                  ? <PortfolioLink workerId={worker.id} />
                  : <span className="form-hint">No portfolio provided</span>}
                <Button variant="outline" size="sm" onClick={() => navigate(`/entrepreneur/workers/${app.worker_id}`)}>
                  View Worker Profile
                </Button>
                {app.status === 'pending' && (
                  <>
                    <Button variant="success" size="sm" disabled={decidingId !== null} onClick={() => updateStatus(app.id, 'accepted')}>Accept</Button>
                    <Button variant="danger" size="sm" disabled={decidingId !== null} onClick={() => updateStatus(app.id, 'rejected')}>Reject</Button>
                  </>
                )}
                {app.status === 'accepted' && (
                  <Button variant="secondary" size="sm" onClick={() => navigate('/connections')}>Contact details</Button>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
