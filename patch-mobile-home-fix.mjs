import { readFileSync, writeFileSync } from "fs";

const file = "src/components/family-app.tsx";
let src = readFileSync(file, "utf8");
const lfSrc = src.replace(/\r\n/g, "\n");
let result = lfSrc;

// Fix MobileHome destructuring to include openChangePassword
const destructuringOld = `function MobileHome({
  data,
  user,
  notifications,
  go,
  openProfile,
  update,
  setEditor,
  showMembers,
  setShowMembers,
}: {`;

const destructuringNew = `function MobileHome({
  data,
  user,
  notifications,
  go,
  openProfile,
  update,
  setEditor,
  showMembers,
  setShowMembers,
  openChangePassword,
}: {`;

if (!result.includes(destructuringOld)) { console.error("MobileHome destructuring not found!"); process.exit(1); }
result = result.replace(destructuringOld, destructuringNew);

result = result.replace(/\n/g, "\r\n");
writeFileSync(file, result, "utf8");
console.log("Successfully fixed MobileHome signature!");
