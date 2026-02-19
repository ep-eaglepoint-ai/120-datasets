'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Annotation } from '@/lib/types';

interface AnnotationManagerProps {
  documentId: string;
}

export default function AnnotationManager({ documentId }: AnnotationManagerProps) {
  const { annotations, addAnnotation } = useStore();
  const [newAnnotation, setNewAnnotation] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const docAnnotations = annotations.get(documentId) || [];

  const handleAddAnnotation = async () => {
    if (!newAnnotation.trim()) return;
    await addAnnotation(documentId, newAnnotation.trim());
    setNewAnnotation('');
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div 
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span>📝</span> Annotations
          <span className="text-sm font-normal text-gray-500">
            ({docAnnotations.length})
          </span>
        </h3>
        <button className="text-gray-500 hover:text-gray-700">
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Add new annotation */}
          <div className="flex gap-2">
            <textarea
              value={newAnnotation}
              onChange={(e) => setNewAnnotation(e.target.value)}
              placeholder="Add a note or insight about this document..."
              className="flex-1 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
            />
            <button
              onClick={handleAddAnnotation}
              disabled={!newAnnotation.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed self-end"
            >
              Add
            </button>
          </div>

          {/* Annotation list */}
          {docAnnotations.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              No annotations yet. Add your first note above.
            </p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {docAnnotations
                .sort((a, b) => b.timestamp - a.timestamp)
                .map((annotation) => (
                  <div
                    key={annotation.id}
                    className="bg-yellow-50 border border-yellow-200 rounded-lg p-3"
                  >
                    <p className="text-gray-800 text-sm">{annotation.content}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {formatDate(annotation.timestamp)}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
