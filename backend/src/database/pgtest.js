import * as db from './index.js'

const query1 = {
    text: 'SELECT NOW() as now'
}
const query2 = {
    text: 'INSERT INTO powerreadings(port0, port1, port2, port3, port4, port5, port6, port7) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
    values: [(Math.random * 100), (Math.random * 100), (Math.random * 100), (Math.random * 100), (Math.random * 100), (Math.random * 100), (Math.random * 100), (Math.random * 100)]
}

const result1 = await db.query(query1)
const result2 = await db.query(query2)

console.log(result1.rows[0])
console.log(result2.rows[0])