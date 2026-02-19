import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { CreatePoll } from './pages/CreatePoll';
import { VotePoll } from './pages/VotePoll';
import { Dashboard } from './pages/Dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <nav className="border-b bg-white px-4 py-3 flex gap-4">
        <Link to="/" className="text-indigo-600 font-medium">Home</Link>
        <Link to="/create" className="text-gray-600 hover:text-indigo-600">Create poll</Link>
        <Link to="/dashboard" className="text-gray-600 hover:text-indigo-600">Dashboard</Link>
      </nav>
      <main className="min-h-screen bg-gray-50 py-6">
        <Routes>
          <Route path="/" element={<div className="max-w-lg mx-auto p-6 text-center"><p className="text-gray-600">Create a poll or open a shared link to vote.</p><Link to="/create" className="text-indigo-600 hover:underline">Create poll</Link></div>} />
          <Route path="/create" element={<CreatePoll />} />
          <Route path="/poll/:pollId" element={<VotePoll />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
