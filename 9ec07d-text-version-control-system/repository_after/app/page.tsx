"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Page {
  id: string;
  title: string;
}

export default function Home() {
  const [pages, setPages] = useState<Page[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/pages')
      .then(res => res.json())
      .then(data => setPages(Array.isArray(data) ? data : []));
  }, []);

  const createPage = async () => {
    if (!newTitle.trim()) return;
    const res = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle })
    });
    const page = await res.json();
    router.push(`/pages/${page.id}`);
  };

  return (
    <main className="min-h-screen text-gray-800 bg-gray-50 flex flex-col items-center p-10">
      <h1 className="text-4xl font-bold mb-10 text-blue-600">Prose Git Wiki</h1>
      
      <div className="w-full max-w-2xl bg-white p-6 rounded-lg shadow-md mb-10">
        <h2 className="text-xl font-semibold mb-4">Create New Page</h2>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 border p-2 rounded"
            placeholder="Page Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button 
            onClick={createPage}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create
          </button>
        </div>
      </div>

      <div className="w-full max-w-2xl">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Existing Pages</h2>
        <div className="grid gap-4">
          {pages.map(page => (
            <Link key={page.id} href={`/pages/${page.id}`} className="block">
              <div className="bg-white p-4 rounded shadow hover:shadow-md transition border-l-4 border-blue-400">
                <h3 className="text-xl font-bold">{page.title}</h3>
                <p className="text-gray-400 text-sm">ID: {page.id}</p>
              </div>
            </Link>
          ))}
          {pages.length === 0 && <p className="text-gray-500">No pages yet.</p>}
        </div>
      </div>
    </main>
  );
}
