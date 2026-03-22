// services/apiTypes.ts

// Represents image links with different qualities
export interface ApiImage {
  quality: "50x50" | "150x150" | "500x500" | string; // Allow other quality strings
  link: string;
}

// Represents download links for songs with quality information
export interface DownloadUrl {
  quality: string; // e.g., "12kbps", "48kbps", "96kbps", "160kbps", "320kbps"
  link: string; // Direct download/stream URL
}

export interface BioObject {
  text: string;
  title: string;
  sequence?: number;
}

// Simplified Artist interface (can be expanded for details view)
export interface ApiArtist {
  id: string;
  name: string;
  role?: string;
  image: ApiImage[] | string | null;
  type?: string; // e.g., 'artist'
  url: string; // Link to artist page on Saavn
  // For details view:
  followerCount?: string;
  fanCount?: string; // alias for followerCount
  isVerified?: boolean;
  dominantLanguage?: string;
  dominantType?: string;
  bio?: string | BioObject | BioObject[] | null;
  dob?: string;
  fb?: string; // Facebook profile ID or link
  twitter?: string; // Twitter profile ID or link
  wiki?: string; // Wikipedia link
  urls?: { [key: string]: string }; // Other URLs like website, instagram
  availableLanguages?: string[];
  topSongs?: ApiSong[]; // For artist details page
  topAlbums?: ApiAlbum[]; // For artist details page
  singles?: ApiSong[];
  latestRelease?: ApiSong[] | ApiAlbum[];
  dedicatedArtistPlaylist?: ApiPlaylistBrief; // Brief version for linking
  featuredArtistPlaylist?: ApiPlaylistBrief;
  // From search results, these might be flatter
  subtitle?: string; // Often role or language
  position?: number;
}

// Core Song interface
export interface ApiSong {
  dominantColor: string;
  id: string;
  name: string; // Primary display name/title
  title?: string; // Often same as name
  subtitle?: string; // Can contain artist names
  type?: string; // e.g., 'song'
  album: {
    // This structure might be flatter in some contexts (e.g. just album_id, album_name)
    id: string;
    name: string;
    url: string;
  };
  year?: string;
  releaseDate?: string | null; // API might use 'release_date'
  duration: string; // Typically in seconds as a string
  label?: string;

  primaryArtists?: ApiArtist[] | string; // Can be array of artist objects or comma-separated string
  primaryArtistsId?: string; // Comma-separated IDs

  featuredArtists?: ApiArtist[] | string;
  featuredArtistsId?: string;

  singers?: string; // Sometimes present as comma-separated string
  starring?: string;

  explicitContent: number | string; // 0 or 1, or "true"/"false"
  playCount?: number; // Typically a number, but API might return as string
  language: string;
  hasLyrics?: string; // "true" or "false"
  lyricsId?: string | null;
  lyricsSnippet?: string;

  url: string; // This is usually the song's page URL on Saavn, not a direct stream link
  permaUrl?: string; // Alias for url

  copyright?: string;
  image: ApiImage[] | string; // Can be an array of image objects or a direct link string

  downloadUrl: DownloadUrl[] | string; // Array of download links (various qualities) or boolean false

  albumId?: string;
  artist?: string; // Fallback if primaryArtists is complex to parse initially (e.g. comma separated string)
  origin?: string;
  isWeekly?: boolean;
  playcount?: string; // alias for playCount
  youtubeId?: string; // YouTube video ID for YouTube integration
  // Fields from search results
  description?: string;
  position?: number;
  more_info?: any; // Catch-all for other song-specific details from various endpoints
  localUri?: string; // Path to the locally downloaded file
}

// Simplified Album interface (can be expanded for details view)
export interface ApiAlbum {
  id: string;
  name: string; // Or 'title'
  title?: string;
  year?: string;
  type?: string; // e.g., 'album'
  playCount?: string;
  language?: string;
  explicitContent?: string | number;
  primaryArtists?: ApiArtist[] | string; // Can be name string or array of artist objects
  primaryArtistsId?: string;
  featuredArtists?: ApiArtist[] | string;
  artistMap?: any; // complex artist mapping from API
  songCount?: string; // Number of songs as string
  releaseDate?: string;
  image: ApiImage[] | string;
  url: string; // Link to album page
  songs?: ApiSong[]; // For album details view, list of songs
  // From search results
  subtitle?: string; // Often artist names
  description?: string;
  position?: number;
}

// For playlist search results or brief mentions
export interface ApiPlaylistBrief {
  id: string;
  title: string; // or 'name'
  name?: string;
  image: ApiImage[] | string;
  url: string;
  subtitle?: string; // e.g., song count or user name
  type?: "playlist" | string;
  songCount?: string;
  followerCount?: string;
  explicitContent?: string | number;
  // from search
  description?: string;
  position?: number;
}

