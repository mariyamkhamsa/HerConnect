import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { homePathFor, roleLabel } from '../utils/roles.js'
import ProfileAvatar from './ProfileAvatar.jsx'

export default function Navbar() {
  const { isAuthenticated, role, email, login, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path) => location.pathname === path
  const dashboardPath = homePathFor(role)

  const [activeSection, setActiveSection] = useState('home')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [profileEmail, setProfileEmail] = useState(() => localStorage.getItem('herconnect_email') || '')
  const [profileSummary, setProfileSummary] = useState(null)
  const profileMenuRef = useRef(null)


  useEffect(() => {
    if (!isAuthenticated || !role) return
    if (email) {
      setProfileEmail(email)
      return
    }
    api.get(role === 'worker' ? '/workers/me' : '/entrepreneurs/me')
      .then((res) => {
        const foundEmail = res.data?.email || res.data?.user?.email || ''
        if (foundEmail) {
          setProfileEmail(foundEmail)
          localStorage.setItem('herconnect_email', foundEmail)
        }
      })
      .catch(() => {})
  }, [isAuthenticated, role, email])

  useEffect(() => {
    if (!isAuthenticated || !role || (role !== 'worker' && role !== 'entrepreneur')) { setProfileSummary(null); return }
    let active = true
    api.get(role === 'worker' ? '/workers/me' : '/entrepreneurs/me')
      .then((res) => { if (active) setProfileSummary({ id: res.data.id, hasPhoto: !!res.data.profile_photo_path, photoPath: res.data.profile_photo_path || '' }) })
      .catch(() => { if (active) setProfileSummary(null) })
    return () => { active = false }
  }, [isAuthenticated, role, location.pathname])

  // In-website notification badge: refresh on login, on every page change, when a page
  // reports a change, and every 30 seconds. Failures are ignored - the bell is a convenience.
  const [unread, setUnread] = useState(0)
  const hasInbox = isAuthenticated && (role === 'entrepreneur' || role === 'worker')

  useEffect(() => {
    if (!hasInbox) {
      setUnread(0)
      return undefined
    }
    let cancelled = false
    const refresh = () => {
      api.get('/notifications/unread-count')
        .then((res) => { if (!cancelled) setUnread(res.data.unread) })
        .catch(() => {})
    }
    refresh()
    const timer = setInterval(refresh, 30000)
    window.addEventListener('herconnect:notifications-changed', refresh)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('herconnect:notifications-changed', refresh)
    }
  }, [hasInbox, location.pathname])

  // Scroll to the section named in the URL hash (or to the top for plain "/") whenever we land on
  // the homepage. location.key changes on every navigation, so clicking the same link twice works.
  useEffect(() => {
    if (isAuthenticated || location.pathname !== '/') return undefined
    const frame = requestAnimationFrame(() => {
      const id = decodeURIComponent(location.hash.replace('#', ''))
      const target = id ? document.getElementById(id) : null
      if (!target) {
        if (!id) window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      const navbar = document.querySelector('.reference-navbar')
      const offset = navbar ? navbar.offsetHeight : 0
      const top = target.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [isAuthenticated, location.pathname, location.hash, location.key])

  useEffect(() => {
    if (isAuthenticated || location.pathname !== '/') return

    const sections = ['home', 'about', 'collaborate', 'grow']
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150
      let currentSection = 'home'
      sections.forEach((sectionId) => {
        const section = document.getElementById(sectionId)
        if (section && section.offsetTop <= scrollPosition) currentSection = sectionId
      })
      setActiveSection(currentSection)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isAuthenticated, location.pathname])

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false)
      }
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') setProfileMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const handleLogout = () => {
    setProfileMenuOpen(false)
    logout()
    navigate('/login')
  }

  if (!isAuthenticated) {
    return (
      <nav className="navbar reference-navbar">
        <Link to="/" className="navbar-brand reference-brand">
          <svg className="brand-logo" viewBox="0 0 46 52" aria-hidden="true">
            <path d="M22 4c-6 0-10 4-10 10 0 3 1 5 0 7-1 2-3 3-3 5 0 2 2 3 3 3-1 3 0 5 3 6l1 5h10" />
            <path d="M22 4c5 0 9 4 9 10 0 4-2 7-3 10" />
            <path d="M18 35c-5 2-9 6-10 11" />
            <path d="M18 35c-4-1-7-4-8-8 4 0 7 2 8 5" />
            <path d="M18 40c-4 0-7-2-9-5" className="logo-accent" />
            <path d="M20 31c4-2 8-1 10 2-3 2-7 3-10-2Z" className="logo-accent" />
          </svg>
          <span>HerConnect</span>
        </Link>

        <div className="reference-nav-links">
          {[
            { id: 'home', label: 'Home', to: { pathname: '/', hash: '' } },
            { id: 'about', label: 'About', to: { pathname: '/', hash: '#about' } },
            { id: 'collaborate', label: 'For Women', to: { pathname: '/', hash: '#collaborate' } },
            { id: 'grow', label: 'Support', to: { pathname: '/', hash: '#grow' } },
          ].map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className={`reference-nav-link ${location.pathname === '/' && activeSection === item.id ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="reference-nav-actions">
          <Link to="/login" className="reference-login-btn">Login</Link>
          <Link to="/register" className="reference-start-btn">Get Started</Link>
        </div>
      </nav>
    )
  }

  // These links point to the existing role-specific profile forms.
  const profilePath = role === 'worker' ? '/worker/my-profile' : '/entrepreneur/my-profile'

  return (
    <nav className="navbar">
      <Link to={dashboardPath} className="navbar-brand">
        <span className="brand-mark">🌸</span>
        HerConnect
      </Link>

      <div className="navbar-links">
        <Link to={dashboardPath} className={`navbar-link ${isActive(dashboardPath) ? 'active' : ''}`}>
          Dashboard
        </Link>

        {hasInbox && (
          <>
            <Link
              to={role === 'worker' ? '/worker/invitations' : '/entrepreneur/invitations'}
              className={`navbar-link ${isActive(role === 'worker' ? '/worker/invitations' : '/entrepreneur/invitations') ? 'active' : ''}`}
            >
              Invitations
            </Link>
            <Link to="/connections" className={`navbar-link ${isActive('/connections') ? 'active' : ''}`}>
              Connections
            </Link>
            <Link to="/notifications" className={`navbar-link ${isActive('/notifications') ? 'active' : ''}`}>
              🔔 Notifications
              {unread > 0 && <span className="nav-count">{unread > 99 ? '99+' : unread}</span>}
            </Link>
          </>
        )}

        <div className="navbar-profile-menu" ref={profileMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="navbar-profile-trigger"
            aria-label="Open profile menu"
            aria-haspopup="menu"
            aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen((open) => !open)}
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              border: '1px solid #f1d2dc',
              background: '#f9e6ec',
              color: '#b56782',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 25,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            <ProfileAvatar role={role} profileId={profileSummary?.id} hasPhoto={!!profileSummary?.hasPhoto} photoPath={profileSummary?.photoPath} email={profileEmail || email} size={40} style={{ border: 'none', background: 'transparent', fontSize: 22 }} />
          </button>

          {profileMenuOpen && (
            <div
              className="navbar-profile-dropdown"
              role="menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: 210,
                padding: 8,
                background: '#fff',
                border: '1px solid #f1dce3',
                borderRadius: 14,
                boxShadow: '0 10px 30px rgba(80, 35, 50, 0.14)',
                zIndex: 1000,
              }}
            >
              <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid #f4e5ea', marginBottom: 5 }}>
                <div style={{ fontWeight: 600, color: '#49323b' }}>My account</div>
                <div style={{ fontSize: 12, color: '#9a7b86', marginTop: 3 }}>{roleLabel(role)}</div>
              </div>
              <Link
                to={profilePath}
                role="menuitem"
                onClick={() => setProfileMenuOpen(false)}
                style={{ display: 'block', padding: '10px', borderRadius: 8, color: '#49323b', textDecoration: 'none' }}
              >
                My Profile
              </Link>
              <Link
                to="/account/settings"
                role="menuitem"
                onClick={() => setProfileMenuOpen(false)}
                style={{ display: 'block', padding: '10px', borderRadius: 8, color: '#49323b', textDecoration: 'none' }}
              >
                Account Settings
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px',
                  border: 0,
                  borderTop: '1px solid #f4e5ea',
                  marginTop: 4,
                  borderRadius: 8,
                  background: 'transparent',
                  color: '#c45f72',
                  font: 'inherit',
                  cursor: 'pointer',
                }}
              >
                ↪ Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
