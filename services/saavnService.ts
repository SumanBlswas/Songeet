// services/saavnService.ts
import {
  ApiAlbum,
  ApiArtist,
  ApiPlaylist,
  ApiSong,
  HomePageData,
} from "./apiTypes";

// Base URL for your Saavn API proxy
const API_BASE_URL = "https://suman-api.vercel.app";

/**
 * Fetch homepage data from possible endpoints.
 * Tries multiple endpoints until one succeeds.
 */
export const getHomePageData = async (
  language: string = "hindi",
): Promise<HomePageData | null> => {
  try {
    const possibleEndpoints = [
      `${API_BASE_URL}/modules?language=${language.toLowerCase()}`,
      `${API_BASE_URL}/modules`,
      `${API_BASE_URL}/home`,
      `${API_BASE_URL}/featured`,
      `${API_BASE_URL}/trending`,
    ];

    let lastError: any = null;

    for (const endpoint of possibleEndpoints) {
      try {
        const response = await fetch(endpoint);

        if (response.ok) {
          const text = await response.text();

          try {
            const json = JSON.parse(text);

            if (json.success !== false && json.data) {
              return json.data as HomePageData;
            } else if (
              json.success !== false &&
              !json.data &&
              typeof json === "object"
            ) {
              console.log(`Success with endpoint (unwrapped): ${endpoint}`);
              return json as HomePageData;
            }
          } catch (parseError) {
            console.warn(`Parse error for ${endpoint}:`, parseError);
            continue;
          }
        } else {
          console.warn(`HTTP ${response.status} for ${endpoint}`);
          continue;
        }
      } catch (networkError) {
        console.warn(`Network error for ${endpoint}:`, networkError);
        lastError = networkError;
        continue;
      }
    }

    console.log("All homepage endpoints failed, trying search fallback...");
    return await getHomepageFallback();
  } catch (error) {
    console.error("Error in getHomePageData:", error);
    return null;
  }
};

/**
 * Fallback: Search some popular queries and construct a homepage-like structure.
 */
const getHomepageFallback = async (): Promise<HomePageData | null> => {
  try {
    const popularQueries = [
      "hindi songs",
      "bollywood",
      "trending",
      "arijit singh",
      "latest",
    ];

    for (const query of popularQueries) {
      try {
        const searchResult = await searchSongs(query, 1, 20);
        if (searchResult && searchResult.songs.length > 0) {
          return {
            trending: {
              data: searchResult.songs.map((song) => ({
                ...song,
                type: "song" as const,
              })),
              position: 1,
            },
          } as HomePageData;
        }
      } catch {
        // Ignore errors here, try next query
      }
    }
    return null;
  } catch (error) {
    console.error("Fallback failed:", error);
    return null;
  }
};

/**
 * Fetch song details by song ID.
 */
export const getSongDetails = async (
  songId: string,
): Promise<ApiSong | null> => {
  if (!songId) {
    console.error("getSongDetails: songId is required.");
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/songs/${songId}`);

    if (!response.ok) {
      console.error(
        `HTTP error! status: ${response.status} for song ${songId}`,
      );
      return null;
    }

    const text = await response.text();

    try {
      const json = JSON.parse(text);

      if (json.success !== false && json.data) {
        return Array.isArray(json.data) ? json.data[0] : json.data;
      } else if (json.success !== false && !json.data && json.id) {
        return json as ApiSong;
      }

      console.error(`No song data found for ID ${songId}`);
      return null;
    } catch (parseError) {
      console.error(`Error parsing JSON for song ${songId}:`, parseError);
      return null;
    }
  } catch (networkError) {
    console.error(`Network error for song ${songId}:`, networkError);
    return null;
  }
};

/**
 * Search songs by query, with optional pagination.
 */
export const searchSongs = async (
  query: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ songs: ApiSong[]; total: number } | null> => {
  if (!query) {
    console.error("searchSongs: query is required.");
    return null;
  }

  try {
    let url = `${API_BASE_URL}/search/songs?query=${encodeURIComponent(query)}`;
    if (page > 1) url += `&page=${page}`;
    if (limit !== 20) url += `&limit=${limit}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(
        `HTTP error! status: ${response.status} for search: ${query}`,
      );
      return null;
    }

    const text = await response.text();

    try {
      const json = JSON.parse(text);

      if (json.success !== false && json.data) {
        const data = json.data;
        return {
          songs: data.results || data || [],
          total: data.total || data.length || 0,
        };
      } else if (Array.isArray(json)) {
        return {
          songs: json,
          total: json.length,
        };
      }

      console.error(`Search songs failed for query "${query}"`);
      return null;
    } catch (parseError) {
      console.error(`Error parsing JSON for search "${query}":`, parseError);
      return null;
    }
  } catch (networkError) {
    console.error(`Network error for search "${query}":`, networkError);
    return null;
  }
};

