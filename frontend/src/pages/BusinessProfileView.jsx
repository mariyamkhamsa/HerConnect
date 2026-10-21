import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api.js'
import Button from '../components/Button.jsx'
import ProfileAvatar from '../components/ProfileAvatar.jsx'
import TagList from '../components/TagList.jsx'
import GalleryGrid from '../components/GalleryGrid.jsx'
import { formatApiError } from '../utils/errors.js'

const styles = {
  page: { maxWidth: 980, margin: '0 auto', padding: '28px 20px 48px', color: '#422d39' },
  topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  eyebrow: { color: '#c04472', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em' },
  hero: { position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 20, padding: '30px', border: '1px solid #f4cbd9', borderRadius: 20, background: 'linear-gradient(120deg, #fff9fb 0%, #fff 55%, #fcecf2 100%)', boxShadow: '0 10px 28px rgba(125, 55, 83, 0.06)', marginBottom: 14 },
  avatar: { width: 82, height: 82, flex: '0 0 82px', borderRadius: 22, display: 'grid', placeItems: 'center', background: 'linear-gradient(145deg, #e9a0b9, #c85f8b)', color: '#fff', fontSize: 30, fontWeight: 700, boxShadow: '0 8px 18px rgba(188, 80, 121, 0.18)' },
  heroTitle: { margin: '6px 0 8px', fontSize: 'clamp(26px, 4vw, 34px)', lineHeight: 1.15, letterSpacing: '-0.03em', overflowWrap: 'anywhere' },
  location: { margin: 0, color: '#826d79', fontSize: 14 },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(260px, 1fr)', gap: 14, marginTop: 14 },
  card: { background: '#fff', border: '1px solid #f0dce4', borderRadius: 17, padding: 22, boxShadow: '0 5px 18px rgba(74, 42, 57, 0.035)', minWidth: 0 },
  aboutCard: { minHeight: 220, display: 'flex', flexDirection: 'column' },
  sectionTitle: { fontSize: 16, fontWeight: 700, margin: '0 0 14px', color: '#493540' },
  body: { color: '#786773', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0 },
  detailRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f4e5eb' },
  iconBox: { width: 38, height: 38, flex: '0 0 38px', display: 'grid', placeItems: 'center', borderRadius: 12, color: '#bd4d79', background: '#fff0f5', fontSize: 17 },
  label: { fontSize: 11, color: '#9a8792', marginBottom: 3 },
  value: { fontSize: 13, fontWeight: 600, color: '#57434e', overflowWrap: 'anywhere' },
  note: { marginTop: 16, fontSize: 12, color: '#9a8792', lineHeight: 1.6 },
  state: { marginTop: 20, padding: 18, borderRadius: 14, border: '1px solid #f0dce4', background: '#fff', color: '#786773' },
}

export default function BusinessProfileView() {
  const { entrepreneurId } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setProfile(null)
    api.get(`/entrepreneurs/${entrepreneurId}`)
      .then((res) => { if (!cancelled) setProfile(res.data) })
      .catch((err) => { if (!cancelled) setError(formatApiError(err, 'Could not load this business profile.')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [entrepreneurId])

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/worker'))
  const initials = (profile?.business_name || 'B').trim().charAt(0).toUpperCase()

  return (
    <main style={styles.page}>
      <div style={styles.topbar}>
        <Button variant="secondary" size="sm" onClick={goBack}>← Back</Button>
        <span style={styles.eyebrow}>BUSINESS PROFILE</span>
      </div>

      {loading && <div className="spinner" aria-label="Loading business profile" />}
      {!loading && error && <div className="error-banner" role="alert">{error}</div>}
      {!loading && !error && !profile && (
        <div style={styles.state}>
          <h2 style={{ margin: '0 0 6px', color: '#493540', fontSize: 18 }}>Business profile unavailable</h2>
          <p style={styles.body}>This business profile could not be found or is no longer available.</p>
          <div style={{ marginTop: 14 }}><Button variant="secondary" size="sm" onClick={goBack}>← Back</Button></div>
        </div>
      )}

      {profile && (
        <>
          <section style={styles.hero}>
            <ProfileAvatar role="entrepreneur" profileId={profile.id} hasPhoto={!!profile.profile_photo_path} photoPath={profile.profile_photo_path} size={82} style={{ borderRadius: 22, flex: '0 0 82px', position: 'relative', zIndex: 1 }} />
            <div style={{ minWidth: 0, flex: 1, position: 'relative', zIndex: 1 }}>
              <div style={styles.eyebrow}>LOCAL BUSINESS</div>
              <h1 style={styles.heroTitle}>{profile.business_name || 'Business profile'}</h1>
              <p style={styles.location}>📍 {profile.locality || 'Locality not provided'}</p>
            </div>
            <div aria-hidden="true" style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: 'rgba(239, 190, 207, 0.22)', right: -38, top: -58 }} />
          </section>

          <div className="business-profile-grid" style={styles.grid}>
            <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              {profile.business_intro && (
                <section style={styles.card}>
                  <h2 style={styles.sectionTitle}>Business introduction</h2>
                  <p style={styles.body}>{profile.business_intro}</p>
                </section>
              )}
              <section style={{ ...styles.card, ...styles.aboutCard }}>
                <h2 style={styles.sectionTitle}>About the business</h2>
                {profile.description
                  ? <p style={styles.body}>{profile.description}</p>
                  : <p style={styles.body}>This business has not added a description yet.</p>}
                <p style={{ ...styles.note, marginTop: 'auto', paddingTop: 22, marginBottom: 0 }}>Business information is supplied by the profile owner. Review opportunity details before making decisions.</p>
              </section>
              {profile.services_products && (
                <section style={styles.card}>
                  <h2 style={styles.sectionTitle}>Services and products</h2>
                  <TagList value={profile.services_products} />
                </section>
              )}
              {profile.collaboration_needs && (
                <section style={styles.card}>
                  <h2 style={styles.sectionTitle}>Looking to collaborate with</h2>
                  <TagList value={profile.collaboration_needs} />
                  <p style={{ ...styles.note, marginBottom: 0 }}>Skills and workers this business would like to work with.</p>
                </section>
              )}
              <section style={styles.card}>
                <h2 style={styles.sectionTitle}>Portfolio gallery</h2>
                <GalleryGrid role="entrepreneur" profileId={profile.id} items={profile.gallery} empty="This business hasn’t added gallery pictures yet." />
              </section>
            </div>

            <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              <section style={styles.card}>
                <h2 style={styles.sectionTitle}>Business details</h2>
                <div style={{ ...styles.detailRow, paddingTop: 2 }}>
                  <span style={styles.iconBox} aria-hidden="true">⌖</span>
                  <div><div style={styles.label}>Locality</div><div style={styles.value}>{profile.locality || 'Not provided'}</div></div>
                </div>
                {profile.email && (
                  <div style={styles.detailRow}>
                    <span style={styles.iconBox} aria-hidden="true">✉</span>
                    <div><div style={styles.label}>Email</div><div style={styles.value}><a href={`mailto:${profile.email}`} style={{ color: 'inherit' }}>{profile.email}</a></div></div>
                  </div>
                )}
                {profile.years_in_business != null && (
                  <div style={styles.detailRow}>
                    <span style={styles.iconBox} aria-hidden="true">✦</span>
                    <div><div style={styles.label}>Years in business</div><div style={styles.value}>{profile.years_in_business} {Number(profile.years_in_business) === 1 ? 'year' : 'years'}</div></div>
                  </div>
                )}
                {profile.preferred_work_arrangements && (
                  <div style={{ ...styles.detailRow, alignItems: 'flex-start' }}>
                    <span style={styles.iconBox} aria-hidden="true">◷</span>
                    <div style={{ minWidth: 0 }}><div style={styles.label}>Preferred work arrangements</div><div style={{ marginTop: 6 }}><TagList value={profile.preferred_work_arrangements} /></div></div>
                  </div>
                )}
                <div style={{ ...styles.detailRow, borderBottom: 'none', paddingBottom: 2 }}>
                  <span style={styles.iconBox} aria-hidden="true">▦</span>
                  <div><div style={styles.label}>Profile type</div><div style={styles.value}>Entrepreneur / business</div></div>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
      <style>{`@media (max-width: 680px) { .business-profile-grid { grid-template-columns: 1fr !important; } }`}</style>
    </main>
  )
}
