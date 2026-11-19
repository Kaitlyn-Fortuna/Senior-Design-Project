import { Router } from "express";
import passport from "passport";
import {
  loadDeviceConfig,
  saveDeviceConfig,
  validateDeviceConfig,
  CURRENT_KEYS,
  VOLTAGE_KEYS,
  VALID_GAINS,
  VALID_OSR,
} from "./deviceConfig.js";

const router = Router();

router.use(passport.authenticate("jwt", { session: false }));

const OPTIONS = {
  currentKeys: CURRENT_KEYS,
  voltageKeys: VOLTAGE_KEYS,
  gains: VALID_GAINS,
  oversamplingRatios: VALID_OSR,
};

// Current device-configuration.json (defaults filled in for anything missing)
router.get("/", (_req, res) => {
  res.json({ config: loadDeviceConfig(), options: OPTIONS });
});

// Validate and write device-configuration.json.
// smartPowerMeter.js picks the change up through watchDeviceConfig().
router.put("/", (req, res) => {
  const { errors } = validateDeviceConfig(req.body ?? {});
  if (errors.length > 0) {
    return res.status(400).json({ error: "Invalid device configuration", errors });
  }
  try {
    const saved = saveDeviceConfig(req.body);
    return res.json({ config: saved });
  } catch (error) {
    console.error("Failed to save device configuration:", error);
    return res.status(500).json({ error: "Failed to save device configuration" });
  }
});

export default router;
