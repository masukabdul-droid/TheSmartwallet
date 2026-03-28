import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Star, Plus, Trash2, Edit2, Gift, DollarSign, ChevronDown, ChevronUp, CreditCard, Tag, Percent, BarChart2, Filter, Calendar } from "lucide-react";
import { useDB, LoyaltyProgram, LoyaltyTx } from "@/lib/database";
import { SearchFilter, EMPTY_FILTER, matchesFilter, SearchFilterState } from "@/components/ui/search-filter";

const REDEEM_METHODS: { value: LoyaltyTx["redeemMethod"]; label: string; icon: string }[] = [
  { value: "cashback", label: "Cashback / Statement Credit", icon: "💰" },
  { value: "purchase", label: "Purchase / Pay with Points", icon: "🛍️" },
  { value: "miles", label: "Air Miles / Travel", icon: "✈️" },
  { value: "account_credit", label: "Transfer to Account", icon: "🏦" },
];

const PROGRAM_COLORS = [
  "hsl(40,90%,55%)", "hsl(160,84%,39%)", "hsl(280,70%,60%)",
  "hsl(200,80%,50%)", "hsl(0,72%,51%)", "hsl(330,70%,55%)",
];
const DC_COLORS = ["hsl(220,80%,40%)", "hsl(200,70%,40%)", "hsl(260,70%,50%)", "hsl(0,70%,45%)", "hsl(160,70%,40%)", "hsl(40,80%,45%)"];
const PROVIDERS = ["Emirates", "Etihad", "Air Arabia", "Marriott", "Hilton", "ADNOC", "Carrefour", "LuLu", "Noon", "Amazon", "Mashreq", "Emirates NBD", "FAB", "ADCB", "Other"];

const EMPTY_PROG = { name: "", provider: "", pointsBalance: "", pointsValue: "", currency: "AED", color: PROGRAM_COLORS[0], expiryDate: "", earnRate: "", autoDetect: false };
const EMPTY_TX = { date: new Date().toISOString().slice(0, 10), points: "", type: "earned" as LoyaltyTx["type"], description: "", redeemMethod: undefined as LoyaltyTx["redeemMethod"] | undefined, redeemValue: "" };
const EMPTY_DC = { name: "", provider: "", type: "government" as "government" | "corporate" | "membership" | "other", discountType: "percentage" as "percentage" | "fixed" | "tiered", defaultDiscount: "", maxDiscount: "", cardNumber: "", expiryDate: "", color: DC_COLORS[0] };

