import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface AppConfig {
  revoked: boolean;
  message?: string;
  minVersion?: string;
  blockedIps?: string[];
}

// THIS SHOULD BE UNIQUE FOR EVERY BUILD TO ALLOW INDIVIDUAL REVOCATION
const BUILD_SECRET = "sb_8k2f9v4m5n7pQxRzTwY1aBcDeFgHiJkL"; 

const CONFIG_URL =
  "https://raw.githubusercontent.com/SumanBlswas/songeet-controller/refs/heads/main/app-config-json";

export async function checkAppStatus(): Promise<AppConfig> {
  try {
    const response = await fetch(`${CONFIG_URL}?t=${Date.now()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch app config");
    }

    const json = await response.json();
    const data = json.data || json;

    // 1. Get client's public IP
    let clientIp = "";
    try {
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const ipJson = await ipRes.json();
      clientIp = ipJson.ip;
    } catch (e) {
      console.warn("[ConfigService] Failed to get public IP", e);
    }

    const blockedIps = data.blocked_ips || [];
    const isIpBlocked = clientIp ? blockedIps.includes(clientIp) : false;

    // 2. Check Version Mismatch
    const currentVersion = Constants.expoConfig?.version || "1.0.0";
    const minVersion = data.min_version || "1.0.0";
    const isVersionOutdated = currentVersion < minVersion;

    // 3. Check Build Secret (Whitelist approach)
    // The build is revoked if its secret is NOT in the allowed_secrets list
    const allowedSecrets = data.allowed_secrets || [];
    const isBuildAuthorized = allowedSecrets.includes(BUILD_SECRET);

    const isRevoked = 
      (data.revoked || false) || 
      isIpBlocked || 
      isVersionOutdated || 
      !isBuildAuthorized;

    let finalMessage = data.message || "Access to this application has been revoked by the developer.";
    if (isIpBlocked) finalMessage = "Your IP address has been restricted.";
    if (isVersionOutdated) finalMessage = `Update required! Please update to v${minVersion} to continue.`;
    if (!isBuildAuthorized) finalMessage = "This version is no longer supported. Please download the latest build.";

    return {
      revoked: isRevoked,
      message: finalMessage,
      minVersion: minVersion,
      blockedIps: blockedIps,
    };
  } catch (error) {
    console.warn("[ConfigService] Failed to check app status:", error);
    // If offline or fetch fails, we assume not revoked to allow offline playback
    // as per user requirement: "if user is offline... they can play"
    return { revoked: false };
  }
}
