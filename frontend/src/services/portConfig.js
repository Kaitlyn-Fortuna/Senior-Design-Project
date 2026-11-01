// LocalStorage key for port names
export const PORT_NAMES_STORAGE_KEY = "energy_monitor_port_names";

/**
 * Retrieves saved port names array from localStorage.
 * NOTE: Currently stored in localStorage. Once backend integration is implemented,
 * these names should be fetched from the database via API.
 */
export function getSavedPortNames() {
  try {
    const saved = localStorage.getItem(PORT_NAMES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to retrieve port names from localStorage:", err);
  }
  return [];
}

/**
 * Saves port names array to localStorage.
 * NOTE: Currently stored in localStorage. Once backend integration is implemented,
 * these names should be saved to the database via API.
 */
export function saveSavedPortNames(names) {
  try {
    localStorage.setItem(PORT_NAMES_STORAGE_KEY, JSON.stringify(names));
  } catch (err) {
    console.error("Failed to save port names to localStorage:", err);
  }
}

/**
 * Resolves the display name for a given port index (0-7).
 * If a port has no saved name or it is blank, defaults to "Port N" where N is the port number.
 *
 * @param {number} portIndex - The hardware port index (0 through 7)
 * @returns {string} The resolved display name
 */
export function getPortDisplayName(portIndex) {
  const names = getSavedPortNames();
  const name = names[portIndex];
  if (name && typeof name === "string" && name.trim().length > 0) {
    return name.trim();
  }
  return `Port ${portIndex}`;
}
