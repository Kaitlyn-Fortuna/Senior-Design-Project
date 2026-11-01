import { getToken } from "./auth";

const API_URL = import.meta.env.VITE_API_URL || "";

async function request(method, body) {
  const response = await fetch(`${API_URL}/api/config`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    throw Object.assign(new Error("Your session expired. Log in again."), {
      status: 401,
    });
  }
  if (!response.ok) {
    throw Object.assign(new Error(data.error || "Request failed"), {
      status: response.status,
      errors: data.errors || [],
    });
  }
  return data;
}

export function fetchDeviceConfig() {
  return request("GET");
}

export function saveDeviceConfig(config) {
  return request("PUT", config);
}
