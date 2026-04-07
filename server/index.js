require("dotenv").config();
const express = require("express");
const cors    = require("cors");

const app = express();

app.use(cors({
  origin: "http://localhost:3001",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
app.options(/.*/, cors()); // preflight for all routes (Express 5 compatible)
app.use(express.json({ limit: "20mb" })); // 20mb for base64 file uploads

// Routes
app.use("/api/auth",                         require("./routes/auth"));
app.use("/api/admin",                        require("./routes/admin"));
app.use("/api/requests",                     require("./routes/requests"));
app.use("/api/requests/:id/documents",       require("./routes/documents"));
app.use("/api/requests/:id/timeline",        require("./routes/timeline"));
app.use("/api/requests/:id/comments",        require("./routes/comments"));

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// 404
app.use((req, res) => res.status(404).json({ error: "Not found" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`LegalFlow API running on http://localhost:${PORT}`));
