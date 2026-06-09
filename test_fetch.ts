import { fetchIncomeData } from "./src/lib/incomes";
import { pool } from "./src/lib/db";

async function test() {
  try {
    const data = await fetchIncomeData(2026);
    console.log("Records returned:", data.records.length);
    if (data.records.length > 0) {
      console.log("First record:", data.records[0]);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    pool.end();
  }
}
test();
