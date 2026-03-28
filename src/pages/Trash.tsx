import { useState } from "react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, RotateCcw, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useDB, TrashedItem } from "@/lib/database";
import { useAuth } from "@/lib/auth";
import { sbGetTrash, sbDeleteFromTrash, sbClearTrash, sbUpsert, sbUpsertSingleton } from "@/lib/supabase-db";
import { Download, Upload } from "lucide-react";

// Trash is now stored in Supabase

const TYPE_LABELS: Record<string, string> = {
  transaction:"Transaction", account:"Account", creditcard:"Credit Card",
  loan:"Loan / EMI", transfer:"Transfer", property:"Property",
  business:"Business", goal:"Goal", savings:"Savings Goal", loyalty:"Loyalty Program",
  recurring:"Recurring Bill", moneylender:"Money Lender", crypto:"Crypto Holding",
  discount:"Discount Card", budget:"Budget",
};
const TYPE_COLORS: Record<string, string> = {
  transaction:"bg-blue-500/20 text-blue-400", account:"bg-green-500/20 text-green-400",
  creditcard:"bg-purple-500/20 text-purple-400", loan:"bg-red-500/20 text-red-400",
  transfer:"bg-indigo-500/20 text-indigo-400", property:"bg-amber-500/20 text-amber-400",
  business:"bg-teal-500/20 text-teal-400", goal:"bg-pink-500/20 text-pink-400",
  savings:"bg-emerald-500/20 text-emerald-400", loyalty:"bg-yellow-500/20 text-yellow-400",
  recurring:"bg-orange-500/20 text-orange-400", moneylender:"bg-cyan-500/20 text-cyan-400",
  crypto:"bg-violet-500/20 text-violet-400", discount:"bg-rose-500/20 text-rose-400",
  budget:"bg-lime-500/20 text-lime-400",
};

