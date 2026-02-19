import { DateTime } from "luxon";
import * as fs from "fs";
import * as path from "path";

// Get repository path from environment
const REPO_PATH = process.env.REPO_PATH || "repository_after";

// Mock database for testing
export class MockDatabase {
  private tables: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    this.initializeTables();
  }

  private initializeTables() {
    this.tables.set("users", []);
    this.tables.set("roles", []);
    this.tables.set("permissions", []);
    this.tables.set("role_hierarchy", []);
    this.tables.set("role_permissions", []);
    this.tables.set("user_roles", []);
  }

  insert(table: string, data: any): any {
    const tableData = this.tables.get(table) || [];
    const record = {
      id: this.nextId++,
      ...data,
      created_at: DateTime.now(),
      updated_at: DateTime.now(),
    };
    tableData.push(record);
    this.tables.set(table, tableData);
    return record;
  }

  find(table: string, conditions: any = {}): any[] {
    const tableData = this.tables.get(table) || [];
    return tableData.filter((record) => {
      return Object.keys(conditions).every(
        (key) => record[key] === conditions[key],
      );
    });
  }

  findOne(table: string, conditions: any = {}): any | null {
    const results = this.find(table, conditions);
    return results[0] || null;
  }

  update(table: string, conditions: any, updates: any): number {
    const tableData = this.tables.get(table) || [];
    let updatedCount = 0;

    tableData.forEach((record) => {
      const matches = Object.keys(conditions).every(
        (key) => record[key] === conditions[key],
      );
      if (matches) {
        Object.assign(record, updates, { updated_at: DateTime.now() });
        updatedCount++;
      }
    });

    return updatedCount;
  }

  delete(table: string, conditions: any): number {
    const tableData = this.tables.get(table) || [];
    const initialLength = tableData.length;

    const filtered = tableData.filter((record) => {
      return !Object.keys(conditions).every(
        (key) => record[key] === conditions[key],
      );
    });

    this.tables.set(table, filtered);
    return initialLength - filtered.length;
  }

  clear(table?: string) {
    if (table) {
      this.tables.set(table, []);
    } else {
      this.initializeTables();
    }
  }

  getTable(table: string): any[] {
    return this.tables.get(table) || [];
  }
}

// Global test database instance
export const testDb = new MockDatabase();

// Helper to check if file exists in current repository
export function fileExistsInRepo(relativePath: string): boolean {
  const fullPath = path.join(process.cwd(), REPO_PATH, relativePath);
  return fs.existsSync(fullPath);
}

// Helper to read file content from current repository
export function readFileFromRepo(relativePath: string): string {
  const fullPath = path.join(process.cwd(), REPO_PATH, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, "utf8");
}

// Mock DateTime.now() for deterministic tests
const FIXED_TIME = DateTime.fromISO("2024-01-15T10:00:00.000Z");
jest
  .spyOn(DateTime, "now")
  .mockReturnValue(FIXED_TIME as unknown as DateTime<true>);

beforeEach(() => {
  testDb.clear();
});
