import * as Network from 'expo-network';
import { useEffect, useState } from 'react';

// Check if device is online
export async function isOnline(): Promise<boolean> {
  try {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected === true && networkState.isInternetReachable === true;
  } catch {
    return false;
  }
}

// Hook to monitor network status
export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean>(true);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        setIsConnected(state.isConnected ?? false);
        setIsInternetReachable(state.isInternetReachable ?? false);
      } catch {
        setIsConnected(false);
        setIsInternetReachable(false);
      }
    };

    // Check immediately
    checkNetwork();

    // Check every 5 seconds
    intervalId = setInterval(checkNetwork, 5000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  return {
    isOnline: isConnected && isInternetReachable,
    isConnected,
    isInternetReachable,
  };
}
