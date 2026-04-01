// ══════════════════════════════════════════════════════════════════════════
//  Bank Statement XLSX Parsers  – Smart Wallet Companion v4
//  Supports: Sonali Bank BDT | LIV/Emirates NBD Savings AED |
//            LIV Metals Investment AED | LIV Credit Card AED |
//            TapTap Send AED→BDT | Islami Bank DPS BDT
//  All parsers tested against real uploaded statements.
// ══════════════════════════════════════════════════════════════════════════

export interface ParsedTransaction {
  date: string;          // YYYY-MM-DD
  description: string;
  amount: number;        // positive = income/credit, negative = expense/debit
  type: "income" | "expense";
  currency: string;
  category: string;
  extra?: string;        // e.g. "BDT 5,000 @ 31.25" for TapTap
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  bankName: string;
  accountType: string;
  currency: string;
  error?: string;
}

// ── Category Auto-Detection ───────────────────────────────────────────────
const CATEGORY_RULES: [RegExp, string][] = [
  [/salary|ipp.*credit|payroll|ipp customer/i, "Income"],
  [/interest applied|interest.*earn|profit.*appl|bonus multiplier/i, "Interest/Returns"],
  [/carrefour|lulu|spinneys|choithram|union coop|supermarket|hypermarket|dmart/i, "Groceries"],
  [/restaurant|rest |cafe|coffee|starbucks|mcdonald|kfc|burger|pizza|sushi|shawarma|keeta|talabat|zomato|deliveroo|dining/i, "Food & Dining"],
  [/dewa|fewa|sewa|electricity|water authority/i, "Utilities"],
  [/du |etisalat|virgin mobile|telecom/i, "Telecom"],
  [/emarat|enoc|adnoc|eppco|petrol|fuel|salik/i, "Transport"],
  [/rta|metro|bus|taxi|uber|careem/i, "Transport"],
  [/amazon|noon|namshi|shein|zara|h&m|shopping|mall/i, "Shopping"],
  [/hospital|clinic|pharmacy|medical|ibn sina|aster|nmc/i, "Health"],
  [/dha|mohre|amer|govt|government|municipality|etihad credit/i, "Government"],
  [/school|university|college|tuition|education/i, "Education"],
  [/rent|landlord|ejari/i, "Housing"],
  [/airline|flight|hotel|booking|airbnb|emirates air|flydubai|air arabia/i, "Travel"],
  [/taptap|tap.*send|remit|beftn|ewallet|fund_transfer|mepay|pos-purchase.*tapt/i, "Transfers"],
  [/credit card payment|cc.*payment|cc no/i, "Credit Card Payment"],
  [/atm|cash withdrawal/i, "Cash"],
  [/tabby/i, "Shopping"],
  [/deposite from|deposit from/i, "Transfers"],
];

export function autoCategory(desc: string): string {
  for (const [re, cat] of CATEGORY_RULES) {
    if (re.test(desc)) return cat;
  }
  return "Other";
}

// ── Date helpers ──────────────────────────────────────────────────────────
const MON: Record<string, number> = {
  JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12
};

