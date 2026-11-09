import * as db from './index.js'

export const insertRecord = async (currents = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0], voltages = [0.0, 0.0], associations = [0, 0, 0, 0, 0, 0]) => {
    //arrays that will contain values to push to db
    let iArray = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    let vArray = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    let pArray = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    let pfArray = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];

    //loop to fill arrays
    for(let i = 0; i < 6; i++){

        //fill iArray
        let current = 0.0;
        if(i < currents.length){current = currents[i]};
        iArray[i] = current;

        //fill vArray
        let voltage = 0.0;
        if(i < associations.length && associations[i] < voltages.length){voltage = voltages[associations[i]]};
        vArray[i] = voltage

        //fill pArray
        pArray[i] = current * voltage;

        //TODO: program power factor calculation
    }

    //build the sql query with the calculated values
    const query = {
    text: 'INSERT INTO ' +
        'powerdata (' + 
        'i0, i1, i2, i3, i4, i5, ' + 
        'v0, v1, v2, v3, v4, v5, ' + 
        'p0, p1, p2, p3, p4, p5, ' + 
        'pf0, pf1, pf2, pf3, pf4, pf5' +
        ') ' + 
        'VALUES (' +
        '$1, $2, $3, $4, $5, $6,' + 
        '$7, $8, $9, $10, $11, $12,' +
        '$13, $14, $15, $16, $17, $18,' +
        '$19, $20, $21, $22, $23, $24' +
        ') ' + 
        'RETURNING pkey',
    values: [
        iArray[0], iArray[1], iArray[2], iArray[3], iArray[4], iArray[5],
        vArray[0], vArray[1], vArray[2], vArray[3], vArray[4], vArray[5],
        pArray[0], pArray[1], pArray[2], pArray[3], pArray[4], pArray[5],
        pfArray[0], pfArray[1], pfArray[2], pfArray[3], pfArray[4], pfArray[5]
    ]
    };

    //do the query
    const result = await db.query(query);

    //print resulting row to console
    console.log(result.rows[0]);

    //return
    return result;
}

export const insertPowers = async (p) => {
    const query = {
        text: 'INSERT INTO powerdata(p0, p1, p2, p3, p4, p5) VALUES ($1, $2, $3, $4, $5, $6) RETURNING pkey',
        values: p,
    };
    return db.query(query);
};

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