/**
 * General search across all types (songs, albums, artists, playlists).
 */
export interface GeneralSearchResultItem {
  id: string;
  title: string;
  name?: string;
  type: "song" | "album" | "artist" | "playlist" | string;
  image: string | any[];
  description?: string;
  url?: string;
}

export interface GeneralSearchResponseData {
  topQuery?: { results: GeneralSearchResultItem[]; label: string };
  songs?: { results: ApiSong[]; position: number; label: string };
  albums?: { results: ApiAlbum[]; position: number; label: string };
  artists?: { results: ApiArtist[]; position: number; label: string };
  playlists?: { results: ApiPlaylist[]; position: number; label: string };
}

export const searchAllTypes = async (
  query: string,
): Promise<GeneralSearchResponseData | null> => {
  if (!query) {
    console.error("searchAllTypes: query is required.");
    return null;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/search?query=${encodeURIComponent(query)}`,
    );

    if (!response.ok) {
      console.error(
        `HTTP error! status: ${response.status} for general search: ${query}`,
      );
      return null;
    }

    const text = await response.text();

    try {
      const json = JSON.parse(text);

      if (json.success !== false && json.data) {
        return json.data as GeneralSearchResponseData;
      } else if (json.success !== false && typeof json === "object") {
        return json as GeneralSearchResponseData;
      }

      console.error(`General search failed for query "${query}"`);
      return null;
    } catch (parseError) {
      console.error(
        `Error parsing JSON for general search "${query}":`,
        parseError,
      );
      return null;
    }
  } catch (networkError) {
    console.error(`Network error for general search "${query}":`, networkError);
    return null;
  }
};

/**
 * Search albums by query.
 */
export const searchAlbums = async (
  query: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ albums: ApiAlbum[]; total: number } | null> => {
  if (!query) {
    console.error("searchAlbums: query is required.");
    return null;
  }

  try {
    let url = `${API_BASE_URL}/search/albums?query=${encodeURIComponent(
      query,
    )}`;
    if (page > 1) url += `&page=${page}`;
    if (limit !== 20) url += `&limit=${limit}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(
        `HTTP error! status: ${response.status} for album search: ${query}`,
      );
      return null;
    }

    const text = await response.text();

    try {
      const json = JSON.parse(text);

      if (json.success !== false && json.data) {
        const data = json.data;
        return {
          albums: data.results || data || [],
          total: data.total || data.length || 0,
        };
      }

      return null;
    } catch (parseError) {
      console.error(
        `Error parsing JSON for album search "${query}":`,
        parseError,
      );
      return null;
    }
  } catch (networkError) {
    console.error(`Network error for album search "${query}":`, networkError);
    return null;
  }
};

/**
 * Fetch album details and songs by ID.
 */
