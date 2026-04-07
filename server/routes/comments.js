const router      = require("express").Router({ mergeParams: true });
const pool        = require("../db");
const requireAuth = require("../middleware/auth");

router.use(requireAuth);

// GET /api/requests/:id/comments
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM comments WHERE request_id = $1 ORDER BY created_at ASC",
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/requests/:id/comments
router.post("/", async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: "Comment body is required" });
  try {
    const { rows } = await pool.query(`
      INSERT INTO comments (request_id, author_id, author_name, body)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [req.params.id, req.user.id, req.user.name, body.trim()]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/requests/:id/comments/:commentId
router.delete("/:commentId", async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM comments WHERE id = $1 AND request_id = $2 AND author_id = $3",
      [req.params.commentId, req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: "Comment not found or not yours" });
    res.json({ message: "Comment deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
