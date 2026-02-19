import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../App.css';
const { API_BASE_URL } = require('../config.js');

interface Song {
  _id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
}

const SongList: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);

  useEffect(() => {
    // Fetch the list of songs from the backend API
    axios.get<Song[]>(`${API_BASE_URL}/songs`)
      .then(response => {
        setSongs(response.data);
      })
      .catch(error => {
        console.error('Error fetching songs:', error);
      });
  }, []);

  return (
    <div className="song-list-container">
      <h1 className="song-list-heading">Song List</h1>
      {songs.map(({ _id, title, artist, album, genre }) => (
        <div className="song-item" key={_id}>
          <h3 className="song-title">{title}</h3>
          <p className="song-info">Artist: {artist}</p>
          <p className="song-info">Album: {album}</p>
          <p className="song-info">Genre: {genre}</p>
          <p className="song-info">Id: {_id}</p>
        </div>
      ))}
    </div>
  );
};

export default SongList;
