import { Router } from "express";
import passport from "passport";
import {
  DEFAULTS,
  VALID_GAINS,
  VALID_OSR,
  loadDeviceConfig,
  saveDeviceConfig,
  validateDeviceConfig,
} from "../deviceConfig.js";

const router = Router();
const requireLogin = passport.authenticate("jwt", { session: false });

router.get("/", requireLogin, (_req, res, next) => {
  try {
    res.json({
      config: loadDeviceConfig(),
      defaults: DEFAULTS,
      validGains: VALID_GAINS,
      validOsr: VALID_OSR,
    });
  } catch (err) {
    next(err);
  }
});

router.put("/", requireLogin, (req, res, next) => {
  try {
    const { errors } = validateDeviceConfig(req.body);
    if (errors.length > 0) {
      return res
        .status(400)
        .json({ error: "Some settings are invalid", errors });
    }
    const config = saveDeviceConfig(req.body);
    return res.json({ config });
  } catch (err) {
    return next(err);
  }
});

export default router;
