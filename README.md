# Sekar & Co — Employee Details Portal

A web application for **Sekar & Co** (Electricals · Plumbing/Pipes · Paints · Building
Construction Materials — Karur, Tamil Nadu) that lets employees fill the official
**Employee Details Form** online. Submissions are stored in **PostgreSQL** and
optionally mirrored to a **Google Sheet**, with an **admin dashboard** to browse,
search and review every record.

> _"Quality is Permanent"_

## Features

- 🔐 **User authentication** (register / login) — credentials stored in PostgreSQL, passwords hashed with bcrypt, JWT session cookie.
- 👥 **Role-based access & user management** — three privileges:
  - **Admin** — full access (records, user management, settings, delete, export).
  - **Read-only / Viewer** — can only **view & export** records; cannot edit, delete, submit, or change settings.
  - **Employee** — fills and submits the Employee Details Form.
  Admins create and manage accounts (assign roles, reset passwords) from a **Users** page.
- 📝 **Full 8-section Employee Details Form** matching the official PDF:
  1. Personal Information (with passport photo upload)
  2. Employment & Joining Details
  3. Identity & Statutory Details
  4. Emergency Contact Information
  5. Educational Qualifications
  6. Previous Work Information
  7. Medical Record
  8. Declaration & consent
- 🗄️ **Dual storage** — every submission is written to PostgreSQL **and** appended to a Google Sheet (when configured).
- 👨‍💼 **Admin dashboard** — searchable table with profile-picture avatars, full-record detail view, photo preview, delete.
- ⬇️ **Export to CSV & PDF** — both **bulk** (all/filtered records) and **individual** (single record), respecting the active search filter.
- 🎨 **Customization / Settings page** — admins can change the **logo** (image upload or emoji), **shop name**, **tagline**, **accent & header colors**, **footer note**, and all **contact details** (head office, branch, emails). Changes apply live across the portal.
- 🖼️ **Browser tab icon** (PNG favicon) included.
- 🔗 **Clean named URLs** — `/login`, `/register`, `/admin`, `/users`, `/settings` (no `.html`).
- 🌗 **Light & Dark theme** toggle (remembers your choice, respects OS preference).
- 📱 **Mobile-optimized** responsive layout (adaptive header, scrollable tables, no iOS input zoom).
- 🎨 Electricals / plumbing-construction visual theme with live shop contact details pulled from sekarandco.com.
- 🌱 **Demo data** — two sample employees seeded on first boot (toggle with `SEED_DEMO`).
- 🐳 **Docker Compose** deployment (app + PostgreSQL), one command to run.

## Tech stack

| Layer    | Technology                                   |
|----------|----------------------------------------------|
| Backend  | Node.js 18 + Express                         |
| Database | PostgreSQL 16                                |
| Auth     | JWT (httpOnly cookie) + bcryptjs             |
| Sheets   | `googleapis` (service-account)               |
| Frontend | Vanilla HTML/CSS/JS (no build step)          |
| Deploy   | Docker Compose                               |

---

## Quick start (Docker Compose)

```bash
# 1. Configure environment
cp .env.example .env
#    → edit .env: set JWT_SECRET, DB_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD

# 2. Build & launch
docker compose up -d --build

# 3. Open the app
#    http://localhost:3000
```

On first boot the database schema is created automatically and the admin user
from `ADMIN_EMAIL` / `ADMIN_PASSWORD` is seeded.

- **Employee form:** http://localhost:3000/  (login required)
- **Admin dashboard:** http://localhost:3000/admin.html  (admin login required)

Stop / reset:

```bash
docker compose down            # stop
docker compose down -v         # stop and DELETE all data (db + uploads)
```

---

## Local development (without Docker)

```bash
cd backend
npm install
# point to a local Postgres and run the schema in db/init.sql first
DB_HOST=localhost DB_USER=sekar DB_PASSWORD=... DB_NAME=sekar_employees \
ADMIN_EMAIL=admin@sekarandco.in ADMIN_PASSWORD=admin123 \
JWT_SECRET=dev-secret npm run dev
```

---

## Enabling the Google Sheets mirror (optional)

The app works fully without this; PostgreSQL is the source of truth. To also push
each submission into a Google Sheet:

1. In **Google Cloud Console**, create a project and enable the **Google Sheets API**.
2. Create a **Service Account** and download its **JSON key**.
3. Create a Google Sheet and note its **ID** (the long token in the URL:
   `https://docs.google.com/spreadsheets/d/`**`<SHEET_ID>`**`/edit`).
