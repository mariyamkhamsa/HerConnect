import React from 'react'
import { Link } from 'react-router-dom'

function HeroHandsIcon() {
  return (
    <div className="hero-icon" aria-hidden="true">
      <svg viewBox="0 0 100 100" role="img">
        <path
          d="M50 40c-9-9-19-4-15 5 2 5 9 9 15 14 6-5 13-9 15-14 4-9-6-14-15-5Z"
          className="hero-heart"
        />
        <path d="M22 62c4 12 14 20 28 20s24-8 28-20" />
        <path d="M22 62c-1-6 1-11 5-13 3 8 7 12 13 14" />
        <path d="M78 62c1-6-1-11-5-13-3 8-7 12-13 14" />
        <path d="M27 49c-1-3 0-6 3-7" />
        <path d="M73 49c1-3 0-6-3-7" />
        <path d="M33 58c3 5 8 8 17 8s14-3 17-8" />
      </svg>
    </div>
  )
}

function FeatureIcon({ type }) {
  const paths = {
    connect: (
      <>
        <circle cx="32" cy="27" r="8" />
        <circle cx="18" cy="31" r="6" />
        <circle cx="46" cy="31" r="6" />
        <path d="M20 51c1-8 6-13 12-13s11 5 12 13" />
        <path d="M7 50c1-6 5-10 10-10 3 0 6 1 8 4" />
        <path d="M51 50c-1-6-5-10-10-10-3 0-6 1-8 4" />
      </>
    ),

    collaborate: (
      <>
        <path d="M12 30l10-8c3-2 6-2 9 0l6 5" />
        <path d="M48 30l-10-8c-3-2-6-2-9 0l-6 5" />
        <path d="M23 27l8 8c2 2 5 2 7 0l6-6" />
        <path d="M17 32l8 8c2 2 4 2 6 0l2-2" />
        <path d="M44 32l-7 7" />
        <path d="M29 47c5-5 10-8 16-9" />
      </>
    ),

    grow: (
      <>
        <path d="M31 55V24" />
        <path d="M31 38c-8-2-13-7-14-14 8 0 14 4 17 11" />
        <path d="M31 31c5-7 11-10 18-9-1 7-6 12-15 14" />
        <path d="M15 55h34" />
        <path d="M31 24c0-6 3-10 9-13 3 6 0 11-9 13" />
      </>
    )
  }

  return (
    <svg
      className="feature-svg"
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      {paths[type]}
    </svg>
  )
}

