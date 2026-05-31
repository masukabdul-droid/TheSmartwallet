import { SearchFilter, EMPTY_FILTER, matchesFilter, SearchFilterState } from "@/components/ui/search-filter";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, Plus, Trash2, Edit2, Globe, Home, Settings, CreditCard, Pencil, Search, Calendar, X, ChevronRight, UserMinus, User } from "lucide-react";
import { useDB, Transfer } from "@/lib/database";

// ── TYPES ────────────────────────────────────────────────────────────────────
type DestType = "account" | "creditcard" | "external_person";
type BdtBonusType = "percentage" | "fixed";

const EMPTY_FORM = {
  fromAccountId: "",
  toAccountId: "",
  toCreditCardId: "",
  destType: "account" as DestType,
  // External person fields
  recipientName: "",
  recipientAccount: "",
  // Amount fields
  amountSent: "",
  amountReceived: "",
  fxRate: "",
  fee: "0",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
  transferMode: "",
  // BDT-specific fields
  bdtConversionRate: "",
  bdtBonusType: "percentage" as BdtBonusType,
  bdtBonusValue: "",
};

const DATE_RANGES = [
  { label: "All Time", value: "all" },
  { label: "Today", value: "today" },
  { label: "Last 7 Days", value: "7days" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Last 6 Months", value: "6months" },
  { label: "This Year", value: "this_year" },
  { label: "Custom Range", value: "custom" },
];

// ── DYNAMIC CARD ─────────────────────────────────────────────────────────────
interface DynamicCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color?: string;
  onClick?: () => void;
}

function DynamicCard({ title, value, subtitle, icon: Icon, color = "primary", onClick }: DynamicCardProps) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    destructive: "bg-destructive/10 text-destructive",
    amber: "bg-amber-500/10 text-amber-500",
    purple: "bg-purple-500/10 text-purple-500",
    emerald: "bg-emerald-500/10 text-emerald-500",
    blue: "bg-blue-500/10 text-blue-500",
  };
  const iconColorMap: Record<string, string> = {
    primary: "text-primary", destructive: "text-destructive", amber: "text-amber-500",
    purple: "text-purple-500", emerald: "text-emerald-500", blue: "text-blue-500",
  };
  const bgColorMap: Record<string, string> = {
    primary: "bg-primary", destructive: "bg-destructive", amber: "bg-amber-500",
    purple: "bg-purple-500", emerald: "bg-emerald-500", blue: "bg-blue-500",
  };

  return (
    <motion.div
      whileHover={onClick ? { y: -2 } : {}}
      onClick={onClick}
      className={`glass-card p-4 relative overflow-hidden ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-[0.03] ${bgColorMap[color] || "bg-primary"}`} />
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{title}</p>
          <p className="text-xl font-display font-bold text-foreground">{value}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground font-medium">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color] || colorMap.primary}`}>
          <Icon className={`w-5 h-5 ${iconColorMap[color] || iconColorMap.primary}`} />
        </div>
      </div>
      {onClick && (
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
          <span>View Details</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      )}
    </motion.div>
  );
}

// ── BDT CALCULATOR PANEL ─────────────────────────────────────────────────────
interface BdtPanelProps {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  fromCurrency: string;
}

