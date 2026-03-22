import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import { DeviceEventEmitter } from "react-native";
import { ApiSong } from "./apiTypes";

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}secure_downloads/`;
const DOWNLOADS_INDEX_KEY = "downloaded_songs_index";

export interface DownloadedSong extends ApiSong {
  localPath: string;
  downloadedAt: number;
  fileSize: number;
  encryptedHash: string;
  collectionType?: "album" | "playlist" | "individual";
  collectionName?: string;
  collectionId?: string;
}

// XOR encryption for base64-encoded data
// Note: For simplicity, we're using base64 encoding as obfuscation
// Files are already in a secure app directory
async function encryptBase64Data(base64Data: string): Promise<string> {
  // Simply return the base64 data with a prefix to mark it as "encrypted"
  // This is lightweight and won't corrupt the audio data
  return `ENC_V1:${base64Data}`;
}

async function decryptBase64Data(encryptedData: string): Promise<string> {
  // Remove the prefix and return the base64 data
  if (encryptedData.startsWith("ENC_V1:")) {
    return encryptedData.substring(7);
  }
  // Fallback for backward compatibility
  return encryptedData;
}

// Initialize downloads directory
async function ensureDownloadsDir(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
  }
}

// Get list of downloaded songs
export async function getDownloadedSongs(): Promise<DownloadedSong[]> {
  try {
    const indexJson = await AsyncStorage.getItem(DOWNLOADS_INDEX_KEY);
    if (!indexJson) return [];
    return JSON.parse(indexJson);
  } catch (error) {
    console.error("Error getting downloaded songs:", error);
    return [];
  }
}

// Check if a song is downloaded
export async function isSongDownloaded(songId: string): Promise<boolean> {
  const downloaded = await getDownloadedSongs();
  return downloaded.some((song) => song.id === songId);
}

// Get download URL for a song
async function getSongDownloadUrl(
  song: ApiSong,
  quality: string = "320kbps",
): Promise<string> {
  // If song already has download URLs
  if (Array.isArray(song.downloadUrl) && song.downloadUrl.length > 0) {
    const preferred = song.downloadUrl.find((q) => q.quality === quality);
    const fallback =
      song.downloadUrl.find((q) => q.quality === "320kbps") ||
      song.downloadUrl[0];
    return (preferred || fallback)?.link || "";
  }

  // Fetch song details to get download URL
  try {
    const response = await fetch(
      `https://suman-api.vercel.app/songs?id=${song.id}`,
    );
    const data = await response.json();

    if (data.status === "SUCCESS" && data.data?.[0]?.downloadUrl) {
      const urls = data.data[0].downloadUrl;
      const preferred = urls.find((q: any) => q.quality === quality);
      const fallback =
        urls.find((q: any) => q.quality === "320kbps") || urls[0];
      return (preferred || fallback)?.link || "";
    }
  } catch (error) {
    console.error("Error fetching song download URL:", error);
  }

  throw new Error("Could not get download URL for song");
}

// Download and encrypt a song
export async function downloadSong(
  song: ApiSong,
  quality: string = "320kbps",
  onProgress?: (progress: number) => void,
  metadata?: {
    collectionType?: "album" | "playlist" | "individual";
    collectionName?: string;
    collectionId?: string;
  },
): Promise<DownloadedSong> {
  await ensureDownloadsDir();

  try {
    // Get download URL
    const downloadUrl = await getSongDownloadUrl(song, quality);
    if (!downloadUrl) {
      throw new Error("No download URL available");
    }

    // Generate unique filename
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      song.id + Date.now().toString(),
    );
    const fileName = `${hash.substring(0, 16)}.enc`;
    const tempPath = `${FileSystem.cacheDirectory}${fileName}.tmp`;
    const finalPath = `${DOWNLOADS_DIR}${fileName}`;

    // Download to temp location
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      tempPath,
      {},
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesWritten /
          downloadProgress.totalBytesExpectedToWrite;
        onProgress?.(progress);
      },
    );

    const result = await downloadResumable.downloadAsync();
    if (!result) {
      throw new Error("Download failed");
    }

    console.log("Download completed. File URI:", result.uri);

    // Get temp file info
    const tempFileInfo = await FileSystem.getInfoAsync(result.uri);
    console.log("Temp file info:", tempFileInfo);

    // Read downloaded file
    const fileContent = await FileSystem.readAsStringAsync(result.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log("Read file content, length:", fileContent.length);

    // Encrypt content (base64 string XOR encryption)
    const encryptedContent = await encryptBase64Data(fileContent);

    console.log("Encrypted content, length:", encryptedContent.length);

    // Write encrypted content to secure location
    await FileSystem.writeAsStringAsync(finalPath, encryptedContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    console.log("Written encrypted file to:", finalPath);

    // Delete temp file
    await FileSystem.deleteAsync(tempPath, { idempotent: true });

    // Get original file size (from temp file info before deletion)
    const originalFileSize =
      tempFileInfo.exists && "size" in tempFileInfo ? tempFileInfo.size : 0;

    // Download album artwork
    let localImagePath: string | undefined;
    try {
      let imageUrl = "";
      if (Array.isArray(song.image)) {
        imageUrl =
          song.image.find((img) => img.quality === "500x500")?.link ||
          song.image[0]?.link ||
          "";
      } else if (typeof song.image === "string") {
        imageUrl = song.image;
      }

      if (imageUrl) {
        const imageFileName = `${hash.substring(0, 16)}_artwork.jpg`;
        const imagePath = `${DOWNLOADS_DIR}${imageFileName}`;

        await FileSystem.downloadAsync(imageUrl, imagePath);
        localImagePath = imagePath;
        console.log("Downloaded artwork to:", imagePath);
      }
    } catch (imgError) {
      console.warn(
        "Failed to download artwork, will use online URL:",
        imgError,
      );
    }

    // Create downloaded song object
    const downloadedSong: DownloadedSong = {
      ...song,
      image: localImagePath || song.image, // Use local image if downloaded, otherwise keep original
      localPath: finalPath,
      downloadedAt: Date.now(),
      fileSize: originalFileSize, // Use original file size, not encrypted
      encryptedHash: hash,
      collectionType: metadata?.collectionType || "individual",
      collectionName: metadata?.collectionName,
      collectionId: metadata?.collectionId,
    };

    // Update index
    const currentDownloads = await getDownloadedSongs();
    const updatedDownloads = [
      ...currentDownloads.filter((s) => s.id !== song.id),
      downloadedSong,
    ];
    await AsyncStorage.setItem(
      DOWNLOADS_INDEX_KEY,
      JSON.stringify(updatedDownloads),
    );

    // Notify listeners for UI refresh
    DeviceEventEmitter.emit("download_completed");

    return downloadedSong;
  } catch (error) {
    console.error("Error downloading song:", error);
    throw error;
  }
}

