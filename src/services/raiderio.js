/**
 * Raider.io API client
 */

import { getRaiderioApiKey } from './secrets.js';
import { getConfig } from '../config.js';

const DEFAULT_RIO_BASE = 'https://raider.io/api/v1';

export async function rioGet(path, params = {}) {
  const config = await getConfig();
  const base = config.rioBase || DEFAULT_RIO_BASE;
  const { skipKey, ...rest } = params;
  const query = skipKey ? rest : { access_key: await getRaiderioApiKey(), ...rest };
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v != null) search.set(k, String(v));
  }
  const url = `${base}${path}?${search.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'WoWAuditTool/2.0' },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Raider.io ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}
