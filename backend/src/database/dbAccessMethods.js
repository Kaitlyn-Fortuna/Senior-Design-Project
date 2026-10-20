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
    console.log(result.rows[0]);

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