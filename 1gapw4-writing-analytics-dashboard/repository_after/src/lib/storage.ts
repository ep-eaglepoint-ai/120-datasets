import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Document, AnalyticsResult, Annotation, Snapshot, DocumentSchema, AnalyticsResultSchema, AnnotationSchema, SnapshotSchema } from './types';

interface WritingAnalyticsDB extends DBSchema {
  documents: {
    key: string;
    value: Document;
    indexes: { 'by-project': string; 'by-date': number };
  };
  analytics: {
    key: string;
    value: AnalyticsResult;
    indexes: { 'by-document': string; 'by-date': number };
  };
  annotations: {
    key: string;
    value: Annotation;
    indexes: { 'by-document': string };
  };
  snapshots: {
    key: string;
    value: Snapshot;
    indexes: { 'by-document': string; 'by-date': number };
  };
}

let dbInstance: IDBPDatabase<WritingAnalyticsDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<WritingAnalyticsDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<WritingAnalyticsDB>('writing-analytics', 1, {
    upgrade(db) {
      const docStore = db.createObjectStore('documents', { keyPath: 'id' });
      docStore.createIndex('by-project', 'project');
      docStore.createIndex('by-date', 'createdAt');

      const analyticsStore = db.createObjectStore('analytics', { keyPath: 'documentId' });
      analyticsStore.createIndex('by-document', 'documentId');
      analyticsStore.createIndex('by-date', 'timestamp');

      const annotationsStore = db.createObjectStore('annotations', { keyPath: 'id' });
      annotationsStore.createIndex('by-document', 'documentId');

      const snapshotsStore = db.createObjectStore('snapshots', { keyPath: 'id' });
      snapshotsStore.createIndex('by-document', 'documentId');
      snapshotsStore.createIndex('by-date', 'timestamp');
    },
  });

  return dbInstance;
}

export async function saveDocument(doc: Document): Promise<void> {
  const validated = DocumentSchema.parse(doc);
  const db = await getDB();
  await db.put('documents', validated);
}

export async function getDocument(id: string): Promise<Document | undefined> {
  const db = await getDB();
  return await db.get('documents', id);
}

export async function getAllDocuments(): Promise<Document[]> {
  const db = await getDB();
  return await db.getAll('documents');
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('documents', id);
}

export async function saveAnalytics(analytics: AnalyticsResult): Promise<void> {
  const validated = AnalyticsResultSchema.parse(analytics);
  const db = await getDB();
  await db.put('analytics', validated);
}

export async function getAnalytics(documentId: string): Promise<AnalyticsResult | undefined> {
  const db = await getDB();
  return await db.get('analytics', documentId);
}

export async function getAllAnalytics(): Promise<AnalyticsResult[]> {
  const db = await getDB();
  return await db.getAll('analytics');
}

export async function saveAnnotation(annotation: Annotation): Promise<void> {
  const validated = AnnotationSchema.parse(annotation);
  const db = await getDB();
  await db.put('annotations', validated);
}

export async function getAnnotationsByDocument(documentId: string): Promise<Annotation[]> {
  const db = await getDB();
  return await db.getAllFromIndex('annotations', 'by-document', documentId);
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  const validated = SnapshotSchema.parse(snapshot);
  const db = await getDB();
  await db.put('snapshots', validated);
}

export async function getSnapshotsByDocument(documentId: string): Promise<Snapshot[]> {
  const db = await getDB();
  return await db.getAllFromIndex('snapshots', 'by-document', documentId);
}

export async function exportAllData(): Promise<{
  documents: Document[];
  analytics: AnalyticsResult[];
  annotations: Annotation[];
  snapshots: Snapshot[];
}> {
  const db = await getDB();
  
  const [documents, analytics, annotations, snapshots] = await Promise.all([
    db.getAll('documents'),
    db.getAll('analytics'),
    db.getAll('annotations'),
    db.getAll('snapshots'),
  ]);

  return { documents, analytics, annotations, snapshots };
}
