// ══════════════════════════════════════════════════════════════════════════
//  Bank Statement XLSX Parsers  – Smart Wallet Companion v4
//  Supports: Sonali Bank BDT | LIV/Emirates NBD Savings AED |
//            LIV Metals Investment AED | LIV Credit Card AED |
//            TapTap Send AED→BDT | Islami Bank DPS BDT
// ══════════════════════════════════════════════════════════════════════════


// ── DATE FORMAT HELPERS ───────────────────────────────────────────────
export type DateFormatId =
  | "auto"
  | "dd-mm-yyyy"
  | "mm-dd-yyyy"
  | "dd-mm-yy"
  | "mm-dd-yy"
  | "yy-mm-dd"
  | "yyyy-mm-dd";

/** Format a Date using LOCAL calendar parts — avoids UTC-offset shifting. */
function localDateStr(d: Date): string {
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, "0")}-` +
    `${String(d.getDate()).padStart(2, "0")}`
  );
}

/**
 * Convert an Excel date serial (integer days since 1899-12-30) to YYYY-MM-DD.
 * Computed entirely in UTC so no timezone offset is applied.
 * e.g. 46053 → 2026-02-01
 */
function excelSerialToDateStr(serial: number): string {
  const MS_PER_DAY = 86_400_000;

  // ✅ FIX: use floor, NOT round
  const days = Math.floor(serial);
  const d = new Date(Date.UTC(1899, 11, 30) + days * MS_PER_DAY);
  // const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * MS_PER_DAY);
  return (
    `${d.getUTCFullYear()}-` +
    `${String(d.getUTCMonth() + 1).padStart(2, "0")}-` +
    `${String(d.getUTCDate()).padStart(2, "0")}`
  );
}

const MONTH_NAMES: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function applyDateFormat(raw: unknown, fmt: DateFormatId): string {
  // ── 1. Numeric → Excel serial ────────────────────────────────────────
  // SheetJS often delivers date cells as raw integer serials when cellDates
  // is false, or when the cell has a custom number format.
  // Valid Excel serial range: 1 (1900-01-01) to 2958465 (9999-12-31).
  if (typeof raw === "number") {
    if (raw >= 1 && raw < 2_958_466) return excelSerialToDateStr(raw);
    return String(raw);
  }

  // ── 2. Date object → local calendar parts ────────────────────────────
  // Using toISOString() would give UTC midnight which is the previous day
  // for UAE (UTC+4) and other positive-offset zones. We use local getters.
  // if (raw instanceof Date) return localDateStr(raw);

if (raw instanceof Date) {
  // fallback only — should rarely happen now
  return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, "0")}-${String(raw.getDate()).padStart(2, "0")}`;
}

  if (!raw) return localDateStr(new Date());

  const s = String(raw).trim();

  // ── 3. Already YYYY-MM-DD — pass straight through ────────────────────
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // ── 4. Three numeric parts: dd/mm/yyyy, mm-dd-yy, yyyy-mm-dd, etc. ───
  const numMatch = s.match(/^(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (numMatch) {
    const [, a, b, c] = numMatch;
    const n  = (x: string) => parseInt(x, 10);
    const yr = (x: string) => (x.length === 2 ? `20${x}` : x);

    let day!: number, month!: number, year!: string;

    if (fmt !== "auto") {
      // Explicit format — trust it exactly
      if      (fmt === "dd-mm-yyyy") { day = n(a); month = n(b); year = c;     }
      else if (fmt === "mm-dd-yyyy") { month = n(a); day = n(b); year = c;     }
      else if (fmt === "dd-mm-yy")   { day = n(a); month = n(b); year = yr(c); }
      else if (fmt === "mm-dd-yy")   { month = n(a); day = n(b); year = yr(c); }
      else if (fmt === "yy-mm-dd")   { year = yr(a); month = n(b); day = n(c); }
      else /* yyyy-mm-dd */          { year = a; month = n(b); day = n(c);     }
    } else {
      // AUTO — infer format from the magnitude of each part:
      //   • If the last part > 31  → it must be a 4-digit year (dd-mm-yyyy style)
      //   • If the first part > 31 → it must be a 4-digit year (yyyy-mm-dd style)
      //   • If first part 13-99   → treat as 2-digit year (yy-mm-dd)
      //   • Otherwise             → assume dd-mm-yy (international default)
      const na = n(a), nb = n(b), nc = n(c);

      if (nc > 31) {
        // e.g. "01-02-2026" or "02-01-2026"
        year = c;
        if      (na > 12) { day = na; month = nb; } // a can't be a month
        else if (nb > 12) { month = na; day = nb; } // b can't be a month
        else              { day = na; month = nb; } // ambiguous → dd-mm
      } else if (na > 31) {
        // e.g. "2026-02-01"
        year = a; month = nb; day = nc;
      } else if (na > 12 && na <= 99) {
        // e.g. "26-02-01"
        year = yr(a); month = nb; day = nc;
      } else {
        // e.g. "01-02-26"
        day = na; month = nb; year = yr(c);
      }
    }

    if (month && day && year) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // ── 5. Month-name formats ─────────────────────────────────────────────
  // "01-Feb-26", "1 Feb 2026"
  const mname = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{2,4})$/);
  if (mname) {
    const mo = MONTH_NAMES[mname[2].toLowerCase()];
    if (mo) {
      const yr = mname[3].length === 2 ? `20${mname[3]}` : mname[3];
      return `${yr}-${mo}-${mname[1].padStart(2, "0")}`;
    }
  }
  // "Feb 1 2026"
  const mnameUS = s.match(/^([A-Za-z]{3})\s+(\d{1,2})[,\s]+(\d{2,4})$/);
  if (mnameUS) {
    const mo = MONTH_NAMES[mnameUS[1].toLowerCase()];
    if (mo) {
      const yr = mnameUS[3].length === 2 ? `20${mnameUS[3]}` : mnameUS[3];
      return `${yr}-${mo}-${mnameUS[2].padStart(2, "0")}`;
    }
  }

  // ── 6. Last resort: JS Date parser ───────────────────────────────────
  // const d = new Date(s);
  // if (!isNaN(d.getTime())) return localDateStr(d);

  // return s; // give up — return as-is




  {
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m}-${d}`;
  }

  const parts = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (parts) {
    const [_, a, b, c] = parts;
    const year = c.length === 2 ? `20${c}` : c;
    return `${year}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
  }
}
}


