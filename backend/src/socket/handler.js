import {config} from '../config.js'
import {retrieveNewestRecord, retrieveRecentRecords} from '../database/dbAccessMethods.js'

const MAX_RECORDS = 48;

//objectify the readings
const serializeReadings = (row) => {
    const ports = [row.p0, row.p1, row.p2, row.p3, row.p4, row.p5].map((value) => Number(value) || 0);

    //return object
    return{
        id: String(row.pkey),
        timestamp: new Date(row.tstamp).toISOString(),
        ports,
        totalWatts: ports.reduce((sum, power) => sum + power, 0),
        isConsolidated: row.isconsolidated || false,
    }
}

export const initializeSocketHandlers = (io) => 
    {
        let pollInProgress = false;
        let lastReadingId = null;

        const sendReadings = async (socket) => {
            try{
                const recentRecords = await retrieveRecentRecords(MAX_RECORDS);
                const readings = recentRecords.map(serializeReadings);
        
                if(readings.length > 0){
                    lastReadingId = readings.at(-1).id;
        
                }
                socket.emit('power:history', readings);
                console.log('Sent', recentRecords.length, 'records to client');
            }catch(error){
                console.error('Error sending readings: ', error);
                socket.emit('power:error', 'Failed to sending readings to client');
            }
        }

        const sendNewestReading = async () => {
            //ensures no polling and checks if theres any connections
            if(pollInProgress || io.engine.clientsCount  === 0){
                return;
            }
            pollInProgress = true;
            try{
                const newestRecord = await retrieveNewestRecord();
                const row = newestRecord.rows[0];
                if(!row){
                    return;
                }
                const reading = serializeReadings(row);
                if (reading.id !== lastReadingId){
                    lastReadingId = reading.id;
                    io.emit('power:update', reading);
                }
                }catch(error){
                    console.error('Unable to get newest record: ', error.message);
                }finally{
                    pollInProgress = false;
                }
        }
            io.on('connection', (socket) => {
                sendReadings(socket);
                handleConnection(socket);
                socket.on('power:refresh', () => sendReadings(socket));
                socket.on('disconnect', (reason) => handleDisconnect(socket, reason));            
                socket.on('error', (error) => handleError(socket, error));
            });

            const timer = setInterval(sendNewestReading, config.socketTimer);
            timer.unref();
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