export default function Home() {
  return (
    <main className="reference-home">

      {/* =========================
          HERO SECTION
          ========================= */}

      <section className="reference-hero" id="home">

        <div
          className="hero-line hero-line-right"
          aria-hidden="true"
        />

        <div
          className="hero-dots hero-dots-right"
          aria-hidden="true"
        >
          ••••
          <br />
          ••••
          <br />
          ••••
        </div>

        <div
          className="hero-dots hero-dots-low"
          aria-hidden="true"
        >
          ••••
          <br />
          ••••
        </div>

        <div
          className="hero-dots hero-dots-left"
          aria-hidden="true"
        >
          ••
        </div>

        <div
          className="hero-sparkle sparkle-left"
          aria-hidden="true"
        >
          ✧
        </div>

        <div
          className="hero-sparkle sparkle-right"
          aria-hidden="true"
        >
          ✧
        </div>


        <div className="reference-hero-content">

          <HeroHandsIcon />

          <h1>
            HerConnect-
            <br />
            Women collaboration
            <br />
            platform
          </h1>

          <div className="hero-divider">
            <span />
            ♥
            <span />
          </div>

          <p>
            Connect. Collaborate. Grow.
          </p>

          <div className="reference-hero-actions">

            <Link
              to="/register"
              className="reference-primary-btn"
            >
              Get Started <span>→</span>
            </Link>

            <a
              href="#about"
              className="reference-explore"
            >
              Explore
            </a>

          </div>

          <div
            className="hero-pagination"
            aria-hidden="true"
          >
            <span className="active" />
            <span />
            <span />
          </div>

        </div>

      </section>


      {/* =========================
          FEATURES
          ========================= */}

      <section
        className="reference-features"
        aria-label="HerConnect benefits"
      >

        <a
          href="#about"
          className="reference-feature"
        >

          <div className="feature-icon">
            <FeatureIcon type="connect" />
          </div>

          <div>
            <h3>Connect</h3>
            <p>Find the right people</p>
            <span>♥</span>
          </div>

        </a>


        <div className="feature-separator" />


        <a
          href="#collaborate"
          className="reference-feature"
        >

          <div className="feature-icon">
            <FeatureIcon type="collaborate" />
          </div>

          <div>
            <h3>Collaborate</h3>
            <p>Work together</p>
            <span>♥</span>
          </div>

        </a>


        <div className="feature-separator" />


        <a
          href="#grow"
          className="reference-feature"
        >

          <div className="feature-icon">
            <FeatureIcon type="grow" />
          </div>

          <div>
            <h3>Grow</h3>
            <p>Build opportunities</p>
            <span>♥</span>
          </div>

        </a>

      </section>


      {/* =========================
          ABOUT SECTION
          ========================= */}

      <section
        className="reference-info"
        id="about"
      >

        <div className="info-inner">

          <span className="section-kicker">
            ABOUT HERCONNECT
          </span>

          <h2>
            Built to help women connect,
            collaborate and grow.
          </h2>

          <p>
            HerConnect connects women entrepreneurs
            running small or home-based businesses
            with skilled women seeking flexible,
            local work. Create a profile, discover
            opportunities and find meaningful matches.
          </p>

        </div>

      </section>


      {/* =========================
          COLLABORATE SECTION
          ========================= */}

      <section
        className="reference-info two-column"
        id="collaborate"
      >

        <div>

          <span className="section-kicker">
            COLLABORATE
          </span>

          <h2>
            Opportunities that fit real lives.
          </h2>

        </div>

        <p>
          Whether you are looking for skilled help
          or flexible work, HerConnect brings the
          right people together while keeping
          location, availability, work type and
          experience in mind.
        </p>

      </section>


      {/* =========================
          SUPPORT SECTION
          ========================= */}

      <section
        className="reference-info support-section"
        id="grow"
      >

        <div className="support-content">

          <span className="section-kicker">
            SUPPORT
          </span>

          <h2>
            We're here to help you
            <br />
            every step of the way.
          </h2>

          <p className="support-description">
            Have a question or need assistance?
            Our HerConnect support team is here
            to help women entrepreneurs and skilled
            women with account-related issues,
            profiles, job applications and other
            platform-related queries.
          </p>


          <div className="support-cards">

            {/* EMAIL */}

            <div className="support-card">

              <div className="support-icon">
                ✉
              </div>

              <div>

                <h3>
                  Email Support
                </h3>

                <p>
                  herconnect@gmail.com
                </p>

                <span>
                  Send us your questions and
                  we'll be happy to help.
                </span>

              </div>

            </div>


            {/* PHONE */}

            <div className="support-card">

              <div className="support-icon">
                ☎
              </div>

              <div>

                <h3>
                  Customer Support
                </h3>

                <p>
                  +91 98765 43210
                </p>

                <span>
                  Contact us for assistance
                  or platform-related queries.
                </span>

              </div>

            </div>


            {/* GENERAL HELP */}

            <div className="support-card">

              <div className="support-icon">
                ♡
              </div>

              <div>

                <h3>
                  How can we help?
                </h3>

                <p>
                  We're here for you.
                </p>

                <span>
                  Get help with accounts, profiles,
                  job applications, recommendations
                  and general queries.
                </span>

              </div>

            </div>

          </div>


          {/* SUPPORT MESSAGE */}

          <div className="support-note">

            <span>🌸</span>

            <p>
              HerConnect is built to make connecting,
              collaborating and growing easier for
              every woman.
            </p>

          </div>

        </div>

      </section>

    </main>
  )
}