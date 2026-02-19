export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
}

export interface ApiError {
  message: string;
  status?: number;
}