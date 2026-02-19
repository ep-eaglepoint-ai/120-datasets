import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(
    token,
    config.jwt.publicKey,
    { algorithms: ["RS256"] },
    (err, decoded) => {
      if (err) return res.sendStatus(403);
      req.user = decoded;
      next();
    }
  );
};
