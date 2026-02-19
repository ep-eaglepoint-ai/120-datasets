import { Pool } from "pg";
import { config } from "../config/env";

const pool = new Pool({
  connectionString: config.dbUrl,
  max: 20,
  idleTimeoutMillis: 30000,
});

export const query = async (text: string, params?: any[]) => {
  try {
    return await pool.query(text, params);
  } catch (error) {
    console.error("Database Query Error", error);
    throw error;
  }
};
