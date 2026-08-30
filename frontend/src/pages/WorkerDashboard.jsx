import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'

export default function WorkerDashboard() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/workers/me').then((res) => setProfile(res.data)).catch(() => setProfile(null)).finally(() => setLoading(false))
  }, [])

  return (
    <div className="page-container">
      <div className="section-heading">
        <div>
          <h2>{profile ? `Welcome, ${profile.full_name}` : 'Your Dashboard'}</h2>
          <p>{profile ? `${profile.structured_skills}` : 'Set up your profile to start getting matched.'}</p>
        </div>
        <Link to="/worker/profile/edit"><Button variant="secondary">Edit profile</Button></Link>
      </div>

      {!profile && !loading && (
        <Card>
          <p>You haven't created a profile yet. <Link to="/worker/profile/edit">Create one</Link> to start getting AI-matched with jobs.</p>
        </Card>
      )}

      {profile && (
        <div className="dashboard-grid">
          <Card hover>
            <h3>✨ AI-Recommended Jobs</h3>
            <p>See jobs semantically matched to your skills and description.</p>
            <Link to={`/worker/${profile.id}/recommendations`}><Button size="sm">View matches</Button></Link>
          </Card>
          <Card hover>
            <h3>🔍 Browse All Jobs</h3>
            <p>See every open job listing, unranked.</p>
            <Link to="/worker/jobs"><Button variant="secondary" size="sm">Browse jobs</Button></Link>
          </Card>
          <Card hover>
            <h3>📋 Your Applications</h3>
            <p>Track the status of jobs you've applied to.</p>
            <Link to={`/worker/${profile.id}/applications`}><Button variant="secondary" size="sm">View applications</Button></Link>
          </Card>
        </div>
      )}
    </div>
  )
}