export default function Loyalty() {
  const { loyaltyPrograms, accounts, creditCards, addLoyaltyProgram, updateLoyaltyProgram, addLoyaltyTx, deleteLoyaltyProgram, discountCards, addDiscountCard, updateDiscountCard, deleteDiscountCard, addTransaction } = useDB();

  const [tab, setTab] = useState<"loyalty" | "discount">("loyalty");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [progOpen, setProgOpen] = useState(false);
  const [editProg, setEditProg] = useState<LoyaltyProgram | null>(null);
  const [progForm, setProgForm] = useState(EMPTY_PROG);

  const [txOpen, setTxOpen] = useState(false);
  const [txProgId, setTxProgId] = useState("");
  const [txForm, setTxForm] = useState(EMPTY_TX);

  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemProgId, setRedeemProgId] = useState("");
  const [filter, setFilter] = useState<SearchFilterState>(EMPTY_FILTER);
  const [redeemForm, setRedeemForm] = useState({ method: "cashback" as LoyaltyTx["redeemMethod"], points: "", value: "", accountId: "", description: "Points redemption", date: new Date().toISOString().slice(0, 10) });

  const [dcOpen, setDcOpen] = useState(false);
  const [editDC, setEditDC] = useState<any>(null);
  const [dcForm, setDcForm] = useState(EMPTY_DC);

  // Discount savings tracker
  const [usageOpen, setUsageOpen] = useState(false);
  const [usageDcId, setUsageDcId] = useState("");
  const [usageForm, setUsageForm] = useState({ date: new Date().toISOString().slice(0,10), originalAmount: "", discountedAmount: "", description: "", cardId: "" });
  const [discountUsages, setDiscountUsages] = useState<Array<{id:string,dcId:string,date:string,originalAmount:number,discountedAmount:number,saved:number,description:string}>>(() => {
    try { return JSON.parse(localStorage.getItem("swc_discount_usages") || "[]"); } catch { return []; }
  });
  const saveUsages = (usages: typeof discountUsages) => { setDiscountUsages(usages); localStorage.setItem("swc_discount_usages", JSON.stringify(usages)); };

  // Dashboard filter state
  const [dashFilter, setDashFilter] = useState({ cardId: "all", period: "this_month", customFrom: "", customTo: "" });

  // Discount analytics
  const getFilteredUsages = useMemo(() => {
    const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
    let start: Date, end = now;
    if (dashFilter.period === "this_month") start = new Date(y, m, 1);
    else if (dashFilter.period === "last_month") { start = new Date(y, m-1, 1); end = new Date(y, m, 0); }
    else if (dashFilter.period === "week") start = new Date(Date.now() - 7*86400000);
    else if (dashFilter.period === "6months") start = new Date(y, m-5, 1);
    else if (dashFilter.period === "1year") start = new Date(y-1, m, 1);
    else if (dashFilter.period === "custom" && dashFilter.customFrom) { start = new Date(dashFilter.customFrom); if (dashFilter.customTo) end = new Date(dashFilter.customTo+"T23:59:59"); }
    else start = new Date(2000,0,1); // all time
    return discountUsages.filter(u => {
      const d = new Date(u.date);
      if (d < start || d > end) return false;
      if (dashFilter.cardId !== "all" && u.dcId !== dashFilter.cardId) return false;
      return true;
    });
  }, [discountUsages, dashFilter]);
  const totalSaved = getFilteredUsages.reduce((s,u) => s+u.saved, 0);

  const totalPoints = loyaltyPrograms.reduce((s, p) => s + p.pointsBalance, 0);
  const totalValue = loyaltyPrograms.reduce((s, p) => s + p.pointsBalance * (p.pointsValue || 0), 0);

  const openAddProg = () => { setEditProg(null); setProgForm(EMPTY_PROG); setProgOpen(true); };
  const openEditProg = (p: LoyaltyProgram) => {
    setEditProg(p);
    setProgForm({ name: p.name, provider: p.provider, pointsBalance: String(p.pointsBalance), pointsValue: String(p.pointsValue || ""), currency: p.currency, color: p.color, expiryDate: p.expiryDate || "", earnRate: String((p as any).earnRate || ""), autoDetect: !!(p as any).autoDetect });
    setProgOpen(true);
  };
  const handleSaveProg = () => {
    if (!progForm.name) return;
    const data = { name: progForm.name, provider: progForm.provider, pointsBalance: parseFloat(progForm.pointsBalance) || 0, pointsValue: parseFloat(progForm.pointsValue) || 0, currency: progForm.currency, color: progForm.color, expiryDate: progForm.expiryDate || undefined, earnRate: parseFloat(progForm.earnRate) || undefined, autoDetect: progForm.autoDetect };
    if (editProg) updateLoyaltyProgram(editProg.id, data);
    else addLoyaltyProgram(data);
    setProgOpen(false);
  };

  const openTx = (progId: string) => { setTxProgId(progId); setTxForm(EMPTY_TX); setTxOpen(true); };
  const handleAddTx = () => {
    const pts = parseFloat(txForm.points) || 0;
    if (!pts || !txProgId) return;
    addLoyaltyTx(txProgId, { date: txForm.date, points: pts, type: txForm.type, description: txForm.description, redeemMethod: txForm.type === "redeemed" ? txForm.redeemMethod : undefined, redeemValue: txForm.redeemValue ? parseFloat(txForm.redeemValue) : undefined });
    setTxOpen(false);
  };

  const openRedeem = (progId: string) => { setRedeemProgId(progId); setRedeemForm({ method: "cashback", points: "", value: "", accountId: "", description: "Points redemption", date: new Date().toISOString().slice(0, 10) }); setRedeemOpen(true); };
  const handleRedeem = () => {
    const pts = parseFloat(redeemForm.points) || 0;
    if (!pts || !redeemProgId) return;
    const prog = loyaltyPrograms.find(p => p.id === redeemProgId);
    const val = redeemForm.value ? parseFloat(redeemForm.value) : pts * (prog?.pointsValue || 0);
    addLoyaltyTx(redeemProgId, { date: redeemForm.date, points: pts, type: "redeemed", description: redeemForm.description, redeemMethod: redeemForm.method, redeemValue: val });
    // If redeeming as account credit, add income transaction to the account
    if (redeemForm.method === "account_credit" && redeemForm.accountId && val > 0) {
      addTransaction({
        name: `Loyalty Redemption: ${prog?.name || "Points"}`,
        amount: val,
        type: "income",
        category: "Loyalty Reward",
        accountId: redeemForm.accountId,
        date: redeemForm.date,
        notes: `Redeemed ${pts} points @ ${prog?.pointsValue || 0} each`,
      });
    }
    setRedeemOpen(false);
  };

  const openAddDC = () => { setEditDC(null); setDcForm(EMPTY_DC); setDcOpen(true); };
  const openEditDC = (dc: any) => { setEditDC(dc); setDcForm({ name: dc.name, provider: dc.provider, type: dc.type, discountType: dc.discountType, defaultDiscount: String(dc.defaultDiscount), maxDiscount: String(dc.maxDiscount || ""), cardNumber: dc.cardNumber || "", expiryDate: dc.expiryDate || "", color: dc.color }); setDcOpen(true); };
  const handleSaveDC = () => {
    if (!dcForm.name) return;
    const data = { name: dcForm.name, provider: dcForm.provider, type: dcForm.type, discountType: dcForm.discountType, defaultDiscount: parseFloat(dcForm.defaultDiscount) || 0, maxDiscount: dcForm.maxDiscount ? parseFloat(dcForm.maxDiscount) : undefined, cardNumber: dcForm.cardNumber || undefined, expiryDate: dcForm.expiryDate || undefined, color: dcForm.color, rules: [] };
    if (editDC) updateDiscountCard(editDC.id, data);
    else addDiscountCard(data);
    setDcOpen(false);
  };

  const handleAddUsage = () => {
    if (!usageForm.originalAmount || !usageDcId) return;
    const orig = parseFloat(usageForm.originalAmount)||0;
    const disc = parseFloat(usageForm.discountedAmount)||orig;
    const saved = orig - disc;
    const newUsage = { id: Date.now().toString(), dcId: usageDcId, date: usageForm.date, originalAmount: orig, discountedAmount: disc, saved, description: usageForm.description };
    saveUsages([...discountUsages, newUsage]);
    setUsageOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loyalty & Rewards"
        subtitle={`${loyaltyPrograms.length} programs · ${discountCards.length} discount cards`}
        action={
          <div className="flex gap-2">
            <div className="flex rounded-lg overflow-hidden border border-border text-xs">
              <button onClick={() => setTab("loyalty")} className={`px-3 py-1.5 transition-colors ${tab === "loyalty" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Loyalty</button>
              <button onClick={() => setTab("discount")} className={`px-3 py-1.5 transition-colors ${tab === "discount" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Discount Cards</button>
            </div>
            {tab === "loyalty"
              ? <Button className="gap-2" onClick={openAddProg}><Plus className="w-4 h-4" />Add Program</Button>
              : <Button className="gap-2" onClick={openAddDC}><Plus className="w-4 h-4" />Add Card</Button>
            }
          </div>
        }
      />

      {tab === "loyalty" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <StatCard title="Total Points" value={totalPoints.toLocaleString()} icon={Star} />
            <StatCard title="Total Value" value={`AED ${totalValue.toFixed(2)}`} icon={DollarSign} changeType="up" />
            <StatCard title="Programs" value={loyaltyPrograms.length.toString()} icon={Gift} />
          </div>

          <SearchFilter value={filter} onChange={setFilter} placeholder="Search programs…" />

          {loyaltyPrograms.length === 0 && (
            <div className="glass-card p-12 text-center">
              <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No loyalty programs yet.</p>
              <p className="text-muted-foreground/60 text-xs mt-1">Add Emirates Skywards, Marriott Bonvoy, ADNOC Rewards and more.</p>
              <Button className="mt-4 gap-2" onClick={openAddProg}><Plus className="w-4 h-4" />Add First Program</Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {loyaltyPrograms.filter(p => !filter.query || p.name.toLowerCase().includes(filter.query.toLowerCase()) || p.category?.toLowerCase().includes(filter.query.toLowerCase())).map((prog, i) => {
              const earned = prog.transactions.filter(t => t.type === "earned").reduce((s, t) => s + t.points, 0);
              const redeemed = prog.transactions.filter(t => t.type === "redeemed").reduce((s, t) => s + t.points, 0);
              const expired = prog.transactions.filter(t => t.type === "expired").reduce((s, t) => s + t.points, 0);
              const estValue = prog.pointsBalance * (prog.pointsValue || 0);
              const isExp = expanded === prog.id;
              return (
                <motion.div key={prog.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="glass-card overflow-hidden">
                  <div className="p-5 border-b border-border" style={{ borderLeftColor: prog.color, borderLeftWidth: 4 }}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${prog.color}25` }}>
                          <Star className="w-5 h-5" style={{ color: prog.color }} />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{prog.name}</p>
                          <p className="text-xs text-muted-foreground">{prog.provider}{prog.expiryDate ? ` · Expires ${prog.expiryDate}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openRedeem(prog.id)}><Gift className="w-3 h-3" />Redeem</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openTx(prog.id)}><Plus className="w-3 h-3" />Earn</Button>
                        <button onClick={() => openEditProg(prog)} className="text-muted-foreground hover:text-foreground p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteLoyaltyProgram(prog.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <p className="text-2xl font-display font-bold text-foreground">{prog.pointsBalance.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Available Points</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold stat-up">AED {estValue.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Est. Value</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{prog.pointsValue ? `AED ${prog.pointsValue}` : "—"}</p>
                        <p className="text-xs text-muted-foreground">per point</p>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-3 grid grid-cols-3 gap-3 border-b border-border text-center text-xs">
                    <div><p className="text-muted-foreground">Earned</p><p className="font-semibold stat-up">+{earned.toLocaleString()}</p></div>
                    <div><p className="text-muted-foreground">Redeemed</p><p className="font-semibold stat-down">-{redeemed.toLocaleString()}</p></div>
                    <div><p className="text-muted-foreground">Expired</p><p className="font-semibold text-amber-400">{expired.toLocaleString()}</p></div>
                  </div>

                  <div className="px-5 py-3 border-b border-border">
                    <p className="text-xs text-muted-foreground mb-2">Redeem as:</p>
                    <div className="flex gap-2 flex-wrap">
                      {REDEEM_METHODS.map(rm => (
                        <button key={rm.value} onClick={() => { setRedeemProgId(prog.id); setRedeemForm(f => ({ ...f, method: rm.value })); setRedeemOpen(true); }}
                          className="text-xs px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center gap-1">
                          {rm.icon} {rm.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button onClick={() => setExpanded(isExp ? null : prog.id)} className="w-full flex items-center justify-between px-5 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <span>History ({prog.transactions.length})</span>
                    {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {isExp && (
                    <div className="px-5 pb-4 space-y-1 max-h-48 overflow-y-auto">
                      {prog.transactions.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No activity yet.</p>}
                      {[...prog.transactions].reverse().map(tx => (
                        <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                          <div>
                            <p className="text-xs font-medium text-foreground">{tx.description}</p>
                            <p className="text-[10px] text-muted-foreground">{tx.date}{tx.redeemMethod ? ` · ${tx.redeemMethod.replace(/_/g, " ")}` : ""}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-semibold ${tx.type === "earned" ? "stat-up" : tx.type === "redeemed" ? "stat-down" : "text-amber-400"}`}>
                              {tx.type === "earned" ? "+" : "-"}{tx.points.toLocaleString()} pts
                            </span>
                            {tx.redeemValue && <p className="text-[10px] text-muted-foreground">≈ AED {tx.redeemValue.toFixed(2)}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {tab === "discount" && (
        <>
          {/* Dashboard filter row */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1"><Filter className="w-4 h-4 text-muted-foreground"/><span className="text-sm font-medium text-foreground">Discount Savings Dashboard</span></div>
            <div className="flex gap-2 flex-wrap">
              <select value={dashFilter.cardId} onChange={e=>setDashFilter(f=>({...f,cardId:e.target.value}))} className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground">
                <option value="all">All Cards</option>
                {discountCards.map(dc=><option key={dc.id} value={dc.id}>{dc.name}</option>)}
              </select>
              {["this_month","last_month","week","6months","1year","all_time","custom"].map(p=>(
                <button key={p} onClick={()=>setDashFilter(f=>({...f,period:p}))} className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${dashFilter.period===p?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground"}`}>
                  {p==="this_month"?"This Month":p==="last_month"?"Last Month":p==="week"?"This Week":p==="6months"?"6 Months":p==="1year"?"1 Year":p==="all_time"?"All Time":"Custom"}
                </button>
              ))}
              {dashFilter.period==="custom"&&(
                <div className="flex items-center gap-1.5">
                  <Input type="date" value={dashFilter.customFrom} onChange={e=>setDashFilter(f=>({...f,customFrom:e.target.value}))} className="h-8 text-xs w-36 bg-background border-border"/>
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input type="date" value={dashFilter.customTo} onChange={e=>setDashFilter(f=>({...f,customTo:e.target.value}))} className="h-8 text-xs w-36 bg-background border-border"/>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="bg-secondary/40 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Saved</p>
                <p className="text-xl font-bold stat-up">AED {totalSaved.toFixed(2)}</p>
              </div>
              <div className="bg-secondary/40 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Transactions</p>
                <p className="text-xl font-bold text-foreground">{getFilteredUsages.length}</p>
              </div>
              <div className="bg-secondary/40 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Avg Saving</p>
                <p className="text-xl font-bold text-foreground">AED {getFilteredUsages.length>0?(totalSaved/getFilteredUsages.length).toFixed(2):"0.00"}</p>
              </div>
            </div>
            {getFilteredUsages.length>0&&(
              <div className="space-y-1 max-h-36 overflow-y-auto">
                <p className="text-xs text-muted-foreground font-medium">Recent Discount Usage</p>
                {[...getFilteredUsages].reverse().slice(0,10).map(u=>{
                  const dc = discountCards.find(d=>d.id===u.dcId);
                  return (<div key={u.id} className="flex items-center justify-between py-1 border-b border-border/40 last:border-0 text-xs">
                    <div><p className="text-foreground">{u.description||dc?.name||"Discount"}</p><p className="text-muted-foreground">{u.date} · {dc?.name}</p></div>
                    <div className="text-right">
                      <p className="stat-up font-semibold">Saved AED {u.saved.toFixed(2)}</p>
                      <p className="text-muted-foreground">AED {u.originalAmount.toFixed(0)} → {u.discountedAmount.toFixed(0)}</p>
                    </div>
                  </div>);
                })}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <StatCard title="Discount Cards" value={discountCards.length.toString()} icon={CreditCard} />
            <StatCard title="Avg Discount" value={discountCards.length > 0 ? `${(discountCards.reduce((s, d) => s + d.defaultDiscount, 0) / discountCards.length).toFixed(0)}%` : "0%"} icon={Percent} />
            <StatCard title="Lifetime Saved" value={`AED ${discountUsages.reduce((s,u)=>s+u.saved,0).toFixed(2)}`} icon={Tag} changeType="up" />
          </div>

          {discountCards.length === 0 && (
            <div className="glass-card p-12 text-center">
              <CreditCard className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground">No discount cards yet.</p>
              <p className="text-muted-foreground/60 text-xs mt-1">Add Fazaa, Esaad, Icare and other discount cards.</p>
              <Button className="mt-4 gap-2" onClick={openAddDC}><Plus className="w-4 h-4" />Add First Card</Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {discountCards.map((dc, i) => (
              <motion.div key={dc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="glass-card overflow-hidden">
                <div className="p-4" style={{ borderLeftColor: dc.color, borderLeftWidth: 4 }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{dc.name}</p>
                      <p className="text-xs text-muted-foreground">{dc.provider} · {dc.type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-lg font-bold stat-up">{dc.defaultDiscount}{dc.discountType === "percentage" ? "%" : " AED"}</p>
                        <p className="text-[10px] text-muted-foreground">discount{dc.maxDiscount ? ` · cap AED ${dc.maxDiscount}` : ""}</p>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={()=>{setUsageDcId(dc.id);setUsageForm({date:new Date().toISOString().slice(0,10),originalAmount:"",discountedAmount:"",description:"",cardId:dc.id});setUsageOpen(true);}}><Plus className="w-3 h-3"/>Log Use</Button>
                      <button onClick={() => openEditDC(dc)} className="text-muted-foreground hover:text-foreground p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteDiscountCard(dc.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  {dc.cardNumber && <p className="text-xs text-muted-foreground mt-1">Card: {dc.cardNumber}{dc.expiryDate ? ` · Exp: ${dc.expiryDate}` : ""}</p>}
                  {dc.applicableCategories && dc.applicableCategories.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-2">
                      {dc.applicableCategories.map(cat => <span key={cat} className="text-[10px] px-1.5 py-0.5 bg-secondary rounded">{cat}</span>)}
                    </div>
                  )}
                  {(() => { const usages = discountUsages.filter(u=>u.dcId===dc.id); const saved = usages.reduce((s,u)=>s+u.saved,0); return saved>0 ? <p className="text-xs stat-up mt-1">💰 Total saved: AED {saved.toFixed(2)} across {usages.length} uses</p> : null; })()}
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Add/Edit Program Dialog */}
      <Dialog open={progOpen} onOpenChange={setProgOpen}>
        <DialogContent className="w-full sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>{editProg ? "Edit" : "Add"} Loyalty Program</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Program Name</Label><Input placeholder="e.g. Emirates Skywards" value={progForm.name} onChange={e => setProgForm(f => ({ ...f, name: e.target.value }))} className="bg-background border-border" /></div>
              <div className="space-y-1.5"><Label>Provider</Label>
                <Select value={progForm.provider} onValueChange={v => setProgForm(f => ({ ...f, provider: v }))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select provider" /></SelectTrigger>
                  <SelectContent>{PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Current Points</Label><Input type="number" placeholder="0" value={progForm.pointsBalance} onChange={e => setProgForm(f => ({ ...f, pointsBalance: e.target.value }))} className="bg-background border-border" /></div>
              <div className="space-y-1.5"><Label>AED per Point</Label><Input type="number" placeholder="0.01" step="0.001" value={progForm.pointsValue} onChange={e => setProgForm(f => ({ ...f, pointsValue: e.target.value }))} className="bg-background border-border" /></div>
              <div className="space-y-1.5"><Label>Currency</Label><Input value={progForm.currency} onChange={e => setProgForm(f => ({ ...f, currency: e.target.value }))} className="bg-background border-border" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Expiry Date (optional)</Label><Input type="date" value={progForm.expiryDate} onChange={e => setProgForm(f => ({ ...f, expiryDate: e.target.value }))} className="bg-background border-border" /></div>
              <div className="space-y-1.5"><Label>Earn Rate <span className="text-muted-foreground text-xs">(pts/AED)</span></Label><Input type="number" step="0.1" placeholder="e.g. 1.5" value={progForm.earnRate} onChange={e => setProgForm(f => ({ ...f, earnRate: e.target.value }))} className="bg-background border-border" /></div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={progForm.autoDetect} onCheckedChange={v => setProgForm(f => ({ ...f, autoDetect: v }))} />
              <Label>Auto-detect transactions</Label>
            </div>
            {progForm.autoDetect && <div className="p-2 bg-primary/10 rounded-lg text-xs text-primary">🤖 Points auto-calculated from earn rate when linked to CC transactions</div>}
            <div className="space-y-1.5"><Label>Color</Label>
              <div className="flex gap-2">{PROGRAM_COLORS.map(c => <button key={c} onClick={() => setProgForm(f => ({ ...f, color: c }))} className="w-7 h-7 rounded-full border-2 transition-all" style={{ backgroundColor: c, borderColor: progForm.color === c ? "white" : "transparent" }} />)}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProgOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveProg} disabled={!progForm.name}>{editProg ? "Save Changes" : "Add Program"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Earn Points Dialog */}
      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Add Points Activity</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["earned", "redeemed", "expired"] as const).map(t => (
                  <button key={t} onClick={() => setTxForm(f => ({ ...f, type: t }))} className={`py-2 rounded-lg text-xs border transition-all capitalize ${txForm.type === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{t}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Points</Label><Input type="number" placeholder="1000" value={txForm.points} onChange={e => setTxForm(f => ({ ...f, points: e.target.value }))} className="bg-background border-border" /></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={txForm.date} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))} className="bg-background border-border" /></div>
            </div>
            <div className="space-y-1.5"><Label>Description</Label><Input placeholder="e.g. Flight booking reward" value={txForm.description} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} className="bg-background border-border" /></div>
            {txForm.type === "redeemed" && (
              <div className="space-y-1.5"><Label>Redemption Method</Label>
                <Select value={txForm.redeemMethod || ""} onValueChange={v => setTxForm(f => ({ ...f, redeemMethod: v as any }))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>{REDEEM_METHODS.map(m => <SelectItem key={m.value as string} value={m.value as string}>{m.icon} {m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTx} disabled={!txForm.points}>Add Activity</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redeem Dialog */}
      <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Redeem Points — {loyaltyPrograms.find(p => p.id === redeemProgId)?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Redemption Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {REDEEM_METHODS.map(m => (
                  <button key={m.value as string} onClick={() => setRedeemForm(f => ({ ...f, method: m.value }))} className={`py-2 px-3 rounded-lg text-xs border transition-all text-left flex items-center gap-1.5 ${redeemForm.method === m.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                    <span>{m.icon}</span><span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Points to Redeem</Label><Input type="number" value={redeemForm.points} onChange={e => setRedeemForm(f => ({ ...f, points: e.target.value }))} placeholder="e.g. 5000" className="bg-background border-border" /></div>
              <div className="space-y-1.5"><Label>AED Value (opt.)</Label><Input type="number" value={redeemForm.value} onChange={e => setRedeemForm(f => ({ ...f, value: e.target.value }))} placeholder="Auto-calc" className="bg-background border-border" /></div>
            </div>
            {redeemForm.method === "account_credit" && (
              <div className="space-y-1.5"><Label>Credit to Account</Label>
                <Select value={redeemForm.accountId} onValueChange={v => setRedeemForm(f => ({ ...f, accountId: v }))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5"><Label>Description</Label><Input value={redeemForm.description} onChange={e => setRedeemForm(f => ({ ...f, description: e.target.value }))} className="bg-background border-border" /></div>
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={redeemForm.date} onChange={e => setRedeemForm(f => ({ ...f, date: e.target.value }))} className="bg-background border-border" /></div>
            {redeemForm.points && (
              <div className="p-3 bg-primary/10 rounded-lg text-xs text-primary">
                Redeeming {parseFloat(redeemForm.points).toLocaleString()} pts ≈ AED {redeemForm.value || ((parseFloat(redeemForm.points) || 0) * (loyaltyPrograms.find(p => p.id === redeemProgId)?.pointsValue || 0)).toFixed(2)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedeemOpen(false)}>Cancel</Button>
            <Button onClick={handleRedeem} disabled={!redeemForm.points}>Redeem Points</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Discount Usage Dialog */}
      <Dialog open={usageOpen} onOpenChange={setUsageOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Log Discount Usage — {discountCards.find(d=>d.id===usageDcId)?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Original Price (AED)</Label><Input type="number" placeholder="100" value={usageForm.originalAmount} onChange={e=>setUsageForm(f=>({...f,originalAmount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Amount Paid (AED)</Label><Input type="number" placeholder="80" value={usageForm.discountedAmount} onChange={e=>setUsageForm(f=>({...f,discountedAmount:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            {usageForm.originalAmount && usageForm.discountedAmount && (
              <div className="p-2 bg-primary/10 rounded-lg text-xs text-primary">
                💰 You saved: AED {(parseFloat(usageForm.originalAmount||"0")-parseFloat(usageForm.discountedAmount||"0")).toFixed(2)}
                {" "}({((1-parseFloat(usageForm.discountedAmount||"0")/parseFloat(usageForm.originalAmount||"1"))*100).toFixed(1)}% off)
              </div>
            )}
            <div className="space-y-1.5"><Label>Description (optional)</Label><Input placeholder="e.g. Dinner at Nobu" value={usageForm.description} onChange={e=>setUsageForm(f=>({...f,description:e.target.value}))} className="bg-background border-border"/></div>
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={usageForm.date} onChange={e=>setUsageForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setUsageOpen(false)}>Cancel</Button>
            <Button onClick={handleAddUsage} disabled={!usageForm.originalAmount}>Log Saving</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Discount Card Dialog */}
      <Dialog open={dcOpen} onOpenChange={setDcOpen}>
        <DialogContent className="w-full sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>{editDC ? "Edit" : "Add"} Discount Card</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Card Name</Label><Input value={dcForm.name} onChange={e => setDcForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Fazaa" className="bg-background border-border" /></div>
              <div className="space-y-1.5"><Label>Provider</Label><Input value={dcForm.provider} onChange={e => setDcForm(f => ({ ...f, provider: e.target.value }))} placeholder="e.g. UAE Federal Authority" className="bg-background border-border" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Card Type</Label>
                <Select value={dcForm.type} onValueChange={v => setDcForm(f => ({ ...f, type: v as any }))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="membership">Membership</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Discount Type</Label>
                <Select value={dcForm.discountType} onValueChange={v => setDcForm(f => ({ ...f, discountType: v as any }))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">% Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed AED</SelectItem>
                    <SelectItem value="tiered">Tiered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Discount ({dcForm.discountType === "percentage" ? "%" : "AED"})</Label><Input type="number" value={dcForm.defaultDiscount} onChange={e => setDcForm(f => ({ ...f, defaultDiscount: e.target.value }))} placeholder="10" className="bg-background border-border" /></div>
              <div className="space-y-1.5"><Label>Max Cap (AED, optional)</Label><Input type="number" value={dcForm.maxDiscount} onChange={e => setDcForm(f => ({ ...f, maxDiscount: e.target.value }))} placeholder="500" className="bg-background border-border" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Card Number (optional)</Label><Input value={dcForm.cardNumber} onChange={e => setDcForm(f => ({ ...f, cardNumber: e.target.value }))} className="bg-background border-border" /></div>
              <div className="space-y-1.5"><Label>Expiry Date (optional)</Label><Input type="date" value={dcForm.expiryDate} onChange={e => setDcForm(f => ({ ...f, expiryDate: e.target.value }))} className="bg-background border-border" /></div>
            </div>
            <div className="space-y-1.5"><Label>Color</Label>
              <div className="flex gap-2">{DC_COLORS.map(c => <button key={c} onClick={() => setDcForm(f => ({ ...f, color: c }))} className="w-7 h-7 rounded-full border-2 transition-all" style={{ backgroundColor: c, borderColor: dcForm.color === c ? "white" : "transparent" }} />)}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDcOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveDC} disabled={!dcForm.name}>{editDC ? "Save Changes" : "Add Card"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
