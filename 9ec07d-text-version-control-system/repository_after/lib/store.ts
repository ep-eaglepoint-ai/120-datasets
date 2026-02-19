import { Page, VersionNode } from './types';
import fs from 'fs';
import path from 'path';

// Using a simple JSON file-based store to simulate a database.
// In a real app, this would be SQLite, Postgres, etc.

const DATA_DIR = path.join(process.cwd(), 'data');
const PAGES_FILE = path.join(DATA_DIR, 'pages.json');
const VERSIONS_FILE = path.join(DATA_DIR, 'versions.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadData<T>(file: string, defaultData: T): T {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    const data = fs.readFileSync(file, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return defaultData;
  }
}

function saveData<T>(file: string, data: T) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
  }
}

export class Store {
  private pages: Page[];
  private versions: VersionNode[];

  constructor() {
    this.pages = loadData<Page[]>(PAGES_FILE, []);
    this.versions = loadData<VersionNode[]>(VERSIONS_FILE, []);
  }

  // Page Operations
  getPages(): Page[] {
    return this.pages;
  }

  getPage(id: string): Page | undefined {
    return this.pages.find(p => p.id === id);
  }

  createPage(page: Page) {
    this.pages.push(page);
    saveData(PAGES_FILE, this.pages);
  }

  // Version Operations
  getVersions(pageId: string): VersionNode[] {
    return this.versions.filter(v => v.pageId === pageId);
  }

  getVersion(id: string): VersionNode | undefined {
    return this.versions.find(v => v.id === id);
  }

  addVersion(version: VersionNode) {
    // Integrity Check: Ensure parents exist
    for (const parentId of version.parentIds) {
      if (!this.versions.find(v => v.id === parentId)) {
        throw new Error(`Parent version ${parentId} not found`);
      }
    }
    this.versions.push(version);
    saveData(VERSIONS_FILE, this.versions);
  }
}

export const db = new Store();
