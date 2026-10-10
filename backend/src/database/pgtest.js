import * as db from './index.js'
import * as accessMethods from './dbAccessMethods.js'

const query1 = {
    text: 'SELECT NOW() as now'
};

const query2 = {
    text: 'INSERT INTO powerdata(p0, p1, p2, p3, p4, p5) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    values: [(Math.random() * 100),
            (Math.random() * 100),
            (Math.random() * 100),
            (Math.random() * 100),
            (Math.random() * 100),
            (Math.random() * 100)]
};

const result1 = await db.query(query1);
const result2 = await db.query(query2);

console.log(result1.rows[0]);
console.log(result2.rows[0]);

accessMethods.insertRecord([(Math.random() * 100),
                            (Math.random() * 100),
                            (Math.random() * 100),
                            (Math.random() * 100),
                            (Math.random() * 100),
                            (Math.random() * 100)],
                            [(Math.random() * 100), (Math.random() * 100)],
                            [0, 1, 0, 1, 0, 1]
);

accessMethods.retrieveRecordByPKey(1);

accessMethods.retrieveNewestRecord();

accessMethods.retrieveAllRecords();