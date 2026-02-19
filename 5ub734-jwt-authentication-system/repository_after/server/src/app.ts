import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import authRoutes from "./routes/authRoutes";
import { authenticateToken } from "./middleware/auth";
import { config } from "./config/env";

const app = express();

app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);

// Protected Test Route
app.get("/api/protected", authenticateToken, (req, res) => {
  res.json({ message: "Secure data access granted", user: req.user });
});

export default app;
