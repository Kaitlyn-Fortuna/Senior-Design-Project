import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL||'http://localhost:3000';

let socket = null;

export function connectSocket() {
    if(socket) 
        {
            console.log('Socket already connected');
            return socket;
        }
    else
        {
            console.log('Connecting to socket');
            socket = io(API_URL);
            return socket;
        }
}

export function disconnectSocket() {
    if(socket) {
        socket.disconnect();
        socket = null;
        console.log('Socket disconnected');
    }
    else
        {
            console.log('Socket not connected');
        }
}

export function getSocket() {
    if (socket)
    {
        console.log('Socket already connected');
        return socket;
    }
    else
    {
        console.log('Socket not connected');
        return null;
    }
}