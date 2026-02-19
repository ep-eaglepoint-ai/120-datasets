"use client";

import { useState, useEffect } from "react";
import { Snapshot, Document, AnalyticsResult } from "@/lib/types";

interface SnapshotManagerProps {
  document: Document;
  analytics: AnalyticsResult | null;
  snapshots: Snapshot[];
  onCreateSnapshot: () => void;
  onRestoreSnapshot: (snapshot: Snapshot) => void;
}

export default function SnapshotManager({
  document,
  analytics,
  snapshots,
  onCreateSnapshot,
  onRestoreSnapshot,
}: SnapshotManagerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(
    null,
  );

  const handleCreateSnapshot = () => {
    if (!analytics) return;
    onCreateSnapshot();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const docSnapshots = snapshots.filter((s) => s.documentId === document.id);

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span>📸</span> Snapshots
          <span className="text-sm font-normal text-gray-500">
            ({docSnapshots.length})
          </span>
        </h3>
        <button className="text-gray-500 hover:text-gray-700">
          {isExpanded ? "▼" : "▶"}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Create snapshot button */}
          <button
            onClick={handleCreateSnapshot}
            disabled={!analytics}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>📷</span> Create Snapshot
          </button>

          {/* Snapshot list */}
          {docSnapshots.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              No snapshots yet. Create one to preserve the current state.
            </p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {docSnapshots
                .sort((a, b) => b.timestamp - a.timestamp)
                .map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className={`border rounded-lg p-3 cursor-pointer transition ${
                      selectedSnapshot?.id === snapshot.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setSelectedSnapshot(snapshot)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {formatDate(snapshot.timestamp)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {snapshot.analytics.wordCount} words •
                          {snapshot.analytics.sentenceCount} sentences
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRestoreSnapshot(snapshot);
                        }}
                        className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Snapshot comparison */}
          {selectedSnapshot && (
            <div className="bg-gray-50 rounded-lg p-3 mt-4">
              <h4 className="text-sm font-semibold mb-2">Snapshot Details</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Words:</span>
                  <span className="ml-1 font-medium">
                    {selectedSnapshot.analytics.wordCount}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Sentences:</span>
                  <span className="ml-1 font-medium">
                    {selectedSnapshot.analytics.sentenceCount}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Sentiment:</span>
                  <span className="ml-1 font-medium">
                    {selectedSnapshot.analytics.sentiment.polarity}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Readability:</span>
                  <span className="ml-1 font-medium">
                    {selectedSnapshot.analytics.readability.fleschReadingEase.toFixed(
                      1,
                    )}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2 truncate">
                Preview: {selectedSnapshot.content.substring(0, 100)}...
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
