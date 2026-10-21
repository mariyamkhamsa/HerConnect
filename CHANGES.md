# HerConnect - two-way connection workflow (invitations, notifications, consent-based contacts)

Paths are relative to the `herconnect/` project folder (backend/ and frontend/ prefixes).
The SBERT + Cross-Encoder pipeline (backend/app/ai/*) and recommendations.py are NOT modified.

Modified
  backend/app/models.py                        + Invitation, Notification; consent flags on Application; optional phone on both profiles
  backend/app/schemas.py                       + invitation/notification/connection schemas, phone (owner-only *MeOut), consent fields
  backend/app/main.py                          registers 3 new routers
  backend/app/privacy.py                       an invitation also grants profile visibility (worker <-> business)
  backend/app/routers/applications.py          consent flag, notifications, decide-once, invitation conflict checks
  backend/app/routers/workers.py               /me endpoints return phone to the owner only; phone never wiped by older clients
  backend/app/routers/entrepreneurs.py         same for the business profile
  README.md                                    short upgrade + workflow notes
  backend/schema.sql                           new columns/tables for fresh installs
  backend/tests/test_connection_workflow.py    (new, see below)
  frontend/src/App.jsx                         5 routes (+3 imports)
  frontend/src/components/Navbar.jsx           Invitations / Connections / Notifications links with unread badge
  frontend/src/pages/RecommendationResults.jsx Invite to apply (entrepreneur), consent checkbox on Apply (worker), invitation-aware buttons
  frontend/src/pages/ApplicationsView.jsx      consent checkbox on Accept, "Contact details" links, double-click guard
  frontend/src/pages/WorkerProfileForm.jsx     optional phone field
  frontend/src/pages/EntrepreneurProfileForm.jsx optional phone field
  frontend/src/index.css                       small additions at the end of the file
New
  backend/app/notify.py
  backend/app/routers/invitations.py
  backend/app/routers/notifications.py
  backend/app/routers/connections.py
  backend/migrations/002_connection_workflow.sql
  backend/tests/test_connection_workflow.py
  frontend/src/components/ConsentCheckbox.jsx
  frontend/src/pages/Invitations.jsx
  frontend/src/pages/Notifications.jsx
  frontend/src/pages/Connections.jsx

Migration: run backend/migrations/002_connection_workflow.sql ONCE on an existing database, before starting the new backend.

----------------------------------------------------------------------------------------------------
Previous change set: worker profile save fix + View Profile
----------------------------------------------------------------------------------------------------

# HerConnect - worker profile save fix + View Profile

Paths are relative to your project root; backend/ and frontend/ prefixes are assumed -
move files to match your real layout (Python imports imply app/..., JSX imports imply src/...).

Modified
  backend/app/schemas.py                       + JobRecommendation.entrepreneur_id (optional)
  backend/app/routers/recommendations.py       passes entrepreneur_id into JobRecommendation (pipeline untouched)
  backend/app/routers/workers.py               access rules on GET /workers/{id} and /workers/{id}/portfolio
  backend/app/routers/entrepreneurs.py         access rule on GET /entrepreneurs/{id} for workers
  frontend/src/App.jsx                         2 imports + 2 routes
  frontend/src/pages/WorkerProfileForm.jsx     Save Profile button, validation, safe error display
  frontend/src/pages/RecommendationResults.jsx View Profile / View Business Profile buttons, safe error display
New
  backend/app/privacy.py
  backend/tests/test_worker_profile_and_views.py
  frontend/src/utils/errors.js
  frontend/src/pages/WorkerProfileView.jsx
  frontend/src/pages/BusinessProfileView.jsx

Migrations: none (no table/column changes; existing data untouched).
