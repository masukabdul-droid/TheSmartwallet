import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, AlertCircle, Upload, FileSpreadsheet, Import, ChevronDown, ChevronUp, Loader2, ArrowRight, RefreshCw } from "lucide-react";
import { useDB } from "@/lib/database";
import { autoDetectAndParse, type ParsedTransaction } from "@/lib/xlsx-parsers";
import { useToast } from "@/hooks/use-toast";

const CAT_COLORS: Record<string, string> = {
  "Income":"bg-primary/20 text-primary","Groceries":"bg-green-500/20 text-green-400",
  "Food & Dining":"bg-orange-500/20 text-orange-400","Utilities":"bg-yellow-500/20 text-yellow-400",
  "Telecom":"bg-blue-500/20 text-blue-400","Transport":"bg-purple-500/20 text-purple-400",
  "Transportation":"bg-purple-500/20 text-purple-400",
  "Shopping":"bg-pink-500/20 text-pink-400","Health":"bg-red-500/20 text-red-400",
  "Government":"bg-gray-500/20 text-gray-400","Education":"bg-cyan-500/20 text-cyan-400",
  "Housing":"bg-emerald-500/20 text-emerald-400","Transfers":"bg-indigo-500/20 text-indigo-400",
  "Cash":"bg-amber-500/20 text-amber-400","Credit Card Payment":"bg-rose-500/20 text-rose-400",
  "Interest/Returns":"bg-teal-500/20 text-teal-400","Personal":"bg-violet-500/20 text-violet-400",
  "Food":"bg-orange-500/20 text-orange-400","Fuel":"bg-yellow-600/20 text-yellow-500",
  "Other":"bg-secondary text-muted-foreground",
};
const ALL_CATS = Object.keys(CAT_COLORS);

// ─── Notion CSV/Excel parser ─────────────────────────────────────────────────

/** Map account-name keywords → currency code (case-insensitive substring match) */
const ACCOUNT_CURRENCY_MAP: Array<[string, string]> = [
  // AED accounts
  ["liv",          "AED"],
  ["neo",          "AED"],
  ["mashreq",      "AED"],
  ["emirates",     "AED"],
  ["enbd",         "AED"],
  ["adcb",         "AED"],
  ["fab",          "AED"],
  ["dib",          "AED"],
  ["rakbank",      "AED"],
  // BDT accounts
  ["sonali",       "BDT"],
  ["islami",       "BDT"],
  ["dutch",        "BDT"],
  ["brac",         "BDT"],
  ["dbbl",         "BDT"],
  // USD
  ["wise",         "USD"],
  ["paypal",       "USD"],
  ["taptap",       "USD"],
  ["remitly",      "USD"],
];

function inferCurrencyFromAccount(accountName: string): string {
  const lower = accountName.toLowerCase();
  for (const [keyword, currency] of ACCOUNT_CURRENCY_MAP) {
    if (lower.includes(keyword)) return currency;
  }
  return "AED"; // sensible default for UAE-based usage
}

