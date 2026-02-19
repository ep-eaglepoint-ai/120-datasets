import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPoll } from '../api/polls';
import { usePollStore } from '../store/pollStore';
import { CopyLinkButton } from '../components/CopyLinkButton';
import type { CreatePollInput } from '../types';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

/** Req 1: Form with question, 2-10 options (add/remove), optional expiration, show results before/after toggle */
export function CreatePoll() {
  const navigate = useNavigate();
  const addCreatedPoll = usePollStore((s) => s.addCreatedPoll);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [showResultsBeforeVote, setShowResultsBeforeVote] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdPollId, setCreatedPollId] = useState<string | null>(null);

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length <= MIN_OPTIONS) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) {
      setError('Question is required');
      return;
    }
    if (trimmed.length < MIN_OPTIONS) {
      setError('At least 2 options are required');
      return;
    }
    if (trimmed.length > MAX_OPTIONS) {
      setError('Maximum ' + MAX_OPTIONS + ' options allowed');
      return;
    }
    setLoading(true);
    try {
      const input: CreatePollInput = {
        question: question.trim(),
        options: trimmed,
        showResultsBeforeVote,
        expiresAt: expiresAt.trim() || undefined,
      };
      const poll = await createPoll(input);
      addCreatedPoll(poll.pollId);
      setCreatedPollId(poll.pollId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create poll');
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = createdPollId
    ? window.location.origin + '/poll/' + createdPollId
    : '';

  if (createdPollId) {
    return (
      <div className="max-w-lg mx-auto p-6 space-y-4">
        <h2 className="text-xl font-semibold">Poll created</h2>
        <p className="text-gray-600">Share this link:</p>
        <div className="flex gap-2 items-center flex-wrap">
          <input readOnly value={shareUrl} className="flex-1 min-w-0 px-3 py-2 border rounded-lg bg-gray-50 text-sm" />
          <CopyLinkButton url={shareUrl} />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => navigate('/poll/' + createdPollId)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            View poll
          </button>
          <button type="button" onClick={() => navigate('/dashboard')} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Create a poll</h1>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
          <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Your poll question" className="w-full px-3 py-2 border rounded-lg" required />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-700">Options (2 to 10)</label>
            <button type="button" onClick={addOption} disabled={options.length >= MAX_OPTIONS} className="text-sm text-indigo-600 hover:underline">
              + Add
            </button>
          </div>
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input type="text" value={opt} onChange={(e) => updateOption(i, e.target.value)} placeholder={'Option ' + (i + 1)} className="flex-1 px-3 py-2 border rounded-lg" />
              <button type="button" onClick={() => removeOption(i)} disabled={options.length <= MIN_OPTIONS} className="px-3 py-2 border rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50">
                Remove
              </button>
            </div>
          ))}
        </div>
        <div>
          <label htmlFor="expiration" className="block text-sm font-medium text-gray-700 mb-1">Expiration (optional)</label>
          <input id="expiration" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="showBefore" checked={showResultsBeforeVote} onChange={(e) => setShowResultsBeforeVote(e.target.checked)} className="rounded" />
          <label htmlFor="showBefore" className="text-sm text-gray-700">Show results before voting</label>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Creating…' : 'Create poll'}
        </button>
      </form>
    </div>
  );
}
