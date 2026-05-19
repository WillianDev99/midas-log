const fs = require('fs');
const content = fs.readFileSync('c:\\DEV\\MIDAS RENT A CAR\\midas-log\\src\\pages\\CerbrasFreightCalculator.tsx', 'utf8');
const lines = content.split('\n');
let depth = 0;
lines.forEach((line, i) => {
  const matches = line.match(/<div/g) || [];
  const selfClosings = (line.match(/<div[^>]*\/>/g) || []).length;
  const closings = (line.match(/<\/div/g) || []).length;
  const opens = matches.length - selfClosings;
  
  const oldDepth = depth;
  depth += opens - closings;
  if (opens > 0 || closings > 0) {
    console.log(`${(i + 1).toString().padStart(4, '0')} | ${oldDepth} -> ${depth} | ${line.trim()}`);
  }
});
