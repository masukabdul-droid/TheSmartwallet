import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  TrendingUp, TrendingDown, Plus, Trash2, Edit2, ChevronDown, ChevronUp,
  DollarSign, BarChart2, Activity, Layers
} from "lucide-react";
import { useDB, InvestmentHolding, InvestmentTx } from "@/lib/database";
import { SearchFilter, EMPTY_FILTER, SearchFilterState } from "@/components/ui/search-filter";

const TYPE_CONFIG = {
  mutual_fund:  { label: "Mutual Fund",  icon: "📊", color: "hsl(200,80%,50%)" },
  etf:          { label: "ETF",          icon: "📈", color: "hsl(160,84%,39%)" },
  index_fund:   { label: "Index Fund",   icon: "📉", color: "hsl(280,70%,60%)" },
  bond:         { label: "Bond",         icon: "🏛️",  color: "hsl(40,90%,55%)"  },
  stock:        { label: "Stock",        icon: "🏢",  color: "hsl(20,90%,55%)"  }, // NEW
};

const TX_TYPES = ["buy","sell","dividend","coupon","maturity","drip"] as const;

const DIVIDEND_MODES = [
  { value: "cash_auto",   label: "💸 Auto-deposit to account" },
  { value: "cash_manual", label: "📋 Record only (manual deposit)" },
  { value: "drip",        label: "🔄 Reinvest as shares (DRIP)" },
] as const;
const DIVIDEND_FREQS = ["monthly","quarterly","semi_annual","annual"] as const;
const STOCK_EXCHANGES = ["NYSE","NASDAQ","ADX","DFM","LSE","TSX","ASX","Other"];
const STOCK_SECTORS = ["Technology","Healthcare","Finance","Energy","Consumer","Industrial","Utilities","Real Estate","Materials","Communication","Other"];

const COUPON_FREQS = ["monthly","quarterly","semi_annual","annual"] as const;
const CURRENCIES = ["AED","USD","EUR","GBP","BDT"];
const COLORS = ["hsl(200,80%,50%)","hsl(160,84%,39%)","hsl(280,70%,60%)","hsl(40,90%,55%)","hsl(0,72%,51%)","hsl(330,70%,55%)"];

const EMPTY_HOLDING: any = {
  type: "etf", name: "", ticker: "", isin: "", color: COLORS[0], currency: "AED",
  issuer: "", couponRate: "", maturityDate: "", couponFrequency: "semi_annual",
  faceValue: "", expenseRatio: "", indexTracked: "", nav: "", navDate: "",
  exchange: "", sector: "", dividendFrequency: "quarterly",
  dividendPerShare: "", dividendMode: "cash_manual", dividendAccountId: "",
};
const EMPTY_TX: any = {
  date: new Date().toISOString().slice(0,10), type: "buy",
  units: "", pricePerUnit: "", totalAmount: "", fees: "",
  fromAccountId: "", toAccountId: "", notes: "",
  dividendMode: "", dripUnits: "", // NEW
};

