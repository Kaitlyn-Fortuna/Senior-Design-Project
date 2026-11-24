import { computed, reactive } from "vue";

// Shared, reactive view of the inputs in device-configuration.json
// (name, colour, enabled, voltage leg) plus pricing and logging interval.
// Every page reads from here, so a change saved on Setup shows up everywhere.
// Cached in localStorage so pages render with the right names/colours before
// the server answers.

export const CURRENT_KEYS = ["c0", "c1", "c2", "c3", "c4", "c5"];
export const VOLTAGE_KEYS = ["v0", "v1"];
const ALL_KEYS = [...CURRENT_KEYS, ...VOLTAGE_KEYS];

const CACHE_KEY = "energy_monitor_inputs";

export const DEFAULT_COLORS = {
  c0: "#84cc16",
  c1: "#0ea5e9",
  c2: "#f97316",
  c3: "#a855f7",
  c4: "#ef4444",
  c5: "#14b8a6",
  v0: "#eab308",
  v1: "#6366f1",
};

/** "c0" -> "Current Clamp 0", "v1" -> "Voltage Sensor 1" */
export function defaultInputName(key) {
  const n = key.slice(1);
  return key.startsWith("v") ? `Voltage Sensor ${n}` : `Current Clamp ${n}`;
}

function defaults() {
  return {
    inputs: Object.fromEntries(
      ALL_KEYS.map((k) => [
        k,
        { name: "", color: DEFAULT_COLORS[k], enabled: true, voltage_sensor: "v0" },
      ]),
    ),
    pricePerKwh: 0.15,
    insertSeconds: 1,
  };
}

function readCache() {
  const base = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!saved) return base;
    for (const k of ALL_KEYS) Object.assign(base.inputs[k], saved.inputs?.[k] ?? {});
    if (Number.isFinite(saved.pricePerKwh)) base.pricePerKwh = saved.pricePerKwh;
    if (Number.isFinite(saved.insertSeconds)) base.insertSeconds = saved.insertSeconds;
  } catch {
    // ignore a bad cache
  }
  return base;
}

const state = reactive(readCache());

/** Copy the parts of a device config the views need into the shared store. */
export function applyDeviceConfig(config) {
  if (!config?.inputs) return;
  for (const k of ALL_KEYS) {
    const input = config.inputs[k] ?? {};
    Object.assign(state.inputs[k], {
      name: input.name ?? "",
      color: input.color || DEFAULT_COLORS[k],
      enabled: input.enabled !== false,
      voltage_sensor: input.voltage_sensor ?? "v0",
    });
  }
  if (Number.isFinite(config.pricing?.price_per_kwh)) {
    state.pricePerKwh = config.pricing.price_per_kwh;
  }
  if (Number.isFinite(config.database?.insert_seconds)) {
    state.insertSeconds = config.database.insert_seconds;
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked; the in-memory store still works
  }
}

export const inputName = (key) => state.inputs[key]?.name?.trim() || defaultInputName(key);
export const inputColor = (key) => state.inputs[key]?.color || DEFAULT_COLORS[key];
export const isInputEnabled = (key) => state.inputs[key]?.enabled !== false;

function describe(key) {
  const port = Number(key.slice(1));
  const input = state.inputs[key];
  return {
    key,
    port,
    label: inputName(key),
    color: inputColor(key),
    enabled: input.enabled !== false,
    // Clamps only: which voltage sensor (0 = v0, 1 = v1)
    leg: input.voltage_sensor === "v1" ? 1 : 0,
  };
}

/** All current clamps (enabled or not), in port order. */
export const allCurrentInputs = computed(() => CURRENT_KEYS.map(describe));
/** Current clamps that are turned on. */
export const enabledCurrentInputs = computed(() =>
  allCurrentInputs.value.filter((i) => i.enabled),
);
/** Voltage sensors that are turned on. */
export const enabledVoltageInputs = computed(() =>
  VOLTAGE_KEYS.map(describe).filter((i) => i.enabled),
);

export const pricePerKwh = computed(() => state.pricePerKwh);
export const insertSeconds = computed(() => state.insertSeconds);

/**
 * How old the newest reading may be and still count as "live".
 * A few insert intervals, never less than 10 s.
 */
export const liveThresholdSeconds = computed(() => Math.max(10, state.insertSeconds * 4));
