const mongoose = require('mongoose');
const db = require('../utils/db');
const SongService = require('./SongService');

const Song = db.defineSongModel();
const songService = new SongService(Song);

const validateObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const SongController = {
  getStatus: (req, res) => res.status(200).json({ status: db.status }),

  createSong: async (req, res) => {
    const { title, artist, album, genre } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Missing title', data: null });
    }
    if (!artist) {
      return res.status(400).json({ message: 'Missing artist', data: null });
    }
    if (!album) {
      return res.status(400).json({ message: 'Missing album', data: null });
    }
    if (!genre) {
      return res.status(400).json({ message: 'Missing genre', data: null });
    }

    try {
      const song = await songService.createSong({ title, artist, album, genre });
      return res.status(201).json({ message: 'Song created successfully', data: song });
    } catch (err) {
      console.error('Failed to record song:', err);
      return res.status(500).json({ message: 'Failed to record song', data: null });
    }
  },

  getSongs: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const result = await songService.getSongs(page, limit);
      return res.json({
        message: 'Songs retrieved successfully',
        data: {
          songs: result.songs,
          pagination: result.pagination,
        },
      });
    } catch (err) {
      console.error('Failed to retrieve songs:', err);
      return res.status(500).json({ message: 'Failed to retrieve songs', data: null });
    }
  },

  updateSong: async (req, res) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Missing id', data: null });
    }
    if (!validateObjectId(id)) {
      return res.status(400).json({ message: 'Invalid id', data: null });
    }

    try {
      const { title, artist, album, genre } = req.body;
      const song = await songService.updateSong(id, { title, artist, album, genre });

      if (!song) {
        return res.status(404).json({ message: 'Song not found', data: null });
      }

      return res.status(200).json({ message: 'Song updated successfully', data: song });
    } catch (err) {
      console.error('Failed to update song:', err);
      return res.status(500).json({ message: 'Failed to update song', data: null });
    }
  },

  deleteSong: async (req, res) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Missing id', data: null });
    }
    if (!validateObjectId(id)) {
      return res.status(400).json({ message: 'Invalid id', data: null });
    }

    try {
      const song = await songService.deleteSong(id);

      if (!song) {
        return res.status(404).json({ message: 'Song not found', data: null });
      }

      return res.status(204).send();
    } catch (err) {
      console.error('Failed to delete song:', err);
      return res.status(500).json({ message: 'Failed to delete song', data: null });
    }
  },

  getTotal: async (req, res) => {
    try {
      const statistics = await songService.getTotal();
      return res.json({ message: 'Statistics retrieved successfully', data: statistics });
    } catch (err) {
      console.error('Failed to retrieve total statistics:', err);
      return res.status(500).json({ message: 'Failed to retrieve total statistics', data: null });
    }
  },

  getGenre: async (req, res) => {
    try {
      const genreStats = await songService.getGenre();
      return res.json({ message: 'Genre statistics retrieved successfully', data: genreStats });
    } catch (err) {
      console.error('Failed to retrieve genre statistics:', err);
      return res.status(500).json({ message: 'Failed to retrieve genre statistics', data: null });
    }
  },

  getAlbums: async (req, res) => {
    try {
      const albumStats = await songService.getAlbums();
      return res.json({ message: 'Album statistics retrieved successfully', data: albumStats });
    } catch (err) {
      console.error('Failed to retrieve album statistics:', err);
      return res.status(500).json({ message: 'Failed to retrieve album statistics', data: null });
    }
  },

  getArtists: async (req, res) => {
    try {
      const artistStats = await songService.getArtists();
      return res.json({ message: 'Artist statistics retrieved successfully', data: artistStats });
    } catch (err) {
      console.error('Failed to retrieve artist statistics:', err);
      return res.status(500).json({ message: 'Failed to retrieve artist statistics', data: null });
    }
  },

  seedSongs: async (req, res) => {
    const sampleData = [
      {
        title: 'Song 1',
        artist: 'Artist 1',
        album: 'Album 1',
        genre: 'Genre 1',
      },
      {
        title: 'Song 2',
        artist: 'Artist 1',
        album: 'Album 1',
        genre: 'Genre 2',
      },
      {
        title: 'Song 3',
        artist: 'Artist 2',
        album: 'Album 2',
        genre: 'Genre 1',
      },
    ];

    try {
      const songs = await songService.seedSongs(sampleData);
      return res.json({ message: 'Sample data seeded successfully', data: songs });
    } catch (err) {
      console.error('Failed to seed sample data:', err);
      return res.status(500).json({ message: 'Failed to seed sample data', data: null });
    }
  },
};

module.exports = SongController;
