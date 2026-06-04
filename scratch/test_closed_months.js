// Simple script to test date normalization in closedMonths utility
import { getYearMonthFromDate, isMonthClosed } from '../src/utils/closedMonths.js';

console.log("=== Testing date format parsing ===");

const testCases = [
  { input: "2026-06-03", expected: "2026-06" },
  { input: "2026-05", expected: "2026-05" },
  { input: "2026/04/10", expected: "2026-04" },
  { input: "invalid-date", expected: "" },
  { input: null, expected: "" },
  { input: undefined, expected: "" }
];

let failed = 0;

testCases.forEach((tc) => {
  const result = getYearMonthFromDate(tc.input);
  if (result === tc.expected) {
    console.log(`[PASS] Input: "${tc.input}" => Output: "${result}"`);
  } else {
    console.error(`[FAIL] Input: "${tc.input}" => Expected: "${tc.expected}", got: "${result}"`);
    failed++;
  }
});

console.log("\n=== Testing isMonthClosed ===");
const closedMonths = ["2026-06", "2026-01"];
const checks = [
  { date: "2026-06-15", expected: true },
  { date: "2026-05-15", expected: false },
  { date: "2026-01-01", expected: true },
  { date: "2025-01-01", expected: false }
];

checks.forEach((tc) => {
  const result = isMonthClosed(tc.date, closedMonths);
  if (result === tc.expected) {
    console.log(`[PASS] Date: "${tc.date}" => Closed: ${result}`);
  } else {
    console.error(`[FAIL] Date: "${tc.date}" => Expected: ${tc.expected}, got: ${result}`);
    failed++;
  }
});

if (failed === 0) {
  console.log("\nAll tests PASSED!");
} else {
  console.error(`\n${failed} tests FAILED.`);
  process.exit(1);
}
