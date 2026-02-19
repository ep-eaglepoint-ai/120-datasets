"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DagGraph from "@/components/DagGraph";
import { VersionNode, Page } from "@/lib/types";

export default function PageView({ params }: { params: { id: string } }) {
  const [page, setPage] = useState<Page | null>(null);
  const [versions, setVersions] = useState<VersionNode[]>([]);
  const [edges, setEdges] = useState<{ source: string; target: string }[]>([]);

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null
  );
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);

  const [content, setContent] = useState(""); // Current editor content
  const [commitMsg, setCommitMsg] = useState("");

  const [mergeResult, setMergeResult] = useState<any>(null); // To store merge conflict data

  const router = useRouter();

  const fetchData = async () => {
    const res = await fetch(`/api/pages/${params.id}`);
    if (!res.ok) return;
    const data = await res.json();
    setPage(data.page);
    setVersions(data.graph.nodes);
    setEdges(data.graph.edges);

    // Default to latest version if none selected, or the last one in list
    if (!selectedVersionId && data.graph.nodes.length > 0) {
      const last = data.graph.nodes[data.graph.nodes.length - 1];
      setSelectedVersionId(last.id);
      setContent(last.content);
    }
  };

  useEffect(() => {
    fetchData();
  }, [params.id]);

  useEffect(() => {
    if (selectedVersionId) {
      const v = versions.find((n) => n.id === selectedVersionId);
      if (v) setContent(v.content);
      setMergeResult(null); // Clear merge state when switching versions
    }
  }, [selectedVersionId, versions]);

  const handleSave = async () => {
    // Branching off selectedVersionId
    if (!selectedVersionId && versions.length > 0) return; // Must have parent if versions exist

    const parentIds = selectedVersionId ? [selectedVersionId] : [];

    // If this is the VERY first version?
    // logic above handles getting existing versions. If empty, parentIds = []

    await fetch("/api/versions", {
      method: "POST",
      body: JSON.stringify({
        pageId: params.id,
        content,
        parentIds: versions.length === 0 ? [] : parentIds,
        message: commitMsg || `Update from ${selectedVersionId?.slice(0, 6)}`,
      }),
    });

    setCommitMsg("");
    fetchData(); // Refresh graph
  };

  const attemptMerge = async () => {
    if (!selectedVersionId || !compareVersionId) return;

    const res = await fetch("/api/merge", {
      method: "POST",
      body: JSON.stringify({
        versionAId: selectedVersionId,
        versionBId: compareVersionId,
      }),
    });
    const result = await res.json();

    if (result.success) {
      // Auto-merged! Setup editor with merged content to allow user to Commit it
      setContent(result.content);
      setCommitMsg(
        `Merge ${compareVersionId.slice(0, 6)} into ${selectedVersionId.slice(
          0,
          6
        )}`
      );
      // We are essentially in a "Draft Merge" state.
      // The parent IDs for the new save should be BOTH.
      // We need to store this state "Merging A and B".
      setMergeResult({
        active: true,
        parents: [selectedVersionId, compareVersionId],
        conflict: false,
      });
      alert("Auto-merge successful! Review and click 'Commit Merge' to save.");
    } else if (result.conflict) {
      // Conflict!
      // For this UI, we just show the user "Conflict detected".
      // In a real app we'd show the 3-pane editor.
      // Here we just let them manually fix the content in the editor (which currently is just showing Version A).
      // A better UX: Set content to A, but show B in a side panel?
      // Or inject markers `<<<<<<<`?

      // Let's inject markers if the server didn't returns content with markers?
      // My server implementation returned empty string for conflict!
      // That's bad. Let's fix client side behavior:

      // We will just fetch content of B and let user edit.
      const vB = versions.find((v) => v.id === compareVersionId);
      const textB = vB ? vB.content : "";

      setContent(
        `<<<<<<< HEAD (${selectedVersionId})\n${content}\n=======\n${textB}\n>>>>>>> MERGE (${compareVersionId})`
      );

      setMergeResult({
        active: true,
        parents: [selectedVersionId, compareVersionId],
        conflict: true,
      });
      setCommitMsg(
        `Merge (Conflict Resolved) ${compareVersionId.slice(
          0,
          6
        )} into ${selectedVersionId.slice(0, 6)}`
      );
      alert("Conflict detected! Please resolve in the editor.");
    }
  };

  const commitMerge = async () => {
    if (!mergeResult || !mergeResult.active) return;

    await fetch("/api/versions", {
      method: "POST",
      body: JSON.stringify({
        pageId: params.id,
        content, // The manually resolved content
        parentIds: mergeResult.parents,
        message: commitMsg,
      }),
    });

    setMergeResult(null);
    setCompareVersionId(null);
    setCommitMsg("");
    fetchData();
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar: Graph & History */}
      <div className="w-1/3 border-r bg-white p-4 flex flex-col overflow-y-auto">
        <div className="mb-4">
          <button
            onClick={() => router.push("/")}
            className="text-blue-500 hover:underline mb-2"
          >
            &larr; Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold">{page?.title}</h1>
          <p className="text-sm text-gray-500">{params.id}</p>
        </div>

        <div className="mb-4">
          <h3 className="font-semibold mb-2">History Graph</h3>
          <DagGraph
            versions={versions}
            edges={edges}
            onNodeClick={setSelectedVersionId}
            selectedNodeId={selectedVersionId || undefined}
          />
          <p className="text-xs text-gray-400 mt-1">
            Click a node to fork/edit from it.
          </p>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-semibold mb-2">Merge Operations</h3>
          {selectedVersionId && (
            <div className="bg-blue-50 p-3 rounded">
              <p className="text-sm">
                Current HEAD: <b>{selectedVersionId.slice(0, 8)}</b>
              </p>
              <div className="mt-2">
                <label className="block text-xs font-bold mb-1">
                  Merge With:
                </label>
                <select
                  className="w-full text-sm p-1 border rounded"
                  onChange={(e) => setCompareVersionId(e.target.value)}
                  value={compareVersionId || ""}
                >
                  <option value="">Select a version...</option>
                  {versions
                    .filter((v) => v.id !== selectedVersionId) // Don't merge with self
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.message.slice(0, 20)} ({v.id.slice(0, 6)})
                      </option>
                    ))}
                </select>
              </div>
              <button
                onClick={attemptMerge}
                disabled={!compareVersionId}
                className="mt-2 w-full bg-purple-600 text-white text-sm py-1 rounded disabled:opacity-50"
              >
                Attempt Merge
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Area: Editor / Viewer */}
      <div className="flex-1 p-6 flex flex-col">
        <div className="bg-white rounded-lg shadow h-full flex flex-col">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
            <h2 className="font-bold text-lg">
              {mergeResult?.active
                ? "Resolving Merge"
                : `Editing Version: ${
                    selectedVersionId?.slice(0, 8) || "Root"
                  }`}
            </h2>
            {mergeResult?.active && (
              <span className="text-xs bg-yellow-200 px-2 py-1 rounded text-yellow-800 font-bold">
                MERGE IN PROGRESS
              </span>
            )}
          </div>

          <textarea
            className="flex-1 p-4 font-mono text-sm resize-none focus:outline-none text-black bg-white"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start typing your wiki content..."
          />

          <div className="p-4 border-t bg-gray-50 rounded-b-lg flex gap-4 items-center">
            <input
              type="text"
              className="flex-1 border p-2 rounded text-sm"
              placeholder="Commit message..."
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
            />

            {mergeResult?.active ? (
              <button
                onClick={commitMerge}
                className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 font-bold"
              >
                Commit Merge
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 font-bold"
              >
                Save New Version
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
