const mongoose = require('mongoose');

class SongService {
  constructor(songModel) {
    this.Song = songModel;
  }

  async createSong(songData) {
    const song = new this.Song(songData);
    return await song.save();
  }

  async getSongs(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const songs = await this.Song.find().skip(skip).limit(limit);
    const total = await this.Song.countDocuments();
    return {
      songs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateSong(id, updateData) {
    const filteredData = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v !== undefined)
    );
    return await this.Song.findByIdAndUpdate(id, filteredData, {
      new: true,
      runValidators: true,
    });
  }

  async deleteSong(id) {
    return await this.Song.findByIdAndDelete(id);
  }

  async getTotal() {
    const statistics = await this.Song.aggregate([
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
    return statistics.length > 0
      ? statistics[0]
      : { totalSongs: 0, totalArtists: 0, totalAlbums: 0, totalGenres: 0 };
  }

  async getGenre() {
    return await this.Song.aggregate([
      {
        $group: {
          _id: '$genre',
          count: { $sum: 1 },
        },
      },
    ]);
  }

  async getAlbums() {
    return await this.Song.aggregate([
      {
        $group: {
          _id: '$album',
          count: { $sum: 1 },
        },
      },
    ]);
  }

  async getArtists() {
    return await this.Song.aggregate([
      {
        $group: {
          _id: '$artist',
          songs: { $sum: 1 },
          albumNames: { $addToSet: '$album' },
        },
      },
      {
        $addFields: {
          numberOfAlbums: {
            $size: '$albumNames',
          },
        },
      },
    ]);
  }

  async seedSongs(sampleData) {
    await this.Song.deleteMany();
    return await this.Song.insertMany(sampleData);
  }
}

module.exports = SongService;
