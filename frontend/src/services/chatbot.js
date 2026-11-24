import { getToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Sends the conversation and streams the assistant's reply.
 * @param {Array} message  chat history [{ role, content }]
 * @param {{ page?: string, context?: object, onDelta?: (text: string) => void, signal?: AbortSignal }} options
 *   page/context: page the user is on and its summary; onDelta: called with each new piece of text;
 *   signal: aborts the request (e.g. when the user starts a new chat)
 * @returns {Promise<string>} the full reply
 */
export async function sendChatMessage(message, { page, context, onDelta, signal } = {}) {
    const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ message, page, context }),
        signal,
    });

    if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send chat message');
    }

    // Body is newline-delimited JSON: {"delta"} events, then {"done"} or {"error"}
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    let reply = '';
    let finished = false;

    const handle = (line) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.error) throw new Error(event.error);
        if (event.done) finished = true;
        if (event.delta) {
            reply += event.delta;
            onDelta?.(event.delta);
        }
    };

    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop();
        lines.forEach(handle);
    }
    handle(buffer);

    if (!finished) throw new Error('The reply was interrupted');
    return reply;
}

/**
 * Short inline summary of one section of a page.
 * @param {string} section  which summary (see SUMMARY_SECTIONS in the backend)
 * @param {object} data     compact numbers for that section
 */
export async function requestSummary(section, data) {
    const response = await fetch(`${API_URL}/api/chat/summarize`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ section, data }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(body.error || 'Failed to summarize');
    }
    return body.summary;
}