export default function Trash() {
  const db = useDB();
  const { currentUser } = useAuth();
  const [items, setItems] = useState<TrashedItem[]>([]);
  const [trashLoading, setTrashLoading] = useState(true);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = () => {
    if (!currentUser) return;
    sbGetTrash(currentUser.id).then(data => { setItems(data); setTrashLoading(false); });
  };
  useState(() => { refresh(); });

  const handleRestore = (item: TrashedItem) => {
    try {
      switch (item.type) {
        case "transaction": db.addTransaction(item.data); break;
        case "account": {
          const { balance, ...rest } = item.data;
          db.addAccount({ ...rest, openingBalance: rest.openingBalance ?? balance ?? 0 });
          break;
        }
        case "creditcard": db.addCreditCard(item.data); break;
        case "loan": db.addLoan(item.data); break;
        case "property": db.addProperty(item.data); break;
        case "business": db.addBusiness(item.data); break;
        case "goal": db.addGoal(item.data); break;
        case "savings": db.addSavingsGoal(item.data); break;
        case "loyalty": db.addLoyaltyProgram(item.data); break;
        case "recurring": db.addRecurringBill(item.data); break;
        case "moneylender": db.addMoneyLender(item.data); break;
        case "crypto": db.addCryptoHolding(item.data); break;
        case "budget": db.addBudget(item.data); break;
        default: console.warn("Unknown restore type:", item.type);
      }
      removeFromTrash(item.id);
      refresh();
    } catch(e) { console.error("Restore failed", e); }
  };

  const handleDelete = (id: string) => { if (currentUser) sbDeleteFromTrash(id).then(refresh); };
  const handleClearAll = () => { if (currentUser) sbClearTrash(currentUser.id).then(() => { setItems([]); setClearConfirm(false); }); };

  const types = [...new Set(items.map(i => i.type))];
  const filtered = filter === "all" ? items : items.filter(i => i.type === filter);

  const daysSince = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / (1000*60*60*24));
    if (days===0) return "Today"; if (days===1) return "Yesterday";
    return `${days} days ago`;
  };

  // ── TABLE MAP: localStorage key → Supabase table name ─────────────
  const TABLE_MAP: Record<string, string> = {
    swc_accounts:        "accounts",
    swc_transactions:    "transactions",
    swc_budgets:         "budgets",
    swc_goals:           "goals",
    swc_savings:         "savings_goals",
    swc_fd:              "fixed_deposits",
    swc_cards:           "credit_cards",
    swc_app_rules:       "app_rules",
    swc_recurring:       "recurring_bills",
    swc_loans:           "loans",
    swc_transfers:       "transfers",
    swc_crypto:          "crypto_holdings",
    swc_metals:          "metal_holdings",
    swc_properties:      "properties",
    swc_businesses:      "businesses",
    swc_cash:            "cash_entries",
    swc_loyalty:         "loyalty_programs",
    swc_companies:       "companies",
    swc_discount_cards:  "discount_cards",
    swc_money_lenders:   "money_lenders",
  };
  const SINGLETON_MAP: Record<string, string> = {
    swc_transfer_modes:    "transfer_modes",
    swc_crypto_exchanges:  "crypto_exchanges",
    swc_metal_platforms:   "metal_platforms",
    swc_re_platforms:      "real_estate_platforms",
  };

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");

  // Export: pull current data from the DB context and write a JSON backup
  const handleExportData = () => {
    const snapshot: Record<string, any> = {
      _meta: { exportedAt: new Date().toISOString(), version: "v10", source: "supabase" },
      swc_accounts:       db.accounts,
      swc_transactions:   db.transactions,
      swc_budgets:        db.budgets,
      swc_goals:          db.goals,
      swc_savings:        db.savingsGoals,
      swc_fd:             db.fixedDeposits,
      swc_cards:          db.creditCards,
      swc_app_rules:      db.appRules,
      swc_recurring:      db.recurringBills,
      swc_loans:          db.loans,
      swc_transfers:      db.transfers,
      swc_crypto:         db.cryptoHoldings,
      swc_metals:         db.metalHoldings,
      swc_properties:     db.properties,
      swc_businesses:     db.businesses,
      swc_cash:           db.cashEntries,
      swc_loyalty:        db.loyaltyPrograms,
      swc_companies:      db.companies,
      swc_discount_cards: db.discountCards,
      swc_money_lenders:  db.moneyLenders,
      swc_transfer_modes: db.transferModes,
      swc_crypto_exchanges: db.cryptoExchanges,
      swc_metal_platforms: db.metalPlatforms,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smart-wallet-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import: read backup JSON and push every record into Supabase
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);

        // Detect format: v10 snapshot vs old localStorage dump
        const isV10 = raw._meta?.source === "supabase";
        const hasSwcKeys = Object.keys(raw).some(k => k.startsWith("swc_") && Array.isArray(raw[k]));
        if (!isV10 && !hasSwcKeys) {
          alert("❌ Invalid file — please use a Smart Wallet backup JSON.");
          return;
        }

        // Count total records and build summary
        let total = 0;
        const summary: string[] = [];
        for (const [key, table] of Object.entries(TABLE_MAP)) {
          const items = raw[key];
          if (Array.isArray(items) && items.length > 0) {
            total += items.length;
            summary.push(`• ${table.replace(/_/g, " ")}: ${items.length}`);
          }
        }
        if (raw.swc_transfer_modes) summary.push(`• transfer modes`);
        if (raw.swc_crypto_exchanges) summary.push(`• crypto exchanges`);
        if (raw.swc_metal_platforms) summary.push(`• metal platforms`);

        const confirmMsg = `Import data from ${raw._meta?.exportedAt ? new Date(raw._meta.exportedAt).toLocaleDateString() : "this backup"}?

Records to be imported (${total} total):
${summary.join("\n")}

This will ADD all records from the backup into your current account. Existing records will be overwritten if they share the same ID.`;

        if (!confirm(confirmMsg)) return;

        setImporting(true);
        let done = 0;

        // Upsert array tables
        for (const [key, table] of Object.entries(TABLE_MAP)) {
          const items = raw[key];
          if (!Array.isArray(items)) continue;
          setImportProgress(`Importing ${table.replace(/_/g, " ")}... (${items.length} records)`);
          for (const item of items) {
            if (item?.id) {
              await sbUpsert(table, currentUser.id, item.id, item);
              done++;
              if (done % 10 === 0) setImportProgress(`Importing... ${done}/${total} records`);
            }
          }
        }

        // Upsert singletons
        if (raw.swc_transfer_modes) await sbUpsertSingleton("transfer_modes", currentUser.id, { modes: raw.swc_transfer_modes });
        if (raw.swc_crypto_exchanges) await sbUpsertSingleton("crypto_exchanges", currentUser.id, { exchanges: raw.swc_crypto_exchanges });
        if (raw.swc_metal_platforms) await sbUpsertSingleton("metal_platforms", currentUser.id, { platforms: raw.swc_metal_platforms });

        setImportProgress("Done! Reloading...");
        setTimeout(() => { window.location.reload(); }, 800);
      } catch (err) {
        console.error(err);
        alert("❌ Failed to read backup file. Make sure it's a valid Smart Wallet JSON.");
        setImporting(false);
        setImportProgress("");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Deleted Items" subtitle={`${items.length} items in trash`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportData}><Download className="w-4 h-4"/>Export Data</Button>
            <>
              <Button
                variant="outline" size="sm" className="gap-2"
                disabled={importing}
                onClick={() => { if (!importing) document.getElementById("swc-import-input")?.click(); }}
              >
                {importing ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"/> : <Upload className="w-4 h-4"/>}
                {importing ? "Importing..." : "Import Data"}
              </Button>
              <input id="swc-import-input" type="file" accept=".json" className="hidden" onChange={handleImportData}/>
            </>
            <Button variant="destructive" size="sm" className="gap-2" onClick={()=>setClearConfirm(true)} disabled={items.length===0}><Trash2 className="w-4 h-4"/>Empty Trash</Button>
          </div>
        } />

      {importing && (
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0"/>
          <p className="text-sm text-muted-foreground">{importProgress || "Importing data..."}</p>
        </div>
      )}
      {trashLoading ? (
        <div className="glass-card p-12 text-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"/><p className="text-muted-foreground text-sm">Loading trash...</p></div>
      ) : items.length===0 ? (
        <div className="glass-card p-12 text-center">
          <Trash2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3"/>
          <p className="text-muted-foreground">Trash is empty</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Deleted items appear here and can be recovered. Items are kept for up to 200 records.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            <button onClick={()=>setFilter("all")} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${filter==="all"?"bg-primary text-primary-foreground":"bg-secondary text-muted-foreground hover:text-foreground"}`}>All ({items.length})</button>
            {types.map(t=>(
              <button key={t} onClick={()=>setFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${filter===t?"bg-primary text-primary-foreground":"bg-secondary text-muted-foreground hover:text-foreground"}`}>
                {TYPE_LABELS[t]||t} ({items.filter(i=>i.type===t).length})
              </button>
            ))}
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-xs text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0"/>Items may not perfectly restore all balance changes when recovered.
          </div>
          <div className="space-y-2">
            {filtered.map(item=>(
              <motion.div key={item.id} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} className="glass-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Badge className={`text-[10px] px-1.5 py-0.5 shrink-0 ${TYPE_COLORS[item.type]||"bg-secondary text-muted-foreground"}`}>{TYPE_LABELS[item.type]||item.type}</Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-xs text-muted-foreground hidden sm:block">{daysSince(item.deletedAt)}</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={()=>handleRestore(item)}><RotateCcw className="w-3 h-3"/>Restore</Button>
                    <button onClick={()=>handleDelete(item.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>setExpanded(expanded===item.id?null:item.id)} className="text-muted-foreground p-1">{expanded===item.id?<ChevronUp className="w-3.5 h-3.5"/>:<ChevronDown className="w-3.5 h-3.5"/>}</button>
                  </div>
                </div>
                {expanded===item.id && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <pre className="text-[10px] text-muted-foreground overflow-x-auto bg-secondary/30 rounded p-2 max-h-32 overflow-y-auto">{JSON.stringify(item.data,null,2)}</pre>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </>
      )}

      <Dialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Empty Trash?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">This will permanently delete all {items.length} items. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setClearConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleClearAll}>Empty Trash</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function removeFromTrash(id: string) {
  sbDeleteFromTrash(id);
}