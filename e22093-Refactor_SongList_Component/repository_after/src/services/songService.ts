import axios from 'axios';
import { Song, ApiError } from '../types/song';
import songsData from '../data/songs.json';

const API_BASE_URL = 'http://localhost:3000/api';

export const fetchSongs = async (signal: AbortSignal): Promise<Song[]> => {
  try {
    const response = await axios.get<any[]>(`${API_BASE_URL}/songs`, {
      signal,
      timeout: 5000
    });
    
    return response.data.map(song => ({
      id: song._id || song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      genre: song.genre
    }));
  } catch (error) {
    if (axios.isCancel(error)) {
      throw error;
    }
    
    return songsData as Song[];
  }
};