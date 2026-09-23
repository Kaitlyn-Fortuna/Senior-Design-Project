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
 * Generates 15-minute increment power usage readings for the specified lookback range.
 * Keep this simple and lightweight so real data can easily replace it.
 */
export function generateTimeSeriesData(lookbackValue = "48h", devices = DEFAULT_DEVICES) {
  const selectedOption = LOOKBACK_OPTIONS.find((o) => o.value === lookbackValue) || LOOKBACK_OPTIONS[2];
  const totalHours = selectedOption.hours;
  const intervals = totalHours * 4; // 15-minute increments

  const now = new Date();
  // Round down to the nearest 15-minute boundary
  const remainderMinutes = now.getMinutes() % 15;
  now.setMinutes(now.getMinutes() - remainderMinutes, 0, 0);

  const data = [];
  const startTimeMs = now.getTime() - (intervals - 1) * 15 * 60 * 1000;

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
      // Simple pseudo-variation based on index and device index
      const wave = Math.sin((i + dIdx * 7) / 6) * 0.4 + Math.cos((i * 2 + dIdx * 3) / 12) * 0.3;
      const noise = ((i * 13 + dIdx * 37) % 19) / 38 - 0.25;
      const usage = Math.max(0.05, Number((device.baseUsage + (wave + noise) * device.variance).toFixed(2)));
      point[device.key] = usage;
      total += usage;
    });

    point.total = Number(total.toFixed(2));
    data.push(point);
  }

  return data;
}
