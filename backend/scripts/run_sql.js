// Runs one or more .sql files against the database in .env, splitting batches on "GO" lines.
// Usage (from the backend folder):  node scripts/run_sql.js ../database/a.sql ../database/b.sql
const fs = require('fs');
const path = require('path');
const { poolPromise } = require('../src/config/db');

(async () => {
    const files = process.argv.slice(2);
    if (!files.length) {
        console.error('Give at least one .sql file. Ex: node scripts/run_sql.js ../database/procedures.sql');
        process.exit(1);
    }

    const pool = await poolPromise;
    for (const file of files) {
        const batches = fs.readFileSync(path.resolve(file), 'utf8')
            .split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
        for (const batch of batches) await pool.request().batch(batch);
        console.log(`${path.basename(file)}: ${batches.length} batches run`);
    }
    process.exit(0);
})().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