function BdtPanel({ form, setForm, fromCurrency }: BdtPanelProps) {
  const amountSent = parseFloat(form.amountSent) || 0;
  const convRate = parseFloat(form.bdtConversionRate) || 0;
  const bonusVal = parseFloat(form.bdtBonusValue) || 0;

  // Base TAKA = amount × conversion rate
  const baseTaka = amountSent * convRate;

  // Bonus amount
  let bonusAmount = 0;
  if (form.bdtBonusType === "percentage") {
    bonusAmount = baseTaka * (bonusVal / 100);
  } else {
    bonusAmount = bonusVal;
  }

  const totalTaka = baseTaka + bonusAmount;

  // Sync amountReceived whenever BDT params change
  useEffect(() => {
    if (totalTaka > 0) {
      setForm(f => ({ ...f, amountReceived: totalTaka.toFixed(2) }));
    }
  }, [totalTaka]);

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">BDT Conversion</span>
      </div>

      {/* Conversion Rate */}
      <div className="space-y-1">
        <Label className="text-xs">
          Conversion Rate <span className="text-muted-foreground">({fromCurrency} → BDT)</span>
        </Label>
        <Input
          type="number"
          placeholder="e.g. 33.21"
          value={form.bdtConversionRate}
          onChange={e => setForm(f => ({ ...f, bdtConversionRate: e.target.value }))}
          className="bg-background border-border h-8 text-sm"
        />
      </div>

      {/* Bonus */}
      <div className="space-y-1">
        <Label className="text-xs">Remittance / Government Bonus</Label>
        <div className="flex gap-2">
          {/* Toggle: Percentage vs Fixed */}
          <div className="flex rounded-md overflow-hidden border border-border text-[11px] shrink-0">
            <button
              onClick={() => setForm(f => ({ ...f, bdtBonusType: "percentage" }))}
              className={`px-2.5 py-1.5 font-medium transition-colors ${
                form.bdtBonusType === "percentage"
                  ? "bg-emerald-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              %
            </button>
            <button
              onClick={() => setForm(f => ({ ...f, bdtBonusType: "fixed" }))}
              className={`px-2.5 py-1.5 font-medium transition-colors ${
                form.bdtBonusType === "fixed"
                  ? "bg-emerald-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ৳ Fixed
            </button>
          </div>
          <Input
            type="number"
            placeholder={form.bdtBonusType === "percentage" ? "e.g. 2.5" : "e.g. 500"}
            value={form.bdtBonusValue}
            onChange={e => setForm(f => ({ ...f, bdtBonusValue: e.target.value }))}
            className="bg-background border-border h-8 text-sm flex-1"
          />
        </div>
      </div>

      {/* Calculation Summary */}
      {amountSent > 0 && convRate > 0 && (
        <div className="rounded-lg bg-background/60 border border-border/50 p-2.5 space-y-1 text-[11px]">
          <div className="flex justify-between text-muted-foreground">
            <span>Base ({fromCurrency} {amountSent.toLocaleString()} × {convRate})</span>
            <span className="font-medium text-foreground">৳ {baseTaka.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          {bonusAmount > 0 && (
            <div className="flex justify-between text-emerald-400">
              <span>
                Bonus ({form.bdtBonusType === "percentage" ? `${bonusVal}%` : `৳${bonusVal} fixed`})
              </span>
              <span className="font-medium">+ ৳ {bonusAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-foreground border-t border-border/40 pt-1 mt-1">
            <span>Total Received (BDT)</span>
            <span className="text-emerald-400">৳ {totalTaka.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function Transfers() {
  const {
    transfers, addTransfer, updateTransfer, deleteTransfer,
    accounts, creditCards, transferModes, addTransferMode, updateTransferMode, deleteTransferMode,
    getAccountBalance,
  } = useDB();

  const [filter, setFilter] = useState<SearchFilterState>(EMPTY_FILTER);
  const [open, setOpen] = useState(false);
  const [editTransfer, setEditTransfer] = useState<Transfer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [modesOpen, setModesOpen] = useState(false);
  const [newMode, setNewMode] = useState("");
  const [editMode, setEditMode] = useState<{ old: string; val: string } | null>(null);
  const [statsSettingsOpen, setStatsSettingsOpen] = useState(false);
  const [visibleStats, setVisibleStats] = useState<string[]>(["Total Transferred", "Total Fees Paid", "Bank Transfers", "CC Payments"]);

  // Filters
  const [search, setSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState("all");
  const [filterMode, setFilterMode] = useState("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");

  // Custom transfer mode inline input
  const [customModeInput, setCustomModeInput] = useState("");

  const fromAcc = (id: string) => accounts.find(a => a.id === id);

  // Detect if from-account is BDT
  const fromAccount = fromAcc(form.fromAccountId);
  const isBDT = fromAccount?.currency === "BDT";

  const openAdd = () => {
    setEditTransfer(null);
    setForm({ ...EMPTY_FORM, fromAccountId: accounts[0]?.id || "", toAccountId: accounts[1]?.id || "" });
    setCustomModeInput("");
    setOpen(true);
  };

  const openEdit = (t: Transfer) => {
    const isCC = !!t.toCreditCardId;
    const isExtPerson = !!(t as any).recipientName;
    setEditTransfer(t);
    setForm({
      fromAccountId: t.fromAccountId,
      toAccountId: t.toAccountId || "",
      toCreditCardId: t.toCreditCardId || "",
      destType: isCC ? "creditcard" : isExtPerson ? "external_person" : "account",
      recipientName: (t as any).recipientName || "",
      recipientAccount: (t as any).recipientAccount || "",
      amountSent: String(t.amountSent),
      amountReceived: String(t.amountReceived),
      fxRate: String(t.fxRate || ""),
      fee: String(t.fee),
      date: t.date,
      notes: t.notes || "",
      transferMode: t.transferMode || "",
      bdtConversionRate: String((t as any).bdtConversionRate || ""),
      bdtBonusType: (t as any).bdtBonusType || "percentage",
      bdtBonusValue: String((t as any).bdtBonusValue || ""),
    });
    setCustomModeInput("");
    setOpen(true);
  };

  const handleSave = () => {
    const sent = parseFloat(form.amountSent);
    if (!form.fromAccountId || !sent) return;
    if (form.destType === "creditcard" && !form.toCreditCardId) return;
    if (form.destType === "external_person" && !form.recipientName) return;

    const from = fromAcc(form.fromAccountId);
    const to = form.destType === "account" ? fromAcc(form.toAccountId) : null;

    // Resolve effective transfer mode (including custom)
    const effectiveMode =
      form.transferMode === "_custom"
        ? customModeInput.trim() || "Custom"
        : form.transferMode;

    const data: Omit<Transfer, "id"> & Record<string, any> = {
      fromAccountId: form.fromAccountId,
      toAccountId:
        form.destType === "account"
          ? form.toAccountId || form.fromAccountId
          : form.fromAccountId,
      toCreditCardId: form.destType === "creditcard" ? form.toCreditCardId : undefined,
      amountSent: sent,
      amountReceived: parseFloat(form.amountReceived) || sent,
      currencyFrom: from?.currency || "AED",
      currencyTo: to?.currency || from?.currency || "AED",
      fxRate: parseFloat(form.fxRate) || undefined,
      fee: parseFloat(form.fee) || 0,
      date: form.date,
      notes: form.notes || undefined,
      transferMode: effectiveMode || undefined,
      // External person fields
      recipientName: form.destType === "external_person" ? form.recipientName : undefined,
      recipientAccount: form.destType === "external_person" ? form.recipientAccount : undefined,
      // BDT fields
      bdtConversionRate: isBDT && form.bdtConversionRate ? parseFloat(form.bdtConversionRate) : undefined,
      bdtBonusType: isBDT && form.bdtBonusValue ? form.bdtBonusType : undefined,
      bdtBonusValue: isBDT && form.bdtBonusValue ? parseFloat(form.bdtBonusValue) : undefined,
    };

    if (editTransfer) updateTransfer(editTransfer.id, data);
    else addTransfer(data);

    // If custom mode was entered and not already in the list, persist it
    if (form.transferMode === "_custom" && customModeInput.trim()) {
      if (!transferModes.includes(customModeInput.trim())) {
        addTransferMode(customModeInput.trim());
      }
    }

    setOpen(false);
  };

  // ── FILTER LOGIC ────────────────────────────────────────────────────────────
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      const searchMatch =
        !search ||
        t.notes?.toLowerCase().includes(search.toLowerCase()) ||
        fromAcc(t.fromAccountId)?.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.toCreditCardId
          ? creditCards.find(c => c.id === t.toCreditCardId)?.name.toLowerCase().includes(search.toLowerCase())
          : fromAcc(t.toAccountId)?.name.toLowerCase().includes(search.toLowerCase())) ||
        (t as any).recipientName?.toLowerCase().includes(search.toLowerCase());

      const accountMatch =
        filterAccount === "all" || t.fromAccountId === filterAccount || t.toAccountId === filterAccount;

      const typeMatch =
        filterType === "all" ||
        (filterType === "account" && !t.toCreditCardId && t.toAccountId !== t.fromAccountId && !(t as any).recipientName) ||
        (filterType === "creditcard" && !!t.toCreditCardId) ||
        (filterType === "external" && !t.toCreditCardId && t.toAccountId === t.fromAccountId && !(t as any).recipientName) ||
        (filterType === "person" && !!(t as any).recipientName) ||
        (filterType === "intl" && !t.toCreditCardId && fromAcc(t.fromAccountId)?.currency !== fromAcc(t.toAccountId)?.currency);

      const modeMatch = filterMode === "all" || t.transferMode === filterMode;

      let dateMatch = true;
      const tDate = new Date(t.date);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (filterDateRange === "custom") {
        if (customDateFrom) dateMatch = dateMatch && tDate >= new Date(customDateFrom);
        if (customDateTo) dateMatch = dateMatch && tDate <= new Date(customDateTo);
      } else if (filterDateRange !== "all") {
        if (filterDateRange === "today") dateMatch = tDate >= today;
        else if (filterDateRange === "7days") { const d = new Date(today); d.setDate(today.getDate() - 7); dateMatch = tDate >= d; }
        else if (filterDateRange === "this_month") dateMatch = tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
        else if (filterDateRange === "last_month") { const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1; const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(); dateMatch = tDate.getMonth() === m && tDate.getFullYear() === y; }
        else if (filterDateRange === "6months") { const d = new Date(today); d.setMonth(today.getMonth() - 6); dateMatch = tDate >= d; }
        else if (filterDateRange === "this_year") dateMatch = tDate.getFullYear() === now.getFullYear();
      }

      return searchMatch && accountMatch && typeMatch && modeMatch && dateMatch;
    });
  }, [transfers, search, filterAccount, filterType, filterMode, filterDateRange, customDateFrom, customDateTo, accounts, creditCards]);

  // ── DASHBOARD STATS ─────────────────────────────────────────────────────────
  const dashboardStats = useMemo(() => [
    {
      title: "Total Transferred",
      value: `AED ${filteredTransfers.reduce((s, t) => s + t.amountSent, 0).toLocaleString()}`,
      subtitle: `${filteredTransfers.length} transactions`,
      icon: ArrowRightLeft, color: "primary",
    },
    {
      title: "Total Fees Paid",
      value: `AED ${filteredTransfers.reduce((s, t) => s + t.fee, 0).toLocaleString()}`,
      subtitle: "Transaction costs",
      icon: ArrowRightLeft, color: "destructive",
    },
    {
      title: "Bank Transfers",
      value: `AED ${filteredTransfers.filter(t => !t.toCreditCardId && t.toAccountId !== t.fromAccountId && !(t as any).recipientName).reduce((s, t) => s + t.amountSent, 0).toLocaleString()}`,
      subtitle: "Account to Account",
      icon: Home, color: "blue",
    },
    {
      title: "CC Payments",
      value: `AED ${filteredTransfers.filter(t => !!t.toCreditCardId).reduce((s, t) => s + t.amountSent, 0).toLocaleString()}`,
      subtitle: "Credit Card Repayments",
      icon: CreditCard, color: "purple",
    },
    {
      title: "External / Other",
      value: `AED ${filteredTransfers.filter(t => !t.toCreditCardId && t.toAccountId === t.fromAccountId && !(t as any).recipientName).reduce((s, t) => s + t.amountSent, 0).toLocaleString()}`,
      subtitle: "Sent to others",
      icon: UserMinus, color: "amber",
    },
    {
      title: "International",
      value: `${filteredTransfers.filter(t => { const f = fromAcc(t.fromAccountId), to = fromAcc(t.toAccountId); return f && to && f.currency !== to.currency; }).length} transfers`,
      subtitle: "Cross-currency",
      icon: Globe, color: "emerald",
    },
  ], [filteredTransfers, accounts]);

  const resetFilters = () => {
    setSearch(""); setFilterAccount("all"); setFilterType("all");
    setFilterDateRange("all"); setFilterMode("all"); setCustomDateFrom(""); setCustomDateTo("");
  };

  const allPossibleStats = useMemo(() => dashboardStats.map(s => s.title), [dashboardStats]);
  const toggleStatVisibility = (title: string) =>
    setVisibleStats(prev => prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]);

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader title="Transfers" subtitle={`${transfers.length} transfers`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 h-9" onClick={() => setStatsSettingsOpen(true)}><Settings className="w-4 h-4" />Customize</Button>
            <Button variant="outline" className="gap-2 h-9" onClick={() => setModesOpen(true)}><Settings className="w-3.5 h-3.5" />Modes</Button>
            <Button className="gap-2 h-9" onClick={openAdd}><Plus className="w-4 h-4" />New Transfer</Button>
          </div>
        } />

      {/* ── ADVANCED FILTERS ── */}
      <div className="glass-card p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search notes or accounts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-background border-border h-9 text-sm" />
          </div>
          <Select value={filterAccount} onValueChange={setFilterAccount}>
            <SelectTrigger className="h-9 bg-background border-border text-sm"><SelectValue placeholder="All Accounts" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Accounts</SelectItem>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9 bg-background border-border text-sm"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="account">Bank Transfer</SelectItem>
              <SelectItem value="creditcard">CC Payment</SelectItem>
              <SelectItem value="external">External / Other</SelectItem>
              <SelectItem value="person">Send to Person</SelectItem>
              <SelectItem value="intl">International</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterDateRange} onValueChange={setFilterDateRange}>
            <SelectTrigger className="h-9 bg-background border-border text-sm">
              <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-muted-foreground" /><SelectValue placeholder="Date Range" /></div>
            </SelectTrigger>
            <SelectContent>{DATE_RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <AnimatePresence>
          {filterDateRange === "custom" && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/30">
                <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground">Date From</Label><Input type="date" value={customDateFrom} onChange={e => setCustomDateFrom(e.target.value)} className="h-8 bg-background border-border text-xs" /></div>
                <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground">Date To</Label><Input type="date" value={customDateTo} onChange={e => setCustomDateTo(e.target.value)} className="h-8 bg-background border-border text-xs" /></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mr-1">Modes:</span>
            <button onClick={() => setFilterMode("all")} className={`text-[11px] px-2.5 py-1 rounded-md border transition-all ${filterMode === "all" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "border-border text-muted-foreground hover:border-muted-foreground"}`}>All</button>
            {transferModes.map(m => (
              <button key={m} onClick={() => setFilterMode(m)} className={`text-[11px] px-2.5 py-1 rounded-md border transition-all ${filterMode === m ? "bg-primary text-primary-foreground border-primary shadow-sm" : "border-border text-muted-foreground hover:border-muted-foreground"}`}>{m}</button>
            ))}
          </div>
          {(search || filterAccount !== "all" || filterType !== "all" || filterDateRange !== "all" || filterMode !== "all") && (
            <button onClick={resetFilters} className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"><X className="w-3 h-3" /> Clear Filters</button>
          )}
        </div>
      </div>

      {/* ── DASHBOARD CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {dashboardStats.filter(s => visibleStats.includes(s.title)).map((stat, idx) => (
          <DynamicCard key={idx} {...stat} />
        ))}
      </div>

      <SearchFilter value={filter} onChange={setFilter} placeholder="Search transfers…" />

      {/* ── TRANSFER LIST ── */}
      <div className="space-y-3">
        {filteredTransfers.length === 0 && (
          <div className="p-12 text-center text-muted-foreground glass-card text-sm flex flex-col items-center gap-2">
            <Search className="w-8 h-8 opacity-20" /> No transfers match your filters.
          </div>
        )}
        <AnimatePresence mode="popLayout">
          {filteredTransfers.map(t => {
            const from = fromAcc(t.fromAccountId);
            const to = fromAcc(t.toAccountId);
            const isCC = !!t.toCreditCardId;
            const toCard = isCC ? creditCards.find(c => c.id === t.toCreditCardId) : null;
            const intl = !isCC && from && to && from.currency !== to.currency;
            const isExternal = !isCC && t.toAccountId === t.fromAccountId && !t.toCreditCardId && !(t as any).recipientName;
            const isPerson = !!(t as any).recipientName;

            return (
              <motion.div key={t.id} layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }} className="glass-card p-4 group hover:shadow-md transition-all border-l-4 border-l-transparent hover:border-l-primary">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isCC ? "bg-purple-500/10" : intl ? "bg-primary/10" : isExternal ? "bg-amber-500/10" : isPerson ? "bg-emerald-500/10" : "bg-secondary"}`}>
                    {isCC ? <CreditCard className="w-5 h-5 text-purple-400" /> : intl ? <Globe className="w-5 h-5 text-primary" /> : isExternal ? <UserMinus className="w-5 h-5 text-amber-400" /> : isPerson ? <User className="w-5 h-5 text-emerald-400" /> : <Home className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-bold text-foreground">{from?.name || "Unknown"}</span>
                      <ArrowRightLeft className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-sm font-bold text-foreground">
                        {isCC ? toCard?.name || "Card" : isExternal ? "External / Other" : isPerson ? (t as any).recipientName : to?.name || "Unknown"}
                      </span>
                      {isCC && <Badge className="text-[10px] py-0 bg-purple-500/10 text-purple-400 border-none">CC Payment</Badge>}
                      {isExternal && <Badge className="text-[10px] py-0 bg-amber-500/10 text-amber-400 border-none">External</Badge>}
                      {isPerson && <Badge className="text-[10px] py-0 bg-emerald-500/10 text-emerald-400 border-none">Person</Badge>}
                      {t.transferMode && <Badge variant="outline" className="text-[10px] py-0 border-border/50">{t.transferMode}</Badge>}
                      {(t as any).bdtConversionRate && <Badge className="text-[10px] py-0 bg-emerald-500/10 text-emerald-400 border-none">BDT</Badge>}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[11px] text-muted-foreground font-medium">{t.date}</p>
                      {isPerson && (t as any).recipientAccount && <p className="text-[10px] text-muted-foreground">Acc: {(t as any).recipientAccount}</p>}
                      {t.notes && <p className="text-xs text-foreground/80 italic line-clamp-1">"{t.notes}"</p>}
                    </div>
                  </div>
                  <div className="text-right mr-2">
                    <p className="text-sm font-bold text-foreground">{from?.currency || "AED"} {t.amountSent.toLocaleString()}</p>
                    {!isCC && !isExternal && t.amountSent !== t.amountReceived && (
                      <p className="text-[11px] font-medium text-primary">
                        {isPerson ? "BDT" : to?.currency || "AED"} {t.amountReceived.toLocaleString()}
                      </p>
                    )}
                    {t.fee > 0 && <p className="text-[10px] font-bold text-destructive/80">Fee: {t.fee}</p>}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(t)} className="text-muted-foreground hover:text-primary p-1.5 rounded-md hover:bg-primary/5 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteTransfer(t.id)} className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/5 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── STATS SETTINGS DIALOG ── */}
      <Dialog open={statsSettingsOpen} onOpenChange={setStatsSettingsOpen}>
        <DialogContent className="w-full sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>Customize Dashboard Stats</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-sm text-muted-foreground">Select which statistics to display on the dashboard.</p>
            <div className="grid grid-cols-2 gap-2">
              {allPossibleStats.map(title => (
                <div key={title} className="flex items-center gap-2 p-2 rounded-md bg-background">
                  <input type="checkbox" id={`stat-${title}`} checked={visibleStats.includes(title)} onChange={() => toggleStatVisibility(title)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                  <label htmlFor={`stat-${title}`} className="text-sm font-medium text-foreground">{title}</label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter><Button onClick={() => setStatsSettingsOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ADD / EDIT TRANSFER DIALOG ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTransfer ? "Edit" : "New"} Transfer</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">

            {/* From Account */}
            <div className="space-y-1.5">
              <Label>From Account</Label>
              <Select value={form.fromAccountId} onValueChange={v => setForm(f => ({ ...f, fromAccountId: v }))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Destination Type — 3-way toggle */}
            <div className="space-y-1.5">
              <Label>Destination Type</Label>
              <div className="flex rounded-lg overflow-hidden border border-border text-xs">
                <button
                  onClick={() => setForm(f => ({ ...f, destType: "account" }))}
                  className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors ${form.destType === "account" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Home className="w-3 h-3" />Bank Account
                </button>
                <button
                  onClick={() => setForm(f => ({ ...f, destType: "creditcard" }))}
                  className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors ${form.destType === "creditcard" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <CreditCard className="w-3 h-3" />Credit Card
                </button>
                <button
                  onClick={() => setForm(f => ({ ...f, destType: "external_person" }))}
                  className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors ${form.destType === "external_person" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <User className="w-3 h-3" />Other Person
                </button>
              </div>
            </div>

            {/* Destination Fields */}
            {form.destType === "account" && (
              <div className="space-y-1.5">
                <Label>To Account</Label>
                <Select value={form.toAccountId || "_none"} onValueChange={v => setForm(f => ({ ...f, toAccountId: v === "_none" ? "" : v }))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Same as From Account</SelectItem>
                    {accounts.filter(a => a.id !== form.fromAccountId).map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.destType === "creditcard" && (
              <div className="space-y-1.5">
                <Label>To Credit Card (CC Repayment)</Label>
                <Select value={form.toCreditCardId} onValueChange={v => setForm(f => ({ ...f, toCreditCardId: v }))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select card" /></SelectTrigger>
                  <SelectContent>{creditCards.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ···{c.last4}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {form.destType === "external_person" && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Recipient Details</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Recipient Name <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="e.g. Bou, Mama"
                      value={form.recipientName}
                      onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))}
                      className="bg-background border-border h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Account / bKash No.</Label>
                    <Input
                      placeholder="e.g. 01711-XXXXXX"
                      value={form.recipientAccount}
                      onChange={e => setForm(f => ({ ...f, recipientAccount: e.target.value }))}
                      className="bg-background border-border h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Amount Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount Sent {fromAccount ? `(${fromAccount.currency})` : ""}</Label>
                <Input
                  type="number"
                  value={form.amountSent}
                  onChange={e => setForm(f => ({ ...f, amountSent: e.target.value, amountReceived: e.target.value }))}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Amount Received {isBDT ? "(BDT ৳)" : ""}</Label>
                <Input
                  type="number"
                  value={form.amountReceived}
                  onChange={e => setForm(f => ({ ...f, amountReceived: e.target.value }))}
                  className={`bg-background border-border ${isBDT ? "border-emerald-500/40" : ""}`}
                  readOnly={isBDT && !!form.bdtConversionRate}
                />
              </div>
            </div>

            {/* BDT Conversion Panel — shown only when from-account is BDT */}
            <AnimatePresence>
              {isBDT && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <BdtPanel form={form} setForm={setForm} fromCurrency={fromAccount?.currency || "BDT"} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* FX Rate / Fee / Date */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">FX Rate</Label>
                <Input type="number" value={form.fxRate} onChange={e => setForm(f => ({ ...f, fxRate: e.target.value }))} className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fee (AED)</Label>
                <Input type="number" value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="bg-background border-border" />
              </div>
            </div>

            {/* Transfer Mode — with Custom option */}
            <div className="space-y-1.5">
              <Label>Transfer Mode</Label>
              <Select value={form.transferMode || "_none"} onValueChange={v => { setForm(f => ({ ...f, transferMode: v === "_none" ? "" : v })); if (v !== "_custom") setCustomModeInput(""); }}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select mode (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {transferModes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  <SelectItem value="_custom">✏️ Custom…</SelectItem>
                </SelectContent>
              </Select>
              <AnimatePresence>
                {form.transferMode === "_custom" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <Input
                      placeholder="Enter custom transfer mode…"
                      value={customModeInput}
                      onChange={e => setCustomModeInput(e.target.value)}
                      className="bg-background border-border mt-1.5 text-sm"
                      autoFocus
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes / Description</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="What is this transfer for?" className="bg-background border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editTransfer ? "Save" : "Add Transfer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── TRANSFER MODES MANAGER ── */}
      <Dialog open={modesOpen} onOpenChange={setModesOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Manage Transfer Modes</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <Input value={newMode} onChange={e => setNewMode(e.target.value)} placeholder="e.g. Wise, SWIFT" className="bg-background border-border flex-1" />
              <Button size="sm" onClick={() => { if (newMode.trim()) { addTransferMode(newMode.trim()); setNewMode(""); } }}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {transferModes.map(m => (
                <div key={m} className="flex items-center gap-2 bg-secondary/50 rounded-md px-3 py-2 group">
                  {editMode?.old === m ? (
                    <>
                      <Input value={editMode.val} onChange={e => setEditMode({ old: m, val: e.target.value })} className="bg-background border-border h-7 text-xs flex-1" />
                      <button onClick={() => { updateTransferMode(m, editMode.val); setEditMode(null); }} className="text-primary text-xs font-medium">Save</button>
                      <button onClick={() => setEditMode(null)} className="text-muted-foreground text-xs">Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm flex-1">{m}</span>
                      <button onClick={() => setEditMode({ old: m, val: m })} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteTransferMode(m)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter><Button onClick={() => setModesOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}