// Turns the assistant's Markdown replies into safe HTML.
import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ gfm: true, breaks: true });

// Links from the assistant open in a new tab
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

export function renderMarkdown(text) {
  if (!text) return "";
  const html = marked.parse(String(text), { async: false });
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
