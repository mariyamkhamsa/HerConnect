import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api.js'
import Button from '../components/Button.jsx'
import PortfolioLink from '../components/PortfolioLink.jsx'
import ProfileAvatar from '../components/ProfileAvatar.jsx'
import TagList from '../components/TagList.jsx'
import CertificationList from '../components/CertificationList.jsx'
import GalleryGrid from '../components/GalleryGrid.jsx'
import { formatApiError } from '../utils/errors.js'

/** Entrepreneur-facing, read-only worker portfolio. API access/privacy rules remain server-enforced. */
export default function WorkerProfileView() {
  const { workerId } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setProfile(null)
    api.get(`/workers/${workerId}`)
      .then((res) => { if (!cancelled) setProfile(res.data) })
      .catch((err) => { if (!cancelled) setError(formatApiError(err, 'Could not load this profile.')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [workerId])

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/entrepreneur'))
  const skills = (profile?.structured_skills || '').split(',').map((s) => s.trim()).filter(Boolean)
  const initials = (profile?.full_name || 'Worker').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')

  return (
    <div className="page-container hc-worker-profile-page">
      <style>{`
        .hc-worker-profile-page{max-width:980px;margin:0 auto;padding-bottom:48px;color:#332b30}
        .hc-profile-back{margin:8px 0 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
        .hc-profile-eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:750;color:#b24c72}
        .hc-profile-hero{position:relative;overflow:hidden;border:1px solid #f1d5df;border-radius:22px;background:linear-gradient(125deg,#fff7fa 0%,#fff 60%,#fbedf2 100%);padding:clamp(20px,4vw,36px);box-shadow:0 10px 32px rgba(126,52,79,.07)}
        .hc-profile-hero:after{content:'';position:absolute;width:210px;height:210px;border-radius:50%;right:-75px;top:-95px;background:rgba(232,164,187,.13);pointer-events:none}
        .hc-profile-hero-main{display:flex;align-items:center;gap:20px;position:relative;z-index:1}
        .hc-profile-avatar{width:94px;height:94px;flex:0 0 94px;border-radius:27px;display:grid;place-items:center;background:linear-gradient(145deg,#e9a9bf,#c85f86);color:white;font-size:30px;font-weight:800;box-shadow:0 8px 20px rgba(180,76,114,.2)}
        .hc-profile-name{font-size:clamp(26px,4vw,36px);line-height:1.15;margin:7px 0 9px;color:#34242d;letter-spacing:-.035em}
        .hc-profile-location{color:#77666f;display:flex;align-items:center;gap:7px;font-size:14px}
        .hc-profile-skills{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}
        .hc-profile-skill{display:inline-flex;align-items:center;border:1px solid #f1ccda;background:#fff;color:#9e3e64;border-radius:999px;padding:7px 12px;font-size:13px;font-weight:650}
        .hc-profile-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:16px 0}
        .hc-profile-stat{background:#fff;border:1px solid #f0e2e7;border-radius:16px;padding:17px 18px;min-width:0}
        .hc-profile-stat-label{font-size:12px;color:#8b7881;margin-bottom:8px;display:flex;align-items:center;gap:7px}
        .hc-profile-stat-value{font-size:16px;font-weight:750;color:#3b2b33;overflow-wrap:anywhere}
        .hc-profile-content{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(230px,1fr);gap:16px;align-items:start}
        .hc-profile-panel{background:#fff;border:1px solid #eee1e6;border-radius:18px;padding:22px;box-shadow:0 5px 18px rgba(60,30,43,.035)}
        .hc-profile-panel+.hc-profile-panel{margin-top:16px}
        .hc-profile-panel h3{font-size:17px;margin:0 0 13px;color:#392832;letter-spacing:-.015em}
        .hc-profile-panel p{margin:0;color:#74636c;line-height:1.75;white-space:pre-wrap;overflow-wrap:anywhere}
        .hc-profile-info-row{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #f3e9ed}
        .hc-profile-info-row:last-child{border-bottom:0;padding-bottom:0}
        .hc-profile-info-icon{width:35px;height:35px;flex:0 0 35px;border-radius:11px;display:grid;place-items:center;background:#fff0f5;color:#ae4d72;font-size:17px}
        .hc-profile-info-label{font-size:12px;color:#907c86;margin-bottom:4px}
        .hc-profile-info-value{font-size:14px;font-weight:650;color:#493740;line-height:1.5;overflow-wrap:anywhere}
        .hc-profile-portfolio{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border:1px solid #f1dce4;border-radius:14px;background:#fff9fb;padding:14px}
        .hc-profile-portfolio .hc-profile-portfolio-copy{flex:1 1 150px}
        .hc-profile-portfolio .hc-profile-portfolio-action{flex:0 0 auto;margin-top:0}
        .hc-profile-portfolio .hc-profile-portfolio-hint{flex-basis:100%}
        .hc-profile-portfolio-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:#f9e2eb;color:#a6446b;font-size:20px;flex:0 0 42px}
        .hc-profile-portfolio-copy{flex:1;min-width:0}
        .hc-profile-portfolio-copy strong{display:block;font-size:14px;color:#45313b;margin-bottom:4px}
        .hc-profile-portfolio-copy span{font-size:12px;color:#8b7781;line-height:1.4}
        .hc-profile-portfolio-action{margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
        .hc-profile-portfolio-hint{font-size:12px;color:#8b7781;line-height:1.5}
        .hc-profile-note{font-size:12px!important;color:#96848d!important;margin-top:16px!important;line-height:1.6!important}
        .hc-profile-state{max-width:620px;margin:36px auto;padding:28px;border:1px solid #f0dfe6;background:#fff;border-radius:18px;text-align:center;color:#76636d}
        .hc-profile-state h2{font-size:20px;color:#3e2c36;margin:0 0 8px}
        .hc-profile-state p{margin:0 0 16px;line-height:1.6}
        @media(max-width:680px){.hc-profile-hero-main{align-items:flex-start;gap:14px}.hc-profile-avatar{width:70px;height:70px;flex-basis:70px;border-radius:21px;font-size:24px}.hc-profile-stats{grid-template-columns:1fr}.hc-profile-stat{padding:14px 16px}.hc-profile-content{grid-template-columns:1fr}.hc-profile-panel{padding:18px}.hc-profile-hero{border-radius:18px}}
        @media(prefers-reduced-motion:no-preference){.hc-profile-hero,.hc-profile-panel,.hc-profile-stat{animation:hc-profile-in .35s ease both}@keyframes hc-profile-in{from{opacity:.75;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}}
      `}</style>

      <div className="hc-profile-back">
        <Button variant="secondary" size="sm" onClick={goBack}>← Back</Button>
        <span className="hc-profile-eyebrow">Worker profile</span>
      </div>

      {loading && <div className="hc-profile-state" role="status"><div className="spinner" /><p>Loading worker profile…</p></div>}
      {!loading && error && <div className="hc-profile-state" role="alert"><h2>We couldn’t load this profile</h2><p>{error}</p><Button onClick={() => { setLoading(true); setError(''); api.get(`/workers/${workerId}`).then((res) => setProfile(res.data)).catch((err) => setError(formatApiError(err, 'Could not load this profile.'))).finally(() => setLoading(false)) }}>Try again</Button></div>}
      {!loading && !error && !profile && <div className="hc-profile-state"><h2>Profile unavailable</h2><p>This worker profile may no longer be available.</p><Button variant="secondary" onClick={goBack}>Back</Button></div>}

      {!loading && !error && profile && (
        <>
          <section className="hc-profile-hero">
            <div className="hc-profile-hero-main">
              <ProfileAvatar role="worker" profileId={profile.id} hasPhoto={!!profile.profile_photo_path} photoPath={profile.profile_photo_path} size={82} style={{ borderRadius: 18, flex: '0 0 82px' }} />
              <div style={{ minWidth: 0 }}>
                <div className="hc-profile-eyebrow">Skilled woman</div>
                <h1 className="hc-profile-name">{profile.full_name || 'Worker profile'}</h1>
                <div className="hc-profile-location"><span aria-hidden="true">📍</span>{profile.locality || 'Locality not provided'}</div>
              </div>
            </div>
          </section>

          <section className="hc-profile-stats" aria-label="Worker summary">
            <div className="hc-profile-stat"><div className="hc-profile-stat-label"><span aria-hidden="true">✦</span> Experience</div><div className="hc-profile-stat-value">{profile.experience_years != null ? `${profile.experience_years} ${Number(profile.experience_years) === 1 ? 'year' : 'years'}` : 'Not specified'}</div></div>
            <div className="hc-profile-stat"><div className="hc-profile-stat-label"><span aria-hidden="true">◷</span> Work preference</div><div className="hc-profile-stat-value">{profile.work_type || 'Not specified'}</div></div>
            <div className="hc-profile-stat"><div className="hc-profile-stat-label"><span aria-hidden="true">▦</span> Availability</div><div className="hc-profile-stat-value">{profile.availability || 'Not specified'}</div></div>
          </section>

          <div className="hc-profile-content">
            <div>
              {profile.professional_intro && (
                <section className="hc-profile-panel">
                  <h3>Professional introduction</h3>
                  <p>{profile.professional_intro}</p>
                </section>
              )}
              <section className="hc-profile-panel">
                <h3>About</h3>
                <p>{profile.about_description?.trim() || 'This worker has not added an introduction yet.'}</p>
              </section>
              <section className="hc-profile-panel">
                <h3>Skills & services</h3>
                {skills.length > 0 ? <div className="hc-profile-skills" style={{ marginTop: 0 }}>{skills.map((skill, index) => <span key={`${skill}-${index}`} className="hc-profile-skill">{skill}</span>)}</div> : <p>No skills have been added yet.</p>}
                {profile.services_offered && <>
                  <div className="hc-profile-info-label" style={{ margin: '16px 0 8px' }}>Services offered</div>
                  <TagList value={profile.services_offered} />
                </>}
              </section>
              <section className="hc-profile-panel">
                <h3>Certifications & training</h3>
                <CertificationList items={profile.certifications} empty="No certifications or training have been added yet." />
              </section>
              <section className="hc-profile-panel">
                <h3>Portfolio gallery</h3>
                <GalleryGrid role="worker" profileId={profile.id} items={profile.gallery} empty="This worker hasn’t added portfolio pictures yet." />
              </section>
            </div>

            <aside>
              <section className="hc-profile-panel">
                <h3>Work details</h3>
                <div className="hc-profile-info-row"><div className="hc-profile-info-icon" aria-hidden="true">⌖</div><div><div className="hc-profile-info-label">Locality</div><div className="hc-profile-info-value">{profile.locality || 'Not specified'}</div></div></div>
                <div className="hc-profile-info-row"><div className="hc-profile-info-icon" aria-hidden="true">◷</div><div><div className="hc-profile-info-label">Availability</div><div className="hc-profile-info-value">{profile.availability || 'Not specified'}</div></div></div>
                <div className="hc-profile-info-row"><div className="hc-profile-info-icon" aria-hidden="true">▤</div><div><div className="hc-profile-info-label">Preferred work type</div><div className="hc-profile-info-value">{profile.work_type || 'Not specified'}</div></div></div>
                <div className="hc-profile-info-row"><div className="hc-profile-info-icon" aria-hidden="true">✦</div><div><div className="hc-profile-info-label">Experience</div><div className="hc-profile-info-value">{profile.experience_years != null ? `${profile.experience_years} ${Number(profile.experience_years) === 1 ? 'year' : 'years'}` : 'Not specified'}</div></div></div>
                {profile.email && <div className="hc-profile-info-row"><div className="hc-profile-info-icon" aria-hidden="true">✉</div><div><div className="hc-profile-info-label">Email</div><div className="hc-profile-info-value"><a href={`mailto:${profile.email}`} style={{ color: 'inherit' }}>{profile.email}</a></div></div></div>}
              </section>
              {profile.languages && (
                <section className="hc-profile-panel">
                  <h3>Languages spoken</h3>
                  <TagList value={profile.languages} variant="lang" />
                </section>
              )}
              <section className="hc-profile-panel">
                <h3>Portfolio</h3>
                {profile.portfolio_file_path ? <>
                  <div className="hc-profile-portfolio">
                    <div className="hc-profile-portfolio-icon" aria-hidden="true">▧</div>
                    <div className="hc-profile-portfolio-copy">
                      <strong>Portfolio attachment</strong>
                      <span>Work sample or certificate shared by this worker.</span>
                    </div>
                    <div className="hc-profile-portfolio-action">
                      <PortfolioLink workerId={profile.id} />
                    </div>
                    <span className="hc-profile-portfolio-hint">Opens the worker’s uploaded file securely.</span>
                  </div>
                </> : <div className="hc-profile-portfolio"><div className="hc-profile-portfolio-icon" aria-hidden="true">▧</div><div className="hc-profile-portfolio-copy"><strong>No portfolio uploaded</strong><span>This worker hasn’t shared a work sample or certificate yet.</span></div></div>}
                <p className="hc-profile-note">This profile supports your hiring decision and does not independently certify the worker’s competence.</p>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  )
}
