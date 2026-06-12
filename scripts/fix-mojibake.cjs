const fs = require("node:fs");
const path = require("node:path");

const roots = ["src", "database", "public"];
const rootFiles = ["package.json", "tsconfig.json", "next.config.ts", "next.config.js"];
const textExtensions = new Set([".ts", ".tsx", ".css", ".json"]);

const cp1252Reverse = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

const markerPattern = /Ã|Ä|Æ|áº|á»|Ð|ð|ø|þ|»|º|œ|€|™|˜|š|ž|Ÿ|Œ|Š|Ž|ƒ|„|…|†|‡|ˆ|‰|‹|›|“|”|‘|’|–|—|•|â(?:[\u0080-\u00bf]|\u0153|\u20ac|\u2039)/g;
const candidatePattern = /[\u0009\u0020-\u007e\u00a0-\u024f\u2018-\u2026\u2030-\u203a\u20ac]+/g;

function hasMojibakeMarker(value) {
  markerPattern.lastIndex = 0;
  return markerPattern.test(value);
}

function markerCount(value) {
  markerPattern.lastIndex = 0;
  return [...value.matchAll(markerPattern)].length;
}

function decodeAsUtf8FromCp1252(value) {
  const bytes = [];
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }
    const byte = cp1252Reverse.get(code);
    if (byte === undefined) return null;
    bytes.push(byte);
  }
  return Buffer.from(bytes).toString("utf8");
}

function fixMojibake(value) {
  let output = value.replace(/^\uFEFF/, "");
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    output = output.replace(candidatePattern, (candidate) => {
      if (!hasMojibakeMarker(candidate)) return candidate;
      const decoded = decodeAsUtf8FromCp1252(candidate);
      if (!decoded || decoded === candidate) return candidate;
      if (markerCount(decoded) >= markerCount(candidate)) return candidate;
      changed = true;
      return decoded;
    });
    if (!changed) break;
  }
  return output;
}

function collectFiles(startPath) {
  if (!fs.existsSync(startPath)) return [];
  const stat = fs.statSync(startPath);
  if (stat.isFile()) return textExtensions.has(path.extname(startPath)) ? [startPath] : [];
  const entries = fs.readdirSync(startPath, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") return [];
    const fullPath = path.join(startPath, entry.name);
    if (entry.isDirectory()) return collectFiles(fullPath);
    return textExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

const files = [
  ...roots.flatMap((root) => collectFiles(path.join(process.cwd(), root))),
  ...rootFiles.map((file) => path.join(process.cwd(), file)).filter((file) => fs.existsSync(file)),
];

const changedFiles = [];
for (const file of files) {
  const before = fs.readFileSync(file, "utf8");
  const after = fixMojibake(before);
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    changedFiles.push(path.relative(process.cwd(), file));
  }
}

console.log(changedFiles.length ? changedFiles.join("\n") : "No mojibake changes needed.");
