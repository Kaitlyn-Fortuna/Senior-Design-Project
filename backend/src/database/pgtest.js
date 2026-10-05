import * as db from './index.js'

await db.query('SELECT NOW() as now')