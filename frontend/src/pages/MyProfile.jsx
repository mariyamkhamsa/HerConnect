import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import Button from '../components/Button.jsx'
import ProfileAvatar from '../components/ProfileAvatar.jsx'
import TagList from '../components/TagList.jsx'
import CertificationList from '../components/CertificationList.jsx'
import GalleryGrid from '../components/GalleryGrid.jsx'

const splitSkills = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean)

export default function MyProfile() {
  const { role, email } = useAuth()
  const isWorker = role === 'worker'
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    api.get(isWorker ? '/workers/me' : '/entrepreneurs/me')
      .then((res) => { if (!cancelled) setProfile(res.data) })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.detail || 'Could not load your profile.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isWorker])
  const editPath = isWorker ? '/worker/profile/edit' : '/entrepreneur/profile/edit'
  const name = isWorker ? profile?.full_name : profile?.business_name
  const skills = splitSkills(profile?.structured_skills)
  const card = { border: '1px solid #f0dce4', borderRadius: 20, background: '#fff', padding: 'clamp(20px, 4vw, 32px)', boxShadow: '0 8px 24px rgba(100,45,65,.06)' }
  const section = { marginBottom: 22 }
  return (
    <main className="page-container" style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 48 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div><p style={{ color: '#b56782', fontWeight: 700, margin: '0 0 6px' }}>MY ACCOUNT</p><h2 style={{ margin: 0 }}>My Profile</h2><p style={{ color: '#7d6a73', marginBottom: 0 }}>Review your saved profile details.</p></div>
        <Link to={editPath}><Button>Edit Profile</Button></Link>
      </div>
      {loading && <div className="form-hint">Loading your profile…</div>}
      {error && <div className="error-banner">{error}</div>}
      {!loading && !error && profile && <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, paddingBottom: 22, borderBottom: '1px solid #f2e6eb', marginBottom: 22 }}>
          <ProfileAvatar role={isWorker ? 'worker' : 'entrepreneur'} profileId={profile.id} hasPhoto={!!profile.profile_photo_path} photoPath={profile.profile_photo_path} email={email} size={72} />
          <div><h3 style={{ margin: '0 0 6px', color: '#49323b', fontSize: 24 }}>{name || (isWorker ? 'Your name' : 'Your business name')}</h3><div style={{ color: '#8a6f7b' }}>{isWorker ? 'Skilled woman' : 'Entrepreneur'}</div><div style={{ color: '#8a6f7b', marginTop: 4 }}>{profile.locality || 'Locality not added'}</div></div>
        </div>
        <section style={section}>
          <h3>Email</h3>
          {isWorker && !profile.show_email_publicly
            ? <p style={{ color: '#8a6f7b' }}>Your email is private. Turn on “Show my email publicly” in Edit Profile to show it on your profile.</p>
            : <><p style={{ overflowWrap: 'anywhere', marginBottom: 4 }}>{profile.email || email}</p><div className="form-hint">{isWorker ? 'Shown on your profile to businesses that can view it.' : 'Always shown on your public business profile.'}</div></>}
          <div className="form-hint" style={{ marginTop: 6 }}>Want to change your email or passwordt? <Link to="/account/settings">Account settings</Link></div>
        </section>
        {isWorker ? <>
          <section style={section}><h3>Skills</h3>{skills.length ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{skills.map((skill, i) => <span key={`${skill}-${i}`} style={{ background: '#fff0f5', border: '1px solid #f1d1dd', color: '#9f4266', borderRadius: 999, padding: '7px 12px' }}>{skill}</span>)}</div> : <p>Not added yet.</p>}</section>
          <section style={section}><h3>Professional introduction</h3><p style={{ whiteSpace: 'pre-wrap' }}>{profile.professional_intro || 'Not added yet.'}</p></section>
          <section style={section}><h3>About</h3><p style={{ whiteSpace: 'pre-wrap' }}>{profile.about_description || 'Not added yet.'}</p></section>
          <section style={section}><h3>Services offered</h3><TagList value={profile.services_offered} empty="Not added yet." /></section>
          <section style={section}><h3>Languages spoken</h3><TagList value={profile.languages} variant="lang" empty="Not added yet." /></section>
          <section style={section}><h3>Certifications and training</h3><CertificationList items={profile.certifications} empty="Not added yet." /></section>
          <section style={section}><h3>Portfolio gallery</h3><GalleryGrid role="worker" profileId={profile.id} items={profile.gallery} empty="No pictures added yet. You can add them from Edit Profile." /></section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}><div><strong>Experience</strong><p>{profile.experience_years ?? 0} years</p></div><div><strong>Work type</strong><p>{profile.work_type || 'Not specified'}</p></div><div><strong>Availability</strong><p>{profile.availability || 'Not specified'}</p></div></div>
          <section style={{ marginTop: 18 }}><h3>Portfolio / Certificate</h3><p>{profile.portfolio_file_path ? 'A portfolio or certificate is uploaded. You can view or manage it from Edit Profile.' : 'No portfolio uploaded.'}</p></section>
        </> : <><section style={section}><h3>Business introduction</h3><p style={{ whiteSpace: 'pre-wrap' }}>{profile.business_intro || 'Not added yet.'}</p></section><section style={section}><h3>About the business</h3><p style={{ whiteSpace: 'pre-wrap' }}>{profile.description || 'No description added yet.'}</p></section><section style={section}><h3>Services and products</h3><TagList value={profile.services_products} empty="Not added yet." /></section><section style={section}><h3>Collaboration needs</h3><TagList value={profile.collaboration_needs} empty="Not added yet." /></section><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 22 }}><div><strong>Years in business</strong><p>{profile.years_in_business != null ? `${profile.years_in_business} ${Number(profile.years_in_business) === 1 ? 'year' : 'years'}` : 'Not added yet.'}</p></div><div><strong>Preferred work arrangements</strong><div style={{ marginTop: 8 }}><TagList value={profile.preferred_work_arrangements} empty="Not added yet." /></div></div></div><section style={section}><h3>Portfolio gallery</h3><GalleryGrid role="entrepreneur" profileId={profile.id} items={profile.gallery} empty="No pictures added yet. You can add them from Edit Profile." /></section><section><h3>Locality</h3><p>{profile.locality || 'Not added yet.'}</p></section></>}
        <div style={{ marginTop: 26, display: 'flex', gap: 12, flexWrap: 'wrap' }}><Link to={isWorker ? '/worker' : '/entrepreneur'}><Button variant="secondary">Back to Dashboard</Button></Link></div>
      </div>}
    </main>
  )
}
