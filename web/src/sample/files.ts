/**
 * File contents for FMD Main demo records. They live in this browser's IndexedDB (localStorage is too small for X-rays
 * and PDFs), or in memory when IndexedDB is blocked. The real backend keeps files in private object storage and only
 * ever hands out short-lived signed links (PDR §4.6); see getLink in records.ts.
 */
const mem = new Map<string, Blob>();

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((done) => {
    const r = indexedDB.open("fmd-demo-files", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => done(r.result);
    r.onerror = () => done(null);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const db = await open();
  if (!db) return undefined;
  return new Promise((done, fail) => {
    const req = fn(db.transaction("files", mode).objectStore("files"));
    req.onsuccess = () => done(req.result);
    req.onerror = () => fail(req.error);
  });
}

export async function putFile(id: string, blob: Blob) {
  mem.set(id, blob);
  await run("readwrite", (s) => s.put(blob, id)).catch(() => undefined); // memory holds it for this tab
}

export async function getFile(id: string): Promise<Blob | null> {
  return mem.get(id) ?? (await run<Blob>("readonly", (s) => s.get(id)).catch(() => undefined)) ?? null;
}

export async function deleteFile(id: string) {
  mem.delete(id);
  await run("readwrite", (s) => s.delete(id)).catch(() => undefined);
}

/** A one-page PDF with a title and lines of text: enough for demo reports, plans, invoices and certificates. */
export function demoPdf(title: string, lines: string[]): Blob {
  // the built-in Helvetica only covers Latin text, so ₹ becomes "Rs." and anything else outside ASCII a "?"
  const esc = (s: string) =>
    s
      .replaceAll("₹", "Rs. ")
      .replace(/[\\()]/g, (c) => `\\${c}`)
      .replace(/[^\x20-\x7e]/g, "?");
  const text = [`BT /F1 18 Tf 56 780 Td (${esc(title)}) Tj ET`, ...lines.map((l, i) => `BT /F1 11 Tf 56 ${746 - i * 17} Td (${esc(l)}) Tj ET`)].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length); // all ASCII, so characters are bytes
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([out], { type: "application/pdf" });
}

/** A drawn stand-in for an X-ray, clearly marked as not a real image. */
export function demoXray(label: string): Blob {
  const tooth = (x: number, flip = false) =>
    `<path transform="translate(${x} ${flip ? 420 : 180}) scale(1 ${flip ? -1 : 1})" d="M-34 0c0-40 14-60 34-60s34 20 34 60c0 30-8 46-14 80l-8 60c-2 12-10 12-12 0l-4-40-4 40c-2 12-10 12-12 0l-8-60c-6-34-14-50-14-80z" fill="#d7dde6" fill-opacity=".78"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs><radialGradient id="g" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="#2b3340"/><stop offset="1" stop-color="#05070a"/></radialGradient></defs>
  <rect width="800" height="600" fill="url(#g)"/>
  ${[200, 300, 400, 500, 600].map((x) => tooth(x)).join("")}
  ${[200, 300, 400, 500, 600].map((x) => tooth(x, true)).join("")}
  <text x="24" y="40" fill="#9aa4b2" font-family="sans-serif" font-size="20">${label.replace(/[<&]/g, "")}</text>
  <text x="24" y="572" fill="#ffb470" font-family="sans-serif" font-size="18">DEMO IMAGE · not a real X-ray</text>
</svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
}
