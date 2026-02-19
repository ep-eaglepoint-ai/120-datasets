const mongoose = require('mongoose');
const db = require('../utils/db');

const Song = db.defineSongModel();

const SongController = {
  getStatus: (req, res) => res.status(200).json({ status: db.status }),
  createSong: async (req, res) => {
    const {
      title, artist, album, genre,
    } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Missing title' });
    }

    if (!artist) {
      return res.status(400).json({ error: 'Missing artist' });
    }

    if (!album) {
      return res.status(400).json({ error: 'Missing album' });
    }

    if (!genre) {
      return res.status(400).json({ error: 'Missing genre' });
    }

    try {
      const songData = {
        title, artist, album, genre,
      };
      const song = new Song(songData);
      await song.save();
      return res.status(201).json({ 'Recorded Successfully!': song });
    } catch (err) {
      console.error('Failed to record song:', err);
      return res.status(500).json({ error: 'Failed to record song' });
    }
  },

  getSongs: async (req, res) => {
    try {
      const songs = await Song.find();
      return res.json(songs);
    } catch (err) {
      console.error('Failed to retrieve songs:', err);
      return res.status(500).json({ error: 'Failed to retrieve songs' });
    }
  },

  updateSong: async (req, res) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Missing id' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    try {
      const {
        title, artist, album, genre,
      } = req.body;
      const songData = {
        title, artist, album, genre,
      };

      const song = await Song.findByIdAndUpdate(id, songData, { new: true });
      return res.status(200).json({ 'Song updated successfully!': song });
    } catch (err) {
      console.error('Failed to update song:', err);
      return res.status(500).json({ error: 'Failed to update song' });
    }
  },

  deleteSong: async (req, res) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Missing id' });
    }

    try {
      await Song.findByIdAndDelete(id);
      return res.status(204).json({ message: 'Song deleted successfully!' });
    } catch (err) {
      console.error('Failed to delete song:', err);
      return res.status(500).json({ error: 'Failed to delete song' });
    }
  },

  getTotal: async (req, res) => {
    try {
      const statistics = await Song.aggregate([
        {
          $group: {
            _id: null,
            totalSongs: { $sum: 1 },
            totalArtists: { $addToSet: '$artist' },
            totalAlbums: { $addToSet: '$album' },
            totalGenres: { $addToSet: '$genre' },
          },
        },
        {
          $project: {
            _id: 0,
            totalSongs: 1,
            totalArtists: { $size: '$totalArtists' },
            totalAlbums: { $size: '$totalAlbums' },
            totalGenres: { $size: '$totalGenres' },
          },
        },
      ]);
      return res.json(statistics[0]);
    } catch (err) {
      console.error('Failed to retrieve total statistics:', err);
      return res.status(500).json({ error: 'Failed to retrieve total statistics' });
    }
  },

  getGenre: async (req, res) => {
    try {
      // Get the number of songs in every genre
      const genreStats = await Song.aggregate([
        {
          $group: {
            _id: '$genre',
            count: { $sum: 1 },
          },
        },
      ]);
      return res.json(genreStats);
    } catch (err) {
      console.error('Failed to retrieve genre statistics:', err);
      return res.status(500).json({ error: 'Failed to retrieve genre statistics' });
    }
  },

  getAlbums: async (req, res) => {
    // Get the number of songs in each album
    try {
      const albumStats = await Song.aggregate([
        {
          $group: {
            _id: '$album',
            count: { $sum: 1 },
          },
        },
      ]);
      return res.json(albumStats);
    } catch (err) {
      console.error('Failed to retrieve album statistics:', err);
      return res.status(500).json({ error: 'Failed to retrieve album statistics' });
    }
  },

  getArtists: async (req, res) => {
    // Get the number of songs and albums each artist has
    try {
      const artistStats = await Song.aggregate([
        {
          $group: {
            _id: '$artist',
            songs: { $sum: 1 },
            albumNames: { $addToSet: '$album' },
          },
        },
        {
          $addFields: {
            NumberofAlbum: {
              $size: '$albumNames',
            },
          },
        },
      ]);
      return res.json(artistStats);
    } catch (err) {
      console.error('Failed to retrieve artist statistics:', err);
      return res.status(500).json({ error: 'Failed to retrieve artist statistics' });
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

    // Seed the sample data
    try {
      await Song.deleteMany(); // Clear existing data
      const songs = await Song.insertMany(sampleData);
      return res.json(songs);
    } catch (err) {
      console.error('Failed to seed sample data:', err);
      return res.status(500).json({ error: 'Failed to seed sample data' });
    }
  },
};

module.exports = SongController;
