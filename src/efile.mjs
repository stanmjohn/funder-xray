// Reads one e-filed 990-PF from the IRS bulk e-file data and pulls out the
// grants it paid during the year. This and propublica.mjs are the only files
// that touch the network.
//
// The IRS publishes every e-filed return as XML, packed into large zip files
// listed on its Form 990 Series Downloads page. The zips run from about
// 100 MB to over 1 GB, so this file never downloads one. It asks the server
// for small slices instead (HTTP range requests): first the zip's table of
// contents, then the one compressed return. Node's zlib unpacks it. No
// dependencies.
//
// The zip links are read off the IRS page each run, never assembled.

import { inflateRawSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { UA } from "./propublica.mjs";

export const IRS_DOWNLOADS_PAGE = "https://www.irs.gov/charities-non-profits/form-990-series-downloads";
const CACHE_DIR = fileURLToPath(new URL("../out/", import.meta.url));
const CACHE_FILE = CACHE_DIR + "efile-locations.json";

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTITIES[e]);
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m ? decode(m[1]).trim() : null;
}

/**
 * Parse the grants paid during the year from one 990-PF e-file.
 * Returns { returnType, taxPeriodEnd, reportedTotal, grants }.
 * Each grant is { name, amount, individual, foreign, state }. A grant to a
 * person carries individual: true and no name, so no person is ever named.
 */
export function parseGrants(xml) {
  const returnType = tag(xml, "ReturnTypeCd");
  const taxPeriodEnd = tag(xml, "TaxPeriodEndDt");
  const total = tag(xml, "TotalGrantOrContriPdDurYrAmt");
  const grants = [];
  for (const m of xml.matchAll(/<GrantOrContributionPdDurYrGrp>([\s\S]*?)<\/GrantOrContributionPdDurYrGrp>/g)) {
    const b = m[1];
    const line1 = tag(b, "BusinessNameLine1Txt");
    const line2 = tag(b, "BusinessNameLine2Txt");
    const individual = !line1 && /<RecipientPersonNm>/.test(b);
    grants.push({
      name: individual ? null : [line1, line2].filter(Boolean).join(" "),
      amount: Number(tag(b, "Amt") ?? 0),
      individual,
      foreign: /<RecipientForeignAddress>/.test(b),
      state: tag(b, "StateAbbreviationCd"),
    });
  }
  return {
    returnType,
    taxPeriodEnd,
    reportedTotal: total == null ? null : Number(total),
    grants,
  };
}

/** The zip links for one processing year, read off the IRS downloads page. */
export async function zipLinksForYear(year, pageHtml) {
  const html = pageHtml ?? (await (await fetch(IRS_DOWNLOADS_PAGE, { headers: { "User-Agent": UA } })).text());
  const links = new Set();
  for (const m of html.matchAll(/href="([^"]+\.zip)"/g)) {
    if (m[1].includes(`/xml/${year}/`)) links.add(m[1]);
  }
  return [...links];
}

async function range(url, start, end) {
  const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}`, "User-Agent": UA } });
  if (res.status !== 206) throw new Error(`IRS bulk file did not return a slice (HTTP ${res.status}) for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Read a remote zip's table of contents and find one member by name. */
async function findMember(url, needle) {
  const head = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA } });
  const size = Number(head.headers.get("content-length"));
  if (!size) throw new Error(`No size reported for ${url}`);
  const tailLen = Math.min(size, 70000);
  const tail = await range(url, size - tailLen, size - 1);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error(`No zip directory found in ${url}`);
  let entries = tail.readUInt16LE(eocd + 10);
  let cdSize = tail.readUInt32LE(eocd + 12);
  let cdOff = tail.readUInt32LE(eocd + 16);
  if (cdOff === 0xffffffff || entries === 0xffff) {
    const z64off = Number(tail.readBigUInt64LE(eocd - 20 + 8));
    const z = await range(url, z64off, z64off + 55);
    cdSize = Number(z.readBigUInt64LE(40));
    cdOff = Number(z.readBigUInt64LE(48));
  }
  const cd = await range(url, cdOff, cdOff + cdSize - 1);
  let p = 0;
  while (p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50) {
    const method = cd.readUInt16LE(p + 10);
    let csize = cd.readUInt32LE(p + 20);
    const usize32 = cd.readUInt32LE(p + 24);
    const nlen = cd.readUInt16LE(p + 28);
    const xlen = cd.readUInt16LE(p + 30);
    const clen = cd.readUInt16LE(p + 32);
    let offset = cd.readUInt32LE(p + 42);
    const name = cd.toString("utf8", p + 46, p + 46 + nlen);
    if (name.includes(needle)) {
      if (csize === 0xffffffff || offset === 0xffffffff) {
        let x = p + 46 + nlen;
        const end = x + xlen;
        while (x < end) {
          const id = cd.readUInt16LE(x);
          const len = cd.readUInt16LE(x + 2);
          if (id === 1) {
            let q = x + 4;
            if (usize32 === 0xffffffff) q += 8;
            if (csize === 0xffffffff) { csize = Number(cd.readBigUInt64LE(q)); q += 8; }
            if (offset === 0xffffffff) offset = Number(cd.readBigUInt64LE(q));
          }
          x += 4 + len;
        }
      }
      return { url, name, method, csize, offset };
    }
    p += 46 + nlen + xlen + clen;
  }
  return null;
}

async function readMember(hit) {
  const lh = await range(hit.url, hit.offset, hit.offset + 29);
  const start = hit.offset + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
  const data = await range(hit.url, start, start + hit.csize - 1);
  return (hit.method === 8 ? inflateRawSync(data) : data).toString("utf8");
}

function readCache() {
  try { return JSON.parse(readFileSync(CACHE_FILE, "utf8")); } catch { return {}; }
}

function writeCache(cache) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {
    // A cache that cannot be written only makes the next run slower.
  }
}

/**
 * Fetch and parse one e-file by its object id, the id the ProPublica API
 * gives as latest_object_id. Its first four digits have matched the IRS
 * processing year of the zip that holds it, so that year's zips are searched,
 * newest first, then the next year's. The location is cached under out/.
 * Returns null when the return is not found. The result carries source, the
 * zip link and the file name inside it, so the report can cite both.
 */
export async function fetchGrants(objectId, { log = () => {} } = {}) {
  const id = String(objectId);
  const cache = readCache();
  let hit = cache[id] ?? null;
  if (!hit) {
    const html = await (await fetch(IRS_DOWNLOADS_PAGE, { headers: { "User-Agent": UA } })).text();
    const year = Number(id.slice(0, 4));
    for (const y of [year, year + 1]) {
      const zips = (await zipLinksForYear(y, html)).reverse();
      for (const url of zips) {
        log(`Searching ${url}`);
        hit = await findMember(url, `${id}_public.xml`);
        if (hit) break;
      }
      if (hit) break;
    }
    if (!hit) return null;
    cache[id] = hit;
    writeCache(cache);
  }
  return { ...parseGrants(await readMember(hit)), source: { zip: hit.url, member: hit.name } };
}
