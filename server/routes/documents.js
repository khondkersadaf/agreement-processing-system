const router      = require("express").Router({ mergeParams: true });
const pool        = require("../db");
const requireAuth = require("../middleware/auth");

router.use(requireAuth);

// GET /api/requests/:id/documents (metadata only, no base64)
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.id, d.request_id, d.name, d.mime_type, d.size_bytes,
             d.uploaded_by, d.uploaded_at, u.name AS uploaded_by_name,
             ROW_NUMBER() OVER (PARTITION BY d.request_id ORDER BY d.uploaded_at ASC) - 1 AS version
      FROM documents d JOIN users u ON u.id = d.uploaded_by
      WHERE d.request_id = $1 ORDER BY d.uploaded_at ASC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/requests/:id/documents/:docId/download (includes base64 data)
router.get("/:docId/download", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM documents WHERE id = $1 AND request_id = $2",
      [req.params.docId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Document not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/requests/:id/documents
router.post("/", async (req, res) => {
  const { name, mimeType, sizeBytes, data, timelineAction, timelineNote } = req.body;
  if (!name || !data) return res.status(400).json({ error: "name and data are required" });
  try {
    const { rows } = await pool.query(`
      INSERT INTO documents (request_id, name, mime_type, size_bytes, data, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, request_id, name, mime_type, size_bytes, uploaded_by, uploaded_at
    `, [req.params.id, name, mimeType || null, sizeBytes || null, data, req.user.id]);

    const action = timelineAction || `Uploaded "${name}"`;
    await pool.query(`
      INSERT INTO timeline_events (request_id, actor_id, actor_name, actor_role, action, note)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [req.params.id, req.user.id, req.user.name, req.user.role, action, timelineNote || null]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/requests/:id/documents/:docId
router.delete("/:docId", async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM documents WHERE id = $1 AND request_id = $2",
      [req.params.docId, req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: "Document not found" });
    res.json({ message: "Document deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
