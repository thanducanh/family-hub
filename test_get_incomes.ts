import { config } from "dotenv";
config({ path: ".env.local" });
import { fetchIncomeData } from "./src/lib/incomes.ts";
import { pool } from "./src/lib/db.ts";

async function test() {
  try {
    const data = await fetchIncomeData(2026);
    console.log("Returned records count:", data.records.length);
    if (data.records.length > 0) {
      console.log("First record:", JSON.stringify(data.records[0], null, 2));
    } else {
      console.log("No records returned. Let's run a raw query to check what is in the DB.");
      const raw = await pool.query("SELECT * FROM income_records WHERE year = 2026 OR EXTRACT(YEAR FROM received_date) = 2026");
      console.log("Raw query count:", raw.rows.length);
      if (raw.rows.length > 0) {
        console.log("First raw row:", raw.rows[0]);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

test();