export const getAlbumDetails = async (
  albumId: string,
): Promise<ApiAlbum | null> => {
  if (!albumId) {
    console.error("getAlbumDetails: albumId is required.");
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/albums?id=${albumId}`);

    if (!response.ok) {
      console.error(
        `HTTP error! status: ${response.status} for album ${albumId}`,
      );
      return null;
    }

    const text = await response.text();

    try {
      const json = JSON.parse(text);

      if (json.success !== false && json.data) {
        let data = json.data;
        // If data is an array, take the first item
        if (Array.isArray(data)) data = data[0];
        
        // If data itself is a song (missing songs array), treat it as an album with one song
        if (data && !data.songs && data.type === 'song') {
            data.songs = [data];
        }

        return data as ApiAlbum;
      }

      console.error(`No album data found for ID ${albumId}`);
      return null;
    } catch (parseError) {
      console.error(`Error parsing JSON for album ${albumId}:`, parseError);
      return null;
    }
  } catch (networkError) {
    console.error(`Network error for album ${albumId}:`, networkError);
    return null;
  }
};

/**
 * Search artists by query.
 */
export const searchArtists = async (
  query: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ artists: ApiArtist[]; total: number } | null> => {
  if (!query) {
    console.error("searchArtists: query is required.");
    return null;
  }

  try {
    let url = `${API_BASE_URL}/search/artists?query=${encodeURIComponent(
      query,
    )}`;
    if (page > 1) url += `&page=${page}`;
    if (limit !== 20) url += `&limit=${limit}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(
        `HTTP error! status: ${response.status} for artist search: ${query}`,
      );
      return null;
    }

    const text = await response.text();

    try {
      const json = JSON.parse(text);

      if (json.success !== false && json.data) {
        const data = json.data;
        return {
          artists: data.results || data || [],
          total: data.total || data.length || 0,
        };
      }

      return null;
    } catch (parseError) {
      console.error(
        `Error parsing JSON for artist search "${query}":`,
        parseError,
      );
      return null;
    }
  } catch (networkError) {
    console.error(`Network error for artist search "${query}":`, networkError);
    return null;
  }
};

/**
 * Search playlists by query.
 */
