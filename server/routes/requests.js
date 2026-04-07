const router      = require("express").Router();
const pool        = require("../db");
const requireAuth = require("../middleware/auth");

router.use(requireAuth);

// GET /api/requests — list all (with doc count)
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.*,
             u.name  AS created_by_name,
             u.email AS created_by_email,
             COUNT(d.id)::int AS doc_count
      FROM requests r
      JOIN users u ON u.id = r.created_by
      LEFT JOIN documents d ON d.request_id = r.id
      GROUP BY r.id, u.name, u.email
      ORDER BY r.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/requests
router.post("/", async (req, res) => {
  const { title, type, businessUnit, partyA, partyB, detail } = req.body;
  if (!title) return res.status(400).json({ error: "Title is required" });
  try {
    const { rows } = await pool.query(`
      INSERT INTO requests (title, type, business_unit, party_a, party_b, detail, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [title, type || "draft", businessUnit || null, partyA || null, partyB || null, detail || null, req.user.id]);

    await pool.query(`
      INSERT INTO timeline_events (request_id, actor_id, actor_name, actor_role, action, note)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [rows[0].id, req.user.id, req.user.name, req.user.role, "Submitted request", detail || null]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/requests/:id — full detail with docs, timeline, comments
router.get("/:id", async (req, res) => {
  try {
    const { rows: reqRows } = await pool.query(`
      SELECT r.*, u.name AS created_by_name
      FROM requests r JOIN users u ON u.id = r.created_by
      WHERE r.id = $1
    `, [req.params.id]);
    if (!reqRows[0]) return res.status(404).json({ error: "Request not found" });

    const [docs, timeline, comments] = await Promise.all([
      pool.query(`
        SELECT d.*, u.name AS uploaded_by_name,
               ROW_NUMBER() OVER (PARTITION BY d.request_id ORDER BY d.uploaded_at ASC) - 1 AS version
        FROM documents d JOIN users u ON u.id = d.uploaded_by
        WHERE d.request_id = $1 ORDER BY d.uploaded_at ASC
      `, [req.params.id]),
      pool.query(`
        SELECT * FROM timeline_events WHERE request_id = $1 ORDER BY created_at ASC
      `, [req.params.id]),
      pool.query(`
        SELECT * FROM comments WHERE request_id = $1 ORDER BY created_at ASC
      `, [req.params.id]),
    ]);

    // Strip base64 data from list view docs (only include metadata)
    const docsMetadata = docs.rows.map(({ data, ...rest }) => rest);

    res.json({
      ...reqRows[0],
      documents: docsMetadata,
      timeline:  timeline.rows,
      comments:  comments.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/requests/:id
router.put("/:id", async (req, res) => {
  const { status, assignedTo, title, detail, cxoNote } = req.body;
  try {
    const updates = [];
    const values  = [];
    let i = 1;
    if (status)     { updates.push(`status = $${i++}`);      values.push(status); }
    if (assignedTo) { updates.push(`assigned_to = $${i++}`); values.push(assignedTo); }
    if (title)      { updates.push(`title = $${i++}`);       values.push(title); }
    if (detail)     { updates.push(`detail = $${i++}`);      values.push(detail); }
    if (cxoNote !== undefined) { updates.push(`cxo_note = $${i++}`); values.push(cxoNote); }

    if (!updates.length) return res.status(400).json({ error: "Nothing to update" });

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE requests SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: "Request not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
