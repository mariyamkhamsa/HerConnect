import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import MatchExplanation from '../components/MatchExplanation.jsx'

/**
 * Shared recommendation results page.
 * mode="workers" -> entrepreneur viewing AI-recommended workers for a job (job_id from route)
 * mode="jobs"    -> worker viewing AI-recommended jobs for her profile (worker_id from route)
 */
export default function RecommendationResults({ mode }) {
  const params = useParams()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [appliedIds, setAppliedIds] = useState(new Set())
  const [applyingId, setApplyingId] = useState(null)

  const id = mode === 'workers' ? params.jobId : params.workerId
  const endpoint = mode === 'workers'
    ? `/recommendations/candidates/${id}`
    : `/recommendations/jobs/${id}`

  useEffect(() => {
    setLoading(true)
    setError('')
    api.get(endpoint)
      .then((res) => setResults(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Could not load recommendations.'))
      .finally(() => setLoading(false))
  }, [endpoint])

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
      <h2>{mode === 'workers' ? '✨ AI-Recommended Workers' : '✨ AI-Recommended Jobs For You'}</h2>
      <p>
        {mode === 'workers'
          ? 'Ranked using semantic skill matching (SBERT + Cross-Encoder) combined with location, availability and experience fit. This is decision support, not an automatic hiring outcome.'
          : 'Ranked using semantic matching between your profile and open job listings, combined with location, availability and experience fit.'}
      </p>

      {loading && <div className="spinner" />}
      {error && <div className="error-banner">{error}</div>}

      {!loading && !error && results.length === 0 && (
        <div className="empty-state">
          <p>No structurally-eligible matches were found yet. Try adjusting locality, availability, or work type on the profile/job, or check back once more profiles/jobs are added.</p>
        </div>
      )}

      {mode === 'workers' && results.map((r) => (
        <Card key={r.worker_id} hover>
          <div className="section-heading">
            <div>
              <h3>{r.full_name}</h3>
              <div className="tag-list">
                {r.structured_skills.split(',').map((s) => (
                  <span key={s} className="badge badge-pink">{s.trim()}</span>
                ))}
              </div>
            </div>
          </div>
          <p>{r.about_description}</p>
          <p className="form-hint">
            📍 {r.locality} · 🕒 {r.availability} · {r.work_type} · {r.experience_years} yrs experience
            {r.portfolio_file_path && ' · 📎 Portfolio attached'}
          </p>
          <MatchExplanation explanation={r.explanation} finalScore={r.final_score} semanticScore={r.semantic_score} />
        </Card>
      ))}

      {mode === 'jobs' && results.map((r) => (
        <Card key={r.job_id} hover>
          <div className="section-heading">
            <div>
              <h3>{r.title}</h3>
              <div className="tag-list">
                {r.required_skills_text.split(',').map((s) => (
                  <span key={s} className="badge badge-pink">{s.trim()}</span>
                ))}
              </div>
            </div>
          </div>
          <p>{r.description}</p>
          <p className="form-hint">
            📍 {r.locality} · 🕒 {r.availability} · {r.work_type} · min. {r.experience_required} yrs experience
          </p>
          <MatchExplanation explanation={r.explanation} finalScore={r.final_score} semanticScore={r.semantic_score} />
          <div style={{ marginTop: '12px' }}>
            <Button
              size="sm"
              disabled={appliedIds.has(r.job_id) || applyingId === r.job_id}
              onClick={() => handleApply(r.job_id)}
            >
              {appliedIds.has(r.job_id) ? '✓ Applied' : (applyingId === r.job_id ? 'Applying...' : 'Apply to this job')}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
