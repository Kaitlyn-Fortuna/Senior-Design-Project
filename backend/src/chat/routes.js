import { Router } from "express";
import passport from "passport";
import OpenAI from "openai";
import { config } from "../config.js";

const router = Router();

const SYSTEM_PROMPT = "You are an assistant that helps users with questions about enery and power consumption. You are helpful, concise, and provide accurate information. If you don't know the answer, say 'I don't know' instead of making up an answer.";

router.post(
  "/",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    if (!config.openai.apiKey || !config.openai.model) {
      return res
        .status(503)
        .json({ error: "Assistant isn't configured properly" });
    }

    const { message } = req.body;

    if (!Array.isArray(message) || message.length === 0) {
      return res.status(400).json({ error: "Invalid message format" });
    }

    const history = message
        .filter((m) => ["user", "assistant"].includes(m.role) && typeof m.content === "string")
        .slice(-20);


    try {
      const client = new OpenAI({ apiKey: config.openai.apiKey });
      const completion = await client.chat.completions.create({
        model: config.openai.model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
      });
    return res.json({ reply: completion.choices[0].message.content });
    } catch (error) {
      console.error("Error generating response:", error.message);
      return res.status(502).json({ error: "Failed to generate response" });
    }
  },
);

export default router;
