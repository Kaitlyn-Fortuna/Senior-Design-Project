// Number formatting shared by the views

/** Watts with an auto unit: 2.3 W, 845 W, 1.25 kW */
export function formatPower(watts) {
  const w = Number(watts) || 0;
  if (Math.abs(w) >= 1000) return `${(w / 1000).toFixed(2)} kW`;
  if (Math.abs(w) >= 100) return `${w.toFixed(0)} W`;
  return `${w.toFixed(1)} W`;
}

/** Amps with an auto unit: 0.21 A, 7.10 A, 45 mA */
export function formatCurrent(amps) {
  const a = Number(amps) || 0;
  if (a !== 0 && Math.abs(a) < 0.1) return `${(a * 1000).toFixed(0)} mA`;
  return `${a.toFixed(2)} A`;
}

export const formatVoltage = (v) => `${(Number(v) || 0).toFixed(1)} V`;
export const formatPf = (pf) => (Number(pf) || 0).toFixed(2);
export const formatPercent = (p) => `${(Number(p) || 0).toFixed(1)}%`;

/** kWh with sensible precision: 0.0042 kWh, 0.42 kWh, 12.3 kWh */
export function formatEnergy(kWh) {
  const e = Number(kWh) || 0;
  if (e === 0) return "0 kWh";
  if (Math.abs(e) >= 100) return `${e.toFixed(0)} kWh`;
  if (Math.abs(e) >= 10) return `${e.toFixed(1)} kWh`;
  if (Math.abs(e) >= 0.1) return `${e.toFixed(2)} kWh`;
  return `${e.toFixed(4)} kWh`;
}

/** Dollars; shows fractions of a cent for tiny amounts: $0.0042 */
export function formatMoney(dollars) {
  const d = Number(dollars) || 0;
  if (d !== 0 && Math.abs(d) < 0.01) return `$${d.toFixed(4)}`;
  return `$${d.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 45 s, 12 min, 3.5 h, 2.1 days */
export function formatDuration(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  if (s < 90) return `${Math.round(s)} s`;
  if (s < 90 * 60) return `${Math.round(s / 60)} min`;
  if (s < 48 * 3600) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 86400).toFixed(1)} days`;
}

/** "1-minute", "15-second" bucket labels */
export function formatBucket(seconds) {
  if (!seconds) return "";
  if (seconds < 60) return `${seconds}-second`;
  if (seconds < 3600) return `${seconds / 60}-minute`;
  if (seconds < 86400) return `${seconds / 3600}-hour`;
  return `${seconds / 86400}-day`;
}

/** Formats a Date object to YYYY-MM-DD for date input fields. */
export function formatDateForInput(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Short date/time label for a timestamp (ms), e.g. "Nov 19, 3:05 PM". */
export function formatTimestamp(ms, { seconds = false, date = true } = {}) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
  });
  if (!date) return time;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

export function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
