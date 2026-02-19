import { selectWinningTicketId } from '../repository_after/server/raffleService';

/**
 * REQ-8: Winner selection unit test — mock pool of 10 tickets; 1,000 simulated
 *        draws; distribution within acceptable statistical margin; never selects
 *        ID outside the participating pool.
 */
describe('Winner selection fairness (selectWinningTicketId)', () => {
  const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('always returns an ID from the pool', () => {
    for (let i = 0; i < 1000; i++) {
      const id = selectWinningTicketId(pool);
      expect(pool).toContain(id);
    }
  });

  it('never returns an ID outside the pool (REQ-8)', () => {
    const set = new Set(pool);
    for (let i = 0; i < 1000; i++) {
      const id = selectWinningTicketId(pool);
      expect(set.has(id)).toBe(true);
    }
  });

  it('distribution over 1000 draws is statistically reasonable (REQ-8)', () => {
    const counts: Record<number, number> = {};
    pool.forEach((id) => (counts[id] = 0));
    for (let i = 0; i < 1000; i++) {
      const id = selectWinningTicketId(pool);
      counts[id]++;
    }
    const expected = 1000 / 10;
    const margin = 80;
    pool.forEach((id) => {
      expect(counts[id]).toBeGreaterThanOrEqual(expected - margin);
      expect(counts[id]).toBeLessThanOrEqual(expected + margin);
    });
  });

  it('throws when pool is empty', () => {
    expect(() => selectWinningTicketId([])).toThrow();
  });
});