function parseDDMONYY(s: string): string | null {
  const m = s.trim().match(/^(\d{2})([A-Z]{3})(\d{2,4})/i);
  if (!m) return null;
  const day = parseInt(m[1]);
  const mon = MON[m[2].toUpperCase()] || 1;
  let yr = parseInt(m[3]);
  if (yr < 100) yr += 2000;
  return `${yr}-${String(mon).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

/**
 * FIX A — Convert a Date object to YYYY-MM-DD using LOCAL date parts,
 * not UTC. Using d.toISOString() returns UTC which is behind by the
 * local UTC offset (e.g. UAE is UTC+4, so UTC midnight = 8pm local the
 * previous day → toISOString gives yesterday's date).
 *
 * getFullYear/getMonth/getDate always read the local calendar date,
 * so the date on screen matches the date printed on the bank statement.
 */
function dateObjToStr(d: Date): string {
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day   = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * FIX B — Accept either a Date object OR a pre-converted "YYYY-MM-DD"
 * string (which readXlsxRows now produces). This makes every parser
 * resilient regardless of which layer does the conversion first.
 */
function toDateStr(raw: unknown): string | null {
  if (!raw) return null;
  // Already a clean ISO string — pass through
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return raw.trim();
  }
  // Date object — use local parts (FIX A)
  if (raw instanceof Date) {
    return dateObjToStr(raw);
  }
  return null;
}

function stripAmt(raw: unknown): { amount: number; isCredit: boolean } | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).replace(/,/g, "").replace(/AED\s*/i, "").trim();
  const isCredit = /CR$/i.test(s);
  const num = parseFloat(s.replace(/CR$/i, "").trim());
  if (isNaN(num)) return null;
  return { amount: num, isCredit };
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

// ══════════════════════════════════════════════════════════════════════════
//  PARSER 1: Sonali Bank Bangladesh (BDT)
// ══════════════════════════════════════════════════════════════════════════
export function parseSonaliXLSX(rows: unknown[][]): ParseResult {
  const txns: ParsedTransaction[] = [];

  let hdr = -1;
  for (let i = 0; i < rows.length; i++) {
    if (str(rows[i][0]) === "Date" && str(rows[i][3]) === "Debit") {
      hdr = i; break;
    }
  }
  if (hdr < 0) {
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const row = rows[i];
      const rowText = row.map(c => str(c).toLowerCase()).join("|");
      if (rowText.includes("debit") && rowText.includes("credit") && (rowText.includes("date") || rowText.includes("transaction"))) {
        hdr = i; break;
      }
    }
  }
  if (hdr < 0) return { transactions: [], bankName: "Sonali Bank", accountType: "Savings", currency: "BDT", error: "Header row not found. Expected columns: Date, Branch, Transaction, Debit, Credit" };

  for (const row of rows.slice(hdr + 1)) {
    const r0 = row[0];
    if (!r0) continue;
    const desc = str(row[2]);
    if (!desc || /BROUGHT FORWARD|CARRIED FORWARD/i.test(desc)) continue;

    let date: string;
    // FIX B: toDateStr handles both Date objects and pre-converted strings
    const fromToDateStr = toDateStr(r0);
    if (fromToDateStr) {
      date = fromToDateStr;
    } else {
      const s = str(r0).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        date = s.slice(0, 10);
      } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
        const parts = s.split("/");
        date = `${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
      } else if (/^\d{1,2}-\d{1,2}-\d{4}/.test(s)) {
        const parts = s.split("-");
        date = `${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
      } else {
        const num = parseFloat(s);
        if (!isNaN(num) && num > 40000) {
          const d = new Date((num - 25569) * 86400 * 1000);
          date = dateObjToStr(d);
        } else {
          const parsed = parseDDMONYY(s);
          date = parsed || s.slice(0,10);
        }
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const debit = row[3];
    const credit = row[4];

    if (credit !== null && credit !== undefined && str(credit) !== "") {
      const a = parseFloat(str(credit).replace(/,/g, ""));
      if (!isNaN(a) && a > 0) {
        txns.push({ date, description: desc.replace(/\n/g, " "), amount: a, type: "income", currency: "BDT", category: autoCategory(desc) });
      }
    } else if (debit !== null && debit !== undefined && str(debit) !== "") {
      const a = parseFloat(str(debit).replace(/,/g, ""));
      if (!isNaN(a) && a > 0) {
        txns.push({ date, description: desc.replace(/\n/g, " "), amount: -a, type: "expense", currency: "BDT", category: autoCategory(desc) });
      }
    }
  }

  return { transactions: txns, bankName: "Sonali Bank", accountType: "Savings Deposit", currency: "BDT" };
}

// ══════════════════════════════════════════════════════════════════════════
//  PARSER 2: LIV / Emirates NBD Savings (AED)
// ══════════════════════════════════════════════════════════════════════════
export function parseLivSavingsXLSX(rows: unknown[][]): ParseResult {
  const txns: ParsedTransaction[] = [];
  const dateRe = /^(\d{2}[A-Z]{3}\d{2})\s*(.*)/i;

  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    const r0 = str(row[0]);

    if (/BROUGHT FORWARD|CARRIED FORWARD|باسحلا|Tax invoice|Emirates NBD|Commercial Reg|Tax Registration/i.test(r0)) {
      i++; continue;
    }

    const m = dateRe.exec(r0);
    if (m && row[1] !== null && row[1] !== undefined) {
      const dateStr = parseDDMONYY(m[1]);
      if (!dateStr) { i++; continue; }

      const descParts: string[] = [str(row[1])];
      let j = i + 1;

      while (j < rows.length && j < i + 12) {
        const nrow = rows[j];
        const nr0 = str(nrow[0]);
        if (nr0 && dateRe.exec(nr0)) break;
        if (/CARRIED FORWARD|BROUGHT FORWARD/i.test(nr0)) break;

        if (nrow[2] !== null && nrow[2] !== undefined) {
          const debitAmt = parseFloat(str(nrow[2]).replace(/,/g, ""));
          const creditAmt = (nrow[3] !== null && nrow[3] !== undefined) ? parseFloat(str(nrow[3]).replace(/,/g, "")) : NaN;
          const desc = descParts.join(" ").replace(/\n/g, " ").trim();

          if (!isNaN(creditAmt) && creditAmt > 0) {
            txns.push({ date: dateStr, description: desc, amount: creditAmt, type: "income", currency: "AED", category: autoCategory(desc) });
          } else if (!isNaN(debitAmt) && debitAmt > 0) {
            txns.push({ date: dateStr, description: desc, amount: -debitAmt, type: "expense", currency: "AED", category: autoCategory(desc) });
          }
          j++;
          break;
        }
        if (nrow[1]) descParts.push(str(nrow[1]).slice(0, 50));
        j++;
      }
      i = j;
    } else {
      i++;
    }
  }

  return { transactions: txns, bankName: "Emirates NBD LIV", accountType: "Savings Account", currency: "AED" };
}

// ══════════════════════════════════════════════════════════════════════════
//  PARSER 3: LIV Metals Investment (AED)
// ══════════════════════════════════════════════════════════════════════════
export function parseLivMetalsXLSX(rows: unknown[][]): ParseResult {
  const txns: ParsedTransaction[] = [];
  const dateRe = /^(\d{2}[A-Z]{3}\d{2})\s+(.*)/i;

  let i = 0;
  while (i < rows.length) {
    const r0 = str(rows[i][0]);
    const m = dateRe.exec(r0);
    if (m) {
      const dateStr = parseDDMONYY(m[1]);
      const desc = m[2].trim();
      if (dateStr && desc && !/BROUGHT FORWARD|CARRIED FORWARD/i.test(desc)) {
        let fullDesc = desc;
        let j = i + 1;
        while (j < rows.length && j < i + 6) {
          const nr0 = str(rows[j][0]);
          if (!nr0 || dateRe.exec(nr0) || /CARRIED FORWARD/i.test(nr0)) break;
          if (/REFNO|VALUE DATE/i.test(nr0)) { j++; break; }
          fullDesc += " " + nr0;
          j++;
        }
        txns.push({ date: dateStr, description: fullDesc.trim(), amount: 0, type: "income", currency: "AED", category: "Transfers", extra: "Amount not in statement" });
        i = j;
      } else { i++; }
    } else { i++; }
  }

  return { transactions: txns, bankName: "Emirates NBD LIV Metals", accountType: "Metals Investment Account", currency: "AED" };
}

// ══════════════════════════════════════════════════════════════════════════
//  PARSER 4: Islami Bank Bangladesh DPS / MSSA (BDT)
// ══════════════════════════════════════════════════════════════════════════
export function parseIBBLXLSX(rows: unknown[][]): ParseResult {
  const txns: ParsedTransaction[] = [];

  let hdr = -1;
  for (let i = 0; i < rows.length; i++) {
    if (str(rows[i][0]).trim() === "Trans Date") { hdr = i; break; }
  }
  if (hdr < 0) return { transactions: [], bankName: "Islami Bank Bangladesh", accountType: "DPS/MSSA", currency: "BDT", error: "Header not found" };

  for (const row of rows.slice(hdr + 1)) {
    const r0 = row[0];
    if (!r0) continue;
    const desc = str(row[1]);
    if (!desc || /^B\/F$/i.test(desc)) continue;

    // FIX B: toDateStr handles both Date objects and pre-converted strings
    const date = toDateStr(r0);
    if (!date) continue;

    const withdraw = row[4];
    const deposit = row[5];

    if (deposit !== null && deposit !== undefined) {
      const a = parseFloat(str(deposit).replace(/,/g, ""));
      if (!isNaN(a) && a > 0) {
        txns.push({ date, description: desc.replace(/\n/g, " "), amount: a, type: "income", currency: "BDT", category: autoCategory(desc) });
      }
    } else if (withdraw !== null && withdraw !== undefined) {
      const a = parseFloat(str(withdraw).replace(/,/g, ""));
      if (!isNaN(a) && a > 0) {
        txns.push({ date, description: desc.replace(/\n/g, " "), amount: -a, type: "expense", currency: "BDT", category: autoCategory(desc) });
      }
    }
  }

  return { transactions: txns, bankName: "Islami Bank Bangladesh", accountType: "DPS/MSSA", currency: "BDT" };
}

// ══════════════════════════════════════════════════════════════════════════
//  PARSER 5: TapTap Send Remittance (AED → BDT)
// ══════════════════════════════════════════════════════════════════════════
export function parseTapTapXLSX(rows: unknown[][]): ParseResult {
  const txns: ParsedTransaction[] = [];

  let hdr = -1;
  for (let i = 0; i < rows.length; i++) {
    if (str(rows[i][0]) === "ID" && str(rows[i][1]) === "Date") { hdr = i; break; }
  }
  if (hdr < 0) return { transactions: [], bankName: "TapTap Send", accountType: "Remittance", currency: "AED", error: "Header not found" };

  for (const row of rows.slice(hdr + 1)) {
    if (!row[0]) continue;
    const rawDate = str(row[1]).replace(/\n/g, " ").split(" ")[0].trim();
    const date = rawDate.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : rawDate.slice(0, 10);
    if (!date || !/^\d{4}/.test(date)) continue;

    const recipient = str(row[3]);
    const country = str(row[5]);
    const amtCharged = str(row[6]).replace(/AED\s*/i, "").replace(/\n/g, "").trim();
    const converted = str(row[11]).replace(/\n/g, " ").trim();
    const fxRate = str(row[12]).replace(/\n/g, " ").trim();

    const amt = parseFloat(amtCharged.replace(/,/g, ""));
    if (isNaN(amt) || amt <= 0) continue;

    const desc = `TapTap → ${recipient} (${country})`;
    const extra = converted && fxRate ? `${converted} @ ${fxRate.replace("AED 1 = ", "")}` : converted;

    txns.push({ date, description: desc, amount: -amt, type: "expense", currency: "AED", category: "Transfers", extra });
  }

  return { transactions: txns, bankName: "TapTap Send", accountType: "Remittance Transfers", currency: "AED" };
}

// ══════════════════════════════════════════════════════════════════════════
//  PARSER 6: LIV Credit Card (AED) – 5381 XXXX XXXX 1901
//  Layout: col[0]=transaction date, col[3]=posting date,
//          col[8]=description, col[20]=amount (string, may end in "CR")
//
//  FIX: col[0] used to be checked with `instanceof Date` — but readXlsxRows
//  now converts Date cells to local "YYYY-MM-DD" strings before passing rows
//  to parsers. The guard is updated to accept EITHER a Date object OR a
//  YYYY-MM-DD string so the parser works both ways.
// ══════════════════════════════════════════════════════════════════════════
export function parseLivCreditCardXLSX(rows: unknown[][]): ParseResult {
  const txns: ParsedTransaction[] = [];

  for (const row of rows) {
    const r0 = row[0];
    if (!r0) continue;
    if (row.length < 21) continue;

    // FIX B: accept Date object OR pre-converted "YYYY-MM-DD" string
    const date = toDateStr(r0);
    if (!date) continue;

    const desc = str(row[8]);
    if (!desc) continue;

    const amtRaw = row[20];
    if (amtRaw === null || amtRaw === undefined) continue;

    const amtStr = str(amtRaw).replace(/,/g, "").trim();
    const isCredit = /CR$/i.test(amtStr);
    const amt = parseFloat(amtStr.replace(/CR$/i, "").trim());
    if (isNaN(amt) || amt === 0) continue;

    const amount = isCredit ? Math.abs(amt) : -Math.abs(amt);
    const type = isCredit ? "income" : "expense";

    txns.push({ date, description: desc.replace(/\n/g, " "), amount, type, currency: "AED", category: autoCategory(desc) });
  }

  return { transactions: txns, bankName: "LIV Credit Card", accountType: "Credit Card (5381···1901)", currency: "AED" };
}

// ══════════════════════════════════════════════════════════════════════════
//  AUTO-DETECT: Fingerprint rows to choose parser
// ══════════════════════════════════════════════════════════════════════════
export function autoDetectAndParse(rows: unknown[][]): ParseResult {
  const sample = rows.slice(0, 40).map(r => r.map(c => str(c)).join(" ")).join(" ").toLowerCase();

  if (/taptap.*send|taptap send activity/i.test(sample)) {
    return parseTapTapXLSX(rows);
  }
  if (/5381.*1901|credit card statement.*5381|liv.*credit card/i.test(sample)) {
    return parseLivCreditCardXLSX(rows);
  }
  if (/metals investment account|silver currency|metals.*account/i.test(sample)) {
    return parseLivMetalsXLSX(rows);
  }
  if (/islami bank|mssa|cumilla.*chawkbazar|trans date.*particulars/i.test(sample)) {
    return parseIBBLXLSX(rows);
  }
  if (/sonali|bise building|savings deposit.*online|1302901/i.test(sample)) {
    return parseSonaliXLSX(rows);
  }
  if (/emirates nbd|liv.*savings|savings account.*yolo|statement of account.*emirate/i.test(sample)) {
    return parseLivSavingsXLSX(rows);
  }

  for (const fn of [parseSonaliXLSX, parseLivSavingsXLSX, parseTapTapXLSX, parseIBBLXLSX, parseLivCreditCardXLSX]) {
    const r = fn(rows);
    if (r.transactions.length > 0) return r;
  }

  return { transactions: [], bankName: "Unknown", accountType: "Unknown", currency: "AED", error: "Could not detect bank format. Showing raw rows." };
}