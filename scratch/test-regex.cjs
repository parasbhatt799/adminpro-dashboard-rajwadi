const mappedVal = "lte.2026-05-31t18:29:59.999z";
const result = mappedVal.replace(
  /(\d{4}-\d{2}-\d{2})t(\d{2}:\d{2}:\d{2}(?:\.\d+)?)z/gi,
  (match, p1, p2) => `${p1}T${p2}Z`
);
console.log("Original:", mappedVal);
console.log("Result:", result);
