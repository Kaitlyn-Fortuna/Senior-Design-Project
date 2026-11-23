import { getToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * @param {Array} message  chat history [{ role, content }]
 * @param {{ page?: string, context?: object }} view  page the user is on and its summary
 */
export async function sendChatMessage(message, { page, context } = {}) {
    const respone = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ message, page, context }),
    });

    const data = await respone.json().catch(() => ({}));
    if (!respone.ok) {
        throw new Error(data.error || 'Failed to send chat message');
    }
    return data.reply;
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
