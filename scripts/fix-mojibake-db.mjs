import { Client } from 'pg';

const isDryRun = process.argv.includes('--dry-run');
const isApply = process.argv.includes('--apply');

if (!isDryRun && !isApply) {
  console.error("Please specify --dry-run or --apply");
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://family_user:FamilyHubDB2026_local@192.168.1.107:5432/family_hub';

const client = new Client({
  connectionString: DATABASE_URL,
});

const mojibakePatterns = ['Ã', 'Â', 'Ä', 'á»', 'áº', 'Æ', ''];
function hasMojibake(str) {
  return mojibakePatterns.some(p => str.includes(p));
}

function fixString(str) {
  if (!str || typeof str !== 'string') return str;
  if (!hasMojibake(str)) return str;
  try {
    const fixed = Buffer.from(str, 'binary').toString('utf8');
    // If decoding generated invalid replacement characters and original didn't have them, something went wrong
    if (fixed.includes('\uFFFD') && !str.includes('\uFFFD')) {
      return str;
    }
    return fixed !== str ? fixed : str;
  } catch(e) {
    return str;
  }
}

async function fixDefaultValues() {
  console.log('--- Checking default values ---');
  const res = await client.query(`
    SELECT table_name, column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_default IS NOT NULL
  `);

  for (const row of res.rows) {
    const defaultVal = row.column_default;
    if (defaultVal.startsWith("'") && defaultVal.includes("::")) {
      const match = defaultVal.match(/^'(.*)'::(.*)$/);
      if (match) {
        let textPart = match[1];
        textPart = textPart.replace(/''/g, "'");
        
        if (hasMojibake(textPart)) {
          const fixedText = fixString(textPart);
          if (fixedText !== textPart) {
            console.log(`[DEFAULT] ${row.table_name}.${row.column_name}: ${textPart} -> ${fixedText}`);
            if (isApply) {
              const escaped = fixedText.replace(/'/g, "''");
              const sql = `ALTER TABLE "${row.table_name}" ALTER COLUMN "${row.column_name}" SET DEFAULT '${escaped}'::${match[2]};`;
              await client.query(sql);
            }
          }
        }
      }
    }
  }
}

async function fixTableData() {
  console.log('--- Checking tables data ---');
  const tablesRes = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);

  for (const tableRow of tablesRes.rows) {
    const tableName = tableRow.table_name;
    
    // Get primary key
    const pkRes = await client.query(`
      SELECT a.attname
      FROM   pg_index i
      JOIN   pg_attribute a ON a.attrelid = i.indrelid
                           AND a.attnum = ANY(i.indkey)
      WHERE  i.indrelid = $1::regclass
      AND    i.indisprimary;
    `, [tableName]);

    let pkColumn = 'id';
    if (pkRes.rows.length > 0) {
      pkColumn = pkRes.rows[0].attname;
    } else {
      const idRes = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema='public' AND table_name=$1 AND column_name='id'
      `, [tableName]);
      if (idRes.rows.length === 0) {
        console.warn(`[WARNING] Table ${tableName} has no primary key and no 'id' column. Skipping.`);
        continue;
      }
    }

    const columnsRes = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND data_type IN ('text', 'character varying', 'character', 'char', 'varchar')
    `, [tableName]);

    if (columnsRes.rows.length === 0) continue;
    const columns = columnsRes.rows.map(r => r.column_name);
    
    // Read all rows
    const dataRes = await client.query(`SELECT "${pkColumn}", ${columns.map(c => `"${c}"`).join(', ')} FROM "${tableName}"`);
    
    for (const row of dataRes.rows) {
      const updates = {};
      for (const col of columns) {
        const val = row[col];
        if (val) {
          const fixed = fixString(val);
          if (fixed !== val) {
            updates[col] = fixed;
          }
        }
      }
      
      if (Object.keys(updates).length > 0) {
        for (const [col, fixedVal] of Object.entries(updates)) {
          console.log(`[DATA] ${tableName} (PK: ${row[pkColumn]}).${col}: ${row[col]} -> ${fixedVal}`);
        }
        
        if (isApply) {
          const setClause = Object.keys(updates).map((col, idx) => `"${col}" = $${idx + 2}`).join(', ');
          const values = Object.values(updates);
          const sql = `UPDATE "${tableName}" SET ${setClause} WHERE "${pkColumn}" = $1`;
          await client.query(sql, [row[pkColumn], ...values]);
        }
      }
    }
  }
}

async function main() {
  try {
    await client.connect();
    console.log(`Connected to database. Mode: ${isDryRun ? 'DRY-RUN' : 'APPLY'}`);
    
    await fixDefaultValues();
    await fixTableData();
    
    console.log('--- Done ---');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
