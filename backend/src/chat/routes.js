import { Router } from "express";
import passport from "passport";
import OpenAI from "openai";
import { config } from "../config.js";

const router = Router();

// Largest view summary accepted from the browser (characters of JSON)
const MAX_CONTEXT_CHARS = 8000;

const BASE_PROMPT = `You are the Energy Assistant inside a home smart power meter web app.
The meter has up to six current clamps (inputs C0-C5, one per circuit or appliance) and two voltage sensors (V0, V1, one per leg of split-phase power). Each clamp is paired with one voltage sensor to calculate real power (W), apparent power (VA) and power factor. Readings are saved to a database every few seconds.
Be helpful, concise and accurate. Use the "current view summary" below as the source of truth for the user's numbers; it describes what is on their screen right now. Don't invent readings that aren't in it. If the summary doesn't contain what they ask, say so and tell them where in the app to find it. Use plain language and short answers (a few sentences or a short list). Format money as dollars and energy in kWh.`;

const PAGE_PROMPTS = {
  dashboard: `The user is on the DASHBOARD (main page). It shows:
- A Live section (only when readings are arriving in real time) with total power, per-input power, current, voltage and power factor, and live graphs.
- A power usage chart for the last 48 hours. Users can click and drag across the chart to select a time range and see the energy (kWh) and cost for it.
- Energy by device (pie chart) for the same 48 hours.
- A cost view: what usage costs right now ($ per hour and per minute) and the cost of each 1-minute interval over the last hour.
Help the user understand their usage, what is using the most power, what it costs, and how to save energy. Inputs that are turned off are hidden here.`,

  details: `The user is on the DETAILS page. It has a date range filter, device (input) filters, a multi-line chart of power per device and a table of averaged readings. The page refreshes on its own while the range includes today. Users can drag across the chart to select a time range and get its energy and cost. Disabled inputs are hidden unless "Show disabled sources" is turned on (useful for history from inputs that are now off).
Help the user analyse the selected range: compare devices, spot peaks and unusual usage, explain energy (kWh = average kW x hours) and cost (kWh x price).`,

  setup: `The user is on the SETUP page, where the meter is configured. Changes save automatically. Help them set it up correctly. What the settings mean:
- Each input can be enabled/disabled, given a display name and a colour (the colour is used for that input on every chart). Disabled inputs read zero and are hidden on the dashboard.
- Electricity price ($/kWh) is saved with each reading and used for all cost numbers. Typical US residential prices are about $0.10-$0.30/kWh; check the utility bill.
- Current clamp (CT) advanced settings: CT ratio (turns ratio of the clamp, e.g. 2400 for a 2400:1 CT), burden resistor (ohms across the CT output), turns (how many times the wire passes through the clamp; power is divided by this), voltage sensor (which leg V0/V1 the circuit is on; wrong leg gives a bad power factor or negative power), gain (ADC gain; higher for small currents but clips large ones) and calibration (fine multiplier 0.5-2, adjust by comparing to a known meter).
- Voltage sensor advanced settings: transformer input/output voltage (e.g. 120 V -> 10.4 V), divider ratio, gain, calibration.
- Advanced system settings: ADC oversampling ratio and report interval (need a restart and can break hardware, change rarely), database insert interval and minimum voltage/current/power (smaller readings are saved as 0 to hide noise), and LED thresholds.
Common problems: negative power -> clamp on backwards or wrong voltage leg; power factor far from 1 on a resistive load -> wrong leg; readings of 0 -> input disabled or below the minimums.`,
};

function buildSystemPrompt(page, context) {
  const parts = [BASE_PROMPT, PAGE_PROMPTS[page] ?? PAGE_PROMPTS.dashboard];
  if (context && typeof context === "object") {
    let summary = JSON.stringify(context);
    if (summary.length > MAX_CONTEXT_CHARS) {
      summary = `${summary.slice(0, MAX_CONTEXT_CHARS)}... (truncated)`;
    }
    parts.push(`Current view summary (JSON, generated ${new Date().toISOString()}):\n${summary}`);
  } else {
    parts.push("No view summary is available yet (data may still be loading).");
  }
  return parts.join("\n\n");
}

router.post(
  "/",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    if (!config.openai.apiKey || !config.openai.model) {
      return res
        .status(503)
        .json({ error: "Assistant isn't configured properly" });
    }

    const { message, page, context } = req.body;

    if (!Array.isArray(message) || message.length === 0) {
      return res.status(400).json({ error: "Invalid message format" });
    }

    const history = message
        .filter((m) => ["user", "assistant"].includes(m.role) && typeof m.content === "string")
        .slice(-20);

    const pageKey = typeof page === "string" && PAGE_PROMPTS[page] ? page : "dashboard";

    try {
      const client = new OpenAI({ apiKey: config.openai.apiKey });
      const completion = await client.chat.completions.create({
        model: config.openai.model,
        messages: [{ role: "system", content: buildSystemPrompt(pageKey, context) }, ...history],
      });
    return res.json({ reply: completion.choices[0].message.content });
    } catch (error) {
      console.error("Error generating response:", error.message);
      return res.status(502).json({ error: "Failed to generate response" });
    }
  },
);

export default router;
