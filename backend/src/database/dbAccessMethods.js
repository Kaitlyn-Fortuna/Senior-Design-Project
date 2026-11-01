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

export const insertExtendedRecord = async ({ p, c, v, pf }) => {
    const query = {
        text: `INSERT INTO powerdata
            (p0, p1, p2, p3, p4, p5,
             c0, c1, c2, c3, c4, c5,
             v0, v1,
             pf0, pf1, pf2, pf3, pf4, pf5)
            VALUES ($1,$2,$3,$4,$5,$6, $7,$8,$9,$10,$11,$12, $13,$14, $15,$16,$17,$18,$19,$20)
            RETURNING pkey`,
        values: [...p, ...c, ...v, ...pf],
    };
    return db.query(query);
};

// Insert one measured row from the ADC driver. Arrays are in port order:
// p: real power W [6], c: current A rms [6], v: voltage V rms [2], pf: power factor [6]
export const insertReading = async ({ p, c, v, pf }) => {
    const query = {
        text: `INSERT INTO powerdata
            (p0, p1, p2, p3, p4, p5,
             c0, c1, c2, c3, c4, c5,
             v0, v1,
             pf0, pf1, pf2, pf3, pf4, pf5)
            VALUES ($1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11, $12,
                    $13, $14,
                    $15, $16, $17, $18, $19, $20)
            RETURNING pkey`,
        values: [...p, ...c, ...v, ...pf],
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