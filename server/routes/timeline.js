const router      = require("express").Router({ mergeParams: true });
const pool        = require("../db");
const requireAuth = require("../middleware/auth");

router.use(requireAuth);

// GET /api/requests/:id/timeline
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM timeline_events WHERE request_id = $1 ORDER BY created_at ASC",
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/requests/:id/timeline
router.post("/", async (req, res) => {
  const { action, note } = req.body;
  if (!action) return res.status(400).json({ error: "action is required" });
  try {
    const { rows } = await pool.query(`
      INSERT INTO timeline_events (request_id, actor_id, actor_name, actor_role, action, note)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [req.params.id, req.user.id, req.user.name, req.user.role, action, note || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
