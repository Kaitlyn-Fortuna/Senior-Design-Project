import { getToken } from "./auth";
import { saveSavedPortNames } from "./portConfig";

const API_URL = import.meta.env.VITE_API_URL || "";

// Order matches the port indices used elsewhere (ports 0-5 = c0-c5, 6-7 = v0-v1)
export const CURRENT_KEYS = ["c0", "c1", "c2", "c3", "c4", "c5"];
export const VOLTAGE_KEYS = ["v0", "v1"];

async function request(method, body) {
  const response = await fetch(`${API_URL}/api/device-config`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.errors = Array.isArray(data.errors) ? data.errors : [];
    throw error;
  }
  return data;
}

/** GET /api/device-config -> { config, options } */
export function fetchDeviceConfig() {
  return request("GET");
}

/** PUT /api/device-config -> { config } (the saved file contents) */
export function putDeviceConfig(config) {
  return request("PUT", config);
}

/**
 * Copies the input names from the device config into the local port-name
 * cache that the dashboard and detail pages read from.
 */
export function cachePortNames(config) {
  const inputs = config?.inputs ?? {};
  saveSavedPortNames(
    [...CURRENT_KEYS, ...VOLTAGE_KEYS].map((k) => inputs[k]?.name ?? ""),
  );
}

/** Refresh the cached port names from the server (no-op when logged out). */
export async function syncPortNamesFromServer() {
  if (!getToken()) return;
  try {
    const { config } = await fetchDeviceConfig();
    cachePortNames(config);
  } catch (err) {
    console.warn("Could not sync port names from device config:", err.message);
  }
}
