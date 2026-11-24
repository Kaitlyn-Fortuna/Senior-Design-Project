// Thin compatibility layer over the shared input store (services/inputs.js).
import { defaultInputName, inputName } from "./inputs";

export { defaultInputName };

/**
 * Display name for a port index (0-7).
 * Ports 0-5 are current inputs c0-c5, ports 6-7 are voltage inputs v0-v1.
 */
export function getPortDisplayName(portIndex) {
  return inputName(portIndex < 6 ? `c${portIndex}` : `v${portIndex - 6}`);
}
