import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getPoll, vote as voteApi } from '../api/polls';
import { usePollStore, hasVoted, setVoted, getOrCreateVoteToken } from '../store/pollStore';
import { ResultsSummary } from '../components/ResultsSummary';
import { CopyLinkButton } from '../components/CopyLinkButton';

/** Req 2 and 3: Voting page, question and options, select one and submit; localStorage duplicate prevention; confirmation */
export function VotePoll() {
  const { pollId } = useParams<{ pollId: string }>();
  const { poll, setPoll, updatePoll } = usePollStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justVoted, setJustVoted] = useState(false);
  const voted = pollId ? hasVoted(pollId) : false;

  useEffect(() => {
    if (!pollId) return;
    getPoll(pollId)
      .then((p) => {
        setPoll(p);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load poll'))
      .finally(() => setLoading(false));
  }, [pollId, setPoll]);

  useEffect(() => {
    if (!pollId || !poll) return;
    const socket = io(window.location.origin, { path: '/socket.io' });
    socket.emit('join-poll', pollId);
    socket.on('poll-updated', (updated: typeof poll) => {
      updatePoll(updated);
    });
    return () => {
      socket.off('poll-updated');
      socket.close();
    };
  }, [pollId, poll?.pollId, updatePoll]);

  const handleVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pollId || !selectedOptionId) return;
    setSubmitting(true);
    setError('');
    try {
      const token = getOrCreateVoteToken(pollId);
      const updated = await voteApi(pollId, selectedOptionId, token);
      setVoted(pollId);
      setPoll(updated);
      setJustVoted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to vote');
    } finally {
      setSubmitting(false);
    }
  };

  const canShowResults = poll?.showResultsBeforeVote || voted || justVoted;
  const basePath = window.location.pathname.replace(/\/poll\/.*/, '') || '';
  const shareUrl = pollId ? window.location.origin + basePath + '/poll/' + pollId : '';

  if (loading) return <div className="max-w-lg mx-auto p-6">Loading…</div>;
  if (error && !poll) return <div className="max-w-lg mx-auto p-6 text-red-600">{error}</div>;
  if (!poll) return null;

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">{poll.question}</h1>
      <div className="flex gap-2 items-center">
        <span className="text-sm text-gray-500">Share:</span>
        <CopyLinkButton url={shareUrl} />
      </div>

      {canShowResults ? (
        <>
          {justVoted && <p className="text-green-600 font-medium">Thanks! Your vote has been recorded.</p>}
          {voted && !justVoted && <p className="text-gray-600">You have already voted.</p>}
          <ResultsSummary poll={poll} />
        </>
      ) : (
        <form onSubmit={handleVote} className="space-y-3">
          {poll.options.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="option"
                value={opt.id}
                checked={selectedOptionId === opt.id}
                onChange={() => setSelectedOptionId(opt.id)}
                className="w-4 h-4"
              />
              <span>{opt.text}</span>
            </label>
          ))}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={!selectedOptionId || submitting}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit vote'}
          </button>
        </form>
      )}
    </div>
  );
}