// ── TRANSACTION INTERFACES ───────────────────────────────────────────
export interface ParsedTransaction {
  date: string;          // YYYY-MM-DD
  description: string;
  amount: number;        // positive = income/credit, negative = expense/debit
  type: "income" | "expense";
  currency: string;
  category: string;
  extra?: string;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  bankName: string;
  accountType: string;
  currency: string;
  error?: string;
}

// ── Category Auto-Detection ──────────────────────────────────────────────
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

// ── STRING HELPER ────────────────────────────────────────────────────
function str(v: unknown): string { return String(v ?? "").trim(); }


// ══════════════════════════════════════════════════════════════════════════
//  PARSER 1: Sonali Bank Bangladesh (BDT)
//  Column layout: [0]=Date, [1]=Description, [2]=Withdraw, [3]=Deposit
// ══════════════════════════════════════════════════════════════════════════
export function parseSonaliXLSX(rows: unknown[][], dateFormat: DateFormatId = "auto"): ParseResult {
  const txns: ParsedTransaction[] = [];

  let hdr = -1;
  for (let i = 0; i < rows.length; i++) {
    if (str(rows[i][0]) === "Date" && str(rows[i][3]) === "Debit") { hdr = i; break; }
  }
  if (hdr < 0) {
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const rowText = rows[i].map(c => str(c).toLowerCase()).join("|");
      if (rowText.includes("debit") && rowText.includes("credit") &&
          (rowText.includes("date") || rowText.includes("transaction"))) {
        hdr = i; break;
      }
    }
  }
  if (hdr < 0) {
    return {
      transactions: [],
      bankName: "Sonali Bank Bangladesh",
      accountType: "Savings Account",
      currency: "BDT",
      error: "Header row not found. Expected columns: Date, Description, Withdraw, Deposit",
    };
  }

  for (const row of rows.slice(hdr + 1)) {
    const r0 = row[0];
    if (!r0) continue;
    const desc = str(row[1]);
    if (!desc || /^B\/F$|BROUGHT FORWARD|CARRIED FORWARD/i.test(desc)) continue;
    const date = applyDateFormat(r0, dateFormat);
    if (!date) continue;
    const withdraw = row[2];
    const deposit  = row[3];
    if (deposit !== null && deposit !== undefined && str(deposit) !== "") {
      const a = parseFloat(str(deposit).replace(/,/g, ""));
      if (!isNaN(a) && a > 0) txns.push({ date, description: desc.replace(/\n/g, " "), amount: a, type: "income", currency: "BDT", category: autoCategory(desc) });
    } else if (withdraw !== null && withdraw !== undefined && str(withdraw) !== "") {
      const a = parseFloat(str(withdraw).replace(/,/g, ""));
      if (!isNaN(a) && a > 0) txns.push({ date, description: desc.replace(/\n/g, " "), amount: -a, type: "expense", currency: "BDT", category: autoCategory(desc) });
    }
  }

  return { transactions: txns, bankName: "Sonali Bank Bangladesh", accountType: "Savings Account", currency: "BDT" };
}


