import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
} from "../controllers/authController";
import { loginLimiter } from "../middleware/rateLimit";

const router = Router();

router.post("/register", register);
router.post("/login", loginLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
