import { getPortDisplayName } from "./portConfig";

/**
 * Test data configurations mapped to input ports 0 through 5 in order.
 */
export const TEST_PORT_CONFIGS = [
  { port: 0, key: "port0", color: "var(--chart-1)", baseUsage: 2.2, variance: 0.8 },
  { port: 1, key: "port1", color: "var(--chart-2)", baseUsage: 1.2, variance: 0.6 },
  { port: 2, key: "port2", color: "var(--chart-3)", baseUsage: 0.25, variance: 0.1 },
  { port: 3, key: "port3", color: "var(--chart-4)", baseUsage: 0.5, variance: 0.4 },
  { port: 4, key: "port4", color: "var(--chart-5)", baseUsage: 0.3, variance: 0.3 },
  { port: 5, key: "port5", color: "oklch(0.68 0.16 160)", baseUsage: 0.2, variance: 0.2 },
];

/**
 * Resolves test devices with current saved port display names.
 * Defaults to "Port N" if no name has been saved or if blank.
 */
export function getDevices() {
  return TEST_PORT_CONFIGS.map((config) => ({
    ...config,
    label: getPortDisplayName(config.port),
  }));
}

export const DEFAULT_DEVICES = getDevices();

export const LOOKBACK_OPTIONS = [
  { value: "12h", label: "12 hours", hours: 12 },
  { value: "24h", label: "24 hours", hours: 24 },
  { value: "48h", label: "48 hours", hours: 48 },
  { value: "7d", label: "7 days", hours: 7 * 24 },
  { value: "14d", label: "14 days", hours: 14 * 24 },
];

/**
 * Formats a Date object to YYYY-MM-DD for standard date input fields.
 */
export function formatDateForInput(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Generates 15-minute increment power usage readings for a preset lookback range
 * or a custom start/end date range.
 *
 * @param {string|{mode?: string, value?: string, startDate?: string|Date, endDate?: string|Date}} rangeOptions
 * @param {Array} devices
 */
export function generateTimeSeriesData(rangeOptions = "48h", devices = DEFAULT_DEVICES) {
  let startTimeMs;
  let intervals;

  const now = new Date();
  const remainderMinutes = now.getMinutes() % 15;
  now.setMinutes(now.getMinutes() - remainderMinutes, 0, 0);

  const isCustom = typeof rangeOptions === "object" && (rangeOptions.mode === "custom" || rangeOptions.startDate);

  if (isCustom) {
    const { startDate, endDate } = rangeOptions;
    let start;
    let end;

    if (typeof startDate === "string") {
      const parts = startDate.split("-").map(Number);
      start = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
    } else if (startDate instanceof Date) {
      start = new Date(startDate);
    } else {
      start = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    }

    if (typeof endDate === "string") {
      const parts = endDate.split("-").map(Number);
      end = new Date(parts[0], parts[1] - 1, parts[2], 23, 45, 0);
    } else if (endDate instanceof Date) {
      end = new Date(endDate);
    } else {
      end = new Date(now);
    }

    // Ensure start is before or equal to end
    if (start.getTime() > end.getTime()) {
      const temp = start;
      start = end;
      end = temp;
    }

    startTimeMs = start.getTime();
    const durationMs = end.getTime() - startTimeMs;
    const stepMs = 15 * 60 * 1000;
    // Cap at 2880 intervals (30 days of 15m) to maintain smooth performance
    intervals = Math.min(2880, Math.max(1, Math.floor(durationMs / stepMs) + 1));
  } else {
    const lookbackValue = typeof rangeOptions === "string" ? rangeOptions : rangeOptions?.value || "48h";
    const selectedOption = LOOKBACK_OPTIONS.find((o) => o.value === lookbackValue) || LOOKBACK_OPTIONS[2];
    const totalHours = selectedOption.hours;
    intervals = totalHours * 4; // 15-minute increments
    startTimeMs = now.getTime() - (intervals - 1) * 15 * 60 * 1000;
  }

  const data = [];

  for (let i = 0; i < intervals; i++) {
    const pointTime = new Date(startTimeMs + i * 15 * 60 * 1000);
    const dateStr = pointTime.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const timeStr = pointTime.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const formattedTime = `${dateStr}, ${timeStr}`;

    const point = {
      index: i,
      timestamp: pointTime.getTime(),
      formattedTime,
      dateStr,
      timeStr,
    };

    let total = 0;
    devices.forEach((device, dIdx) => {
      // Deterministic wave variation based on timestamp and device index
      const seed = Math.floor(pointTime.getTime() / (15 * 60 * 1000));
      const wave = Math.sin((seed + dIdx * 7) / 6) * 0.4 + Math.cos((seed * 2 + dIdx * 3) / 12) * 0.3;
      const noise = ((seed * 13 + dIdx * 37) % 19) / 38 - 0.25;
      const usage = Math.max(0.05, Number((device.baseUsage + (wave + noise) * device.variance).toFixed(2)));
      point[device.key] = usage;
      total += usage;
    });

    point.total = Number(total.toFixed(2));
    data.push(point);
  }

  return data;
}

