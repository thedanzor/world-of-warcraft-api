/**
 * Resolve third-party API credentials from AppSettings (via getConfig).
 * Keys are stored in MongoDB during install — never exposed to the frontend.
 */

import { getConfig } from '../config.js';

export async function getRaiderioApiKey() {
  const config = await getConfig();
  const key = config.RAIDERIO_API_KEY?.trim();
  if (!key) throw new Error('Missing RAIDERIO_API_KEY in app settings');
  return key;
}

export async function getWclClientId() {
  const config = await getConfig();
  const id = config.WCL_CLIENT_ID?.trim();
  if (!id) throw new Error('Missing WCL_CLIENT_ID in app settings');
  return id;
}

export async function getWclClientSecret() {
  const config = await getConfig();
  const secret = config.WCL_CLIENT_SECRET?.trim();
  if (!secret) throw new Error('Missing WCL_CLIENT_SECRET in app settings');
  return secret;
}

export async function hasEnrichmentCredentials() {
  try {
    const config = await getConfig();
    return Boolean(
      config.RAIDERIO_API_KEY?.trim() &&
      config.WCL_CLIENT_ID?.trim() &&
      config.WCL_CLIENT_SECRET?.trim()
    );
  } catch {
    return false;
  }
}
