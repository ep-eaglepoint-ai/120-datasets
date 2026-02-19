import React, { useState, useEffect, useCallback } from 'react';
import { Song } from '../types/song';
import { fetchSongs } from '../services/songService';

const SongList: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadSongs = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSongs(signal);
      const limitedSongs = data.slice(0, 100);
      setSongs(limitedSongs);
    } catch (err: any) {
      if (!signal.aborted) {
        setError(err.message || 'Failed to load songs');
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadSongs(controller.signal);
    
    return () => {
      controller.abort();
    };
  }, [loadSongs]);

  const handleRetry = () => {
    const controller = new AbortController();
    loadSongs(controller.signal);
  };

  const handleRefresh = () => {
    const controller = new AbortController();
    loadSongs(controller.signal);
  };

  if (loading) {
    return (
      <div className="song-list-container">
        <h1 className="song-list-heading">Song List</h1>
        <div role="status" aria-live="polite">Loading songs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="song-list-container">
        <h1 className="song-list-heading">Song List</h1>
        <div role="alert" aria-live="assertive">{error}</div>
        <button onClick={handleRetry}>Retry</button>
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="song-list-container">
        <h1 className="song-list-heading">Song List</h1>
        <div>No songs available</div>
        <button onClick={handleRefresh}>Refresh</button>
      </div>
    );
  }

  return (
    <div className="song-list-container">
      <h1 className="song-list-heading">Song List</h1>
      <button onClick={handleRefresh}>Refresh</button>
      <ul role="list">
        {songs.map((song) => (
          <li className="song-item" key={song.id} role="listitem">
            <h3 className="song-title">{song.title}</h3>
            <p className="song-info">Artist: {song.artist}</p>
            <p className="song-info">Album: {song.album}</p>
            <p className="song-info">Genre: {song.genre}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SongList;