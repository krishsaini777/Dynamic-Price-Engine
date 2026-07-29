const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDB = require("./src/config/db");

dotenv.config();

const app = express();

// ── CORS — production whitelist ────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "https://dynamic-pricing-frontend-theta.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// ── Security Headers ───────────────────────────────────
app.use(helmet());

// ── Rate Limiting (Global API protection) ──────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests from this IP, please try again after 15 minutes." }
});
app.use("/api", apiLimiter);

app.use(express.json());

// ── Health check (BEFORE all routes — Render uses this) ─
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// ── Route imports ──────────────────────────────────────
const authRoutes = require("./src/routes/authRoutes");
const productRoutes = require("./src/routes/productRoutes");
const inventoryRoutes = require("./src/routes/inventoryRoutes");
const competitorRoutes = require("./src/routes/competitorRoutes");
const pricingRoutes = require("./src/routes/pricingRoutes");
const salesRoutes = require("./src/routes/salesRoutes");
const eventRoutes = require("./src/routes/eventRoutes");
const settingsRoutes = require("./src/routes/settingsRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const analyticsRoutes = require("./src/routes/analyticsRoutes");
const { protect } = require("./src/middleware/auth");

// ── Mount routes ───────────────────────────────────────
// Auth routes — public (no protect middleware)
app.use("/api/v1/auth", authRoutes);

// All business routes — protected (Firebase ID token required)
app.use("/api/v1/products", protect, productRoutes);
app.use("/api/v1/inventory", protect, inventoryRoutes);
app.use("/api/v1/competitors", protect, competitorRoutes);
app.use("/api/v1/pricing", protect, pricingRoutes);
app.use("/api/v1/sales", protect, salesRoutes);
app.use("/api/v1/events", protect, eventRoutes);
app.use("/api/v1/settings", protect, settingsRoutes);
app.use("/api/v1/dashboard", protect, dashboardRoutes);
app.use("/api/v1/analytics", protect, analyticsRoutes);

// ── Error handler ──────────────────────────────────────
const errorHandler = require("./src/middleware/errorHandler");
app.use(errorHandler);

// ── Start server ───────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();

  // Start background scheduler after DB connects — must not crash the server
  const { startScheduler } = require("./src/services/scheduler");
  startScheduler().catch((err) =>
    console.error("[Scheduler] Failed to start:", err.message),
  );

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
