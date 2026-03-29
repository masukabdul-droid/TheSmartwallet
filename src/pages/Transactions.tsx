import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit2, Trash2, TrendingUp, TrendingDown, DollarSign, CreditCard, Filter, ArrowRightLeft, Star, Tag, Pencil, Building2, Settings } from "lucide-react";
import { useDB, Transaction, Company } from "@/lib/database";
// #MAMOON
const CATEGORIES = ["Income","Housing","Groceries","Food","Transport","Entertainment","Shopping","Utilities","Telecom","Transfer","Cash","Insurance","Government","Healthcare","Education","Goals","Rental Income","Business Revenue","Business Expense","Loan Payment","Money Transfer","Credit Card Payment","Other"];
const EMPTY_FORM = { name:"", amount:"", type:"expense" as "income"|"expense"|"transfer", category:"Other", accountId:"", transferToAccountId:"", date: new Date().toISOString().slice(0,10), notes:"", companyId:"", loyaltyProgramId:"", loyaltyPoints:"", discountCardId:"", discountAmount:"" };
 
export default function Transactions() {
  const {
    transactions, addTransaction, updateTransaction, deleteTransaction,
    transfers, addTransfer,
    accounts,
    creditCards, addCardTransaction, updateCardTransaction, deleteCardTransaction,
    companies, addCompany, updateCompany, deleteCompany,
    loyaltyPrograms, addLoyaltyTx,
    discountCards,
    getAccountBalance
  } = useDB();
 
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction|null>(null);
  // Track whether the row being edited is from a bank account or a credit card
  const [editingSource, setEditingSource] = useState<"account"|"card">("account");
  const [editingCardId, setEditingCardId] = useState<string>("");
 
  const [form, setForm] = useState(EMPTY_FORM);
  const [cmpMgrOpen, setCmpMgrOpen] = useState(false);
  const [cmpForm, setCmpForm] = useState({ name:"", category:"Food", color:"hsl(160,84%,39%)", loyaltyProgramId:"" });
  const [editCmp, setEditCmp] = useState<string|null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
 
  // Filters
  const [search, setSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterSource, setFilterSource] = useState<"account"|"card"|"all">("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
 
  const openAdd = () => {
    setEditing(null);
    setEditingSource("account");
    setEditingCardId("");
    setForm({ ...EMPTY_FORM, accountId: accounts[0]?.id || "" });
    setShowAdvanced(false);
    setOpen(true);
  };
 
  // ─── openEdit: handles BOTH account txs and card txs ───────────────────────
  const openEdit = (tx: any) => {
    if (tx.source === "card") {
      // Card transaction — find which card owns it
      const card = creditCards.find(c => c.transactions.some((t: any) => t.id === tx.id));
      setEditingSource("card");
      setEditingCardId(card?.id || tx.accountId);
      setEditing({ id: tx.id } as any);
      setForm({
        ...EMPTY_FORM,
        name: tx.name,           // mapped from tx.description
        amount: String(tx.amount),
        type: "expense",          // card txs are always expenses (or payments)
        category: tx.category,
        accountId: card?.id || tx.accountId,
        date: tx.date,
        notes: "",
      });
      setShowAdvanced(false);
      setOpen(true);
      return;
    }
 
    // Regular account transaction
    setEditingSource("account");
    setEditingCardId("");
    setEditing(tx as Transaction);
    setForm({
      name: tx.name,
      amount: String(Math.abs(tx.amount)),
      type: tx.type as any,
      category: tx.category,
      accountId: tx.accountId,
      transferToAccountId: tx.transferToAccountId || "",
      date: tx.date,
      notes: tx.notes || "",
      companyId: tx.companyId || "",
      loyaltyProgramId: tx.loyaltyProgramId || "",
      loyaltyPoints: String(tx.loyaltyPoints || ""),
      discountCardId: tx.discountCardId || "",
      discountAmount: String(tx.discountAmount || ""),
    });
    setShowAdvanced(!!(tx.companyId || tx.loyaltyProgramId || tx.discountCardId));
    setOpen(true);
  };
 
  // ─── handleSave: routes to the correct updater based on editingSource ───────
  const handleSave = () => {
    const absAmt = parseFloat(form.amount);
    if (!form.name || !absAmt) return;
 
    // ── Card transaction edit ───────────────────────────────────────────────
    if (editing && editingSource === "card") {
      updateCardTransaction(editingCardId, editing.id, {
        date: form.date,
        description: form.name,
        amount: form.type === "income" ? Math.abs(absAmt) : -Math.abs(absAmt),
        category: form.category,
      });
      setOpen(false);
      return;
    }
 
    // ── Account transaction ─────────────────────────────────────────────────
    if (!form.accountId) return;
 
    const amt = form.type === "income" ? Math.abs(absAmt) : form.type === "expense" ? -Math.abs(absAmt) : 0;
 
    if (form.type === "transfer") {
      if (!form.transferToAccountId) return;
      addTransfer({
        date: form.date,
        fromAccountId: form.accountId,
        toAccountId: form.transferToAccountId,
        amountSent: absAmt,
        amountReceived: absAmt,
        currencyFrom: accounts.find(a => a.id === form.accountId)?.currency || "AED",
        currencyTo: accounts.find(a => a.id === form.transferToAccountId)?.currency || "AED",
        fee: 0,
        notes: form.notes,
      });
      setOpen(false);
      return;
    }
 
    const txData: Omit<Transaction, "id"> = {
      name: form.name,
      amount: amt,
      type: form.type as "income" | "expense",
      category: form.category,
      accountId: form.accountId,
      date: form.date,
      notes: form.notes,
      companyId: form.companyId || undefined,
      loyaltyProgramId: form.loyaltyProgramId || undefined,
      loyaltyPoints: form.loyaltyPoints ? parseFloat(form.loyaltyPoints) : undefined,
      discountCardId: form.discountCardId || undefined,
      discountAmount: form.discountAmount ? parseFloat(form.discountAmount) : undefined,
    };
 
    if (editing) {
      updateTransaction(editing.id, txData);
    } else {
      addTransaction(txData);
      if (form.loyaltyProgramId && form.loyaltyPoints && parseFloat(form.loyaltyPoints) > 0) {
        addLoyaltyTx(form.loyaltyProgramId, {
          date: form.date,
          points: parseFloat(form.loyaltyPoints),
          type: "earned",
          description: `${form.name} (${form.category})`,
        });
      }
    }
    setOpen(false);
  };
 
  // ─── handleDelete: routes to card or account deleter ────────────────────────
  const handleDelete = (tx: any) => {
    if (tx.source === "card") {
      // Find which card owns this transaction
      const card = creditCards.find(c => c.transactions.some((t: any) => t.id === tx.id));
      if (card) deleteCardTransaction(card.id, tx.id);
    } else if (tx.source === "account") {
      deleteTransaction(tx.id);
    }
    // transfers don't have a delete action here
  };
 
  // Auto-fill loyalty points from company
  const handleCompanyChange = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    const autoLoyaltyId = company?.loyaltyProgramId || "";
    const prog = loyaltyPrograms.find(p => p.id === autoLoyaltyId);
    const pts = prog?.autoDetect && prog.earnRate && form.amount ? Math.floor(parseFloat(form.amount) * prog.earnRate) : 0;
    setForm(f => ({ ...f, companyId, loyaltyProgramId: autoLoyaltyId, loyaltyPoints: pts > 0 ? String(pts) : f.loyaltyPoints }));
  };
 
  // Auto-apply discount when discount card selected
  const handleDiscountCardChange = (cardId: string) => {
    const dc = discountCards.find(d => d.id === cardId);
    const amt = parseFloat(form.amount) || 0;
    let discountAmt = 0;
    if (dc && amt > 0) {
      if (dc.discountType === "percentage") discountAmt = Math.min(amt * dc.defaultDiscount / 100, dc.maxDiscount || Infinity);
      else if (dc.discountType === "fixed") discountAmt = dc.defaultDiscount;
    }
    setForm(f => ({ ...f, discountCardId: cardId, discountAmount: discountAmt > 0 ? discountAmt.toFixed(2) : f.discountAmount }));
  };
 
  const handleTypeChange = (newType: string) => {
    setForm(f => ({ ...f, type: newType as any, category: newType === "transfer" ? "Transfer" : f.category }));
  };
 
  // Merge account transactions + card transactions + transfers
  const allTxs = useMemo(() => {
    const acctTxs = transactions.map(t => ({
      ...t,
      source: "account" as const,
      sourceLabel: accounts.find(a => a.id === t.accountId)?.name || "Unknown",
    }));
    const cardTxs = filterSource !== "account" ? creditCards.flatMap(c =>
      c.transactions.map((tx: any) => ({
        id: tx.id,
        name: tx.description,
        amount: Math.abs(tx.amount),
        type: tx.amount < 0 ? "expense" as const : "income" as const,
        category: tx.category,
        accountId: c.id,
        date: tx.date,
        notes: undefined,
        source: "card" as const,
        sourceLabel: `${c.name} ···${c.last4}`,
      }))
    ) : [];
    const transferTxs = transfers.map(t => {
      const from = accounts.find(a => a.id === t.fromAccountId);
      const to = accounts.find(a => a.id === t.toAccountId);
      return {
        id: t.id,
        name: `Transfer → ${to?.name || "?"}`,
        amount: t.amountSent,
        type: "transfer" as const,
        category: "Transfer",
        accountId: t.fromAccountId,
        date: t.date,
        notes: t.notes,
        source: "transfer" as const,
        sourceLabel: `${from?.name || "?"} → ${to?.name || "?"}`,
      };
    });
    return [
      ...acctTxs,
      ...(filterSource !== "account" ? cardTxs : []),
      ...(filterType === "all" || filterType === "transfer" ? transferTxs : []),
    ];
  }, [transactions, creditCards, accounts, transfers, filterSource, filterType]);
 
  const now = new Date();
  const filtered = useMemo(() => {
    return allTxs.filter(t => {
      if (filterSource !== "all" && t.source !== filterSource) return false;
      if (filterAccount !== "all" && t.accountId !== filterAccount) return false;
      if (filterType !== "all" && t.type !== filterType) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.category.toLowerCase().includes(search.toLowerCase())) return false;
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      if (filterPeriod !== "all") {
        const d = new Date(t.date);
        if (filterPeriod === "today") return d.toDateString() === now.toDateString();
        if (filterPeriod === "week") { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w; }
        if (filterPeriod === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (filterPeriod === "prev_month") { const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1); const pe = new Date(now.getFullYear(), now.getMonth(), 0); return d >= pm && d <= pe; }
        if (filterPeriod === "year") return d.getFullYear() === now.getFullYear();
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allTxs, filterSource, filterAccount, filterType, search, filterPeriod, dateFrom, dateTo]);
 
  const totalIncome = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
 
  const selectedCompany = companies.find(c => c.id === form.companyId);
  const linkedProgram = loyaltyPrograms.find(p => p.id === form.loyaltyProgramId);
 
  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" subtitle={`${filtered.length} transactions shown`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setCmpMgrOpen(true)}><Building2 className="w-4 h-4" />Companies</Button>
            <Button className="gap-2" onClick={openAdd}><Plus className="w-4 h-4" />Add Transaction</Button>
          </div>
        } />
 
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <StatCard title="Income" value={`AED ${totalIncome.toLocaleString()}`} icon={TrendingUp} changeType="up" />
        <StatCard title="Expenses" value={`AED ${totalExpense.toLocaleString()}`} icon={TrendingDown} changeType="down" />
        <StatCard title="Net" value={`AED ${(totalIncome - totalExpense).toLocaleString()}`} icon={DollarSign} changeType={totalIncome >= totalExpense ? "up" : "down"} />
      </div>
 
      {/* Filters */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Filter className="w-4 h-4" />Filters</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="relative col-span-2 md:col-span-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-background border-border h-9" />
          </div>
          <Select value={filterSource} onValueChange={v => setFilterSource(v as any)}>
            <SelectTrigger className="bg-background border-border h-9"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="account">Bank Accounts</SelectItem>
              <SelectItem value="card">Credit Cards</SelectItem>
              <SelectItem value="transfer">Transfers</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterAccount} onValueChange={setFilterAccount}>
            <SelectTrigger className="bg-background border-border h-9"><SelectValue placeholder="Account" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              {creditCards.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="bg-background border-border h-9"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="transfer">Transfers</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPeriod} onValueChange={setFilterPeriod}>
            <SelectTrigger className="bg-background border-border h-9"><SelectValue placeholder="Period" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="prev_month">Last Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground shrink-0">From</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="flex h-8 rounded-md border border-input bg-background px-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex-1" />
          <span className="text-xs text-muted-foreground shrink-0">To</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="flex h-8 rounded-md border border-input bg-background px-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex-1" />
          {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-muted-foreground hover:text-foreground shrink-0">✕ Clear</button>}
        </div>
      </div>
 
      <div className="glass-card overflow-hidden">
        <div className="divide-y divide-border">
          {filtered.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">No transactions match your filters.</div>}
          <AnimatePresence>
            {filtered.map((tx, i) => (
              <motion.div key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.02 }}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/20 transition-colors group">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tx.type === "income" ? "bg-primary/10" : tx.type === "transfer" ? "bg-indigo-500/10" : tx.source === "card" ? "bg-violet-500/10" : "bg-secondary"}`}>
                  {(tx as any).source === "card"
                    ? <CreditCard className="w-4 h-4 text-violet-400" />
                    : tx.type === "income"
                      ? <TrendingUp className="w-4 h-4 text-primary" />
                      : tx.type === "transfer"
                        ? <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                        : <TrendingDown className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{tx.name}</p>
                    {(tx as any).source === "card" && <Badge variant="outline" className="text-[10px] h-4 shrink-0 border-violet-500/30 text-violet-400">Card</Badge>}
                    {(tx as any).source === "transfer" && <Badge variant="outline" className="text-[10px] h-4 shrink-0 border-indigo-500/30 text-indigo-400">Transfer</Badge>}
                    {(tx as any).discountAmount && (tx as any).discountAmount > 0 && <Badge className="text-[9px] h-4 bg-green-500/20 text-green-400 border-0">-{(tx as any).discountAmount} disc.</Badge>}
                    {(tx as any).loyaltyPoints && (tx as any).loyaltyPoints > 0 && <Badge className="text-[9px] h-4 bg-amber-500/20 text-amber-400 border-0">+{(tx as any).loyaltyPoints} pts</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{tx.date} · {tx.category} · <span className="text-foreground/70">{(tx as any).sourceLabel}</span></p>
                </div>
                <div className="flex items-center gap-3">
                  <p className={`text-sm font-semibold ${tx.type === "income" ? "stat-up" : tx.type === "transfer" ? "text-indigo-400" : tx.source === "card" ? "stat-down" : "text-foreground"}`}>
                    {tx.type === "income" ? "+" : tx.type === "transfer" ? "↔" : "-"}
                    {tx.source === "card"
                      ? (creditCards.find(c => c.id === tx.accountId)?.name?.split(" ")[0] || "AED")
                      : (accounts.find(a => a.id === tx.accountId)?.currency || "AED")
                    } {tx.amount.toLocaleString()}
                  </p>
                  {/* ✅ Edit/Delete now available for BOTH account and card transactions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(tx as any).source !== "transfer" && (
                      <button
                        onClick={() => openEdit(tx)}
                        className="text-muted-foreground hover:text-foreground p-1"
                        title={`Edit ${(tx as any).source === "card" ? "card " : ""}transaction`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {(tx as any).source !== "transfer" && (
                      <button
                        onClick={() => handleDelete(tx)}
                        className="text-muted-foreground hover:text-destructive p-1"
                        title={`Delete ${(tx as any).source === "card" ? "card " : ""}transaction`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
 
      {/* ─── Add / Edit Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit" : "Add"} Transaction
              {editing && editingSource === "card" && (
                <span className="ml-2 text-xs font-normal text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
                  Credit Card
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
 
            {/* Type selector — hidden when editing a card tx (always expense/income, no transfer) */}
            {editingSource !== "card" && (
              <div className="grid grid-cols-3 gap-2">
                {(["expense", "income", "transfer"] as const).map(t => (
                  <button key={t} onClick={() => handleTypeChange(t)}
                    className={`py-2 rounded-lg text-xs border font-medium capitalize transition-all ${form.type === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
                    {t === "income" ? "💚 Income" : t === "expense" ? "🔴 Expense" : "↔️ Transfer"}
                  </button>
                ))}
              </div>
            )}
 
            {/* Card tx: show type toggle between expense/income only */}
            {editingSource === "card" && (
              <div className="grid grid-cols-2 gap-2">
                {(["expense", "income"] as const).map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={`py-2 rounded-lg text-xs border font-medium capitalize transition-all ${form.type === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
                    {t === "income" ? "💚 Payment / Credit" : "🔴 Expense / Charge"}
                  </button>
                ))}
              </div>
            )}
 
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                placeholder={editingSource === "card" ? "e.g. Amazon, KFC" : "e.g. Salary, DEWA Bill, KFC"}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="bg-background border-border"
              />
            </div>
 
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input type="number" placeholder="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="bg-background border-border" />
              </div>
            </div>
 
            <div className="grid grid-cols-2 gap-3">
              {/* Account/Card selector */}
              <div className="space-y-1.5">
                <Label>{editingSource === "card" ? "Credit Card" : form.type === "transfer" ? "From Account" : "Account"}</Label>
                {editingSource === "card" ? (
                  <Select value={form.accountId} onValueChange={v => setForm(f => ({ ...f, accountId: v }))}>
                    <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select card…" /></SelectTrigger>
                    <SelectContent>{creditCards.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ···{c.last4}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Select value={form.accountId} onValueChange={v => setForm(f => ({ ...f, accountId: v }))}>
                    <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
 
              {/* Category / Transfer-to */}
              {form.type === "transfer" && editingSource !== "card" ? (
                <div className="space-y-1.5">
                  <Label>To Account</Label>
                  <Select value={form.transferToAccountId} onValueChange={v => setForm(f => ({ ...f, transferToAccountId: v }))}>
                    <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{accounts.filter(a => a.id !== form.accountId).map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
 
            {/* Advanced options — only for account transactions */}
            {form.type !== "transfer" && editingSource !== "card" && (
              <>
                <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Star className="w-3 h-3" />{showAdvanced ? "Hide" : "Show"} Company, Loyalty & Discount options
                </button>
                {showAdvanced && (
                  <div className="space-y-3 border border-border rounded-lg p-3 bg-secondary/20">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Company</Label>
                      <Select value={form.companyId || "_none"} onValueChange={v => handleCompanyChange(v === "_none" ? "" : v)}>
                        <SelectTrigger className="bg-background border-border h-8 text-xs"><SelectValue placeholder="Select company (optional)" /></SelectTrigger>
                        <SelectContent><SelectItem value="_none">None</SelectItem>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.category})</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Loyalty Program</Label>
                        <Select value={form.loyaltyProgramId || "_none"} onValueChange={v => setForm(f => ({ ...f, loyaltyProgramId: v === "_none" ? "" : v }))}>
                          <SelectTrigger className="bg-background border-border h-8 text-xs"><SelectValue placeholder="Program" /></SelectTrigger>
                          <SelectContent><SelectItem value="_none">None</SelectItem>{loyaltyPrograms.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.pointsBalance.toLocaleString()} pts)</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Points Earned</Label>
                        <Input type="number" placeholder="0" value={form.loyaltyPoints} onChange={e => setForm(f => ({ ...f, loyaltyPoints: e.target.value }))} className="bg-background border-border h-8 text-xs" />
                      </div>
                    </div>
                    {linkedProgram?.autoDetect && form.amount && (
                      <p className="text-[10px] text-primary">Auto: {Math.floor(parseFloat(form.amount || "0") * (linkedProgram.earnRate || 0))} pts @ {linkedProgram.earnRate} pts/AED</p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Discount Card</Label>
                        <Select value={form.discountCardId || "_none"} onValueChange={v => handleDiscountCardChange(v === "_none" ? "" : v)}>
                          <SelectTrigger className="bg-background border-border h-8 text-xs"><SelectValue placeholder="Card" /></SelectTrigger>
                          <SelectContent><SelectItem value="_none">None</SelectItem>{discountCards.map(d => <SelectItem key={d.id} value={d.id}>{d.name} ({d.defaultDiscount}{d.discountType === "percentage" ? "%" : " AED"} off)</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Discount Amount</Label>
                        <Input type="number" placeholder="0" value={form.discountAmount} onChange={e => setForm(f => ({ ...f, discountAmount: e.target.value }))} className="bg-background border-border h-8 text-xs" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
 
            <div className="space-y-1.5">
              <Label>Notes (opt.)</Label>
              <Input placeholder="Notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="bg-background border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={
                !form.name || !form.amount ||
                (editingSource !== "card" && !form.accountId)
              }
            >
              {editing ? "Save Changes" : "Add Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
 
      {/* Company Manager Dialog */}
      <Dialog open={cmpMgrOpen} onOpenChange={setCmpMgrOpen}>
        <DialogContent className="w-full sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>Manage Companies & Brands</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={cmpForm.name} onChange={e => setCmpForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. KFC" className="bg-background border-border h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Category</Label>
                <Select value={cmpForm.category} onValueChange={v => setCmpForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-background border-border h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Food", "Groceries", "Coffee", "Shopping", "Fuel", "Transport", "Hotels", "Airlines", "Telecom", "Entertainment", "Healthcare", "Government", "Other"].map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Link Loyalty Program (optional)</Label>
              <Select value={cmpForm.loyaltyProgramId || "_none"} onValueChange={v => setCmpForm(f => ({ ...f, loyaltyProgramId: v === "_none" ? "" : v }))}>
                <SelectTrigger className="bg-background border-border h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent><SelectItem value="_none">None</SelectItem>{loyaltyPrograms.map(lp => <SelectItem key={lp.id} value={lp.id} className="text-xs">{lp.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {editCmp ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { if (cmpForm.name) { updateCompany(editCmp, { ...cmpForm, loyaltyProgramId: cmpForm.loyaltyProgramId || undefined }); setEditCmp(null); setCmpForm({ name: "", category: "Food", color: "hsl(160,84%,39%)", loyaltyProgramId: "" }); } }}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => { setEditCmp(null); setCmpForm({ name: "", category: "Food", color: "hsl(160,84%,39%)", loyaltyProgramId: "" }); }}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" className="gap-1" onClick={() => { if (cmpForm.name) { addCompany({ ...cmpForm, loyaltyProgramId: cmpForm.loyaltyProgramId || undefined }); setCmpForm({ name: "", category: "Food", color: "hsl(160,84%,39%)", loyaltyProgramId: "" }); } }}><Plus className="w-3 h-3" />Add Company</Button>
            )}
            <div className="max-h-48 overflow-y-auto space-y-1 border-t border-border pt-2 mt-1">
              {companies.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No companies added.</p>}
              {companies.map(c => (
                <div key={c.id} className="flex items-center gap-2 bg-secondary/40 rounded-md px-3 py-2 group">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{c.category}{c.loyaltyProgramId && ` · ${loyaltyPrograms.find(lp => lp.id === c.loyaltyProgramId)?.name || "Loyalty"}`}</p>
                  </div>
                  <button onClick={() => { setEditCmp(c.id); setCmpForm({ name: c.name, category: c.category, color: c.color, loyaltyProgramId: c.loyaltyProgramId || "" }); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => deleteCompany(c.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter><Button onClick={() => setCmpMgrOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
 