function parseNotionRows(rows: unknown[][]): ParsedTransaction[] {
  if (rows.length < 2) return [];
  const header = (rows[0] as unknown[]).map(h => String(h ?? "").toLowerCase().trim());

  const col = (names: string[]) => {
    for (const n of names) {
      const idx = header.findIndex(h => h.includes(n));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const dateCol    = col(["date"]);
  const descCol    = col(["expenses", "description", "desc", "name", "title"]);
  // Two separate amount columns — pick whichever is filled per row
  // "Total Amount" = original currency; "Total Amount (BD)" = BDT converted
  const amtColMain = header.findIndex(h => (h === "total amount" || h === "total amount (aed)" || h === "amount") && !h.includes("(bd)") && !h.includes("(bdt)"));
  const amtColBD   = header.findIndex(h => h.includes("total amount") && (h.includes("(bd)") || h.includes("(bdt)")));
  const catCol     = col(["categories", "category"]);
  const acctCol    = col(["accounts", "account", "payment method"]);
  const currCol    = col(["currency"]); // explicit currency column if present

  const parseNotionDate = (raw: unknown): string => {
    if (!raw) return new Date().toISOString().split("T")[0];
    if (raw instanceof Date) return raw.toISOString().split("T")[0];
    const s = String(raw).trim();
    // dd-mm-yyyy  or  dd/mm/yyyy
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const y = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toISOString().split("T")[0];
  };

  // "Food (Food%20...csv)"  →  "Food"
  const cleanNotionName = (raw: unknown): string => {
    if (!raw) return "";
    const s = String(raw).trim();
    const paren = s.match(/^(.+?)\s*\(/);
    return paren ? paren[1].trim() : s;
  };

  // Handles "3,000" / "1,234.56" / plain numbers
  const parseAmount = (raw: unknown): number => {
    if (raw === null || raw === undefined || raw === "") return 0;
    if (typeof raw === "number") return raw;
    return parseFloat(String(raw).replace(/,/g, "").trim()) || 0;
  };

  const txns: ParsedTransaction[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row  = rows[r] as unknown[];
    const desc = descCol >= 0 ? String(row[descCol] ?? "").trim() : "";

    // Pick whichever amount column is filled: prefer Main (original currency),
    // fall back to BD/BDT (converted). Both empty → skip the row.
    const rawMain = amtColMain >= 0 ? row[amtColMain] : null;
    const rawBD   = amtColBD   >= 0 ? row[amtColBD]   : null;
    const isFilled = (v: unknown) => v !== null && v !== undefined && v !== "" && v !== 0;
    const useMain = isFilled(rawMain);
    const rawAmt  = useMain ? rawMain : (isFilled(rawBD) ? rawBD : null);

    if (!desc && !isFilled(rawAmt)) continue; // skip blank rows

    const accountName = acctCol >= 0 ? cleanNotionName(row[acctCol]) : "";

    // Currency priority:
    //   1. Explicit "Currency" column in the sheet
    //   2. If using the BD column → BDT
    //   3. Infer from account name keyword map
    //   4. Default AED
    let currency = "AED";
    if (currCol >= 0 && row[currCol]) {
      currency = String(row[currCol]).trim().toUpperCase();
    } else if (!useMain && isFilled(rawBD)) {
      currency = "BDT";
    } else if (accountName) {
      currency = inferCurrencyFromAccount(accountName);
    }

    const amount = parseAmount(rawAmt);

    txns.push({
      date:        dateCol >= 0 ? parseNotionDate(row[dateCol]) : new Date().toISOString().split("T")[0],
      description: desc || "Unknown",
      amount:      amount > 0 ? -amount : amount, // Notion sheet stores expenses as positive → negate
      type:        "expense",
      category:    catCol  >= 0 ? cleanNotionName(row[catCol]) : "Other",
      currency,
      extra:       accountName,
    });
  }
  return txns;
}

function isNotionSheet(rows: unknown[][]): boolean {
  if (!rows[0]) return false;
  const h = (rows[0] as unknown[]).map(c => String(c ?? "").toLowerCase());
  return h.some(c => c.includes("expenses")) && h.some(c => c.includes("categories"));
}

// ─── XLSX reader ──────────────────────────────────────────────────────────────
async function readXlsxRows(file: File): Promise<unknown[][]> {
  try {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    const rows: unknown[][] = [];
    for (let R = range.s.r; R <= range.e.r; R++) {
      const row: unknown[] = [];
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (!cell) { row.push(null); continue; }
        if (cell.t === "d" && cell.v instanceof Date) { row.push(cell.v); continue; }
        if (cell.t === "n") { row.push(cell.v); continue; }
        row.push(cell.v ?? null);
      }
      rows.push(row);
    }
    return rows;
  } catch {
    throw new Error("Could not read XLSX file. Make sure xlsx is installed (npm install xlsx).");
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface BulkRule {
  fromCategory:  string;
  fromAccountId: string;
  toCategory:    string;
  toAccountId:   string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function StatementImport() {
  const { batchAddTransactions, accounts } = useDB();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [dragging,        setDragging]        = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [fileInfo,        setFileInfo]        = useState<{ name: string; size: string } | null>(null);
  const [parseResult,     setParseResult]     = useState<{ transactions: ParsedTransaction[]; bankName: string; accountType: string; currency: string; error?: string } | null>(null);
  const [selectedIds,     setSelectedIds]     = useState<Set<number>>(new Set());
  const [targetAccountId, setTargetAccountId] = useState(accounts[0]?.id ?? "");
  const [imported,        setImported]        = useState(false);
  const [showAll,         setShowAll]         = useState(false);
  const [editCats,        setEditCats]        = useState<Record<number, string>>({});
  const [editAccounts,    setEditAccounts]    = useState<Record<number, string>>({});

  // All as Transfer
  const [allAsTransfer,    setAllAsTransfer]    = useState(false);
  const [transferFromAcct, setTransferFromAcct] = useState("");
  const [transferToAcct,   setTransferToAcct]   = useState("");

  // Bulk rule
  const [bulkRule,  setBulkRule]  = useState<BulkRule>({ fromCategory: "", fromAccountId: "", toCategory: "", toAccountId: "" });
  const [bulkApplied, setBulkApplied] = useState(false);

  const txns     = parseResult?.transactions ?? [];
  const displayed = showAll ? txns : txns.slice(0, 30);

  const presentCategories   = Array.from(new Set(txns.map((t, i) => editCats[i]    || t.category || "Other")));
  const presentAccountNames = Array.from(new Set(txns.map(t => t.extra || "").filter(Boolean)));

  const bulkReady =
    bulkRule.fromCategory  !== "" &&
    bulkRule.fromAccountId !== "" &&
    bulkRule.toCategory    !== "" &&
    bulkRule.toAccountId   !== "";

  // Auto-select rows matching the bulk "from" filters
  useEffect(() => {
    if (!bulkRule.fromCategory && !bulkRule.fromAccountId) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      txns.forEach((tx, i) => {
        const cat  = editCats[i]    || tx.category || "Other";
        const acct = editAccounts[i] || tx.extra   || "";
        const catMatch  = !bulkRule.fromCategory  || cat  === bulkRule.fromCategory;
        const acctMatch = !bulkRule.fromAccountId || acct === bulkRule.fromAccountId ||
                          accounts.find(a => a.id === bulkRule.fromAccountId)?.name === acct;
        if (catMatch && acctMatch) next.add(i);
      });
      return next;
    });
    setBulkApplied(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkRule.fromCategory, bulkRule.fromAccountId]);

  const applyBulkRule = () => {
    if (!bulkReady) return;
    const newCats:  Record<number, string> = { ...editCats };
    const newAccts: Record<number, string> = { ...editAccounts };
    txns.forEach((tx, i) => {
      const cat  = editCats[i]    || tx.category || "Other";
      const acct = editAccounts[i] || tx.extra   || "";
      const catMatch  = !bulkRule.fromCategory  || cat  === bulkRule.fromCategory;
      const acctMatch = !bulkRule.fromAccountId || acct === bulkRule.fromAccountId ||
                        accounts.find(a => a.id === bulkRule.fromAccountId)?.name === acct;
      if (catMatch && acctMatch) {
        newCats[i]  = bulkRule.toCategory;
        newAccts[i] = bulkRule.toAccountId;
      }
    });
    setEditCats(newCats);
    setEditAccounts(newAccts);
    setBulkApplied(true);
    toast({ title: "Bulk rule applied", description: `Remapped → ${bulkRule.toCategory}` });
  };

  const resetBulkRule = () => {
    setBulkRule({ fromCategory: "", fromAccountId: "", toCategory: "", toAccountId: "" });
    setBulkApplied(false);
  };

  // ── File processing ──────────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast({ title: "Invalid file type", description: "Please upload an .xlsx or .csv file", variant: "destructive" }); return;
    }
    setLoading(true); setImported(false); setParseResult(null);
    setFileInfo({ name: file.name, size: `${(file.size / 1024).toFixed(1)} KB` });
    setEditCats({}); setEditAccounts({});
    setBulkRule({ fromCategory: "", fromAccountId: "", toCategory: "", toAccountId: "" });
    try {
      const rows = await readXlsxRows(file);
      if (isNotionSheet(rows)) {
        const notionTxns = parseNotionRows(rows);
        setParseResult({ transactions: notionTxns, bankName: "Notion Export", accountType: "Expense Sheet", currency: "AED" });
        setSelectedIds(new Set(notionTxns.map((_, i) => i)));
        toast({ title: "✓ Notion Export", description: `${notionTxns.length} transactions parsed` });
        return;
      }
      const result = autoDetectAndParse(rows);
      setParseResult(result);
      setSelectedIds(new Set(result.transactions.map((_, i) => i)));
      toast({ title: `✓ ${result.bankName}`, description: `${result.transactions.length} transactions parsed` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setParseResult({ transactions: [], bankName: "Error", accountType: "", currency: "AED", error: msg });
      toast({ title: "Parse error", description: msg, variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  const onDrop       = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) processFile(e.target.files[0]); };
  const toggleSelect = (i: number) => { const s = new Set(selectedIds); s.has(i) ? s.delete(i) : s.add(i); setSelectedIds(s); };
  const toggleAll    = () => selectedIds.size === txns.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(txns.map((_, i) => i)));

  // ── Import ───────────────────────────────────────────────────────────────
  const handleImport = () => {
    if (!allAsTransfer && !targetAccountId) { toast({ title: "Select an account first", variant: "destructive" }); return; }
    if (allAsTransfer && (!transferFromAcct || !transferToAcct)) { toast({ title: "Select both transfer accounts", variant: "destructive" }); return; }

    const finalList = txns
      .map((tx, i) => ({ tx, i }))
      .filter(({ i }) => selectedIds.has(i))
      .map(({ tx, i }) => {
        if (allAsTransfer) {
          return {
            name:        tx.description.slice(0, 80),
            amount:      Math.abs(tx.amount),
            type:        "transfer" as const,
            category:    "Transfers",
            accountId:   transferFromAcct,
            toAccountId: transferToAcct,
            date:        tx.date,
            notes:       tx.extra || "",
          };
        }
        return {
          name:      tx.description.slice(0, 80),
          amount:    tx.amount,
          type:      tx.type as "income" | "expense",
          category:  editCats[i]     || tx.category || "Other",
          accountId: editAccounts[i] || targetAccountId,
          date:      tx.date,
          notes:     tx.extra || "",
        };
      });

    batchAddTransactions(finalList);
    const acct    = accounts.find(a => a.id === targetAccountId);
    const totalIn  = finalList.filter(t => (t.amount ?? 0) > 0).reduce((s, t) => s + (t.amount ?? 0), 0);
    const totalOut = finalList.filter(t => (t.amount ?? 0) < 0).reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
    setImported(true);
    toast({ title: `✓ Imported ${finalList.length} transactions${acct ? ` to ${acct.name}` : ""}`, description: `+AED ${totalIn.toFixed(0)} in / -AED ${totalOut.toFixed(0)} out` });
    setParseResult(null); setFileInfo(null); setSelectedIds(new Set());
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader title="Statement Import" subtitle="Drag & drop your bank XLSX / Notion statements for automatic parsing" />

      {/* Supported formats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { bank: "Sonali Bank",     icon: "🇧🇩", col: "border-green-500/30 bg-green-500/5" },
          { bank: "LIV / ENBD",      icon: "🇦🇪", col: "border-blue-500/30 bg-blue-500/5" },
          { bank: "LIV Credit Card", icon: "💳",  col: "border-violet-500/30 bg-violet-500/5" },
          { bank: "Mashreq / Neo",   icon: "🏦",  col: "border-sky-500/30 bg-sky-500/5" },
          { bank: "TapTap Send",     icon: "💸",  col: "border-orange-500/30 bg-orange-500/5" },
          { bank: "Notion Export",   icon: "📋",  col: "border-pink-500/30 bg-pink-500/5" },
        ].map(f => (
          <div key={f.bank} className={`glass-card p-3 border ${f.col} text-center`}>
            <div className="text-2xl mb-1">{f.icon}</div>
            <p className="text-xs font-medium text-foreground">{f.bank}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Auto-detected</p>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all p-10 text-center
          ${dragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-secondary/30"}`}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
        {loading
          ? <div className="flex flex-col items-center gap-3"><Loader2 className="w-10 h-10 text-primary animate-spin" /><p className="text-sm text-muted-foreground">Parsing…</p></div>
          : fileInfo
            ? <div className="flex flex-col items-center gap-2"><FileSpreadsheet className="w-10 h-10 text-primary" /><p className="text-sm font-medium">{fileInfo.name}</p><p className="text-xs text-muted-foreground">{fileInfo.size}</p></div>
            : <div className="flex flex-col items-center gap-3"><Upload className="w-10 h-10 text-muted-foreground" /><div><p className="text-base font-medium text-foreground">Drop your bank statement here</p><p className="text-sm text-muted-foreground mt-1">or click to browse — .xlsx / .csv / Notion export</p></div></div>
        }
      </motion.div>

      {/* Parse info + options */}
      {parseResult && !parseResult.error && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-4">

          {/* Stats row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5 flex-wrap text-xs">
              <div><p className="text-muted-foreground">Bank / Source</p><p className="font-semibold text-foreground">{parseResult.bankName}</p></div>
              <div><p className="text-muted-foreground">Type</p><p className="font-semibold text-foreground">{parseResult.accountType}</p></div>
              <div><p className="text-muted-foreground">Currency</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {Array.from(new Set(txns.length > 0 ? txns.map(t => t.currency) : [parseResult.currency])).sort().map(cur => (
                    <Badge key={cur} variant="secondary">{cur}</Badge>
                  ))}
                </div>
              </div>
              <div><p className="text-muted-foreground">Found</p><p className="font-semibold text-primary">{txns.length} transactions</p></div>
            </div>
            {!allAsTransfer && (
              <div className="space-y-1">
                <Label className="text-xs">Default Import Account</Label>
                <Select value={targetAccountId} onValueChange={setTargetAccountId}>
                  <SelectTrigger className="w-[200px] bg-background border-border h-8 text-xs"><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* ── All as Transfer ── */}
          <div className="border border-border rounded-xl p-3 space-y-3 bg-secondary/10">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAllAsTransfer(v => !v)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${allAsTransfer ? "bg-primary border-primary" : "border-border"}`}
              >
                {allAsTransfer && <Check className="w-3 h-3 text-white" />}
              </button>
              <span className="text-sm font-medium text-foreground">Import all selected as Transfers</span>
            </div>
            <AnimatePresence>
              {allAsTransfer && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="flex flex-wrap gap-4 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs text-foreground">From Account</Label>
                      <Select value={transferFromAcct} onValueChange={setTransferFromAcct}>
                        <SelectTrigger className="w-[180px] bg-background border-border h-8 text-xs text-foreground">
                          <SelectValue placeholder="From account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map(a => (
                            <SelectItem key={a.id} value={a.id} className="text-foreground">{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end pb-1">
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-foreground">To Account</Label>
                      <Select value={transferToAcct} onValueChange={setTransferToAcct}>
                        <SelectTrigger className="w-[180px] bg-background border-border h-8 text-xs text-foreground">
                          <SelectValue placeholder="To account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map(a => (
                            <SelectItem key={a.id} value={a.id} className="text-foreground">{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Bulk Remap ── */}
          {!allAsTransfer && (
            <div className={`border rounded-xl p-3 space-y-3 transition-all duration-300
              ${bulkReady ? "border-primary/50 bg-primary/5 shadow-sm shadow-primary/10" : "border-border bg-secondary/10"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Bulk Remap
                  {bulkReady    && !bulkApplied && <Badge className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary border border-primary/30">Ready ✦</Badge>}
                  {bulkApplied  && <Badge className="text-[10px] px-1.5 py-0 bg-green-500/20 text-green-400 border border-green-500/30">Applied ✓</Badge>}
                </span>
                <button onClick={resetBulkRule} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  <RefreshCw className="w-3 h-3" />Reset
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Selecting a "From" value auto-highlights matching rows. Fill all four fields, then click Apply.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* FROM */}
                <div className="space-y-2 p-2 rounded-lg bg-secondary/20">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">From</p>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Category</Label>
                    <select
                      value={bulkRule.fromCategory}
                      onChange={e => setBulkRule(r => ({ ...r, fromCategory: e.target.value }))}
                      className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 text-foreground"
                    >
                      <option value="">— any category —</option>
                      {presentCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Account</Label>
                    <select
                      value={bulkRule.fromAccountId}
                      onChange={e => setBulkRule(r => ({ ...r, fromAccountId: e.target.value }))}
                      className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 text-foreground"
                    >
                      <option value="">— any account —</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      {presentAccountNames
                        .filter(n => !accounts.some(a => a.name === n))
                        .map(n => <option key={n} value={n}>{n} (import)</option>)
                      }
                    </select>
                  </div>
                </div>

                {/* TO */}
                <div className="space-y-2 p-2 rounded-lg bg-secondary/20">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">To</p>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Category</Label>
                    <select
                      value={bulkRule.toCategory}
                      onChange={e => setBulkRule(r => ({ ...r, toCategory: e.target.value }))}
                      className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 text-foreground"
                    >
                      <option value="">— select —</option>
                      {ALL_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Account</Label>
                    <select
                      value={bulkRule.toAccountId}
                      onChange={e => setBulkRule(r => ({ ...r, toAccountId: e.target.value }))}
                      className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 text-foreground"
                    >
                      <option value="">— select —</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                className={`w-full gap-2 transition-all ${bulkReady ? "opacity-100" : "opacity-40 cursor-not-allowed"}`}
                disabled={!bulkReady}
                onClick={applyBulkRule}
              >
                <Check className="w-3.5 h-3.5" />
                Apply to {selectedIds.size} selected row{selectedIds.size !== 1 ? "s" : ""}
              </Button>

              {bulkApplied && (
                <p className="text-[11px] text-center text-muted-foreground">
                  Done! Click Reset above to configure another batch.
                </p>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Transaction table */}
      {parseResult && !parseResult.error && txns.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleAll}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedIds.size === txns.length ? "bg-primary border-primary" : "border-border"}`}
              >
                {selectedIds.size === txns.length && <Check className="w-3 h-3 text-white" />}
              </button>
              <span className="text-sm font-medium">{selectedIds.size} / {txns.length} selected</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={toggleAll}>{selectedIds.size === txns.length ? "Deselect All" : "Select All"}</Button>
              <Button size="sm" className="gap-2" onClick={handleImport} disabled={selectedIds.size === 0}><Import className="w-3.5 h-3.5" />Import {selectedIds.size}</Button>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-semibold uppercase text-muted-foreground bg-secondary/20">
            <span className="col-span-1" />
            <span className="col-span-2">Date</span>
            <span className="col-span-3">Description</span>
            <span className="col-span-2">Category</span>
            <span className="col-span-2">Account</span>
            <span className="col-span-1 text-right">Amount</span>
            <span className="col-span-1 text-right">Type</span>
          </div>

          <div className="divide-y divide-border">
            {displayed.map((tx, i) => {
              const sel = selectedIds.has(i);
              const cat = editCats[i] || tx.category || "Other";
              const matchesBulk = (bulkRule.fromCategory !== "" || bulkRule.fromAccountId !== "") && (() => {
                const acct     = editAccounts[i] || tx.extra || "";
                const catMatch  = !bulkRule.fromCategory  || cat  === bulkRule.fromCategory;
                const acctMatch = !bulkRule.fromAccountId || acct === bulkRule.fromAccountId ||
                                  accounts.find(a => a.id === bulkRule.fromAccountId)?.name === acct;
                return catMatch && acctMatch;
              })();

              return (
                <div
                  key={i}
                  onClick={() => toggleSelect(i)}
                  className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center cursor-pointer transition-colors hover:bg-secondary/20
                    ${sel ? "" : "opacity-40"}
                    ${matchesBulk && !bulkApplied ? "ring-1 ring-inset ring-primary/40 bg-primary/5" : ""}
                  `}
                >
                  <span className="col-span-1">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${sel ? "bg-primary border-primary" : "border-border"}`}>
                      {sel && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                  </span>
                  <span className="col-span-2 text-xs text-muted-foreground">{tx.date}</span>
                  <span className="col-span-3 text-xs text-foreground truncate" title={tx.description}>{tx.description}</span>
                  <span className="col-span-2" onClick={e => e.stopPropagation()}>
                    <select
                      value={cat}
                      onChange={e => setEditCats(p => ({ ...p, [i]: e.target.value }))}
                      className="w-full text-[10px] bg-secondary border-0 rounded px-1 py-0.5 text-foreground cursor-pointer"
                    >
                      {ALL_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </span>
                  <span className="col-span-2" onClick={e => e.stopPropagation()}>
                    <select
                      value={editAccounts[i] || targetAccountId}
                      onChange={e => setEditAccounts(p => ({ ...p, [i]: e.target.value }))}
                      className="w-full text-[10px] bg-secondary border-0 rounded px-1 py-0.5 text-foreground cursor-pointer"
                    >
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </span>
                  <span className={`col-span-1 text-xs font-semibold text-right ${tx.amount >= 0 ? "text-primary" : "text-foreground"}`}>
                    {tx.amount >= 0 ? "+" : ""}{Math.abs(tx.amount).toFixed(2)}
                  </span>
                  <span className="col-span-1 flex justify-end">
                    <Badge className={`text-[9px] px-1 py-0 ${CAT_COLORS[cat] || CAT_COLORS.Other}`}>{tx.type}</Badge>
                  </span>
                </div>
              );
            })}
          </div>

          {txns.length > 30 && (
            <div className="p-3 text-center border-t border-border">
              <button onClick={() => setShowAll(!showAll)} className="flex items-center gap-1 mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
                {showAll ? <><ChevronUp className="w-4 h-4" />Show less</> : <><ChevronDown className="w-4 h-4" />Show all {txns.length} transactions</>}
              </button>
            </div>
          )}

          <div className="p-4 border-t border-border flex flex-wrap justify-between items-center gap-3">
            {/* Multi-currency summary grouped by currency */}
            <div className="flex flex-wrap gap-3">
              {Array.from(new Set(txns.map(t => t.currency))).sort().map(cur => {
                const curTxns = txns.filter(t => t.currency === cur);
                const income  = curTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
                const expense = Math.abs(curTxns.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0));
                return (
                  <div key={cur} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{cur}</Badge>
                    {income > 0 && <span className="text-primary font-medium">+{income.toFixed(2)}</span>}
                    {income > 0 && expense > 0 && <span className="text-muted-foreground">/</span>}
                    {expense > 0 && <span className="text-foreground font-medium">-{expense.toFixed(2)}</span>}
                  </div>
                );
              })}
            </div>
            <Button className="gap-2" onClick={handleImport} disabled={selectedIds.size === 0}><Import className="w-4 h-4" />Import {selectedIds.size} Transactions</Button>
          </div>
        </motion.div>
      )}

      {parseResult?.error && (
        <div className="glass-card p-5 flex items-center gap-3 border border-destructive/30">
          <AlertCircle className="w-5 h-5 text-destructive" />
          <p className="text-sm text-destructive">{parseResult.error}</p>
        </div>
      )}

      {imported && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3"><Check className="w-8 h-8 text-primary" /></div>
          <p className="text-lg font-display font-bold text-foreground">Import Complete!</p>
          <p className="text-sm text-muted-foreground mt-1">Transactions added to your account. Drop another file to continue.</p>
          <Button variant="outline" className="mt-4" onClick={() => setImported(false)}>Import Another File</Button>
        </motion.div>
      )}
    </div>
  );
}
