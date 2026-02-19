'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Document } from '@/lib/types';
import { useVirtualization } from '@/lib/useVirtualization';

const ITEM_HEIGHT = 120; // Height of each document item in pixels
const CONTAINER_HEIGHT = 384; // max-h-96 = 24rem = 384px

export default function DocumentList() {
  const { documents, loadDocuments, setCurrentDocument, deleteDocument, analytics } = useStore();
  const [filter, setFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'length'>('date');

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const filteredDocs = documents
    .filter(doc => {
      if (filter && !doc.title.toLowerCase().includes(filter.toLowerCase()) && 
          !doc.content.toLowerCase().includes(filter.toLowerCase())) {
        return false;
      }
      if (projectFilter && doc.project !== projectFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date') return b.createdAt - a.createdAt;
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'length') return b.content.length - a.content.length;
      return 0;
    });

  const projects = Array.from(new Set(documents.map(d => d.project).filter(Boolean)));

  // Use virtualization for large document lists
  const { containerRef, visibleItems, totalHeight, offsetY, handleScroll } = useVirtualization(
    filteredDocs,
    { itemHeight: ITEM_HEIGHT, containerHeight: CONTAINER_HEIGHT }
  );

  const renderDocumentItem = (doc: Document) => {
    const docAnalytics = analytics.get(doc.id);
    return (
      <div
        key={doc.id}
        className="border border-gray-200 rounded-md p-4 hover:bg-gray-50 cursor-pointer transition"
        style={{ height: `${ITEM_HEIGHT}px` }}
        onClick={() => setCurrentDocument(doc)}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{doc.title}</h3>
            <p className="text-sm text-gray-600 line-clamp-2">{doc.content.substring(0, 100)}...</p>
            
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span>{docAnalytics?.wordCount || 0} words</span>
              <span>{docAnalytics?.sentenceCount || 0} sentences</span>
              {doc.project && <span className="text-blue-600">📁 {doc.project}</span>}
              {doc.category && <span className="text-purple-600">🏷️ {doc.category}</span>}
            </div>

            {doc.tags && doc.tags.length > 0 && (
              <div className="flex gap-1 mt-2">
                {doc.tags.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this document?')) {
                deleteDocument(doc.id);
              }
            }}
            className="ml-4 text-red-600 hover:text-red-800"
          >
            🗑️
          </button>
        </div>

        <div className="text-xs text-gray-400 mt-2">
          {new Date(doc.createdAt).toLocaleDateString()}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4">Documents ({documents.length})</h2>

      <div className="mb-4 space-y-2">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search documents..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex gap-2">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Projects</option>
            {projects.map(project => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date">Sort by Date</option>
            <option value="title">Sort by Title</option>
            <option value="length">Sort by Length</option>
          </select>
        </div>
      </div>

      {/* Virtualized list container */}
      <div 
        ref={containerRef}
        className="relative max-h-96 overflow-y-auto"
        onScroll={handleScroll}
      >
        {filteredDocs.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No documents found. Create your first document above!</p>
        ) : (
          <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
            <div style={{ transform: `translateY(${offsetY}px)` }}>
              {visibleItems.map(({ item }) => renderDocumentItem(item))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
