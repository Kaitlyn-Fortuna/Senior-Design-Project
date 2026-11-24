import { connectSocket } from "./socket";

const TIMEOUT_MS = 15000;

// Ask the backend for data over the socket and wait for its answer (ack).
function request(event, params) {
  const socket = connectSocket();
  return new Promise((resolve, reject) => {
    socket.timeout(TIMEOUT_MS).emit(event, params, (err, response) => {
      if (err) return reject(new Error("The server took too long to answer"));
      if (response?.error) return reject(new Error(response.error));
      resolve(response);
    });
  });
}

/**
 * Readings averaged into buckets.
 * params: { startDate, endDate } (ISO) or { sinceSeconds }, plus maxPoints / bucketSeconds.
 * -> { bucketSeconds, span, points: [{ timestamp, ports, currents, voltages, powerFactors, energyWh, cost, seconds }] }
 */
export const fetchPowerSeries = (params) => request("power:series", params);

/**
 * Energy and cost per port over a window.
 * -> { energyWh: [6], cost: [6], avgW, peakW, peakTotalW, seconds, count, first, last }
 */
export const fetchEnergy = (params) => request("power:energy", params);
