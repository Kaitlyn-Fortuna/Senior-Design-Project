import * as db from './index.js'

export const insertRecord = async (currents = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0], voltages = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0], apparentPowers = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0], realPowers = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0], powerFactors = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0], powerprice = 0.0) => {
    //arrays that will contain values to push to db
    let currentArray = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    let voltageArray = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    let apparentPowerArray = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    let realPowerArray = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    let powerFactorArray = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];

    //loop to fill arrays
    for(let i = 0; i < 6; i++){
        //fill currentArray
        let current = 0.0;
        if(i < currents.length){current = currents[i]};
        currentArray[i] = current;

        //fill voltageArray
        let voltage = 0.0;
        if(i < voltages.length){voltage = voltages[i]};
        voltageArray[i] = voltage

        //fill apparentPowerArray
        let apparentPower = 0.0;
        if(i < apparentPowers.length){apparentPower = apparentPowers[i]};
        apparentPowerArray[i] = apparentPower;

        //fill realPowerArray
        let realPower = 0.0;
        if(i < realPowers.length){realPower = realPowers[i]};
        realPowerArray[i] = realPower;

        //fill powerFactorArray
        let powerFactor = 0.0;
        if(i < powerFactors.length){powerFactor = powerFactors[i]};
        powerFactorArray[i] = powerFactor;
    }

    //build the sql query with the calculated values
    const query = {
    text: 'INSERT INTO ' +
        'powerdata (' + 
        'i0, i1, i2, i3, i4, i5, ' + 
        'v0, v1, v2, v3, v4, v5, ' + 
        'p0, p1, p2, p3, p4, p5, ' + 
        's0, s1, s2, s3, s4, s5, ' + 
        'pf0, pf1, pf2, pf3, pf4, pf5, ' +
        'powerprice' +
        ') ' + 
        'VALUES (' +
        '$1, $2, $3, $4, $5, $6,' + 
        '$7, $8, $9, $10, $11, $12,' +
        '$13, $14, $15, $16, $17, $18,' +
        '$19, $20, $21, $22, $23, $24, ' +
        '$25, $26, $27, $28, $29, $30, ' +
        '$31' +
        ') ' + 
        'RETURNING pkey',
    values: [
        currentArray[0], currentArray[1], currentArray[2], currentArray[3], currentArray[4], currentArray[5],
        voltageArray[0], voltageArray[1], voltageArray[2], voltageArray[3], voltageArray[4], voltageArray[5],
        realPowerArray[0], realPowerArray[1], realPowerArray[2], realPowerArray[3], realPowerArray[4], realPowerArray[5],
        apparentPowerArray[0], apparentPowerArray[1], apparentPowerArray[2], apparentPowerArray[3], apparentPowerArray[4], apparentPowerArray[5],
        powerFactorArray[0], powerFactorArray[1], powerFactorArray[2], powerFactorArray[3], powerFactorArray[4], powerFactorArray[5],
        powerprice
    ]
    };

    //do the query
    const result = await db.query(query);

    //print resulting row to console
    /*
    console.log(result.rows[0]);
    console.log(iArray);
    console.log(vArray);
    console.log(pArray);
    console.log(pfArray);
    */
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
        text: `SELECT *, powerprice::numeric AS price,
            EXTRACT(EPOCH FROM (LOCALTIMESTAMP - tstamp)) AS age_seconds
            FROM powerdata ORDER BY tstamp DESC LIMIT 1`
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
        text: `SELECT *, powerprice::numeric AS price,
            EXTRACT(EPOCH FROM (LOCALTIMESTAMP - tstamp)) AS age_seconds
            FROM powerdata ORDER BY tstamp DESC LIMIT $1`,
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
