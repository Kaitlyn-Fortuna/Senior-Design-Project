import { ref } from "vue";
import { requestSummary } from "@/services/chatbot";

/**
 * State for one inline "Summarize" button.
 * `getData` builds the compact data object at the moment the user clicks.
 */
export function useAiSummary(section, getData) {
  const text = ref("");
  const loading = ref(false);
  const error = ref("");
  const generatedAt = ref(null);
  const open = ref(false);
  let seq = 0;

  async function generate() {
    const id = ++seq;
    open.value = true;
    loading.value = true;
    error.value = "";
    try {
      const summary = await requestSummary(section, getData());
      if (id !== seq) return;
      text.value = summary;
      generatedAt.value = new Date();
    } catch (err) {
      if (id === seq) error.value = err.message;
    } finally {
      if (id === seq) loading.value = false;
    }
  }

  function dismiss() {
    seq++; // ignore a reply that is still on its way
    open.value = false;
    loading.value = false;
    error.value = "";
    text.value = "";
    generatedAt.value = null;
  }

  return { text, loading, error, generatedAt, open, generate, dismiss };
}

/**
 * Averages chart points down to at most `max` rows so a summary request stays small.
 * Points look like { t, total, [key]: watts }. Returns [{ time, totalW, ...perKeyW }].
 */
export function powerProfile(points, keys, { max = 48, labelFor = (k) => k } = {}) {
  if (!points.length) return [];
  const size = Math.ceil(points.length / max);
  const rows = [];
  for (let i = 0; i < points.length; i += size) {
    const group = points.slice(i, i + size);
    const avg = (pick) => Math.round(group.reduce((s, p) => s + (pick(p) || 0), 0) / group.length);
    const row = {
      time: new Date(group[0].t).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      totalW: avg((p) => p.total),
    };
    for (const k of keys) row[labelFor(k)] = avg((p) => p[k]);
    rows.push(row);
  }
  return rows;
}
