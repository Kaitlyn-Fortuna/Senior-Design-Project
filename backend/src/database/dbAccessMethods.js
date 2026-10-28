import * as db from './index.js'

export const insertRecord = async (currents = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0], voltages = [0.0, 0.0], associations = [0, 0, 0, 0, 0, 0]) => {
    //array that will contain wattage values
    let power = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];

    //loop to calculate wattage values
    for(let i = 0; i < 6; i++){
        let current = 0.0;
        if(i < currents.length){current = currents[i]};

        let voltage = 0.0;
        if(i < associations.length && associations[i] < voltages.length){voltage = voltages[associations[i]]};

        power[i] = current * voltage;
    }

    //build the sql query with the calculated values
    const query = {
    text: 'INSERT INTO powerdata(p0, p1, p2, p3, p4, p5) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    values: power
    };

    //do the query
    const result = await db.query(query);

    //print resulting row to console
    console.log(result.rows[0]);

    //return
    return result;
}

export const retrieveRecordByPKey = async (pKeyInt) =>{
    const query = {
        text: 'SELECT * FROM powerdata WHERE pkey = $1',
        values: [pKeyInt]
    };

    //do the query
    const result = await db.query(query);

    //print resulting row to console
    console.log(result.rows[0]);

    //return
    return result;
}

export const retrieveNewestRecord = async () =>{
    const query = {
        text: 'SELECT * FROM powerdata ORDER BY tstamp DESC LIMIT 1'
    };

    //do the query
    const result = await db.query(query);

    //print resulting row to console
    //console.log(result.rows[0]);

    //return
    return result;
}

export const retrieveAllRecords = async () =>{
    const query = {
        text: 'SELECT * FROM powerdata'
    };

    //do the query
    const result = await db.query(query);

    //print resulting row to console
    console.log(result.rows[0]);

    //return
    return result;
}
//limits to 48 records as the chart only shows the newest 48 records
export const retrieveRecentRecords = async ( limit = 48) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 48, 1), 200);

    const query = {
        text: 
        'SELECT * FROM powerdata ORDER BY tstamp DESC LIMIT $1',
        values: [safeLimit]
    };

    //do the query
    const result = await db.query(query);

    //return in reverse to get
    return result.rows.reverse();
}

/**
 * Queries power data based on optional date range and port selection.
 * @param {Object} params
 * @param {string|Date} [params.startDate]
 * @param {string|Date} [params.endDate]
 * @param {number[]} [params.ports] Array of port numbers (0 through 5)
 * @param {number} [params.limit] Max rows to return (defaults to 3000)
 */
export const queryPowerData = async ({ startDate, endDate, ports, limit = 3000 } = {}) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 3000, 1), 10000);
    const validPortIndices = [0, 1, 2, 3, 4, 5];

    // Determine which port columns to select
    const selectedPorts = Array.isArray(ports)
        ? ports.map(Number).filter((p) => validPortIndices.includes(p))
        : validPortIndices;

    // Build SELECT column list (always include pkey and tstamp)
    const selectCols = ['pkey', 'tstamp'];
    validPortIndices.forEach((p) => {
        if (selectedPorts.includes(p)) {
            selectCols.push(`p${p}`);
        } else {
            selectCols.push(`0 AS p${p}`);
        }
    });

    const conditions = [];
    const values = [];

    if (startDate) {
        values.push(new Date(startDate));
        conditions.push(`tstamp >= $${values.length}`);
    }

    if (endDate) {
        values.push(new Date(endDate));
        conditions.push(`tstamp <= $${values.length}`);
    }

    let sql = `SELECT ${selectCols.join(', ')} FROM powerdata`;
    if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    values.push(safeLimit);
    sql += ` ORDER BY tstamp ASC LIMIT $${values.length}`;

    const query = {
        text: sql,
        values,
    };

    const result = await db.query(query);
    return result.rows;
};
