async function run() {
  const res = await fetch("http://localhost:3000/api/bank-accounts");
  if (!res.ok) {
    console.error("HTTP error", res.status);
    return;
  }
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}
run();