// More detailed Playlist interface (for playlist details page)
export interface ApiPlaylist extends ApiPlaylistBrief {
  language?: string;
  followerCount?: string; // Number of followers as string
  lastUpdated?: string; // Timestamp or date string
  songs?: ApiSong[]; // List of songs in the playlist
  fanCount?: string; // alias for followerCount
  userId?: string;
  username?: string;
  firstname?: string;
  lastname?: string;
  list_count?: string; // alias for songCount
  listid?: string; // alias for id
  listname?: string; // alias for name/title
  more_info?: any;
}

// Interface for a generic module item (could be a song, album, playlist, chart, etc.)
export interface ApiModuleDataItem {
  id: string;
  title: string; // Or 'name'
  name?: string;
  subtitle?: string;
  type: "song" | "album" | "playlist" | "chart" | "artist" | string;
  image: ApiImage[] | string;
  url: string;
  explicitContent?: string | number;
  description?: string; // often for playlists/albums in modules
  more_info?: {
    album?: string;
    album_id?: string;
    artistMap?: {
      primary_artists: ApiArtist[];
      featured_artists: ApiArtist[];
      artists: ApiArtist[];
    };
    duration?: string;
    label?: string;
    year?: string;
    song_count?: string; // For playlists/charts in modules
    firstname?: string; // For user playlists in modules
    follower_count?: string; // For playlists/charts
    last_updated?: string; // For playlists/charts
    // ... other specific fields from module items
  };
  // Artist specific
  role?: string; // if type is artist
  position?: number;
}

// Interface for modules in homepage data (e.g., new_trending, charts, albums)
export interface ApiModule {
  id?: string;
  title: string;
  subtitle?: string;
  type?: string; // e.g., 'album_list', 'chart_list', 'playlist_list', 'song_list', 'artist_list', 'mix'
  source?: string;
  position: number;
  data?: ApiModuleDataItem[] | ApiSong[] | ApiAlbum[] | ApiPlaylistBrief[];
  view_more?: any;
  params?: any;
}

// Interface for the overall homepage data structure (the content of 'data' in ApiResponse for /modules, or direct for saavn.me/modules)
export interface HomePageData {
  [moduleKey: string]: ApiModule | any; // Using 'any' for modules like 'global_config' or other non-standard ones
  // Example known modules (can be explicitly typed if their structure is consistent)
  // new_trending?: ApiModule;
  // charts?: ApiModule;
  // new_albums?: ApiModule;
  // top_playlists?: ApiModule;
  // top_artists?: ApiModule;
  // radio?: ApiModule;
}

// For a generic API response structure (if API wraps responses)
export interface ApiResponse<T> {
  status: string; // "SUCCESS" or "ERROR"
  message?: string | null; // Optional message
  data: T;
}

// --- Types for General Search (`/search` endpoint) ---
export interface GeneralSearchResultItem {
  id: string;
  title: string; // or name
  name?: string;
  type:
    | "song"
    | "album"
    | "artist"
    | "playlist"
    | "topquery"
    | "show"
    | "episode"
    | string; // 'topquery' is often a type for the top result suggestion
  image: ApiImage[] | string;
  description?: string; // Often artist names for songs, or other info
  url?: string;
  album?: string; // For songs
  singers?: string; // For songs
  language?: string;
  year?: string; // For albums/songs
  playCount?: string; // For songs
  songCount?: string; // For albums/playlists
  explicitContent?: string | number;
  role?: string; // For artists
  // other specific fields depending on type
  isExplicit?: string; // from topQuery results
  album_id?: string; // from topQuery results
  primary_artists?: ApiArtist[] | string; // from topQuery results
  perma_url?: string;
  label?: string; // from topQuery results if it's a section label
}

export interface GeneralSearchCategory<T> {
  title?: string; // e.g., "Top Result", "Songs", "Albums"
  data: T[]; // Array of items like ApiSong, ApiAlbum, etc. or GeneralSearchResultItem
  position: number;
  // fields specific to saavn.me general search might be different than saavan-api-psi
  // for saavan-api-psi:
  label?: string;
  results?: T[]; // The API uses "results" within each category
}

export interface GeneralSearchResponseData {
  topQuery?: GeneralSearchCategory<GeneralSearchResultItem>; // Or define a specific TopQueryResult type
  songs?: GeneralSearchCategory<ApiSong>;
  albums?: GeneralSearchCategory<ApiAlbum>;
  artists?: GeneralSearchCategory<ApiArtist>;
  playlists?: GeneralSearchCategory<ApiPlaylistBrief>; // Use brief version for search results
  shows?: GeneralSearchCategory<GeneralSearchResultItem>; // Define ApiShow if needed
  episodes?: GeneralSearchCategory<GeneralSearchResultItem>; // Define ApiEpisode if needed
  // The API might return categories with dynamic keys or a flat list of results with types.
  // The above structure is an assumption for a categorized search response.
  // If it's a flat list: results: GeneralSearchResultItem[]; total: number;
}