export const searchPlaylists = async (
  query: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ playlists: ApiPlaylist[]; total: number } | null> => {
  if (!query) {
    console.error("searchPlaylists: query is required.");
    return null;
  }

  try {
    let url = `${API_BASE_URL}/search/playlists?query=${encodeURIComponent(
      query,
    )}`;
    if (page > 1) url += `&page=${page}`;
    if (limit !== 20) url += `&limit=${limit}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(
        `HTTP error! status: ${response.status} for playlist search: ${query}`,
      );
      return null;
    }

    const text = await response.text();

    try {
      const json = JSON.parse(text);

      if (json.success !== false && json.data) {
        const data = json.data;
        return {
          playlists: data.results || data || [],
          total: data.total || data.length || 0,
        };
      }

      return null;
    } catch (parseError) {
      console.error(
        `Error parsing JSON for playlist search "${query}":`,
        parseError,
      );
      return null;
    }
  } catch (networkError) {
    console.error(
      `Network error for playlist search "${query}":`,
      networkError,
    );
    return null;
  }
};

/**
 * Fetch lyrics for a song with retry and caching support.
 * Priority: Cache -> LRCLIB (synced) -> Saavn API
 * Returns: { lyrics: string, isSynced: boolean } | null
 */
export const getSongLyrics = async (
  songId: string,
  songName?: string,
  artistName?: string,
  retryCount: number = 2,
): Promise<{ lyrics: string; isSynced: boolean } | null> => {
  if (!songId && !songName) {
    console.error("getSongLyrics: songId or songName is required.");
    return null;
  }

  // Clean up song name and artist for better matching
  const cleanSongName =
    songName
      ?.replace(/\(.*?\)/g, "") // Remove parentheses content like "(From Movie)"
      ?.replace(/\[.*?\]/g, "") // Remove brackets
      ?.replace(/feat\..*/i, "") // Remove featuring
      ?.replace(/ft\..*/i, "")
      ?.trim() || "";

  const cleanArtistName =
    artistName
      ?.split(",")[0] // Take first artist only
      ?.replace(/\(.*?\)/g, "")
      ?.trim() || "";

  // Helper: fetch with timeout using Promise.race (more reliable on RN)
  const fetchWithTimeout = async (
    url: string,
    options: RequestInit = {},
    timeout: number = 10000,
  ): Promise<Response> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), timeout);
    });

    // Remove User-Agent for LRCLIB as it may cause issues on mobile
    const cleanOptions = { ...options };
    if (
      cleanOptions.headers &&
      (cleanOptions.headers as Record<string, string>)["User-Agent"]
    ) {
      delete (cleanOptions.headers as Record<string, string>)["User-Agent"];
    }

    return Promise.race([fetch(url, cleanOptions), timeoutPromise]);
  };

  // Attempt to fetch lyrics
  const attemptFetch = async (): Promise<{
    lyrics: string;
    isSynced: boolean;
  } | null> => {
    try {
      // 1. Try LRCLIB first (provides full synced lyrics)
      if (cleanSongName && cleanArtistName) {
        console.log(
          `[Lyrics] Trying LRCLIB for: "${cleanSongName}" by "${cleanArtistName}"`,
        );

        const lrclibUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtistName)}&track_name=${encodeURIComponent(cleanSongName)}`;

        try {
          const lrclibResponse = await fetchWithTimeout(lrclibUrl, {}, 10000);

          if (lrclibResponse.ok) {
            const lrclibData = await lrclibResponse.json();

            if (lrclibData.syncedLyrics) {
              console.log("[Lyrics] Got synced lyrics from LRCLIB");
              return { lyrics: lrclibData.syncedLyrics, isSynced: true };
            } else if (lrclibData.plainLyrics) {
              console.log("[Lyrics] Got plain lyrics from LRCLIB");
              return { lyrics: lrclibData.plainLyrics, isSynced: false };
            }
          }
        } catch (lrclibError) {
          console.warn("[Lyrics] LRCLIB error:", lrclibError);
        }

        // 1b. Try LRCLIB search as backup
        try {
          const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanSongName + " " + cleanArtistName)}`;
          const searchResponse = await fetchWithTimeout(searchUrl, {}, 10000);

          if (searchResponse.ok) {
            const searchResults = await searchResponse.json();
            if (Array.isArray(searchResults) && searchResults.length > 0) {
              const bestMatch = searchResults[0];
              if (bestMatch.syncedLyrics) {
                console.log("[Lyrics] Got synced lyrics from LRCLIB search");
                return { lyrics: bestMatch.syncedLyrics, isSynced: true };
              } else if (bestMatch.plainLyrics) {
                console.log("[Lyrics] Got plain lyrics from LRCLIB search");
                return { lyrics: bestMatch.plainLyrics, isSynced: false };
              }
            }
          }
        } catch (searchError) {
          console.warn("[Lyrics] LRCLIB search error:", searchError);
        }
      }

      // 2. Try Saavn API using songId
      if (songId) {
        console.log(`[Lyrics] Trying Saavn API for id: ${songId}`);
        const response = await fetchWithTimeout(
          `${API_BASE_URL}/lyrics?id=${songId}`,
          {},
          8000,
        );

        if (response.ok) {
          const text = await response.text();
          try {
            const json = JSON.parse(text);
            if (json.success !== false && json.data?.lyrics) {
              console.log("[Lyrics] Got lyrics from Saavn API");
              return { lyrics: json.data.lyrics, isSynced: false };
            }
          } catch (parseError) {
            console.warn(`[Lyrics] Error parsing Saavn JSON:`, parseError);
          }
        }
      }

      // 3. Fallback: Saavn lyrics search
      if (songName && artistName) {
        const searchQuery = `${songName} ${artistName}`;
        const searchResponse = await fetchWithTimeout(
          `${API_BASE_URL}/search/lyrics?query=${encodeURIComponent(searchQuery)}`,
          {},
          8000,
        );

        if (searchResponse.ok) {
          const searchText = await searchResponse.text();
          try {
            const searchJson = JSON.parse(searchText);
            if (searchJson.success !== false && searchJson.data?.lyrics) {
              console.log("[Lyrics] Got lyrics from Saavn search");
              return { lyrics: searchJson.data.lyrics, isSynced: false };
            }
          } catch (parseError) {
            console.warn(
              `[Lyrics] Error parsing Saavn search JSON:`,
              parseError,
            );
          }
        }
      }

      return null;
    } catch (networkError) {
      console.error(`[Lyrics] Network error:`, networkError);
      return null;
    }
  };

  // Retry logic - fast retries since network errors are often transient
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    if (attempt > 0) {
      console.log(`[Lyrics] Retry attempt ${attempt}/${retryCount}`);
      await new Promise((resolve) => setTimeout(resolve, 300)); // Fast fixed delay
    }

    const result = await attemptFetch();
    if (result) {
      return result;
    }
  }

  console.warn(
    `[Lyrics] No lyrics found for: ${songName || songId} after ${retryCount + 1} attempts`,
  );
  return null;
};
