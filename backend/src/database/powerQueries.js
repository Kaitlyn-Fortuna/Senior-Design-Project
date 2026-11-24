import * as db from './index.js';

// Aggregate queries over powerdata for charts, energy and cost.
//
// Energy is the integral of power over time. Each row stands for the time
// until the next row (dt). dt is capped so a gap in recording (meter off,
// network down) doesn't count as if the last reading kept going. The last
// row in a window gets the nominal insert interval.
//
// Price: each row's powerprice ($/kWh). Rows saved before prices were
// recorded have 0, so they fall back to the configured price.

const PORTS = [0, 1, 2, 3, 4, 5];

// Bucket sizes the chart can use (seconds)
const BUCKET_STEPS = [
  1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800,
  21600, 43200, 86400,
];

/**
 * Smallest "nice" bucket that keeps a span under maxPoints buckets,
 * and never finer than how often rows are saved.
 */
export function pickBucketSeconds(spanSeconds, maxPoints, insertSeconds = 1) {
  const target = Math.max(spanSeconds / Math.max(maxPoints, 1), insertSeconds, 1);
  return BUCKET_STEPS.find((s) => s >= target) ?? BUCKET_STEPS.at(-1);
}

/**
 * WHERE clause for a time window. Either an absolute { startDate, endDate }
 * or a relative { sinceSeconds } measured against the database clock, which
 * is the same clock the rows are stamped with.
 */
function windowClause({ startDate, endDate, sinceSeconds }, values) {
  const conditions = [];
  if (Number.isFinite(Number(sinceSeconds)) && Number(sinceSeconds) > 0) {
    values.push(Number(sinceSeconds));
    conditions.push(`tstamp >= LOCALTIMESTAMP - make_interval(secs => $${values.length})`);
  } else {
    if (startDate) {
      values.push(new Date(startDate));
      conditions.push(`tstamp >= $${values.length}`);
    }
    if (endDate) {
      values.push(new Date(endDate));
      conditions.push(`tstamp <= $${values.length}`);
    }
  }
  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
}

// Rows in the window with their price and duration (dt, seconds)
function rowsCte(window, { defaultPrice, nominalSeconds, gapCapSeconds }, values) {
  const where = windowClause(window, values);
  values.push(defaultPrice, nominalSeconds, gapCapSeconds);
  const [price, nominal, cap] = [values.length - 2, values.length - 1, values.length];
  const cols = PORTS.map((p) => `p${p}, i${p}, v${p}, pf${p}`).join(', ');
  return `
    WITH r AS (
      SELECT tstamp, ${cols},
        COALESCE(NULLIF(powerprice::numeric, 0), $${price})::float8 AS price,
        LEAST(
          COALESCE(EXTRACT(EPOCH FROM (LEAD(tstamp) OVER (ORDER BY tstamp) - tstamp)), $${nominal}),
          $${cap}
        )::float8 AS dt
      FROM powerdata
      ${where}
    )`;
}

const num = (v) => Number(v) || 0;

/** First and last timestamp in a window (null when it has no rows). */
export async function queryDataSpan(window) {
  const values = [];
  const sql = `SELECT MIN(tstamp) AS first, MAX(tstamp) AS last, COUNT(*) AS n
    FROM powerdata ${windowClause(window, values)}`;
  const { rows } = await db.query(sql, values);
  const row = rows[0];
  if (!row || !row.first) return null;
  return { first: new Date(row.first), last: new Date(row.last), count: Number(row.n) };
}

/**
 * Readings averaged into time buckets.
 * Returns [{ timestamp, count, ports (avg W), currents (avg A), voltages (avg V),
 *            powerFactors, energyWh, cost ($), seconds (time covered) }]
 */
export async function queryPowerSeries(window, bucketSeconds, settings) {
  const values = [];
  const cte = rowsCte(window, settings, values);
  values.push(bucketSeconds);
  const b = `$${values.length}`;
  const perPort = PORTS.map(
    (p) => `AVG(p${p}) AS p${p}, AVG(i${p}) AS i${p}, AVG(v${p}) AS v${p},
      AVG(NULLIF(pf${p}, 0)) AS pf${p},
      SUM(p${p} * dt) AS e${p}, SUM(p${p} * dt * price) AS c${p}`,
  ).join(',\n');
  const sql = `${cte}
    SELECT
      (to_timestamp(floor(EXTRACT(EPOCH FROM tstamp) / ${b}) * ${b}) AT TIME ZONE 'UTC') AS bucket,
      COUNT(*) AS n, SUM(dt) AS seconds,
      ${perPort}
    FROM r GROUP BY 1 ORDER BY 1`;
  const { rows } = await db.query(sql, values);
  return rows.map((row) => ({
    timestamp: new Date(row.bucket).toISOString(),
    count: Number(row.n),
    seconds: num(row.seconds),
    ports: PORTS.map((p) => num(row[`p${p}`])),
    currents: PORTS.map((p) => num(row[`i${p}`])),
    voltages: PORTS.map((p) => num(row[`v${p}`])),
    powerFactors: PORTS.map((p) => num(row[`pf${p}`])),
    energyWh: PORTS.map((p) => num(row[`e${p}`]) / 3600),
    cost: PORTS.map((p) => num(row[`c${p}`]) / 3.6e6),
  }));
}

/**
 * Energy and cost per port over a window.
 * Returns { energyWh: [6], cost: [6], peakW: [6], avgW: [6], seconds, count, first, last }
 */
export async function queryEnergy(window, settings) {
  const values = [];
  const cte = rowsCte(window, settings, values);
  const perPort = PORTS.map(
    (p) => `SUM(p${p} * dt) AS e${p}, SUM(p${p} * dt * price) AS c${p}, MAX(p${p}) AS m${p}`,
  ).join(',\n');
  const sql = `${cte}
    SELECT COUNT(*) AS n, SUM(dt) AS seconds, MIN(tstamp) AS first, MAX(tstamp) AS last,
      MAX(${PORTS.map((p) => `p${p}`).join(' + ')}) AS peak_total,
      ${perPort}
    FROM r`;
  const { rows } = await db.query(sql, values);
  const row = rows[0] ?? {};
  const seconds = num(row.seconds);
  const energyWh = PORTS.map((p) => num(row[`e${p}`]) / 3600);
  return {
    count: Number(row.n) || 0,
    seconds,
    first: row.first ? new Date(row.first).toISOString() : null,
    last: row.last ? new Date(row.last).toISOString() : null,
    energyWh,
    cost: PORTS.map((p) => num(row[`c${p}`]) / 3.6e6),
    peakW: PORTS.map((p) => num(row[`m${p}`])),
    avgW: energyWh.map((wh) => (seconds > 0 ? (wh * 3600) / seconds : 0)),
    peakTotalW: num(row.peak_total),
  };
}
