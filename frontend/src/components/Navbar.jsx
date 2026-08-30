import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Navbar() {
  const { isAuthenticated, role, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path) => location.pathname === path
  const dashboardPath = role === 'entrepreneur' ? '/entrepreneur' : '/worker'

  const [activeSection, setActiveSection] = useState('home')

  useEffect(() => {
    if (isAuthenticated || location.pathname !== '/') return

    const sections = ['home', 'about', 'collaborate', 'grow']

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150

      let currentSection = 'home'

      sections.forEach((sectionId) => {
        const section = document.getElementById(sectionId)

        if (section && section.offsetTop <= scrollPosition) {
          currentSection = sectionId
        }
      })

      setActiveSection(currentSection)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [isAuthenticated, location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!isAuthenticated) {
    return (
      <nav className="navbar reference-navbar">
        
        {/* Logo */}
        <Link to="/" className="navbar-brand reference-brand">
          <span className="brand-mark" aria-hidden="true">
            ❧
          </span>
          <span>HerConnect</span>
        </Link>

        {/* Navigation */}
        <div className="reference-nav-links">

          <a
            href="#home"
            className={`reference-nav-link ${
              activeSection === 'home' ? 'active' : ''
            }`}
          >
            Home
          </a>

          <a
            href="#about"
            className={`reference-nav-link ${
              activeSection === 'about' ? 'active' : ''
            }`}
          >
            About
          </a>

          <a
            href="#collaborate"
            className={`reference-nav-link ${
              activeSection === 'collaborate' ? 'active' : ''
            }`}
          >
            For Women
          </a>

          <a
            href="#grow"
            className={`reference-nav-link ${
              activeSection === 'grow' ? 'active' : ''
            }`}
          >
            Support
          </a>

        </div>

        {/* Buttons */}
        <div className="reference-nav-actions">

          <Link
            to="/login"
            className="reference-login-btn"
          >
            Login
          </Link>

          <Link
            to="/register"
            className="reference-start-btn"
          >
            Get Started
          </Link>

        </div>

      </nav>
    )
  }

  return (
    <nav className="navbar">

      <Link
        to={dashboardPath}
        className="navbar-brand"
      >
        <span className="brand-mark">🌸</span>
        HerConnect
      </Link>

      <div className="navbar-links">

        <Link
          to={dashboardPath}
          className={`navbar-link ${
            isActive(dashboardPath) ? 'active' : ''
          }`}
        >
          Dashboard
        </Link>

        <span className="navbar-user badge badge-pink">
          {role === 'entrepreneur'
            ? 'Entrepreneur'
            : 'Skilled Woman'}
        </span>

        <button
          className="btn btn-outline btn-sm"
          onClick={handleLogout}
        >
          Log out
        </button>

      </div>

    </nav>
  )
}