import React from 'react'
import { Link } from 'react-router-dom'

function HeroHandsIcon() {
  return (
    <div className="hero-icon" aria-hidden="true">
      <svg viewBox="0 0 100 100" role="img">
        <path d="M39 62c-7-2-13-7-17-14-2-4 3-7 6-4l9 9V37c0-3 5-3 5 0v11l3-13c1-4 6-3 6 1l-1 12 4-10c1-4 6-2 5 2l-3 12 6-7c3-3 7 1 4 4l-8 11c-4 5-11 8-19 7Z" />
        <path d="M61 62c7-2 13-7 17-14 2-4-3-7-6-4l-9 9V37c0-3-5-3-5 0v11l-3-13c-1-4-6-3-6 1l1 12-4-10c-1-4-6-2-5 2l3 12-6-7c-3-3-7 1-4 4l8 11c4 5 11 8 19 7Z" />
        <path
          d="M50 17c-5-10-19-5-15 5 2 5 8 8 15 14 7-6 13-9 15-14 4-10-10-15-15-5Z"
          className="hero-heart"
        />
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

function LeafDecoration({ side }) {
  return (
    <div
      className={`leaf-decoration leaf-${side}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 260 330">
        <path
          d="M32 310C78 245 86 164 196 55"
          className="leaf-stem"
        />

        <path
          d="M70 250C40 232 27 204 32 177c28 5 48 25 49 54"
          className="leaf-fill"
        />

        <path
          d="M87 207c-26-22-31-49-20-73 28 10 43 31 37 58"
          className="leaf-fill"
        />

        <path
          d="M107 170c-15-25-10-50 8-68 22 17 27 40 15 61"
          className="leaf-fill"
        />

        <path
          d="M130 132c-7-24 4-44 25-56 14 21 9 42-8 58"
          className="leaf-fill"
        />

        <path
          d="M103 223c29-10 53-5 71 15-25 19-51 16-71-2"
          className="leaf-fill"
        />

        <path
          d="M124 183c28-12 53-8 72 11-24 20-50 18-72 1"
          className="leaf-fill"
        />

        <path
          d="M150 143c25-11 47-6 62 12-21 17-43 16-62 2"
          className="leaf-fill"
        />

        <path
          d="M176 105c20-8 38-4 50 10-17 14-34 13-50 2"
          className="leaf-fill"
        />
      </svg>
    </div>
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

        <LeafDecoration side="left" />
        <LeafDecoration side="right" />

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

        <div
          className="hero-wave"
          aria-hidden="true"
        />

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