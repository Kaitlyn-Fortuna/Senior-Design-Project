import { getToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL || '';

export async function sendChatMessage(message) {
    const respone = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ message }),
    });

    const data = await respone.json().catch(() => ({}));
    if (!respone.ok) {
        throw new Error(data.error || 'Failed to send chat message');
    }
    return data.reply;
}
