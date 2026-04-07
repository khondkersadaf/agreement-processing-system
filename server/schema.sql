-- ─────────────────────────────────────────────────────────────────────────────
-- LegalFlow Database Schema
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role   AS ENUM ('admin', 'business', 'legal', 'cxo');
CREATE TYPE req_type    AS ENUM ('draft', 'review');
CREATE TYPE req_status  AS ENUM (
  'pending',
  'in_review',
  'draft_shared',
  'feedback_given',
  'revised',
  'final_shared',
  'accepted',
  'cxo_requested',
  'cxo_approved',
  'cxo_rejected',
  'signed',
  'completed'
);

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          user_role   NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Requests ──────────────────────────────────────────────────────────────────
CREATE TABLE requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  seq           SERIAL      UNIQUE,
  title         TEXT        NOT NULL,
  type          req_type    NOT NULL DEFAULT 'draft',
  status        req_status  NOT NULL DEFAULT 'pending',
  business_unit TEXT,
  party_a       TEXT,
  party_b       TEXT,
  detail        TEXT,
  cxo_note      TEXT,
  created_by    UUID        NOT NULL REFERENCES users(id),
  assigned_to   UUID        REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Documents ─────────────────────────────────────────────────────────────────
CREATE TABLE documents (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    UUID        NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  mime_type     TEXT,
  size_bytes    INTEGER,
  data          TEXT,        -- base64 encoded file (for prototype; use object storage in prod)
  uploaded_by   UUID        NOT NULL REFERENCES users(id),
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Timeline Events ───────────────────────────────────────────────────────────
CREATE TABLE timeline_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    UUID        NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  actor_id      UUID        NOT NULL REFERENCES users(id),
  actor_name    TEXT        NOT NULL,
  actor_role    user_role,
  action        TEXT        NOT NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Comments ──────────────────────────────────────────────────────────────────
CREATE TABLE comments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    UUID        NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  author_id     UUID        NOT NULL REFERENCES users(id),
  author_name   TEXT        NOT NULL,
  body          TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER requests_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_requests_created_by  ON requests(created_by);
CREATE INDEX idx_requests_status      ON requests(status);
CREATE INDEX idx_documents_request    ON documents(request_id);
CREATE INDEX idx_timeline_request     ON timeline_events(request_id);
CREATE INDEX idx_comments_request     ON comments(request_id);

-- ── Seed users ────────────────────────────────────────────────────────────────
-- Passwords match credentials.js (hashed with bcrypt cost 10)
-- Passwords: admin123, business123, legal123, cxo123 (bcrypt cost 10)
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Admin',           'admin@legalflow.com',  '$2b$10$fuhzq/fMWnTSMh36jF2biulbaKDIKVQidRetDfSff8wbc2HORpSTe', 'admin'),
  ('Sarah Ahmed',     'sarah@legalflow.com',  '$2b$10$/dhQv4r1ogdRPxiY/QLUQ.qTVoSeuBpyJe64qK12QNX4YGIJf2b0m', 'business'),
  ('Rafiq Hasan',     'rafiq@legalflow.com',  '$2b$10$TjwAcKn69hfNwAUfKzQOgOjlBuOqifdSqunHU76Pez6hrKirgESUe', 'legal'),
  ('Nadia Chowdhury', 'nadia@legalflow.com',  '$2b$10$iUbqx9sg8Gl0ZUTmUZkLUeBJ3ndZncO1PzFVoTGjP/lTr5GIx14Sy', 'cxo');
