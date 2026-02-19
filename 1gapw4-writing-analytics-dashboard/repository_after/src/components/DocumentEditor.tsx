"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

export default function DocumentEditor() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [project, setProject] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");

  const { addDocument, loading } = useStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || content.length === 0) {
      alert("Please enter both title and content");
      return;
    }

    await addDocument({
      title: title.trim(),
      content,
      project: project.trim() || undefined,
      category: category.trim() || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t),
    });

    setTitle("");
    setContent("");
    setProject("");
    setCategory("");
    setTags("");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setContent(text);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4">Write or Import Document</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter document title"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project
            </label>
            <input
              type="text"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tag1, tag2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Content *
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            placeholder="Start writing or import a text file..."
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : "Save Document"}
          </button>

          <label className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer">
            Import Text File
            <input
              type="file"
              accept=".txt,.md,.text"
              onChange={handleImport}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setTitle("");
              setContent("");
              setProject("");
              setCategory("");
              setTags("");
            }}
            className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Clear
          </button>
        </div>

        {content && (
          <div className="text-sm text-gray-600">
            {content.split(/\s+/).filter((w) => w).length} words,{" "}
            {content.length} characters
          </div>
        )}
      </form>
    </div>
  );
}
