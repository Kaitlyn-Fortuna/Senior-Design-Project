import {config} from '../config.js'
import {retrieveNewestRecord, retrieveRecentRecords, queryPowerData} from '../database/dbAccessMethods.js'
import {queryDataSpan, queryPowerSeries, queryEnergy, pickBucketSeconds} from '../database/powerQueries.js'
import {loadDeviceConfig} from '../deviceConfig.js'

// Readings sent with power:history (feeds the live graphs on the dashboard)
const LIVE_HISTORY_RECORDS = 120;

const num = (value) => Number(value) || 0;

//objectify the readings
const serializeReadings = (row) => {
    const ports = [row.p0, row.p1, row.p2, row.p3, row.p4, row.p5].map(num); // real power, W

    //return object
    return{
        id: String(row.pkey),
        timestamp: new Date(row.tstamp).toISOString(),
        ports,
        totalWatts: ports.reduce((sum, power) => sum + power, 0),
        currents: [row.i0, row.i1, row.i2, row.i3, row.i4, row.i5].map(num),        // A rms
        voltages: [row.v0, row.v1, row.v2, row.v3, row.v4, row.v5].map(num),        // V rms of the sensor each CT uses
        powerFactors: [row.pf0, row.pf1, row.pf2, row.pf3, row.pf4, row.pf5].map(num),
        price: row.price === undefined ? undefined : num(row.price),               // $/kWh saved with the row
        // Seconds since the row was saved, measured by the database clock
        ageSeconds: row.age_seconds === undefined ? undefined : num(row.age_seconds),
        isConsolidated: row.isconsolidated || false,
    }
}

// Settings the energy/cost queries need, read fresh so Setup changes apply right away
const energySettings = () => {
    const device = loadDeviceConfig();
    const insertSeconds = device.database.insert_seconds;
    return {
        insertSeconds,
        defaultPrice: device.pricing.price_per_kwh,
        nominalSeconds: insertSeconds,
        // A gap longer than this is treated as "not recording", not as usage
        gapCapSeconds: Math.max(insertSeconds * 5, 10),
    };
};

const pickWindow = (params = {}) => ({
    startDate: params.startDate,
    endDate: params.endDate,
    sinceSeconds: params.sinceSeconds,
});

// Wraps a request handler so it always answers the ack, even on errors
const respond = (handler) => async (params, ack) => {
    if (typeof ack !== 'function') return;
    try {
        ack(await handler(params ?? {}));
    } catch (error) {
        console.error('Socket request failed:', error.message);
        ack({ error: 'Failed to retrieve power data' });
    }
};

/**
 * power:series { startDate, endDate } | { sinceSeconds }, maxPoints?, bucketSeconds?
 * Averages the window into buckets sized to the data actually present.
 */
const handleSeries = async (params) => {
    const settings = energySettings();
    const window = pickWindow(params);
    const span = await queryDataSpan(window);
    if (!span) return { bucketSeconds: null, points: [], span: null };

    const maxPoints = Math.min(Math.max(Number(params.maxPoints) || 300, 10), 1500);
    const spanSeconds = (span.last - span.first) / 1000;
    const requested = Number(params.bucketSeconds);
    const bucketSeconds = requested > 0
        ? Math.max(requested, pickBucketSeconds(spanSeconds, 1500, 1))
        : pickBucketSeconds(spanSeconds, maxPoints, settings.insertSeconds);

    const points = await queryPowerSeries(window, bucketSeconds, settings);
    return {
        bucketSeconds,
        points,
        span: { first: span.first.toISOString(), last: span.last.toISOString(), count: span.count },
    };
};

/** power:energy { startDate, endDate } | { sinceSeconds } -> energy and cost per port */
const handleEnergy = async (params) => queryEnergy(pickWindow(params), energySettings());

export const initializeSocketHandlers = (io) =>
    {
        let pollInProgress = false;
        let lastReadingId = null;

        const sendReadings = async (socket) => {
            try{
                const recentRecords = await retrieveRecentRecords(LIVE_HISTORY_RECORDS);
                const readings = recentRecords.map(serializeReadings);
                socket.emit('power:history', readings);
                console.log('Sent', recentRecords.length, 'records to client');
            }catch(error){
                console.error('Error sending readings: ', error);
                socket.emit('power:error', {message:'Failed to send readings to client'});
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
        const handlePowerQuery = async (socket, queryParams = {}) => {
            try {
                console.log('Received power:query with params:', queryParams);
                const records = await queryPowerData(queryParams);
                const readings = records.map(serializeReadings);
                socket.emit('power:query_result', {
                    params: queryParams,
                    readings,
                });
                console.log('Sent', readings.length, 'query results to client');
            } catch (error) {
                console.error('Error handling power:query: ', error);
                socket.emit('power:query_result', {
                    params: queryParams,
                    readings: [],
                    error: 'Failed to retrieve power records for query',
                });
            }
        };

            io.on('connection', (socket) => {
                sendReadings(socket);
                handleConnection(socket);
                socket.on('power:refresh', () => sendReadings(socket));
                socket.on('power:query', (params) => handlePowerQuery(socket, params));
                socket.on('power:series', respond(handleSeries));
                socket.on('power:energy', respond(handleEnergy));
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
