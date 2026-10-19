import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, acc);
    else acc.push(path);
  }
  return acc;
}

const files = walk('dist');
let total = 0;
const rows = [];
for (const path of files) {
  const gz = gzipSync(readFileSync(path)).length;
  total += gz;
  rows.push([gz, path]);
}
rows.sort((a, b) => b[0] - a[0]);
for (const [gz, path] of rows) {
  console.log(String((gz / 1024).toFixed(1)).padStart(8) + ' KB  ' + path);
}
console.log('TOTAL gzip ' + (total / 1024).toFixed(1) + ' KB');
const limit = 3 * 1024 * 1024;
if (total > limit) {
  console.error('Bundle exceeds 3 MB gzip (' + total + ' bytes)');
  process.exit(1);
}
