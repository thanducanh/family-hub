import pg from 'pg';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const dbUrl = env.split('\n').find(line => line.startsWith('DATABASE_URL=')).split('=')[1].trim();
const pool = new pg.Pool({ connectionString: dbUrl });
pool.query("SELECT table_name, column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name IN ('members', 'users') ORDER BY table_name, ordinal_position;").then(res => { console.table(res.rows); pool.end(); }).catch(err => { console.error(err); pool.end(); });
