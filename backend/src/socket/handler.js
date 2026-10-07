
export const initializeSocketHandlers = (io) => 
    {
            io.on('connection', (socket) => {
                handleConnection(socket);
                socket.on('disconnect', (reason) => handleDisconnect(socket, reason));            
                socket.on('error', (error) => handleError(socket, error));
            });
    };


export const handleConnection = (socket) => 
    {
        console.log("Socket connected", socket.id);
    }
export const handleDisconnect = (socket, reason) => 
    {
        console.log("Socket disconnected", socket.id, 'reason:', reason);
    }
export const handleError = (socket, error) => 
    {
        console.error('Socket error', socket.id, 'error:', error);
    }