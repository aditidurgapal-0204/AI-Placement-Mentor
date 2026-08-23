const { PdfReader } = require("pdfreader");

const extractPdfTextFromBuffer = (buffer) => new Promise((resolve, reject) => {
  const rowsByPage = new Map();
  let page = 1;
  new PdfReader().parseBuffer(buffer, (error, item) => {
    if (error) return reject(new Error("PDF_TEXT_EXTRACTION_FAILED"));
    if (!item) {
      const text = [...rowsByPage.entries()].sort(([a], [b]) => a - b).flatMap(([, rows]) =>
        [...rows.entries()].sort(([a], [b]) => a - b).map(([, cells]) =>
          cells.sort((a, b) => a.x - b.x).map((cell) => cell.text).join(" ")
        )
      ).join("\n").replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      return resolve(text);
    }
    if (item.page) page = Number(item.page) || page;
    if (!item.text) return;
    if (!rowsByPage.has(page)) rowsByPage.set(page, new Map());
    const rows = rowsByPage.get(page);
    const y = Number(item.y || 0).toFixed(1);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push({ x: Number(item.x || 0), text: String(item.text) });
  });
});

module.exports = { extractPdfTextFromBuffer };