// ══════════════════════════════════════════════════════════════════════════
//  PARSER 2: LIV / Emirates NBD Savings (AED)
// ══════════════════════════════════════════════════════════════════════════
export function parseLivSavingsXLSX(rows: unknown[][], dateFormat: DateFormatId = "auto"): ParseResult {
  const txns: ParsedTransaction[] = [];
  const dateRe = /^(\d{2}[A-Z]{3}\d{2})\s*(.*)/i;

  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    const r0  = str(row[0]);

    if (/BROUGHT FORWARD|CARRIED FORWARD|باسحلا|Tax invoice|Emirates NBD|Commercial Reg|Tax Registration/i.test(r0)) {
      i++; continue;
    }

    const m = dateRe.exec(r0);
    if (m && row[1] !== null && row[1] !== undefined) {
      const dateStr = applyDateFormat(m[1], dateFormat);
      if (!dateStr) { i++; continue; }

      const descParts: string[] = [str(row[1])];
      let j = i + 1;

      while (j < rows.length && j < i + 12) {
        const nrow = rows[j];
        const nr0  = str(nrow[0]);
        if (nr0 && dateRe.exec(nr0)) break;
        if (/CARRIED FORWARD|BROUGHT FORWARD/i.test(nr0)) break;

        if (nrow[2] !== null && nrow[2] !== undefined) {
          const debitAmt  = parseFloat(str(nrow[2]).replace(/,/g, ""));
          const creditAmt = (nrow[3] !== null && nrow[3] !== undefined)
            ? parseFloat(str(nrow[3]).replace(/,/g, "")) : NaN;
          const desc = descParts.join(" ").replace(/\n/g, " ").trim();
          if (!isNaN(creditAmt) && creditAmt > 0)
            txns.push({ date: dateStr, description: desc, amount: creditAmt, type: "income", currency: "AED", category: autoCategory(desc) });
          else if (!isNaN(debitAmt) && debitAmt > 0)
            txns.push({ date: dateStr, description: desc, amount: -debitAmt, type: "expense", currency: "AED", category: autoCategory(desc) });
          j++; break;
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
export function parseLivMetalsXLSX(rows: unknown[][], dateFormat: DateFormatId = "auto"): ParseResult {
  const txns: ParsedTransaction[] = [];
  const dateRe = /^(\d{2}[A-Z]{3}\d{2})\s+(.*)/i;

  let i = 0;
  while (i < rows.length) {
    const r0 = str(rows[i][0]);
    const m  = dateRe.exec(r0);
    if (m) {
      const dateStr = applyDateFormat(m[1], dateFormat);
      const desc    = m[2].trim();
      if (dateStr && desc && !/BROUGHT FORWARD|CARRIED FORWARD/i.test(desc)) {
        let fullDesc = desc;
        let j = i + 1;
        while (j < rows.length && j < i + 6) {
          const nr0 = str(rows[j][0]);
          if (!nr0 || dateRe.exec(nr0) || /CARRIED FORWARD/i.test(nr0)) break;
          if (/REFNO|VALUE DATE/i.test(nr0)) { j++; break; }
          fullDesc += " " + nr0; j++;
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
//  Column layout: [0]=Trans Date, [1]=Particulars, [4]=Withdraw, [5]=Deposit
// ══════════════════════════════════════════════════════════════════════════
export function parseIBBLXLSX(rows: unknown[][], dateFormat: DateFormatId = "auto"): ParseResult {
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
    const date = applyDateFormat(r0, dateFormat);
    if (!date) continue;
    const withdraw = row[4];
    const deposit  = row[5];
    if (deposit !== null && deposit !== undefined && str(deposit) !== "") {
      const a = parseFloat(str(deposit).replace(/,/g, ""));
      if (!isNaN(a) && a > 0) txns.push({ date, description: desc.replace(/\n/g, " "), amount: a, type: "income", currency: "BDT", category: autoCategory(desc) });
    } else if (withdraw !== null && withdraw !== undefined && str(withdraw) !== "") {
      const a = parseFloat(str(withdraw).replace(/,/g, ""));
      if (!isNaN(a) && a > 0) txns.push({ date, description: desc.replace(/\n/g, " "), amount: -a, type: "expense", currency: "BDT", category: autoCategory(desc) });
    }
  }

  return { transactions: txns, bankName: "Islami Bank Bangladesh", accountType: "DPS/MSSA", currency: "BDT" };
}


// ══════════════════════════════════════════════════════════════════════════
//  PARSER 5: TapTap Send Remittance (AED → BDT)
// ══════════════════════════════════════════════════════════════════════════
export function parseTapTapXLSX(rows: unknown[][], dateFormat: DateFormatId = "auto"): ParseResult {
  const txns: ParsedTransaction[] = [];

  let hdr = -1;
  for (let i = 0; i < rows.length; i++) {
    if (str(rows[i][0]) === "ID" && str(rows[i][1]) === "Date") { hdr = i; break; }
  }
  if (hdr < 0) return { transactions: [], bankName: "TapTap Send", accountType: "Remittance", currency: "AED", error: "Header not found" };

  for (const row of rows.slice(hdr + 1)) {
    if (!row[0]) continue;
    const date = applyDateFormat(row[1], dateFormat);
    if (!date) continue;
    const recipient  = str(row[3]);
    const country    = str(row[5]);
    const amtCharged = str(row[6]).replace(/AED\s*/i, "").replace(/\n/g, "").trim();
    const converted  = str(row[11]).replace(/\n/g, " ").trim();
    const fxRate     = str(row[12]).replace(/\n/g, " ").trim();
    const amt = parseFloat(amtCharged.replace(/,/g, ""));
    if (isNaN(amt) || amt <= 0) continue;
    const desc  = `TapTap → ${recipient} (${country})`;
    const extra = converted && fxRate ? `${converted} @ ${fxRate.replace("AED 1 = ", "")}` : converted;
    txns.push({ date, description: desc, amount: -amt, type: "expense", currency: "AED", category: "Transfers", extra });
  }

  return { transactions: txns, bankName: "TapTap Send", accountType: "Remittance Transfers", currency: "AED" };
}


// ══════════════════════════════════════════════════════════════════════════
//  PARSER 6: LIV Credit Card (AED) – 5381 XXXX XXXX 1901
//  Column layout: [0]=transaction date, [8]=description, [20]=amount (may end "CR")
// ══════════════════════════════════════════════════════════════════════════
export function parseLivCreditCardXLSX(rows: unknown[][], dateFormat: DateFormatId = "auto"): ParseResult {
  const txns: ParsedTransaction[] = [];

  for (const row of rows) {
    const r0 = row[0];
    if (!r0 || row.length < 21) continue;
    const date = applyDateFormat(r0, dateFormat);
    if (!date) continue;
    const desc = str(row[8]);
    if (!desc) continue;
    const amtRaw = row[20];
    if (amtRaw === null || amtRaw === undefined) continue;
    const amtStr   = str(amtRaw).replace(/,/g, "").trim();
    const isCredit = /CR$/i.test(amtStr);
    const amt      = parseFloat(amtStr.replace(/CR$/i, "").trim());
    if (isNaN(amt) || amt === 0) continue;
    const amount = isCredit ? Math.abs(amt) : -Math.abs(amt);
    const type   = isCredit ? "income" : "expense";
    txns.push({ date, description: desc.replace(/\n/g, " "), amount, type, currency: "AED", category: autoCategory(desc) });
  }

  return { transactions: txns, bankName: "LIV Credit Card", accountType: "Credit Card (5381···1901)", currency: "AED" };
}


// ══════════════════════════════════════════════════════════════════════════
//  AUTO-DETECT: Fingerprint rows to choose parser
// ══════════════════════════════════════════════════════════════════════════
export function autoDetectAndParse(rows: unknown[][], dateFormat: DateFormatId = "auto"): ParseResult {
  const sample = rows.slice(0, 40).map(r => r.map(c => String(c)).join(" ")).join(" ").toLowerCase();

  if (/taptap.*send|taptap send activity/i.test(sample))                            return parseTapTapXLSX(rows, dateFormat);
  if (/5381.*1901|credit card statement.*5381|liv.*credit card/i.test(sample))      return parseLivCreditCardXLSX(rows, dateFormat);
  if (/metals investment account|silver currency|metals.*account/i.test(sample))    return parseLivMetalsXLSX(rows, dateFormat);
  if (/islami bank|mssa|cumilla.*chawkbazar|trans date.*particulars/i.test(sample)) return parseIBBLXLSX(rows, dateFormat);
  if (/sonali|bise building|savings deposit.*online|1302901/i.test(sample))         return parseSonaliXLSX(rows, dateFormat);
  if (/emirates nbd|liv.*savings|savings account.*yolo|statement of account.*emirate/i.test(sample)) return parseLivSavingsXLSX(rows, dateFormat);

  // Fallback: try each parser and return the first that yields transactions
  const fallbacks = [
    parseLivSavingsXLSX,
    parseSonaliXLSX,
    parseTapTapXLSX,
    parseIBBLXLSX,
    parseLivCreditCardXLSX,
    parseLivMetalsXLSX,
  ];
  for (const fn of fallbacks) {
    const r = fn(rows, dateFormat);
    if (r.transactions.length > 0) return r;
  }

  return {
    transactions: [],
    bankName: "Unknown",
    accountType: "Unknown",
    currency: "AED",
    error: "Could not detect bank format. Showing raw rows.",
  };
}