export default function Investments() {
  const { investmentHoldings, addInvestmentHolding, updateInvestmentHolding,
          addInvestmentTx, updateInvestmentTx, deleteInvestmentTx,
          deleteInvestmentHolding, accounts, getAccountBalance,
          addTransaction } = useDB();

  const [filter, setFilter] = useState<SearchFilterState>(EMPTY_FILTER);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string|null>(null);
  const [holdingOpen, setHoldingOpen] = useState(false);
  const [editHolding, setEditHolding] = useState<InvestmentHolding|null>(null);
  const [holdingForm, setHoldingForm] = useState<any>(EMPTY_HOLDING);
  const [txOpen, setTxOpen] = useState(false);
  const [txHoldingId, setTxHoldingId] = useState("");
  const [editTx, setEditTx] = useState<InvestmentTx|null>(null);
  const [txForm, setTxForm] = useState<any>(EMPTY_TX);

  // ── Manual dividend deposit dialog ───────────────────────────────
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositTx, setDepositTx] = useState<{ holdingId: string; tx: InvestmentTx } | null>(null);
  const [depositAccountId, setDepositAccountId] = useState("");
  const [depositDate, setDepositDate] = useState(new Date().toISOString().slice(0, 10));
  // const { addTransaction } = useDB();

  const openDeposit = (holdingId: string, tx: InvestmentTx) => {
    setDepositTx({ holdingId, tx });
    setDepositAccountId("");
    setDepositDate(tx.date);
    setDepositOpen(true);
  };
  const handleDeposit = () => {
    if (!depositTx || !depositAccountId) return;
    const { tx } = depositTx;
    const holding = investmentHoldings.find(h => h.id === depositTx.holdingId);
    addTransaction({
      name: `Dividend: ${holding?.name ?? "Investment"}`,
      amount: tx.totalAmount,
      type: "income",
      category: "Investment Income",
      accountId: depositAccountId,
      date: depositDate,
      notes: `Manual dividend deposit from ${holding?.ticker ?? holding?.name ?? ""}`,
    });
    // Mark the tx as deposited by updating its dividendMode
    updateInvestmentTx(depositTx.holdingId, tx.id, { ...tx, dividendMode: "cash_auto" });
    setDepositOpen(false);
  };

  // ── Stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalInvested = 0, totalValue = 0, totalIncome = 0;
    investmentHoldings.forEach(h => {
      const buys  = h.transactions.filter(t => t.type === "buy");
      const sells = h.transactions.filter(t => t.type === "sell");
      const netUnits = (buys.reduce((s,t) => s + (t.units||0), 0)) - (sells.reduce((s,t) => s + (t.units||0), 0));
      const avgBuy = buys.length ? buys.reduce((s,t) => s + t.totalAmount, 0) / buys.reduce((s,t) => s + (t.units||1), 0) : 0;
      const latestNav = h.nav || (h.transactions.length ? h.transactions[h.transactions.length-1].pricePerUnit || 0 : 0);
      totalInvested += buys.reduce((s,t) => s + t.totalAmount, 0) - sells.reduce((s,t) => s + t.totalAmount, 0);
      totalValue    += Math.max(0, netUnits) * latestNav;
      totalIncome   += h.transactions.filter(t => ["dividend","coupon","maturity"].includes(t.type)).reduce((s,t) => s + t.totalAmount, 0);
    });
    return { totalInvested, totalValue, totalPL: totalValue - totalInvested, totalIncome };
  }, [investmentHoldings]);

  // ── Filtered holdings ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    return investmentHoldings.filter(h => {
      if (typeFilter !== "all" && h.type !== typeFilter) return false;
      if (filter.query && !h.name.toLowerCase().includes(filter.query.toLowerCase()) &&
          !h.ticker?.toLowerCase().includes(filter.query.toLowerCase())) return false;
      return true;
    });
  }, [investmentHoldings, filter, typeFilter]);

  // ── Dialog helpers ────────────────────────────────────────────────
  const openAddHolding = () => { setEditHolding(null); setHoldingForm(EMPTY_HOLDING); setHoldingOpen(true); };
  const openEditHolding = (h: InvestmentHolding) => {
    setEditHolding(h);
    setHoldingForm({
      type: h.type, name: h.name, ticker: h.ticker||"", isin: h.isin||"",
      color: h.color, currency: h.currency,
      issuer: h.issuer||"", couponRate: String(h.couponRate||""),
      maturityDate: h.maturityDate||"", couponFrequency: h.couponFrequency||"semi_annual",
      faceValue: String(h.faceValue||""), expenseRatio: String(h.expenseRatio||""),
      indexTracked: h.indexTracked||"", nav: String(h.nav||""), navDate: h.navDate||"", exchange: h.exchange||"", sector: h.sector||"",
    dividendFrequency: h.dividendFrequency||"quarterly",
    dividendPerShare: String(h.dividendPerShare||""),
    dividendMode: h.dividendMode||"cash_manual",
    dividendAccountId: h.dividendAccountId||"",
    });
    setHoldingOpen(true);
  };
  const handleSaveHolding = () => {
    if (!holdingForm.name) return;
    const data = {
      type: holdingForm.type, name: holdingForm.name, ticker: holdingForm.ticker||undefined,
      isin: holdingForm.isin||undefined, color: holdingForm.color, currency: holdingForm.currency,
      issuer: holdingForm.issuer||undefined, couponRate: holdingForm.couponRate ? parseFloat(holdingForm.couponRate) : undefined,
      maturityDate: holdingForm.maturityDate||undefined, couponFrequency: holdingForm.couponFrequency||undefined,
      faceValue: holdingForm.faceValue ? parseFloat(holdingForm.faceValue) : undefined,
      expenseRatio: holdingForm.expenseRatio ? parseFloat(holdingForm.expenseRatio) : undefined,
      indexTracked: holdingForm.indexTracked||undefined,
      nav: holdingForm.nav ? parseFloat(holdingForm.nav) : undefined,
      navDate: holdingForm.navDate||undefined,  exchange: holdingForm.exchange||undefined,
      sector: holdingForm.sector||undefined,
      dividendFrequency: holdingForm.dividendFrequency||undefined,
      dividendPerShare: holdingForm.dividendPerShare ? parseFloat(holdingForm.dividendPerShare) : undefined,
      dividendMode: holdingForm.dividendMode||undefined,
      dividendAccountId: holdingForm.dividendAccountId||undefined,
    };
    if (editHolding) updateInvestmentHolding(editHolding.id, data);
    else addInvestmentHolding(data);
    setHoldingOpen(false);
  };

  const openAddTx = (holdingId: string) => {
    setTxHoldingId(holdingId); setEditTx(null);
    const h = investmentHoldings.find(h => h.id === holdingId);
    setTxForm({ ...EMPTY_TX, pricePerUnit: String(h?.nav||"") });
    setTxOpen(true);
  };
  const openEditTx = (holdingId: string, tx: InvestmentTx) => {
    setTxHoldingId(holdingId); setEditTx(tx);
    setTxForm({
      date: tx.date, type: tx.type, units: String(tx.units||""),
      pricePerUnit: String(tx.pricePerUnit||""), totalAmount: String(tx.totalAmount),
      fees: String(tx.fees||""), fromAccountId: tx.fromAccountId||"",
      toAccountId: tx.toAccountId||"", notes: tx.notes||"",
    });
    setTxOpen(true);
  };
  const handleSaveTx = () => {
    const total = parseFloat(txForm.totalAmount) || (parseFloat(txForm.units)||0) * (parseFloat(txForm.pricePerUnit)||0);
    if (!total && !txForm.units) return;
    const data: Omit<InvestmentTx,"id"> = {
      date: txForm.date, type: txForm.type,
      units: txForm.units ? parseFloat(txForm.units) : undefined,
      pricePerUnit: txForm.pricePerUnit ? parseFloat(txForm.pricePerUnit) : undefined,
      totalAmount: total,
      fees: txForm.fees ? parseFloat(txForm.fees) : undefined,
      fromAccountId: txForm.fromAccountId||undefined,
      toAccountId: txForm.toAccountId||undefined,
      notes: txForm.notes||undefined, 
      dividendMode: txForm.dividendMode||undefined,
      dripUnits: txForm.dripUnits ? parseFloat(txForm.dripUnits) : undefined,
    };
    if (editTx) updateInvestmentTx(txHoldingId, editTx.id, data);
    else addInvestmentTx(txHoldingId, data);
    setTxOpen(false);
  };

  // Auto-compute totalAmount when units/price change
  const autoTotal = (parseFloat(txForm.units)||0) * (parseFloat(txForm.pricePerUnit)||0);

  const isBondType = holdingForm.type === "bond";
  const isFundType = ["mutual_fund","etf","index_fund"].includes(holdingForm.type);
  const isStockType = holdingForm.type === "stock"; // NEW

  return (
    <div className="space-y-6">
      <PageHeader title="Investments" subtitle={`${investmentHoldings.length} holdings · Mutual Funds, ETFs, Bonds`}
        action={<Button className="gap-2" onClick={openAddHolding}><Plus className="w-4 h-4"/>Add Holding</Button>} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Total Invested"  value={`AED ${stats.totalInvested.toFixed(0)}`} icon={DollarSign} />
        <StatCard title="Portfolio Value" value={`AED ${stats.totalValue.toFixed(0)}`}    icon={BarChart2} changeType={stats.totalValue >= stats.totalInvested ? "up":"down"} />
        <StatCard title="Total P&L"       value={`${stats.totalPL >= 0 ? "+" : ""}AED ${stats.totalPL.toFixed(0)}`} icon={TrendingUp} changeType={stats.totalPL >= 0 ? "up":"down"} />
        <StatCard title="Income Received" value={`AED ${stats.totalIncome.toFixed(0)}`}   icon={Activity} changeType="up" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <SearchFilter value={filter} onChange={setFilter} placeholder="Search holdings…" className="flex-1 min-w-48" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 bg-background border-border h-9"><SelectValue placeholder="All Types"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TYPE_CONFIG).map(([k,v]) => <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Holdings list */}
      {investmentHoldings.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Layers className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3"/>
          <p className="text-muted-foreground text-sm">No investment holdings yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Add Mutual Funds, ETFs, Index Funds or Bonds</p>
          <Button className="mt-4 gap-2" onClick={openAddHolding}><Plus className="w-4 h-4"/>Add First Holding</Button>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((h, i) => {
          const cfg      = TYPE_CONFIG[h.type];
          const buys     = h.transactions.filter(t => t.type === "buy");
          const sells    = h.transactions.filter(t => t.type === "sell");
          const income   = h.transactions.filter(t => ["dividend","coupon","maturity"].includes(t.type));
          const netUnits = buys.reduce((s,t) => s + (t.units||0), 0) - sells.reduce((s,t) => s + (t.units||0), 0);
          const costBasis  = buys.reduce((s,t) => s + t.totalAmount, 0) - sells.reduce((s,t) => s + t.totalAmount, 0);
          const latestNav  = h.nav || (h.transactions.length ? h.transactions[h.transactions.length-1].pricePerUnit || 0 : 0);
          const curVal     = Math.max(0, netUnits) * latestNav;
          const pl         = curVal - costBasis;
          const totalInc   = income.reduce((s,t) => s + t.totalAmount, 0);
          const isExp      = expanded === h.id;

          return (
            <motion.div key={h.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}} className="glass-card overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{backgroundColor:`${h.color}20`}}>
                      {cfg.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{h.name}</p>
                        {h.ticker && <span className="text-xs font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{h.ticker}</span>}
                        <Badge variant="outline" className="text-[10px]">{cfg.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {h.indexTracked ? `Tracks: ${h.indexTracked} · ` : ""}
                        {h.issuer ? `Issuer: ${h.issuer} · ` : ""}
                        {h.currency}
                        {h.maturityDate ? ` · Matures: ${h.maturityDate}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-2">
                      <p className="text-lg font-display font-bold text-foreground">{h.currency} {curVal.toFixed(2)}</p>
                      <p className={`text-xs flex items-center justify-end gap-1 ${pl >= 0 ? "text-primary" : "text-destructive"}`}>
                        {pl >= 0 ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                        {pl >= 0 ? "+" : ""}{h.currency} {pl.toFixed(2)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openAddTx(h.id)}>
                      <Plus className="w-3 h-3"/>Tx
                    </Button>
                    <button onClick={() => openEditHolding(h)} className="text-muted-foreground hover:text-foreground p-1"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={() => deleteInvestmentHolding(h.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-3 mb-3 text-xs">
                  <div><p className="text-muted-foreground">Units Held</p><p className="font-semibold">{netUnits.toFixed(4)}</p></div>
                  <div><p className="text-muted-foreground">Cost Basis</p><p className="font-semibold">{h.currency} {costBasis.toFixed(2)}</p></div>
                  <div><p className="text-muted-foreground">Latest NAV/Price</p><p className="font-semibold">{latestNav > 0 ? `${h.currency} ${latestNav.toFixed(4)}` : "—"}</p></div>
                  <div><p className="text-muted-foreground">Income Earned</p><p className="font-semibold text-primary">{h.currency} {totalInc.toFixed(2)}</p></div>
                </div>

                {h.type === "bond" && h.couponRate && (
                  <div className="bg-secondary/30 rounded-lg px-3 py-2 mb-3 grid grid-cols-3 gap-2 text-xs">
                    <div><p className="text-muted-foreground">Coupon Rate</p><p className="font-semibold text-primary">{h.couponRate}% p.a.</p></div>
                    <div><p className="text-muted-foreground">Frequency</p><p className="font-semibold capitalize">{h.couponFrequency?.replace("_"," ")}</p></div>
                    <div><p className="text-muted-foreground">Face Value</p><p className="font-semibold">{h.faceValue ? `${h.currency} ${h.faceValue.toLocaleString()}` : "—"}</p></div>
                  </div>
                )}
                {(h.expenseRatio !== undefined || h.indexTracked) && (
                  <div className="bg-secondary/30 rounded-lg px-3 py-2 mb-3 grid grid-cols-2 gap-2 text-xs">
                    {h.expenseRatio !== undefined && <div><p className="text-muted-foreground">Expense Ratio</p><p className="font-semibold">{h.expenseRatio}% p.a.</p></div>}
                    {h.indexTracked && <div><p className="text-muted-foreground">Tracks</p><p className="font-semibold">{h.indexTracked}</p></div>}
                  </div>
                )}
                {h.type === "stock" && (h.exchange || h.sector || h.dividendPerShare) && (
                <div className="bg-secondary/30 rounded-lg px-3 py-2 mb-3 grid grid-cols-3 gap-2 text-xs">
                  {h.exchange && <div><p className="text-muted-foreground">Exchange</p><p className="font-semibold">{h.exchange}</p></div>}
                  {h.sector  && <div><p className="text-muted-foreground">Sector</p><p className="font-semibold">{h.sector}</p></div>}
                  {h.dividendPerShare && (
                    <div>
                      <p className="text-muted-foreground">Div/Share</p>
                      <p className="font-semibold text-primary">
                        {h.currency} {h.dividendPerShare}
                        {h.dividendFrequency ? ` / ${h.dividendFrequency.replace("_"," ")}` : ""}
                      </p>
                    </div>
                  )}
                  {h.dividendMode && (
                    <div className="col-span-3 flex items-center gap-1.5 mt-0.5 pt-1.5 border-t border-border/30">
                      <span className="text-muted-foreground">Dividend mode:</span>
                      <Badge variant="outline" className="text-[10px]">
                        {h.dividendMode === "cash_auto"   ? "💸 Auto-deposit" :
                        h.dividendMode === "cash_manual" ? "📋 Manual" : "🔄 DRIP"}
                      </Badge>
                      {h.dividendAccountId && (
                        <span className="text-muted-foreground text-[10px]">
                          → {accounts.find(a => a.id === h.dividendAccountId)?.name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
                {/* Expand transactions */}
                {h.transactions.length > 0 && (
                  <button onClick={() => setExpanded(isExp ? null : h.id)} className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground mt-1">
                    <span>Transactions ({h.transactions.length})</span>
                    {isExp ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                  </button>
                )}

                <AnimatePresence>
                  {isExp && (
                    <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                      <div className="mt-2 border-t border-border pt-2 space-y-1 max-h-60 overflow-y-auto">
                        {[...h.transactions].reverse().map(tx => {
                          const isIncome = ["dividend","coupon","maturity","drip"].includes(tx.type);
                          const isExpense = tx.type === "buy";
                          return (
                            <div key={tx.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0 group">
                              <div>
                                <span className={`font-bold capitalize mr-2 ${
                                    ["dividend","drip","coupon","maturity"].includes(tx.type) ? "text-primary" :
                                    tx.type === "buy" ? "text-destructive" : "text-amber-400"
                                  }`}>
                                    {tx.type === "drip" ? "🔄 DRIP" : tx.type}
                                  </span>
                                  {tx.dividendMode === "cash_auto" && <span className="text-[10px] bg-primary/10 text-primary px-1 rounded mr-1">auto-deposited</span>}
                                  {tx.dividendMode === "cash_manual" && <span className="text-[10px] bg-secondary text-muted-foreground px-1 rounded mr-1">manual</span>}
                                {tx.units && <span className="text-muted-foreground">{tx.units} units @ {tx.pricePerUnit?.toFixed(4)} · </span>}
                                <span className="text-muted-foreground">{tx.date}</span>
                                {tx.notes && <span className="text-muted-foreground"> · {tx.notes}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`font-semibold ${isIncome ? "text-primary" : ""}`}>
                                  {isIncome ? "+" : isExpense ? "-" : ""}{h.currency} {tx.totalAmount.toFixed(2)}
                                </span>
                                {tx.type === "dividend" && tx.dividendMode === "cash_manual" && (
                                  <button
                                    onClick={() => openDeposit(h.id, tx)}
                                    className="opacity-0 group-hover:opacity-100 text-xs text-primary hover:text-primary/80 font-medium px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 transition-colors"
                                  >
                                    Deposit
                                  </button>
                                )}
                                <button onClick={() => openEditTx(h.id, tx)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"><Edit2 className="w-3 h-3"/></button>
                                <button onClick={() => deleteInvestmentTx(h.id, tx.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3"/></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Add/Edit Holding Dialog */}
      <Dialog open={holdingOpen} onOpenChange={setHoldingOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editHolding ? "Edit" : "Add"} Investment Holding</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {/* Type selector */}
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(TYPE_CONFIG).map(([k,v]) => (
                <button key={k} onClick={() => setHoldingForm((f:any) => ({...f, type:k}))}
                  className={`p-2 rounded-lg border text-xs text-center transition-all ${holdingForm.type===k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
                  <div className="text-xl mb-1">{v.icon}</div>
                  {v.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Name</Label><Input placeholder="e.g. Vanguard S&P 500 ETF" value={holdingForm.name} onChange={e=>setHoldingForm((f:any)=>({...f,name:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>{isBondType ? "ISIN" : "Ticker"}</Label><Input placeholder={isBondType ? "e.g. US912828Y503" : "e.g. SPY"} value={isBondType ? holdingForm.isin : holdingForm.ticker} onChange={e=>setHoldingForm((f:any)=>({...f, [isBondType?"isin":"ticker"]:e.target.value}))} className="bg-background border-border font-mono"/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Currency</Label>
                <Select value={holdingForm.currency} onValueChange={v=>setHoldingForm((f:any)=>({...f,currency:v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Latest NAV / Price</Label><Input type="number" step="0.0001" value={holdingForm.nav} onChange={e=>setHoldingForm((f:any)=>({...f,nav:e.target.value}))} className="bg-background border-border"/></div>
            </div>

            {isFundType && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Expense Ratio (% p.a.)</Label><Input type="number" step="0.01" placeholder="e.g. 0.03" value={holdingForm.expenseRatio} onChange={e=>setHoldingForm((f:any)=>({...f,expenseRatio:e.target.value}))} className="bg-background border-border"/></div>
                {holdingForm.type === "index_fund" || holdingForm.type === "etf" ? (
                  <div className="space-y-1.5"><Label>Index Tracked</Label><Input placeholder="e.g. S&P 500" value={holdingForm.indexTracked} onChange={e=>setHoldingForm((f:any)=>({...f,indexTracked:e.target.value}))} className="bg-background border-border"/></div>
                ) : <div/>}
              </div>
            )}

            {isBondType && (
              <div className="space-y-3 border border-amber-400/20 bg-amber-400/5 rounded-lg p-3">
                <Label className="text-xs font-semibold text-amber-400">🏛️ Bond Details</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Issuer</Label><Input placeholder="e.g. US Treasury" value={holdingForm.issuer} onChange={e=>setHoldingForm((f:any)=>({...f,issuer:e.target.value}))} className="bg-background border-border"/></div>
                  <div className="space-y-1.5"><Label className="text-xs">Face Value</Label><Input type="number" value={holdingForm.faceValue} onChange={e=>setHoldingForm((f:any)=>({...f,faceValue:e.target.value}))} className="bg-background border-border"/></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Coupon Rate (% p.a.)</Label><Input type="number" step="0.01" value={holdingForm.couponRate} onChange={e=>setHoldingForm((f:any)=>({...f,couponRate:e.target.value}))} className="bg-background border-border"/></div>
                  <div className="space-y-1.5"><Label className="text-xs">Frequency</Label>
                    <Select value={holdingForm.couponFrequency} onValueChange={v=>setHoldingForm((f:any)=>({...f,couponFrequency:v}))}>
                      <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                      <SelectContent>{COUPON_FREQS.map(f=><SelectItem key={f} value={f} className="capitalize">{f.replace("_"," ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs">Maturity Date</Label><Input type="date" value={holdingForm.maturityDate} onChange={e=>setHoldingForm((f:any)=>({...f,maturityDate:e.target.value}))} className="bg-background border-border"/></div>
                </div>
              </div>
            )}

            <div className="space-y-1.5"><Label>Color</Label>
              <div className="flex gap-2">{COLORS.map(c=>(
                <button key={c} onClick={()=>setHoldingForm((f:any)=>({...f,color:c}))} className="w-7 h-7 rounded-full border-2 transition-all" style={{backgroundColor:c, borderColor:holdingForm.color===c?"white":"transparent"}}/>
              ))}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setHoldingOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveHolding} disabled={!holdingForm.name}>{editHolding ? "Save Changes" : "Add Holding"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

{isStockType && (
  <div className="space-y-3 border border-orange-400/20 bg-orange-400/5 rounded-lg p-3">
    <Label className="text-xs font-semibold text-orange-400">🏢 Stock Details</Label>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Exchange</Label>
        <Select value={holdingForm.exchange} onValueChange={v=>setHoldingForm((f:any)=>({...f,exchange:v}))}>
          <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select exchange"/></SelectTrigger>
          <SelectContent>{STOCK_EXCHANGES.map(e=><SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Sector</Label>
        <Select value={holdingForm.sector} onValueChange={v=>setHoldingForm((f:any)=>({...f,sector:v}))}>
          <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select sector"/></SelectTrigger>
          <SelectContent>{STOCK_SECTORS.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
    <div className="border-t border-orange-400/10 pt-3">
      <Label className="text-xs font-semibold text-orange-300 block mb-2">Dividend Settings</Label>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Dividend per Share</Label>
          <Input type="number" step="0.0001" placeholder="e.g. 0.88"
            value={holdingForm.dividendPerShare}
            onChange={e=>setHoldingForm((f:any)=>({...f,dividendPerShare:e.target.value}))}
            className="bg-background border-border"/>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Frequency</Label>
          <Select value={holdingForm.dividendFrequency} onValueChange={v=>setHoldingForm((f:any)=>({...f,dividendFrequency:v}))}>
            <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
            <SelectContent>{DIVIDEND_FREQS.map(f=><SelectItem key={f} value={f} className="capitalize">{f.replace("_"," ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5 mt-3">
        <Label className="text-xs">Default Dividend Mode</Label>
        <div className="grid grid-cols-1 gap-1.5">
          {DIVIDEND_MODES.map(m => (
            <button key={m.value} onClick={()=>setHoldingForm((f:any)=>({...f,dividendMode:m.value}))}
              className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                holdingForm.dividendMode === m.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {holdingForm.dividendMode === "cash_auto" && (
        <div className="space-y-1.5 mt-3">
          <Label className="text-xs">Auto-deposit to Account</Label>
          <Select value={holdingForm.dividendAccountId} onValueChange={v=>setHoldingForm((f:any)=>({...f,dividendAccountId:v}))}>
            <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select account"/></SelectTrigger>
            <SelectContent>
              {accounts.filter(a=>a.isActive).map(a=>(
                <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  </div>
)}



      {/* Add/Edit Transaction Dialog */}
      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent className="w-full sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editTx ? "Edit" : "Add"} Transaction — {investmentHoldings.find(h=>h.id===txHoldingId)?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Type</Label>
                <Select value={txForm.type} onValueChange={v=>setTxForm((f:any)=>({...f,type:v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                  <SelectContent>{TX_TYPES.map(t=><SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={txForm.date} onChange={e=>setTxForm((f:any)=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            {(txForm.type === "buy" || txForm.type === "sell") && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Units / Shares</Label><Input type="number" step="0.0001" value={txForm.units} onChange={e=>setTxForm((f:any)=>({...f,units:e.target.value}))} className="bg-background border-border"/></div>
                <div className="space-y-1.5"><Label>Price per Unit (NAV)</Label><Input type="number" step="0.0001" value={txForm.pricePerUnit} onChange={e=>setTxForm((f:any)=>({...f,pricePerUnit:e.target.value}))} className="bg-background border-border"/></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Total Amount {autoTotal > 0 && txForm.totalAmount === "" ? `(auto: ${autoTotal.toFixed(2)})` : ""}</Label>
                <Input type="number" placeholder={autoTotal > 0 ? autoTotal.toFixed(2) : "0"} value={txForm.totalAmount} onChange={e=>setTxForm((f:any)=>({...f,totalAmount:e.target.value}))} className="bg-background border-border"/>
              </div>
              <div className="space-y-1.5"><Label>Fees</Label><Input type="number" step="0.01" placeholder="0" value={txForm.fees} onChange={e=>setTxForm((f:any)=>({...f,fees:e.target.value}))} className="bg-background border-border"/></div>
            </div>

            <div className="space-y-1.5">
              <Label>{txForm.type === "buy" ? "💳 Deduct from Account" : "🏦 Credit to Account"}</Label>
              <Select value={(txForm.type === "buy" ? txForm.fromAccountId : txForm.toAccountId)||"_none"} onValueChange={v=>{
                const field = txForm.type === "buy" ? "fromAccountId" : "toAccountId";
                setTxForm((f:any)=>({...f,[field]:v==="_none"?"":v}));
              }}>
                {/* Dividend mode override — shown for dividend / drip transactions */}
{(txForm.type === "dividend" || txForm.type === "drip") && (
  <div className="space-y-2 border border-primary/20 bg-primary/5 rounded-lg p-3">
    <Label className="text-xs font-semibold text-primary">Dividend Options</Label>
    <div className="space-y-1.5">
      <Label className="text-xs">How to receive this dividend?</Label>
      <div className="grid grid-cols-1 gap-1.5">
        {DIVIDEND_MODES.map(m => (
          <button key={m.value} onClick={()=>setTxForm((f:any)=>({...f,dividendMode:m.value, type: m.value==="drip" ? "drip" : "dividend"}))}
            className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${
              txForm.dividendMode === m.value || (m.value==="drip" && txForm.type==="drip")
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}>
            {m.label}
          </button>
        ))}
      </div>
    </div>
    {txForm.dividendMode === "drip" && (
      <div className="space-y-1.5">
        <Label className="text-xs">Units Reinvested</Label>
        <Input type="number" step="0.0001" placeholder="e.g. 1.234"
          value={txForm.dripUnits}
          onChange={e=>setTxForm((f:any)=>({...f,dripUnits:e.target.value}))}
          className="bg-background border-border"/>
      </div>
    )}
    {(txForm.dividendMode === "cash_auto" || txForm.dividendMode === "cash_manual") && (
      <div className="space-y-1.5">
        <Label className="text-xs">
          {txForm.dividendMode === "cash_auto" ? "Deposit to Account" : "Account (optional)"}
        </Label>
        <Select value={txForm.toAccountId} onValueChange={v=>setTxForm((f:any)=>({...f,toAccountId:v}))}>
          <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select account"/></SelectTrigger>
          <SelectContent>
            {accounts.filter(a=>a.isActive).map(a=>(
              <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )}
  </div>
)}
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — AED {getAccountBalance(a.id).toLocaleString()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input placeholder="Optional notes" value={txForm.notes} onChange={e=>setTxForm((f:any)=>({...f,notes:e.target.value}))} className="bg-background border-border"/></div>

            {autoTotal > 0 && (
              <div className={`rounded-lg p-3 text-xs text-center font-medium ${txForm.type==="buy"?"bg-destructive/10 text-destructive":"bg-primary/10 text-primary"}`}>
                {txForm.type==="buy" ? "Will deduct" : "Will credit"} AED {(parseFloat(txForm.totalAmount)||autoTotal).toFixed(2)}
                {txForm.fees ? ` + AED ${txForm.fees} fees` : ""}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setTxOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTx}>{editTx ? "Save Changes" : "Add Transaction"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Manual Dividend Deposit Dialog */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              💸 Deposit Dividend
            </DialogTitle>
          </DialogHeader>
          {depositTx && (() => {
            const holding = investmentHoldings.find(h => h.id === depositTx.holdingId);
            return (
              <div className="space-y-4 py-2">
                {/* Summary */}
                <div className="bg-primary/10 rounded-lg px-4 py-3 text-sm">
                  <p className="text-muted-foreground text-xs mb-1">{holding?.name} · {depositTx.tx.date}</p>
                  <p className="text-2xl font-bold text-primary">
                    {holding?.currency} {depositTx.tx.totalAmount.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Dividend to deposit</p>
                </div>

                {/* Account picker */}
                <div className="space-y-1.5">
                  <Label>Deposit to Account</Label>
                  <Select value={depositAccountId} onValueChange={setDepositAccountId}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Select account…" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => a.isActive).map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="flex items-center gap-2">
                            {a.name}
                            <span className="text-muted-foreground text-xs">({a.currency})</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <Label>Deposit Date</Label>
                  <Input
                    type="date"
                    value={depositDate}
                    onChange={e => setDepositDate(e.target.value)}
                    className="bg-background border-border"
                  />
                </div>

                {depositAccountId && (
                  <div className="bg-secondary/40 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                    This will add <span className="text-foreground font-semibold">+{holding?.currency} {depositTx.tx.totalAmount.toFixed(2)}</span> to{" "}
                    <span className="text-foreground font-semibold">{accounts.find(a => a.id === depositAccountId)?.name}</span> as Investment Income.
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositOpen(false)}>Cancel</Button>
            <Button onClick={handleDeposit} disabled={!depositAccountId} className="gap-2">
              💸 Deposit Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
