import { computed, onMounted, onUnmounted, ref } from "vue";
import { connectSocket } from "@/services/socket";
import { liveThresholdSeconds } from "@/services/inputs";

const HISTORY_LENGTH = 120; // readings kept for the live graphs

/**
 * Newest readings from the socket and whether they are arriving in real time.
 * "Live" means the newest reading is younger than liveThresholdSeconds.
 * Age comes from the database clock, so a wrong browser clock can't fake it.
 */
export function useLiveReadings({ onReading } = {}) {
  const history = ref([]); // oldest first
  const latest = computed(() => history.value.at(-1) ?? null);
  const connected = ref(false);

  // Browser time (ms) at which the newest reading was saved
  const latestSavedAt = ref(null);
  const now = ref(Date.now());

  const ageSeconds = computed(() =>
    latestSavedAt.value === null ? null : (now.value - latestSavedAt.value) / 1000,
  );
  const isLive = computed(
    () => ageSeconds.value !== null && ageSeconds.value <= liveThresholdSeconds.value,
  );

  function markSaved(reading) {
    if (!reading) return;
    const age = Number.isFinite(reading.ageSeconds) ? reading.ageSeconds : null;
    latestSavedAt.value = age === null ? Date.parse(reading.timestamp) : Date.now() - age * 1000;
    now.value = Date.now();
  }

  function handleHistory(readings) {
    history.value = readings.slice(-HISTORY_LENGTH);
    markSaved(readings.at(-1));
  }

  function handleUpdate(reading) {
    if (latest.value?.id === reading.id) return;
    history.value = [...history.value, reading].slice(-HISTORY_LENGTH);
    markSaved(reading);
    onReading?.(reading);
  }

  const onConnect = () => {
    connected.value = true;
  };
  const onDisconnect = () => {
    connected.value = false;
  };
  const onError = (error) => console.error("Power error", error.message);

  let socket = null;
  let clock = null;

  onMounted(() => {
    socket = connectSocket();
    connected.value = socket.connected;
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("power:history", handleHistory);
    socket.on("power:update", handleUpdate);
    socket.on("power:error", onError);
    socket.emit("power:refresh");
    clock = setInterval(() => (now.value = Date.now()), 1000);
  });

  onUnmounted(() => {
    clearInterval(clock);
    if (!socket) return;
    socket.off("connect", onConnect);
    socket.off("disconnect", onDisconnect);
    socket.off("power:history", handleHistory);
    socket.off("power:update", handleUpdate);
    socket.off("power:error", onError);
  });

  return { history, latest, connected, isLive, ageSeconds };
}
