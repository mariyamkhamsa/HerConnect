import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import MatchExplanation from '../components/MatchExplanation.jsx'
import PortfolioLink from '../components/PortfolioLink.jsx'
import ProfileAvatar from '../components/ProfileAvatar.jsx'
import ConsentCheckbox from '../components/ConsentCheckbox.jsx'
import { formatApiError } from '../utils/errors.js'

/**
 * Shared recommendation results page.
 * mode="workers" -> entrepreneur viewing recommended workers for a job (job_id from route)
 * mode="jobs"    -> worker viewing recommended jobs for her profile (worker_id from route)
 */
export default function RecommendationResults({ mode }) {
  const params = useParams()
  const navigate = useNavigate()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [appliedIds, setAppliedIds] = useState(new Set())
  const [applyingId, setApplyingId] = useState(null)
  // Two-way connection workflow state
  const [invitedByWorker, setInvitedByWorker] = useState({})   // mode "workers": worker_id -> invitation status
  const [appliedWorkerIds, setAppliedWorkerIds] = useState(new Set())
  const [inviteFormFor, setInviteFormFor] = useState(null)     // worker_id whose invite panel is open
  const [inviteShare, setInviteShare] = useState(false)
  const [invitingId, setInvitingId] = useState(null)
  const [invitationByJob, setInvitationByJob] = useState({})   // mode "jobs": job_id -> invitation status
  const [shareByJob, setShareByJob] = useState({})
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')

  const id = mode === 'workers' ? params.jobId : params.workerId
  const endpoint = mode === 'workers'
    ? `/recommendations/candidates/${id}`
    : `/recommendations/jobs/${id}`

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setLoading(true)
      setError('')

      try {
        if (mode === 'jobs') {
          const [recommendationResponse, applicationsResponse] = await Promise.all([
            api.get(endpoint),
            api.get(`/applications?worker_id=${id}`),
          ])

          if (cancelled) return
          setResults(recommendationResponse.data)
          setAppliedIds(new Set(applicationsResponse.data.map((app) => app.job_id)))
          // Invitations are a bonus: never block the recommendation list on them.
          api.get('/invitations')
            .then((inv) => {
              if (cancelled) return
              const byJob = {}
              inv.data.forEach((i) => { byJob[i.job_id] = i.status })
              setInvitationByJob(byJob)
            })
            .catch(() => {})
        } else {
          const recommendationResponse = await api.get(endpoint)
          if (cancelled) return
          setResults(recommendationResponse.data)
          // Which recommended workers were already invited / already applied (non-blocking).
          api.get(`/invitations?job_id=${id}`)
            .then((inv) => {
              if (cancelled) return
              const byWorker = {}
              inv.data.forEach((i) => { byWorker[i.worker_id] = i.status })
              setInvitedByWorker(byWorker)
            })
            .catch(() => {})
          api.get(`/applications?job_id=${id}`)
            .then((apps) => { if (!cancelled) setAppliedWorkerIds(new Set(apps.data.map((a) => a.worker_id))) })
            .catch(() => {})
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err, 'Could not load recommendations.'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [endpoint, mode, id])

  const handleApply = async (jobId) => {
    setApplyingId(jobId)
    try {
      await api.post('/applications', { job_id: jobId, share_contact: !!shareByJob[jobId] })
      setAppliedIds((prev) => new Set(prev).add(jobId))
    } catch (err) {
      alert(formatApiError(err, 'Could not apply.'))
    } finally {
      setApplyingId(null)
    }
  }

  // Entrepreneur -> worker: send an invitation for THIS job (server re-checks ownership,
  // eligibility, duplicates and existing applications).
  const handleInvite = async (workerId) => {
    if (invitingId !== null) return
    setInvitingId(workerId)
    setActionError('')
    setActionMessage('')
    try {
      await api.post('/invitations', { job_id: Number(id), worker_id: workerId, share_contact: inviteShare })
      setInvitedByWorker((prev) => ({ ...prev, [workerId]: 'pending' }))
      setInviteFormFor(null)
      setInviteShare(false)
      setActionMessage('Invitation sent. The worker has been notified.')
    } catch (err) {
      setActionError(formatApiError(err, 'Could not send the invitation.'))
    } finally {
      setInvitingId(null)
    }
  }

  return (
    <div className="page-container">
      <h2>{mode === 'workers' ? '✨ Recommended Workers' : '✨ Recommended Jobs'}</h2>
      <p>
        {mode === 'workers'
          ? 'Find workers whose skills, experience, location and availability fit your job.'
          : 'Find jobs that fit your skills, experience, location and availability.'}
      </p>


      {actionMessage && <div className="success-banner">{actionMessage}</div>}
      {actionError && <div className="error-banner">{actionError}</div>}
      {loading && <div className="spinner" />}
      {error && <div className="error-banner">{error}</div>}

      {!loading && !error && results.length === 0 && (
        <div className="empty-state">
          <p>No matches yet. Try changing your job or profile details, or check back later.</p>
        </div>
      )}

      {mode === 'workers' && results.map((r) => (
        <Card key={r.worker_id} hover>
          <div className="section-heading">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ProfileAvatar role="worker" profileId={r.worker_id} hasPhoto size={52} />
              <div><h3>{r.full_name}</h3>
              <div className="tag-list">
                {r.structured_skills.split(',').map((s) => (
                  <span key={s} className="badge badge-pink">{s.trim()}</span>
                ))}
              </div></div>
            </div>
          </div>
          <p>{r.about_description}</p>
          <p className="form-hint">
            📍 {r.locality} · 🕒 {r.availability} · {r.work_type} · {r.experience_years} yrs experience
            {r.portfolio_file_path && ' · 📎 Portfolio attached'}
          </p>
          <MatchExplanation explanation={r.explanation} finalScore={r.final_score} semanticScore={r.semantic_score} />
          <div style={{ marginTop: '12px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="outline" size="sm" onClick={() => navigate(`/entrepreneur/workers/${r.worker_id}`)}>
              View Profile
            </Button>
            {r.portfolio_file_path && <PortfolioLink workerId={r.worker_id} />}
            {appliedWorkerIds.has(r.worker_id) ? (
              <Button variant="secondary" size="sm" onClick={() => navigate(`/entrepreneur/jobs/${id}/applications`)}>
                Applied - review application
              </Button>
            ) : invitedByWorker[r.worker_id] ? (
              <span className={`badge ${invitedByWorker[r.worker_id] === 'accepted' ? 'badge-success' : invitedByWorker[r.worker_id] === 'declined' ? 'badge-danger' : 'badge-warning'}`}>
                Invitation {invitedByWorker[r.worker_id]}
              </span>
            ) : (
              <Button size="sm" onClick={() => { setInviteFormFor(r.worker_id); setInviteShare(false); setActionError('') }}>
                Invite to apply
              </Button>
            )}
          </div>
          {inviteFormFor === r.worker_id && (
            <div className="contact-prompt">
              <p className="form-hint">She will get an in-website notification and can accept or decline.</p>
              <ConsentCheckbox checked={inviteShare} onChange={setInviteShare} disabled={invitingId !== null}>
                If she accepts, share my contact details with her
              </ConsentCheckbox>
              <div className="card-actions">
                <Button size="sm" disabled={invitingId !== null} onClick={() => handleInvite(r.worker_id)}>
                  {invitingId === r.worker_id ? 'Sending...' : 'Send invitation'}
                </Button>
                <Button variant="outline" size="sm" disabled={invitingId !== null} onClick={() => setInviteFormFor(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </Card>
      ))}

      {mode === 'jobs' && results.map((r) => (
        <Card key={r.job_id} hover>
          <div className="section-heading">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {r.entrepreneur_id != null && <ProfileAvatar role="entrepreneur" profileId={r.entrepreneur_id} hasPhoto size={52} />}
              <div><h3>{r.title}</h3>
              <div className="tag-list">
                {r.required_skills_text.split(',').map((s) => (
                  <span key={s} className="badge badge-pink">{s.trim()}</span>
                ))}
              </div></div>
            </div>
          </div>
          <p>{r.description}</p>
          <p className="form-hint">
            📍 {r.locality} · 🕒 {r.availability} · {r.work_type} · min. {r.experience_required} yrs experience
          </p>
          <MatchExplanation explanation={r.explanation} finalScore={r.final_score} semanticScore={r.semantic_score} />
          <div style={{ marginTop: '12px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {appliedIds.has(r.job_id) ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/worker/${id}/applications`)}
              >
                View Application
              </Button>
            ) : invitationByJob[r.job_id] === 'pending' ? (
              <Button size="sm" onClick={() => navigate('/worker/invitations')}>
                You were invited - respond
              </Button>
            ) : invitationByJob[r.job_id] === 'accepted' ? (
              <Button variant="secondary" size="sm" onClick={() => navigate('/connections')}>
                View connection details
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  disabled={applyingId === r.job_id}
                  onClick={() => handleApply(r.job_id)}
                >
                  {applyingId === r.job_id ? 'Applying...' : 'Apply to this job'}
                </Button>
                <ConsentCheckbox
                  checked={shareByJob[r.job_id]}
                  onChange={(v) => setShareByJob((prev) => ({ ...prev, [r.job_id]: v }))}
                  disabled={applyingId === r.job_id}
                >
                  Share my contact details if this application is accepted
                </ConsentCheckbox>
              </>
            )}
            {r.entrepreneur_id != null && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/worker/businesses/${r.entrepreneur_id}`)}>
                View Business Profile
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
