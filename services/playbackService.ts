import TrackPlayer, { Event } from "react-native-track-player";

let isInitialized = false;

export async function setupPlayer() {
  let isSetup = false;
  try {
    await TrackPlayer.getActiveTrack();
    isSetup = true;
  } catch {
    await TrackPlayer.setupPlayer({
      maxCacheSize: 1024 * 10, // 10 MB
    });
    isSetup = true;
  }
  return isSetup;
}

export default async function playbackService() {
  if (isInitialized) return;
  isInitialized = true;

  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    console.log("RemotePlay triggered");
    await TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    console.log("RemotePause triggered");
    await TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    console.log("RemoteNext triggered");
    try {
      await TrackPlayer.skipToNext();
    } catch (error) {
      console.log("Error skipping to next:", error);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    console.log("RemotePrevious triggered");
    try {
      await TrackPlayer.skipToPrevious();
    } catch (error) {
      console.log("Error skipping to previous:", error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, async (event) => {
    console.log("RemoteSeek triggered:", event.position);
    await TrackPlayer.seekTo(event.position);
  });

  TrackPlayer.addEventListener(
    Event.PlaybackActiveTrackChanged,
    async (event) => {
      console.log("Track changed to index:", event.index);
    },
  );
}
