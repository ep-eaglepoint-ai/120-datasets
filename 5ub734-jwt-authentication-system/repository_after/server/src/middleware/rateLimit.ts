import rateLimit from "express-rate-limit";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const xff = req.headers["x-forwarded-for"];
    const ipFromXff = Array.isArray(xff)
      ? xff[0]
      : typeof xff === "string"
      ? xff.split(",")[0]?.trim()
      : undefined;
    return ipFromXff || req.ip || "unknown";
  },
  message: {
    error: "Too many login attempts, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
