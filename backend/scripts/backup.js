// Makes a full backup of the database and copies it out of the container into backend/backups/.
// A backup that only lives inside the container is lost with it, so the copy out is the important part.
// Usage (from the backend folder):  npm run backup
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { poolPromise } = require('../src/config/db');

const CONTAINER = process.env.DB_CONTAINER || 'swot-sql';

(async () => {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const file = `swot_db_${stamp}.bak`;
    const inside = `/var/opt/mssql/data/${file}`;
    const outDir = path.join(__dirname, '..', 'backups');
    fs.mkdirSync(outDir, { recursive: true });

    const pool = await poolPromise;
    await pool.request().batch(`BACKUP DATABASE swot_db TO DISK = '${inside}' WITH INIT, COMPRESSION`);
    console.log(`Backup created inside the container: ${inside}`);

    // MSYS_NO_PATHCONV keeps Git Bash from rewriting the container path
    execFileSync('docker', ['cp', `${CONTAINER}:${inside}`, path.join(outDir, file)], { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
    execFileSync('docker', ['exec', CONTAINER, 'rm', '-f', inside], { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
    console.log(`Copied to: ${path.join(outDir, file)}`);
    process.exit(0);
})().catch((err) => {
    console.error('Backup failed:', err.message);
    process.exit(1);
});
