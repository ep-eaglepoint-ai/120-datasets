import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePollStore } from '../store/pollStore';
import { getPoll, closePoll } from '../api/polls';
import type { Poll } from '../types';

/** Req 5: Dashboard with created polls (localStorage), detailed results, close poll */
export function Dashboard() {
  const { createdPollIds, loadCreatedPollIds } = usePollStore();
  const [polls, setPolls] = useState<Record<string, Poll | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCreatedPollIds();
  }, [loadCreatedPollIds]);

  useEffect(() => {
    const ids = createdPollIds;
    if (ids.length === 0) {
      setLoading(false);
      return;
    }
    let done = 0;
    const next: Record<string, Poll | null> = {};
    ids.forEach((id) => {
      getPoll(id)
        .then((p) => { next[id] = p; })
        .catch(() => { next[id] = null; })
        .finally(() => {
          done++;
          if (done === ids.length) {
            setPolls(next);
            setLoading(false);
          }
        });
    });
  }, [createdPollIds.join(',')]);

  const handleClose = async (pollId: string) => {
    try {
      const updated = await closePoll(pollId);
      setPolls((prev) => ({ ...prev, [pollId]: updated }));
    } catch {
      // keep UI as is
    }
  };

  const status = (p: Poll | null): string => {
    if (!p) return 'Unknown';
    if (p.isClosed) return 'Closed';
    if (p.expiresAt && new Date(p.expiresAt) < new Date()) return 'Expired';
    return 'Open';
  };

  if (loading) return <div className="max-w-2xl mx-auto p-6">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">My polls</h1>
      {createdPollIds.length === 0 ? (
        <p className="text-gray-600">You have not created any polls yet. <Link to="/create" className="text-indigo-600 hover:underline">Create one</Link>.</p>
      ) : (
        <ul className="space-y-4">
          {createdPollIds.map((id) => {
            const poll = polls[id];
            const st = status(poll);
            return (
              <li key={id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{poll?.question ?? id}</p>
                    <p className="text-sm text-gray-500">Status: {st} · Total votes: {poll?.totalVotes ?? '—'}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link
                      to={`/poll/${id}`}
                      className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                    >
                      View results
                    </Link>
                    {st === 'Open' && (
                      <button
                        type="button"
                        onClick={() => handleClose(id)}
                        className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                      >
                        Close poll
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-6">
        <Link to="/create" className="text-indigo-600 hover:underline">Create new poll</Link>
      </div>
    </div>
  );
}
