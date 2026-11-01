import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const CONFIG_PATH = path.join(here, "device-configuration.json");

// Input keys
export const CURRENT_KEYS = ["c0", "c1", "c2", "c3", "c4", "c5"];
export const VOLTAGE_KEYS = ["v0", "v1"];

// Allowed values
export const VALID_GAINS = [1, 2, 4, 8, 16, 32, 64, 128];
export const VALID_OSR = [128, 256, 512, 1024, 2048, 4096, 8192, 16256];

// Defaults
const DEFAULT_VOLTAGE = {
  enabled: true, // false = not connected: reads as 0, hidden from the dashboard
  name: "",
  transformer_input_v: 120,
  transformer_output_v: 10.4,
  divider_ratio: 23,
  gain: 1,
  calibration: 1,
};

const DEFAULT_CURRENT = {
  enabled: true, // false = not connected: reads as 0, hidden from the dashboard
  name: "",
  ct_ratio: 2400,
  ct_burden_ohms: 10,
  turns: 1,
  voltage_sensor: "v0",
  gain: 4,
  calibration: 1,
};

export const DEFAULTS = {
  inputs: {
    ...Object.fromEntries(VOLTAGE_KEYS.map((k) => [k, { ...DEFAULT_VOLTAGE }])),
    ...Object.fromEntries(CURRENT_KEYS.map((k) => [k, { ...DEFAULT_CURRENT }])),
  },
  adc: { oversampling_ratio: 1024, report_seconds: 1 },
  database: {
    insert_seconds: 1,
    min_voltage: 5,
    min_current: 0.02,
    min_power: 0.5,
  },
  leds: { min_voltage: 20, min_current: 0.05 },
};

function num(
  errors,
  label,
  value,
  fallback,
  { min, max, integer = false, oneOf } = {},
) {
  if (value === undefined || value === null) return fallback;
  if (value === "") {
    errors.push(`${label} is required`);
    return fallback;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    errors.push(`${label} must be a number`);
    return fallback;
  }
  if (integer && !Number.isInteger(n)) {
    errors.push(`${label} must be a whole number`);
    return fallback;
  }
  if (oneOf && !oneOf.includes(n)) {
    errors.push(`${label} must be one of ${oneOf.join(", ")}`);
    return fallback;
  }
  if (min !== undefined && n < min) {
    errors.push(`${label} must be at least ${min}`);
    return fallback;
  }
  if (max !== undefined && n > max) {
    errors.push(`${label} must be at most ${max}`);
    return fallback;
  }
  return n;
}

function text(errors, label, value) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    errors.push(`${label} must be text`);
    return "";
  }
  return value.trim().slice(0, 40);
}

function bool(errors, label, value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") {
    errors.push(`${label} must be true or false`);
    return fallback;
  }
  return value;
}

function choice(errors, label, value, fallback, options) {
  if (value === undefined || value === null) return fallback;
  if (!options.includes(value)) {
    errors.push(`${label} must be one of ${options.join(", ")}`);
    return fallback;
  }
  return value;
}

function validateVoltage(errors, key, input = {}) {
  const d = DEFAULT_VOLTAGE;
  return {
    enabled: bool(errors, `${key} enabled`, input.enabled, d.enabled),
    name: text(errors, `${key} name`, input.name),
    transformer_input_v: num(
      errors,
      `${key} transformer_input_v`,
      input.transformer_input_v,
      d.transformer_input_v,
      { min: 1, max: 1000 },
    ),
    transformer_output_v: num(
      errors,
      `${key} transformer_output_v`,
      input.transformer_output_v,
      d.transformer_output_v,
      { min: 0.1, max: 1000 },
    ),
    divider_ratio: num(
      errors,
      `${key} divider_ratio`,
      input.divider_ratio,
      d.divider_ratio,
      { min: 1, max: 1000 },
    ),
    gain: num(errors, `${key} gain`, input.gain, d.gain, {
      oneOf: VALID_GAINS,
    }),
    calibration: num(
      errors,
      `${key} calibration`,
      input.calibration,
      d.calibration,
      { min: 0.5, max: 2 },
    ),
  };
}

function validateCurrent(errors, key, input = {}) {
  const d = DEFAULT_CURRENT;
  return {
    enabled: bool(errors, `${key} enabled`, input.enabled, d.enabled),
    name: text(errors, `${key} name`, input.name),
    ct_ratio: num(errors, `${key} ct_ratio`, input.ct_ratio, d.ct_ratio, {
      min: 1,
      max: 100000,
    }),
    ct_burden_ohms: num(
      errors,
      `${key} ct_burden_ohms`,
      input.ct_burden_ohms,
      d.ct_burden_ohms,
      { min: 0.1, max: 1000 },
    ),
    turns: num(errors, `${key} turns`, input.turns, d.turns, {
      min: 1,
      max: 100,
      integer: true,
    }),
    voltage_sensor: choice(
      errors,
      `${key} voltage_sensor`,
      input.voltage_sensor,
      d.voltage_sensor,
      VOLTAGE_KEYS,
    ),
    gain: num(errors, `${key} gain`, input.gain, d.gain, {
      oneOf: VALID_GAINS,
    }),
    calibration: num(
      errors,
      `${key} calibration`,
      input.calibration,
      d.calibration,
      { min: 0.5, max: 2 },
    ),
  };
}

