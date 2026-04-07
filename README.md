# SU Legal

**Agreement management system** for business, legal, and CXO teams.

Supports the full agreement lifecycle — from request submission through drafting, review, approval, and signing.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss) ![Node](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js) ![Postgres](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql) ![Status](https://img.shields.io/badge/Status-Active-2EBDB1)

---

## Overview

SU Legal is a role-based agreement management tool. Business teams submit contract requests, legal reviews and prepares drafts, and CXO resolves escalations when business and legal can't align. Every action is tracked in a timeline. All data is persisted in PostgreSQL.

---

## Roles

| Role     | What they can do |
|----------|-----------------|
| **Business** | Submit requests, review drafts, send feedback, accept final versions, escalate to CXO, upload signed agreements |
| **Legal**    | Start reviews, upload draft documents (.docx), share final versions (.pdf), move requests through workflow |
| **CXO**      | View escalated requests, approve or reject business change requests |
| **Admin**    | Manage users (create, delete), access the admin panel |

---

## Agreement Workflow

```
[Business] Submits request
           ↓
[Legal]    Starts review          → status: in_review
           ↓
[Legal]    Uploads .docx draft    → status: draft_shared
           ↓
[Business] Reviews draft
           ├── Sends feedback     → status: feedback_given
           │       ↓
           │   [Legal] Uploads revised draft or final
           │
           └── Approves draft
                   ↓
[Legal]    Uploads final .pdf     → status: final_shared
           ↓
[Business] Reviews final version
           ├── Accepts it         → status: accepted
           │       ↓
           │   [Business] Uploads signed PDF → status: signed ✓
           │
           └── Requests changes   → status: cxo_requested
                   ↓
               [CXO] Reviews full history
               ├── Approves       → status: cxo_approved
               │       ↓
               │   [Business] Uploads signed PDF → status: signed ✓
               │
               └── Rejects        → status: cxo_rejected
                       ↓
                   [Business] Uses legal's version
```

### Status Reference

| Status | Meaning | Who acts next |
|--------|---------|---------------|
| `pending` | Submitted, awaiting legal | Legal |
| `in_review` | Legal is reviewing | Legal |
| `draft_shared` | Draft ready for business review | Business |
| `feedback_given` | Business sent feedback | Legal |
| `final_shared` | Final version ready | Business |
| `accepted` | Business accepted, ready to sign | Business |
| `cxo_requested` | Escalated, awaiting CXO decision | CXO |
| `cxo_approved` | CXO approved changes | Business |
| `cxo_rejected` | CXO rejected, legal's version stands | Business |
| `signed` | Signed agreement uploaded, archived | — |

---

## Authentication Flow

```
User enters email + password
    ↓
POST /api/auth/login
    ↓
Server validates against bcrypt hash in DB
    ↓
Returns JWT (8h expiry) + user object
    ↓
Frontend stores JWT in localStorage
    ↓
All subsequent API requests send: Authorization: Bearer <token>
    ↓
On page reload → JWT decoded from localStorage → session restored
    ↓
On JWT expiry → user redirected to login
```

- Passwords are hashed with **bcrypt (cost 10)** — plain passwords are never stored
- JWT payload contains: `id`, `name`, `email`, `role`
- Token expiry: **8 hours**

---

## Document Storage Flow

```
User selects file (drag-and-drop or browse)
    ↓
Browser reads file with FileReader.readAsDataURL()
    ↓
Produces base64 string: "data:application/pdf;base64,JVBERi0x..."
    ↓
POST /api/requests/:id/documents  { name, mimeType, sizeBytes, data }
    ↓
Server inserts into documents table (data column = base64 text)
    ↓
Timeline event automatically created: "Uploaded filename.pdf"
```

**Retrieval:**
```
User clicks document in UI
    ↓
GET /api/requests/:id/documents/:docId/download
    ↓
Server returns full document row including base64 data
    ↓
Frontend renders preview (images inline, others as download link)
```

> **Note:** Base64 is excluded from list queries to keep responses fast. It is only fetched on demand when a user opens a document preview.

**Current storage:** Base64 in PostgreSQL `TEXT` column — suitable for a prototype or low-volume internal tool. For high-volume production use, migrate to S3 or object storage and store only the file URL.

---

## API Flow

Every request from the frontend goes through this chain:

```
React (localhost:3001)
    ↓  fetch() with Authorization: Bearer <token>
Express API (localhost:3000)
    ↓  requireAuth middleware verifies JWT
    ↓  route handler runs query
PostgreSQL (localhost:5432)
    ↓  returns data
Express → JSON response
    ↓
React updates state → UI re-renders
```

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | React 18, Tailwind CSS 3, Inter font            |
| Backend    | Node.js, Express 5                              |
| Database   | PostgreSQL 16 (Docker)                          |
| Auth       | JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`)      |
| Dev DB     | Docker (`postgres:16-alpine`)                   |

---

## Project Structure

```
legal-flow/
├── src/                            # React frontend
│   ├── index.js                    # Entry point
│   ├── index.css                   # Tailwind directives + component classes
│   ├── App.js                      # All UI components and page logic
│   ├── api.js                      # API client (fetch wrapper, token mgmt, normalizers)
│   └── credentials.js              # Legacy dev user list (superseded by DB)
├── server/                         # Express API backend
│   ├── index.js                    # Server entry point (port 3000)
│   ├── db.js                       # PostgreSQL connection pool
│   ├── schema.sql                  # Full DB schema + seed users
│   ├── .env                        # DB + JWT config (not committed)
│   ├── middleware/
│   │   └── auth.js                 # JWT verification middleware
│   ├── routes/
│   │   ├── auth.js                 # Login, change password
│   │   ├── admin.js                # User management (admin only)
│   │   ├── requests.js             # CRUD for agreement requests
│   │   ├── documents.js            # Upload/download documents
│   │   ├── timeline.js             # Timeline events per request
│   │   └── comments.js             # Comments per request
│   └── migrations/
│       └── 001_seed_initial_requests.sql   # Seeds 3 sample agreements
├── tailwind.config.js              # Brand tokens, shadows, animations
├── postcss.config.js
└── package.json                    # Frontend dependencies
```

---

## Quick Start

### Prerequisites

- Node.js 18+ (nvm recommended)
- Docker Desktop (running)

### 1. Install frontend dependencies

```bash
# From project root
npm install
```

### 2. Start the database

```bash
docker run -d \
  --name legalflow-postgres \
  -e POSTGRES_DB=legalflow \
  -e POSTGRES_USER=legalflow \
  -e POSTGRES_PASSWORD=legalflow_dev \
  -p 5432:5432 \
  postgres:16-alpine
```

### 3. Apply schema and seed data

```bash
cd server
npm install
npm run db:init      # creates all tables, enums, indexes, seed users
npm run db:migrate   # applies migrations (sample requests)
```

### 4. Start the API server

```bash
# From server/
npm run dev          # node --watch for auto-reload on file changes
```

API runs at `http://localhost:3000`.

### 5. Start the frontend

```bash
# From project root
npm start
```

Frontend runs at `http://localhost:3001` (React auto-increments if 3000 is taken by the API).

---

## Ports

| Service    | Port  |
|------------|-------|
| Frontend   | 3001  |
| API server | 3000  |
| PostgreSQL | 5432  |

---

## API Reference

All protected routes require `Authorization: Bearer <token>` header.

### Auth

| Method | Endpoint               | Auth | Description                  |
|--------|------------------------|------|------------------------------|
| POST   | `/api/auth/login`      | No   | Login, returns JWT + user    |
| PUT    | `/api/auth/password`   | Yes  | Change own password          |

### Admin (admin role only)

| Method | Endpoint                | Auth  | Description       |
|--------|-------------------------|-------|-------------------|
| GET    | `/api/admin/users`      | Admin | List all users    |
| POST   | `/api/admin/users`      | Admin | Create a user     |
| DELETE | `/api/admin/users/:id`  | Admin | Delete a user     |

### Requests

| Method | Endpoint              | Auth | Description                          |
|--------|-----------------------|------|--------------------------------------|
| GET    | `/api/requests`       | Yes  | List all requests (with doc count)   |
| POST   | `/api/requests`       | Yes  | Create new request + timeline event  |
| GET    | `/api/requests/:id`   | Yes  | Full request with docs + timeline    |
| PUT    | `/api/requests/:id`   | Yes  | Update status, cxo_note, fields      |

### Documents

| Method | Endpoint                                      | Auth | Description                        |
|--------|-----------------------------------------------|------|------------------------------------|
| GET    | `/api/requests/:id/documents`                 | Yes  | List documents (metadata, no data) |
| POST   | `/api/requests/:id/documents`                 | Yes  | Upload document (base64)           |
| GET    | `/api/requests/:id/documents/:docId/download` | Yes  | Download with base64 data          |
| DELETE | `/api/requests/:id/documents/:docId`          | Yes  | Delete document                    |

### Timeline

| Method | Endpoint                       | Auth | Description           |
|--------|--------------------------------|------|-----------------------|
| GET    | `/api/requests/:id/timeline`   | Yes  | Get all events        |
| POST   | `/api/requests/:id/timeline`   | Yes  | Add a timeline event  |

### Comments

| Method | Endpoint                                    | Auth | Description         |
|--------|---------------------------------------------|------|---------------------|
| GET    | `/api/requests/:id/comments`                | Yes  | Get all comments    |
| POST   | `/api/requests/:id/comments`                | Yes  | Add a comment       |
| DELETE | `/api/requests/:id/comments/:commentId`     | Yes  | Delete own comment  |

### Health

| Method | Endpoint       | Auth | Description  |
|--------|----------------|------|--------------|
|GET     | `/api/health`  | No   | Health check |

---

## Test Credentials

| Role     | Email                    | Password      |
|----------|--------------------------|---------------|
| Admin    | admin@legalflow.com      | admin123      |
| Business | sarah@legalflow.com      | business123   |
| Legal    | rafiq@legalflow.com      | legal123      |
| CXO      | nadia@legalflow.com      | cxo123        |

---

## Database

### Connection

| Field    | Value          |
|----------|----------------|
| Host     | localhost      |
| Port     | 5432           |
| Database | legalflow      |
| User     | legalflow      |
| Password | legalflow_dev  |

### Schema

```
users
├── id             UUID (PK)
├── name           TEXT
├── email          TEXT UNIQUE
├── password_hash  TEXT          ← bcrypt hash, never plain text
├── role           user_role     ← enum: admin, business, legal, cxo
└── created_at     TIMESTAMPTZ

requests
├── id             UUID (PK)
├── seq            SERIAL UNIQUE ← human-readable REQ-001, REQ-002...
├── title          TEXT
├── type           req_type      ← enum: draft, review
├── status         req_status    ← enum (see status table above)
├── business_unit  TEXT
├── party_a        TEXT
├── party_b        TEXT
├── detail         TEXT
├── cxo_note       TEXT          ← populated when escalating to CXO
├── created_by     UUID → users
├── assigned_to    UUID → users
├── created_at     TIMESTAMPTZ
└── updated_at     TIMESTAMPTZ   ← auto-updated by trigger

documents
├── id             UUID (PK)
├── request_id     UUID → requests (CASCADE DELETE)
├── name           TEXT          ← original filename
├── mime_type      TEXT
├── size_bytes     INTEGER
├── data           TEXT          ← base64 encoded file content
├── uploaded_by    UUID → users
└── uploaded_at    TIMESTAMPTZ

timeline_events
├── id             UUID (PK)
├── request_id     UUID → requests (CASCADE DELETE)
├── actor_id       UUID → users
├── actor_name     TEXT          ← denormalized for display
├── actor_role     user_role
├── action         TEXT          ← e.g. "Shared draft", "Gave feedback"
├── note           TEXT          ← detail / context
└── created_at     TIMESTAMPTZ

comments
├── id             UUID (PK)
├── request_id     UUID → requests (CASCADE DELETE)
├── author_id      UUID → users
├── author_name    TEXT
├── body           TEXT
└── created_at     TIMESTAMPTZ
```

---

## Migrations

Migration files live in `server/migrations/` and run in filename order.

```bash
# From server/
npm run db:migrate
```

| File | Description |
|------|-------------|
| `001_seed_initial_requests.sql` | Seeds 3 sample agreements (Acme Corp partnership, CloudNet SLA, TechVentures NDA) migrated from the original frontend prototype |

Migrations are idempotent — safe to run multiple times.

---

## Environment Variables (`server/.env`)

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=legalflow
DB_USER=legalflow
DB_PASSWORD=legalflow_dev
JWT_SECRET=legalflow_jwt_secret_change_in_production
JWT_EXPIRES_IN=8h
```

---

## Design System

**Colors**
- Brand: Teal `#1EA99D` (`brand-500`) — primary actions
- Business role: Teal
- Legal role: Amber
- CXO role: Violet
- Admin role: Red

**Typography**
- Font: Inter (Google Fonts), weights 300–700

**Component classes** (defined in `src/index.css`)
- `.lf-input` — standard text/select/textarea input
- `.lf-btn-primary` — primary CTA button (brand teal)
- `.lf-btn-ghost` — secondary/outline button
- `.lf-stat-card` — dashboard stat card with hover lift
- `.lf-req-item` — request list item with hover highlight

**Shadows** (defined in `tailwind.config.js`)
- `shadow-card` — subtle card elevation
- `shadow-modal` — dialog / modal overlay
- `shadow-toast` — notification toast
- `shadow-btn` — button depth

**Animations**
- `animate-fade-in` — opacity 0 → 1
- `animate-scale-in` — scale + fade for modals
- `animate-slide-up` — translate + fade for list items
- `animate-toast-in` — slide up from bottom center
