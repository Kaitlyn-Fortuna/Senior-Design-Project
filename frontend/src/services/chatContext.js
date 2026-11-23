// Lets each page tell the chat assistant what is on screen.
// A page registers a function that returns a small summary object (not raw
// readings), and the chat widget calls it when a message is sent.

const providers = new Map();

export function setChatContext(page, getSummary) {
  providers.set(page, getSummary);
}

export function clearChatContext(page, getSummary) {
  if (!getSummary || providers.get(page) === getSummary) providers.delete(page);
}

export function getChatContext(page) {
  const getSummary = providers.get(page);
  if (!getSummary) return null;
  try {
    return getSummary();
  } catch (err) {
    console.warn("Could not build chat summary:", err);
    return null;
  }
}