export function validateDeviceConfig(src = {}) {
  const errors = [];
  const inputs = {};
  for (const k of VOLTAGE_KEYS)
    inputs[k] = validateVoltage(errors, k, src.inputs?.[k]);
  for (const k of CURRENT_KEYS)
    inputs[k] = validateCurrent(errors, k, src.inputs?.[k]);

  const adc = {
    oversampling_ratio: num(
      errors,
      "adc oversampling_ratio",
      src.adc?.oversampling_ratio,
      DEFAULTS.adc.oversampling_ratio,
      { oneOf: VALID_OSR },
    ),
    report_seconds: num(
      errors,
      "adc report_seconds",
      src.adc?.report_seconds,
      DEFAULTS.adc.report_seconds,
      { min: 0.05, max: 60 },
    ),
  };

  const database = {
    insert_seconds: num(
      errors,
      "database insert_seconds",
      src.database?.insert_seconds,
      DEFAULTS.database.insert_seconds,
      { min: 0.05, max: 60 },
    ),
    min_voltage: num(
      errors,
      "database min_voltage",
      src.database?.min_voltage,
      DEFAULTS.database.min_voltage,
      { min: 0 },
    ),
    min_current: num(
      errors,
      "database min_current",
      src.database?.min_current,
      DEFAULTS.database.min_current,
      { min: 0 },
    ),
    min_power: num(
      errors,
      "database min_power",
      src.database?.min_power,
      DEFAULTS.database.min_power,
      { min: 0 },
    ),
  };

  const leds = {
    min_voltage: num(
      errors,
      "leds min_voltage",
      src.leds?.min_voltage,
      DEFAULTS.leds.min_voltage,
      { min: 0 },
    ),
    min_current: num(
      errors,
      "leds min_current",
      src.leds?.min_current,
      DEFAULTS.leds.min_current,
      { min: 0 },
    ),
  };

  const enabledVoltages = VOLTAGE_KEYS.filter((k) => inputs[k].enabled);
  if (enabledVoltages.length > 0) {
    for (const k of CURRENT_KEYS) {
      if (!enabledVoltages.includes(inputs[k].voltage_sensor)) {
        inputs[k].voltage_sensor = enabledVoltages[0];
      }
    }
  }

  return { config: { inputs, adc, database, leds }, errors };
}

export function ampsPerVolt(cfg, key) {
  const { ct_ratio, ct_burden_ohms, turns, calibration } = cfg.inputs[key];
  return (ct_ratio / ct_burden_ohms / turns) * calibration;
}

export function voltsPerVolt(cfg, key) {
  const { transformer_input_v, transformer_output_v, divider_ratio, calibration } =
    cfg.inputs[key];
  return divider_ratio * (transformer_input_v / transformer_output_v) * calibration;
}

export function channelGains(cfg) {
  return [...CURRENT_KEYS, ...VOLTAGE_KEYS].map((k) => cfg.inputs[k].gain);
}

export function loadDeviceConfig() {
  let rawData;
  try {
    rawData = fs.readFileSync(CONFIG_PATH, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn(`No device config found, creating ${CONFIG_PATH} with defaults`);
      saveDeviceConfig(DEFAULTS);
      return structuredClone(DEFAULTS);
    }
    console.error("Error reading device config, using defaults:", error.message);
    return structuredClone(DEFAULTS);
  }

  let parsedData;
  try {
    parsedData = JSON.parse(rawData);
  } catch (error) {
    console.error(`Device config is not valid JSON (${error.message}), using defaults until it is fixed`);
    return structuredClone(DEFAULTS);
  }

  const { config, errors } = validateDeviceConfig(parsedData);
  if (errors.length > 0) {
    console.warn("Device config problems (defaults used for these):", errors);
  }

  if (typeof parsedData.last_updated === "string") {
    return { last_updated: parsedData.last_updated, ...config };
  }
  return config;
}

export function saveDeviceConfig(cfg) {
  const { config, errors } = validateDeviceConfig(cfg);
  if (errors.length > 0) {
    console.error("Device configuration validation errors:", errors);
    throw new Error("Invalid device configuration");
  }
  const saved = { last_updated: new Date().toISOString(), ...config };
  const tmp = `${CONFIG_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(saved, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, CONFIG_PATH);
  return saved;
}

export function watchDeviceConfig(onChange) {
  fs.watchFile(CONFIG_PATH, { interval: 1000 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) onChange(loadDeviceConfig());
  });
}
