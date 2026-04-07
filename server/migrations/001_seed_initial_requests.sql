-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 001: Seed initial requests from local prototype data
-- Migrates the 3 sample agreements that were previously stored in-memory
-- in src/App.js (INITIAL_REQUESTS array)
-- ─────────────────────────────────────────────────────────────────────────────

-- Skip if already run
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM requests WHERE title = 'Vendor partnership agreement — Acme Corp') THEN
    RAISE NOTICE 'Migration 001 already applied, skipping.';
    RETURN;
  END IF;
END $$;

DO $$
DECLARE
  sarah_id  UUID := '652c4206-8779-452a-84b8-f1b0eb29968e';
  rafiq_id  UUID := '8be406de-767b-4da4-9f01-53dc8b7f7cd0';

  req1_id   UUID;
  req2_id   UUID;
  req3_id   UUID;
BEGIN

  -- ── REQ-001: Vendor partnership agreement — Acme Corp ──────────────────────
  INSERT INTO requests (title, type, status, created_by, created_at, updated_at)
  VALUES ('Vendor partnership agreement — Acme Corp', 'draft', 'draft_shared', sarah_id, '2026-03-28 09:00:00+00', '2026-03-31 14:00:00+00')
  RETURNING id INTO req1_id;

  INSERT INTO documents (request_id, name, mime_type, size_bytes, uploaded_by, uploaded_at)
  VALUES (req1_id, 'Acme_Partnership_v1.docx',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          245000, rafiq_id, '2026-03-31 14:00:00+00');

  INSERT INTO timeline_events (request_id, actor_id, actor_name, actor_role, action, note, created_at) VALUES
    (req1_id, sarah_id, 'Sarah Ahmed', 'business', 'Submitted request',  'Requested new vendor partnership agreement for Acme Corp.',        '2026-03-28 09:00:00+00'),
    (req1_id, rafiq_id, 'Rafiq Hasan', 'legal',    'Started review',     'Reviewing partnership terms and compliance requirements.',         '2026-03-29 10:00:00+00'),
    (req1_id, rafiq_id, 'Rafiq Hasan', 'legal',    'Shared draft',       'Initial draft shared for business review.',                       '2026-03-31 14:00:00+00');


  -- ── REQ-002: SLA review — CloudNet services ────────────────────────────────
  -- Note: original "Imran Khan" is not a seeded user; mapped to Sarah Ahmed (business)
  INSERT INTO requests (title, type, status, created_by, created_at, updated_at)
  VALUES ('SLA review — CloudNet services', 'review', 'final_shared', sarah_id, '2026-03-20 09:00:00+00', '2026-03-28 16:00:00+00')
  RETURNING id INTO req2_id;

  INSERT INTO documents (request_id, name, mime_type, size_bytes, uploaded_by, uploaded_at) VALUES
    (req2_id, 'CloudNet_SLA_Client.pdf',     'application/pdf',                                                                                    1200000, sarah_id, '2026-03-20 09:00:00+00'),
    (req2_id, 'CloudNet_SLA_Review_v1.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',                             310000, rafiq_id, '2026-03-23 11:00:00+00'),
    (req2_id, 'CloudNet_SLA_Review_v2.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',                             318000, rafiq_id, '2026-03-26 15:00:00+00'),
    (req2_id, 'CloudNet_SLA_Final.pdf',      'application/pdf',                                                                                     890000, rafiq_id, '2026-03-28 16:00:00+00');

  INSERT INTO timeline_events (request_id, actor_id, actor_name, actor_role, action, note, created_at) VALUES
    (req2_id, sarah_id, 'Sarah Ahmed', 'business', 'Submitted request',    'Submitted CloudNet SLA for legal review.',                        '2026-03-20 09:00:00+00'),
    (req2_id, rafiq_id, 'Rafiq Hasan', 'legal',    'Started review',       'Reviewing SLA terms and liability clauses.',                      '2026-03-21 10:00:00+00'),
    (req2_id, rafiq_id, 'Rafiq Hasan', 'legal',    'Shared draft',         'Marked up version with recommended changes.',                     '2026-03-23 11:00:00+00'),
    (req2_id, sarah_id, 'Sarah Ahmed', 'business', 'Gave feedback',        'Requested softer language on penalty clauses.',                   '2026-03-24 09:00:00+00'),
    (req2_id, rafiq_id, 'Rafiq Hasan', 'legal',    'Shared revised draft', 'Updated penalty clause language.',                               '2026-03-26 15:00:00+00'),
    (req2_id, sarah_id, 'Sarah Ahmed', 'business', 'Approved draft',       'Approved the revised version.',                                  '2026-03-27 10:00:00+00'),
    (req2_id, rafiq_id, 'Rafiq Hasan', 'legal',    'Shared final version', 'Final PDF version shared.',                                      '2026-03-28 16:00:00+00');


  -- ── REQ-003: NDA — TechVentures deal ──────────────────────────────────────
  INSERT INTO requests (title, type, status, cxo_note, created_by, created_at, updated_at)
  VALUES (
    'NDA — TechVentures deal', 'draft', 'cxo_requested',
    'Business requests shorter non-compete period (6 months instead of 12). Legal recommends 12 months.',
    sarah_id, '2026-03-15 09:00:00+00', '2026-03-23 11:00:00+00'
  )
  RETURNING id INTO req3_id;

  INSERT INTO documents (request_id, name, mime_type, size_bytes, uploaded_by, uploaded_at) VALUES
    (req3_id, 'TechVentures_NDA_v1.docx',  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 198000, rafiq_id, '2026-03-18 14:00:00+00'),
    (req3_id, 'TechVentures_NDA_v2.docx',  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 205000, rafiq_id, '2026-03-20 15:00:00+00'),
    (req3_id, 'TechVentures_NDA_Final.pdf', 'application/pdf',                                                         450000, rafiq_id, '2026-03-22 16:00:00+00');

  INSERT INTO timeline_events (request_id, actor_id, actor_name, actor_role, action, note, created_at) VALUES
    (req3_id, sarah_id, 'Sarah Ahmed', 'business', 'Submitted request',    'Requested NDA for TechVentures acquisition discussions.',         '2026-03-15 09:00:00+00'),
    (req3_id, rafiq_id, 'Rafiq Hasan', 'legal',    'Started review',       'Drafting mutual NDA with standard protections.',                  '2026-03-16 10:00:00+00'),
    (req3_id, rafiq_id, 'Rafiq Hasan', 'legal',    'Shared draft',         'Initial NDA draft with 12-month non-compete.',                   '2026-03-18 14:00:00+00'),
    (req3_id, sarah_id, 'Sarah Ahmed', 'business', 'Gave feedback',        'Requesting 6-month non-compete instead.',                        '2026-03-19 09:00:00+00'),
    (req3_id, rafiq_id, 'Rafiq Hasan', 'legal',    'Shared revised draft', 'Kept 12-month as legal recommendation.',                         '2026-03-20 15:00:00+00'),
    (req3_id, sarah_id, 'Sarah Ahmed', 'business', 'Approved draft',       'Approved reluctantly, prefers shorter term.',                    '2026-03-21 10:00:00+00'),
    (req3_id, rafiq_id, 'Rafiq Hasan', 'legal',    'Shared final version', 'Final NDA with 12-month non-compete.',                           '2026-03-22 16:00:00+00'),
    (req3_id, sarah_id, 'Sarah Ahmed', 'business', 'Escalated to CXO',     'Wants 6-month non-compete version instead.',                     '2026-03-23 11:00:00+00');

  RAISE NOTICE 'Migration 001 applied: seeded 3 requests.';
END $$;
