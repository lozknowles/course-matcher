/* Pure document-layout helpers shared by the browser controller and tests. */

/**
 * Reconstruct readable lines from PDF.js text items using their page position.
 * Joining every item with a space flattens tables and can attach a grade to the
 * wrong subject, so items are grouped into visual rows and sorted left-to-right.
 */
export function pdfTextItemsToLines(items = [], yTolerance = 3) {
  const rows = [];

  for (const item of items) {
    const text = String(item?.str ?? '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const x = Number(item?.transform?.[4] ?? 0);
    const y = Number(item?.transform?.[5] ?? 0);
    let row = rows.find(candidate => Math.abs(candidate.y - y) <= yTolerance);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x, text });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map(row => row.items.sort((a, b) => a.x - b.x).map(item => item.text).join(' '))
    .join('\n');
}

/** Visit every page in order and release each PDF.js page after it is read. */
export async function readAllPdfPages(pdf, readPage, onProgress = () => {}) {
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    onProgress(pageNumber, pdf.numPages);
    const page = await pdf.getPage(pageNumber);
    try {
      pages.push(await readPage(page, pageNumber, pdf.numPages));
    } finally {
      page.cleanup();
    }
  }
  return pages;
}
