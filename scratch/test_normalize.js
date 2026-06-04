const normalizeFormat = (fmt) => {
  const cleanFmt = fmt
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/,/g, '.'); // convert comma to dot

  const parts = cleanFmt.split('X');
  const normParts = parts.map(part => {
    if (part.includes('.')) {
      const num = parseFloat(part);
      if (!isNaN(num) && num < 10) {
        return String(Math.round(num * 100));
      }
    }
    return part;
  });
  return normParts.join('X');
};

const testCases = [
  { input: "1,20x1,20", expected: "120X120" },
  { input: "120x120", expected: "120X120" },
  { input: "60x1,20", expected: "60X120" },
  { input: "60x120", expected: "60X120" },
  { input: "90x90", expected: "90X90" },
  { input: "0,90x0,90", expected: "90X90" },
  { input: "1.20x1.20", expected: "120X120" },
];

let failed = false;
for (const tc of testCases) {
  const output = normalizeFormat(tc.input);
  if (output !== tc.expected) {
    console.error(`FAIL: normalizeFormat("${tc.input}") returned "${output}", expected "${tc.expected}"`);
    failed = true;
  } else {
    console.log(`PASS: normalizeFormat("${tc.input}") => "${output}"`);
  }
}

if (!failed) {
  console.log("All tests passed successfully!");
} else {
  process.exit(1);
}