4. **Share** the sheet with the service account's `client_email` as **Editor**.
5. Configure `.env`:
   ```env
   GOOGLE_SHEETS_ENABLED=true
   GOOGLE_SHEET_ID=<your sheet id>
   # Either mount the key file and point to it…
   GOOGLE_SERVICE_ACCOUNT_JSON=/run/secrets/gcp-sa.json
   # …or paste the base64 of the key file:
   GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=$(base64 -w0 key.json)
   ```
   If using the file path, mount it into the `app` service in `docker-compose.yml`:
   ```yaml
   app:
     volumes:
       - ./gcp-sa.json:/run/secrets/gcp-sa.json:ro
   ```
6. `docker compose up -d --build`. The header row is created automatically and each
   submission is appended as a new row.

> A Sheets outage never blocks a submission — the record is always saved to the
> database first, and the Sheets failure is logged.

---

## API reference

| Method | Endpoint                          | Auth          | Description                              |
|--------|-----------------------------------|---------------|------------------------------------------|
| POST   | `/api/auth/register`              | —             | Create a user account (role `user`)      |
| POST   | `/api/auth/login`                 | —             | Login, sets session cookie               |
| POST   | `/api/auth/logout`                | —             | Clear session                            |
| GET    | `/api/auth/me`                    | any           | Current user                             |
| POST   | `/api/employees`                  | admin, user   | Submit an employee form (multipart)      |
| GET    | `/api/employees`                  | admin, viewer | List/search all records                  |
| GET    | `/api/employees/:id`              | admin, viewer | Single record                            |
| DELETE | `/api/employees/:id`              | admin         | Delete a record                          |
| GET    | `/api/employees/export/csv`       | admin, viewer | Bulk CSV (honors `?search=`)             |
| GET    | `/api/employees/export/pdf`       | admin, viewer | Bulk PDF (honors `?search=`)             |
| GET    | `/api/employees/:id/export/csv`   | admin, viewer | Individual record CSV                    |
| GET    | `/api/employees/:id/export/pdf`   | admin, viewer | Individual record PDF                    |
| GET    | `/api/users`                      | admin         | List user accounts                       |
| POST   | `/api/users`                      | admin         | Create a user with a role                |
| PATCH  | `/api/users/:id`                  | admin         | Change role / reset password             |
| DELETE | `/api/users/:id`                  | admin         | Delete a user                            |
| GET    | `/api/settings`                   | admin         | Read full customization config           |
| PUT    | `/api/settings`                   | admin         | Update branding / contact details        |
| POST   | `/api/settings/logo`              | admin         | Upload a logo image                      |
| DELETE | `/api/settings/logo`              | admin         | Remove uploaded logo                     |
| GET    | `/api/config`                     | —             | Public branding + contact details        |
| GET    | `/api/health`                     | —             | Health check                             |

---

## Security notes

- Always set a strong, unique `JWT_SECRET` and `ADMIN_PASSWORD` in production.
- Put the app behind HTTPS (reverse proxy) and set `FORCE_INSECURE_COOKIE=false`
  so the session cookie is flagged `Secure`.
- The form collects sensitive PII (PAN, Aadhaar, medical). Restrict database and
  server access accordingly and comply with applicable data-protection rules.

---

## Project structure

```
.
├── docker-compose.yml          # app + postgres
├── .env.example
├── db/
│   └── init.sql                # schema (auto-run on first DB boot)
├── docs/
│   └── Employee_Details_Form_v2.pdf
└── backend/
    ├── Dockerfile
    ├── package.json
    ├── src/
    │   ├── server.js           # express app, named routes, static hosting
    │   ├── db.js               # pg pool + readiness wait
    │   ├── auth.js             # JWT, bcrypt, role middleware, admin seed
    │   ├── migrate.js          # idempotent startup migrations
    │   ├── settings.js         # DB-backed branding/customization config
    │   ├── seed.js             # demo employee seeding
    │   ├── sheets.js           # Google Sheets mirror
    │   ├── exporters.js        # CSV + PDF generation
    │   └── routes/
    │       ├── auth.js
    │       ├── employees.js    # CRUD + CSV/PDF export
    │       ├── users.js        # user management (admin)
    │       └── settings.js     # customization (admin)
    └── public/                 # frontend (served statically)
        ├── index.html          # employee form
        ├── login.html / register.html
        ├── admin.html          # records dashboard (admin + viewer)
        ├── users.html          # user management (admin)
        ├── settings.html       # customization (admin)
        ├── favicon.png         # browser tab icon
        ├── css/styles.css      # light + dark theme, responsive
        └── js/{common,form,admin,users,settings}.js
```

---

_Contact details shown in the app are sourced from [sekarandco.com](https://sekarandco.com/)._
