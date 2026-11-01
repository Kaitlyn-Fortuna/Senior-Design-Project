// Number formatting shared by the dashboard

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