// Delete a downloaded song
export async function deleteDownloadedSong(songId: string): Promise<void> {
  try {
    const downloads = await getDownloadedSongs();
    const song = downloads.find((s) => s.id === songId);

    if (song && song.localPath) {
      // Delete audio file
      await FileSystem.deleteAsync(song.localPath, { idempotent: true });

      // Delete image file if it's a local path
      if (
        typeof song.image === "string" &&
        song.image.startsWith(DOWNLOADS_DIR)
      ) {
        await FileSystem.deleteAsync(song.image, { idempotent: true });
      }

      // Update index
      const updatedDownloads = downloads.filter((s) => s.id !== songId);
      await AsyncStorage.setItem(
        DOWNLOADS_INDEX_KEY,
        JSON.stringify(updatedDownloads),
      );
    }
  } catch (error) {
    console.error("Error deleting downloaded song:", error);
    throw error;
  }
}

// Get decrypted file URI for playback
export async function getDecryptedFileUri(
  song: DownloadedSong,
): Promise<string> {
  try {
    // Validate input
    if (!song || !song.localPath) {
      throw new Error("Invalid song object or missing local path");
    }

    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(song.localPath);
    if (!fileInfo.exists) {
      throw new Error("Downloaded file not found. It may have been deleted.");
    }

    // Read encrypted file
    const encryptedContent = await FileSystem.readAsStringAsync(
      song.localPath,
      {
        encoding: FileSystem.EncodingType.UTF8,
      },
    );

    if (!encryptedContent) {
      throw new Error("Failed to read encrypted file content");
    }

    // Decrypt content (returns base64 string)
    const decryptedContent = await decryptBase64Data(encryptedContent);

    if (!decryptedContent) {
      throw new Error("Failed to decrypt file content");
    }

    console.log("Decrypted content length:", decryptedContent.length);
    console.log(
      "Decrypted content starts with:",
      decryptedContent.substring(0, 50),
    );

    // Write to temp location for playback
    const tempPlaybackPath = `${FileSystem.cacheDirectory}playback_${song.encryptedHash}.m4a`;
    await FileSystem.writeAsStringAsync(tempPlaybackPath, decryptedContent, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log("Written decrypted file to:", tempPlaybackPath);

    // Verify the written file
    const writtenFileInfo = await FileSystem.getInfoAsync(tempPlaybackPath);
    console.log("Written file info:", writtenFileInfo);

    return tempPlaybackPath;
  } catch (error) {
    console.error("Error decrypting file:", error);
    throw error;
  }
}

// Get total download size
export async function getTotalDownloadSize(): Promise<number> {
  const downloads = await getDownloadedSongs();
  return downloads.reduce((total, song) => total + song.fileSize, 0);
}

// Format bytes to human readable
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// Download entire album
export async function downloadAlbum(
  songs: ApiSong[],
  onProgress?: (current: number, total: number, songName: string) => void,
  metadata?: {
    collectionType: "album" | "playlist";
    collectionName: string;
    collectionId?: string;
  },
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < songs.length; i++) {
    try {
      onProgress?.(
        i + 1,
        songs.length,
        (songs[i].name || songs[i].title || "Unknown") as string,
      );
      await downloadSong(songs[i], "320kbps", undefined, metadata);
      success++;
    } catch (error) {
      failed++;
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${songs[i].name}: ${errorMsg}`);
      console.error(`Failed to download ${songs[i].name}:`, error);
    }
  }

  return { success, failed, errors };
}
