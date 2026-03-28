import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CreditCard, Plus, Trash2, Edit2, Sparkles, Gift, ArrowDownToLine, Star, Info, RefreshCw } from "lucide-react";
import { useDB, CreditCard as CCType, CardCashbackRule, CardRepayment, CardTransaction } from "@/lib/database";
import { SearchFilter, EMPTY_FILTER, matchesFilter, SearchFilterState } from "@/components/ui/search-filter";

const CARD_COLORS = ["from-amber-500 to-orange-600","from-violet-500 to-purple-700","from-slate-600 to-slate-800","from-emerald-500 to-teal-600","from-rose-500 to-pink-600","from-blue-500 to-indigo-600","from-yellow-400 to-amber-500","from-cyan-500 to-blue-600"];
const CATEGORIES = ["Dining","Groceries","Transport","Shopping","Utilities","Fuel","Travel","Entertainment","Healthcare","Education","Government","Telecom","Other"];
const REPAY_METHODS: {value: CardRepayment["method"], label: string, icon: string}[] = [
  { value:"bank_account", label:"Bank Account Transfer", icon:"🏦" },
  { value:"cash", label:"Cash at Branch / ATM", icon:"💵" },
  { value:"other_card", label:"Other Credit Card", icon:"💳" },
  { value:"cashback", label:"Cashback Redemption", icon:"💰" },
  { value:"loyalty_points", label:"Loyalty / Reward Points", icon:"⭐" },
  { value:"cheque", label:"Cheque", icon:"📄" },
  { value:"standing_order", label:"Standing Order / Auto-Debit", icon:"🔄" },
];
const CASHBACK_PRESETS: Record<string, CardCashbackRule[]> = {
  mashreq: [
    { category:"Dining", rate:5, description:"All Dining 5%" },
    { category:"international_other", rate:1, description:"Other Int'l Spends 1%" },
    { category:"local_general", rate:1, description:"Local Spends 1%" },
    { category:"Government", rate:0.33, description:"Government 0.33%" },
    { category:"Utilities", rate:0.33, description:"Utilities 0.33%" },
    { category:"Fuel", rate:0.33, description:"Fuel 0.33%" },
    { category:"Telecom", rate:0.33, description:"Telecom 0.33%" },
  ],
  liv_tiered: [
    { category:"tier_10000_plus", rate:2.5, description:"AED 10,000+ spend @ 2.5%", tierType:"tiered", minSpend:10000, maxMonthly:750 },
    { category:"tier_5000_9999", rate:1.5, description:"AED 5,000-9,999 @ 1.5%", tierType:"tiered", minSpend:5000, maxMonthly:750 },
    { category:"tier_0_4999", rate:0.75, description:"AED 0-4,999 @ 0.75%", tierType:"tiered", minSpend:0, maxMonthly:750 },
    { category:"low_merchant", rate:0.1, description:"Low-category merchants 0.1%" },
  ],
  tabby_plus: [
    { category:"Shopping", rate:5, description:"Selected shopping 5% cashback" },
    { category:"Other", rate:0, description:"Split in 4, exclusive partner deals" },
  ],
  flat_1: [{ category:"All", rate:1, description:"1% cashback on all spends" }],
  flat_1_5: [{ category:"All", rate:1.5, description:"1.5% cashback on all spends" }],
  miles_1_5: [{ category:"All", rate:1.5, description:"1.5 miles per AED spent" }],
  none: [],
};

const EMPTY_CARD = { name:"", issuer:"", last4:"", limit:"", balance:"", minPayment:"", dueDate:"", statementDate:"", color:CARD_COLORS[0], cashbackType:"none" };
interface TxFormData {
  date: string;
  description: string;
  amount: string;
  category: string;
  isInstallment: boolean;
  installmentMonths: string;
  installmentFee: string;
  installmentInterestRate: string;
  redeemPoints: boolean;
  redeemPointsProgId: string;
  redeemPointsAmt: string;
  earnLoyaltyProgramId: string;
  earnLoyaltyPointsManual: string;
}

const EMPTY_TX: TxFormData = { 
  date:new Date().toISOString().slice(0,10), 
  description:"", 
  amount:"", 
  category:"Shopping", 
  isInstallment:false, 
  installmentMonths:"", 
  installmentFee:"", 
  installmentInterestRate:"", 
  redeemPoints:false, 
  redeemPointsProgId:"", 
  redeemPointsAmt:"", 
  earnLoyaltyProgramId:"", 
  earnLoyaltyPointsManual:"" 
};
const EMPTY_REPAY = { date:new Date().toISOString().slice(0,10), amount:"", method:"bank_account" as CardRepayment["method"], sourceAccountId:"", notes:"" };
const todayStr = new Date().toISOString().slice(0,10);

function calcUtilization(card: CCType) {
  const spent = card.transactions.reduce((s,t)=>s+t.amount,0);
  const repaid = (card.repayments || []).reduce((s,r)=>s+r.amount,0);

const rawBalance = -spent;
const balance = Object.is(rawBalance, -0) ? 0 : rawBalance;

  return {
    balance,
    pct: card.limit>0 ? Math.min(100,(balance/card.limit)*100) : 0
  };
}

// Category aliases: if a transaction's category matches any alias, it counts for the rule
const CAT_ALIASES: Record<string,string[]> = {
  "dining": ["food","dining","food & dining","restaurant","restaurants","cafe","coffee","fast food","takeaway","delivery"],
  "food": ["food","dining","food & dining","restaurant","restaurants","cafe","coffee","fast food"],
  "food & dining": ["food","dining","food & dining","restaurant","restaurants","cafe","coffee","fast food","takeaway"],
  "restaurants": ["food","dining","food & dining","restaurant","restaurants"],
  "groceries": ["groceries","grocery","supermarket","hypermarket","lulu","carrefour","spinneys"],
  "shopping": ["shopping","retail","fashion","clothes","electronics"],
  "transport": ["transport","transportation","uber","taxi","careem","fuel","petrol","salik","toll"],
  "fuel": ["fuel","petrol","gas station","enoc","adnoc","eppco"],
  "utilities": ["utilities","utility","dewa","sewa","addc","electricity","water"],
  "telecom": ["telecom","telecommunications","du","etisalat","e&","phone","internet"],
  "travel": ["travel","airlines","hotel","hotels","booking","airfare"],
  "entertainment": ["entertainment","movies","cinema","vox","reel"],
  "healthcare": ["healthcare","health","medical","pharmacy","hospital","clinic"],
  "education": ["education","school","university","tuition"],
  "government": ["government","government fees","fines","rta","dubai police"],
};
function catMatches(ruleCategory: string, txCategory: string): boolean {
  const r = ruleCategory.toLowerCase();
  const t = txCategory.toLowerCase();
  if (r === t) return true;
  const aliases = CAT_ALIASES[r];
  if (aliases && aliases.includes(t)) return true;
  return false;
}

function calcMonthlyCashback(card: CCType, txs: Array<{amount:number,category:string}>) {
  const rules = card.cashbackRules||[];
  if (!rules.length) return 0;
  const totalSpend = txs.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
  if (card.cashbackType==="liv_tiered") {
    const tier = rules.filter(r=>r.tierType==="tiered"&&r.minSpend!==undefined).sort((a,b)=>(b.minSpend||0)-(a.minSpend||0)).find(r=>totalSpend>=(r.minSpend||0));
    if (!tier) return 0;
    return Math.min(totalSpend*tier.rate/100, tier.maxMonthly||999999);
  }
  return txs.filter(t=>t.amount<0).reduce((s,t)=>{
    const rule = rules.find(r=>catMatches(r.category, t.category))||rules.find(r=>r.category==="All");
    if (!rule) return s;
    return s+Math.abs(t.amount)*rule.rate/100;
  },0);
}

export default function CreditCards() {
  const { creditCards, accounts, loyaltyPrograms, addCreditCard, updateCreditCard, addCardTransaction, updateCardTransaction, deleteCardTransaction, addCardRepayment, deleteCardRepayment, deleteCreditCard, addLoyaltyTx , getAccountBalance} = useDB();
  const [activeView, setActiveView] = useState<"cards"|"cashback">("cards");
  const [filter, setFilter] = useState<SearchFilterState>(EMPTY_FILTER);
  const [cardTab, setCardTab] = useState<Record<string,"transactions"|"repayments">>({});
  const [cardOpen, setCardOpen] = useState(false);
  const [editCard, setEditCard] = useState<CCType|null>(null);
  const [cardForm, setCardForm] = useState(EMPTY_CARD);
  const [customRules, setCustomRules] = useState<CardCashbackRule[]>([]);
  const [txDialogCardId, setTxDialogCardId] = useState("");
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<any>(null);
  const [txForm, setTxForm] = useState<TxFormData>(EMPTY_TX);
  const [repayOpen, setRepayOpen] = useState(false);
  const [repayCardId, setRepayCardId] = useState("");
  const [repayForm, setRepayForm] = useState(EMPTY_REPAY);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesCardId, setRulesCardId] = useState("");
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0,7));

  const totalLimit = creditCards.reduce((s,c)=>s+c.limit,0);
  const totalBalance = creditCards.reduce((s,c)=>s+calcUtilization(c).balance,0);
  const totalCashbackBal = creditCards.reduce((s,c)=>s+(c.cashbackBalance||0),0);
  const thisMonthCashback = useMemo(()=>creditCards.reduce((s,c)=>{
    const txs=c.transactions.filter(t=>t.date.slice(0,7)===monthFilter);
    return s+calcMonthlyCashback(c,txs);
  },0),[creditCards,monthFilter]);

  const openCardAdd = () => { setEditCard(null); setCardForm(EMPTY_CARD); setCustomRules([]); setCardOpen(true); };
  const openCardEdit = (c: CCType) => { setEditCard(c); setCardForm({ name:c.name, issuer:c.issuer, last4:c.last4, limit:String(c.limit), balance:String(c.balance), minPayment:String(c.minPayment), dueDate:c.dueDate, statementDate:c.statementDate, color:c.color, cashbackType:c.cashbackType }); setCustomRules(c.cashbackRules||[]); setCardOpen(true); };
  const handleSaveCard = () => {
    if (!cardForm.name) return;
    const rules = cardForm.cashbackType==="custom" ? customRules : (CASHBACK_PRESETS[cardForm.cashbackType]||[]);
    const data = { name:cardForm.name, issuer:cardForm.issuer, last4:cardForm.last4, limit:parseFloat(cardForm.limit)||0, balance:parseFloat(cardForm.balance)||0, minPayment:parseFloat(cardForm.minPayment)||0, dueDate:cardForm.dueDate, statementDate:cardForm.statementDate, color:cardForm.color, cashbackType:cardForm.cashbackType, cashbackRules:rules };
    if (editCard) updateCreditCard(editCard.id, data); else addCreditCard(data);
    setCardOpen(false);
  };

  const openTxDialog = (cardId: string, tx?: CardTransaction) => { 
    setTxDialogCardId(cardId); 
    setEditingTx(tx||null); 
    setTxForm(tx ? { 
      date:tx.date, 
      description:tx.description, 
      amount:String(Math.abs(tx.amount)), 
      category:tx.category, 
      isInstallment:!!tx.isInstallment, 
      installmentMonths:String(tx.installmentMonths||""), 
      installmentFee:String(tx.installmentFee||""),
      installmentInterestRate:String(tx.installmentInterestRate||""),
      redeemPoints:false, 
      redeemPointsProgId:"", 
      redeemPointsAmt:"", 
      earnLoyaltyProgramId:tx.earnLoyaltyProgramId||"", 
      earnLoyaltyPointsManual:"" 
    } : EMPTY_TX); 
    setTxDialogOpen(true); 
  };
  const handleSaveTx = () => {
    const amount = parseFloat(txForm.amount);
    if (!txForm.description||isNaN(amount)||!txDialogCardId) return;
    const txData: any = {
      date:txForm.date, description:txForm.description, amount:-Math.abs(amount), category:txForm.category,
      isInstallment:txForm.isInstallment,
      installmentMonths:txForm.isInstallment?parseInt(txForm.installmentMonths)||0:undefined,
      installmentFee:txForm.isInstallment?parseFloat(txForm.installmentFee)||0:undefined,
      installmentInterestRate:txForm.isInstallment?parseFloat(txForm.installmentInterestRate)||0:undefined,
      earnLoyaltyProgramId:txForm.earnLoyaltyProgramId||undefined,
    };
    if (editingTx) updateCardTransaction(txDialogCardId, editingTx.id, txData);
    else addCardTransaction(txDialogCardId, txData);
    if (txForm.redeemPoints && txForm.redeemPointsProgId && txForm.redeemPointsAmt) {
      const pts = parseFloat(txForm.redeemPointsAmt)||0;
      if (pts>0) addLoyaltyTx(txForm.redeemPointsProgId, { date:txForm.date, points:pts, type:"redeemed", description:`Redeemed for ${txForm.description}`, redeemMethod:"purchase" });
    }
    // Earn loyalty points at purchase time
    if (txForm.earnLoyaltyProgramId) {
      const prog = loyaltyPrograms.find(p=>p.id===txForm.earnLoyaltyProgramId);
      const manualPts = parseFloat(txForm.earnLoyaltyPointsManual||"");
      const autoPts = (prog?.earnRate && !manualPts) ? Math.floor(Math.abs(amount) * prog.earnRate) : 0;
      const pts = manualPts > 0 ? manualPts : autoPts;
      if (pts>0) addLoyaltyTx(txForm.earnLoyaltyProgramId, { date:txForm.date, points:pts, type:"earned", description:`Earned on: ${txForm.description}` });
    }
    // Auto-earn cashback per transaction (not just monthly)
    if (!editingTx) {
      const card = creditCards.find(c => c.id === txDialogCardId);
      if (card && card.cashbackType !== "none" && card.cashbackType !== "liv_tiered") {
        const rules = card.cashbackRules || [];
        const rule = rules.find(r => catMatches(r.category, txForm.category)) || rules.find(r => r.category === "All");
        if (rule && rule.rate > 0) {
          const earned = Math.abs(amount) * rule.rate / 100;
          if (earned > 0) updateCreditCard(txDialogCardId, { cashbackBalance: (card.cashbackBalance || 0) + earned });
        }
      }
    }
    setTxDialogOpen(false);
  };

  const openRepay = (cardId: string) => { setRepayCardId(cardId); const card=creditCards.find(c=>c.id===cardId); const util=card?calcUtilization(card):{balance:0}; setRepayForm({...EMPTY_REPAY,amount:String(util.balance)}); setRepayOpen(true); };
const handleRepay = () => {
  const amt = parseFloat(repayForm.amount);
  if (!amt || !repayCardId) return;

  // 1. Add repayment record (for history)
  addCardRepayment({
    cardId: repayCardId,
    date: repayForm.date,
    amount: amt,
    method: repayForm.method,
    sourceAccountId: repayForm.method==="bank_account" ? repayForm.sourceAccountId : undefined,
    sourceCardId: repayForm.method==="other_card" ? repayForm.sourceAccountId : undefined,
    notes: repayForm.notes || undefined
  });

  // 2. 🔥 ALSO add as a positive transaction
  addCardTransaction(repayCardId, {
    date: repayForm.date,
    description: "Card Repayment",
    amount: amt, // positive!
    category: "Payment"
  });

  setRepayOpen(false);
};

  const handleEarnCashback = (cardId: string) => {
    const card = creditCards.find(c=>c.id===cardId); if(!card) return;
    const txs = card.transactions.filter(t=>t.date.slice(0,7)===monthFilter);
    const earned = calcMonthlyCashback(card,txs);
    if (earned>0) updateCreditCard(cardId,{cashbackBalance:(card.cashbackBalance||0)+earned});
  };

  const getTab = (id: string) => cardTab[id]||"transactions";

  return (
    <div className="space-y-6">
      <PageHeader title="Credit Cards" subtitle={`${creditCards.length} cards`}
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-border text-xs">
              <button onClick={()=>setActiveView("cards")} className={`px-3 py-1.5 ${activeView==="cards"?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>Cards</button>
              <button onClick={()=>setActiveView("cashback")} className={`px-3 py-1.5 ${activeView==="cashback"?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>Cashback & Loyalty</button>
            </div>
            <Button className="gap-2" onClick={openCardAdd}><Plus className="w-4 h-4"/>Add Card</Button>
          </div>
        }/>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Limit" value={`AED ${totalLimit.toLocaleString()}`} icon={CreditCard}/>
        <StatCard title="Total Used" value={`AED ${totalBalance.toLocaleString()}`} icon={CreditCard} changeType={totalBalance>totalLimit*0.3?"down":"up"}/>
        <StatCard title="Est. Cashback" value={`AED ${thisMonthCashback.toFixed(2)}`} icon={Gift} changeType="up"/>
        <StatCard title="Cashback Balance" value={`AED ${totalCashbackBal.toFixed(2)}`} icon={Star} changeType="up"/>
      </div>

      <SearchFilter value={filter} onChange={setFilter} placeholder="Search cards…" />


{/* CREDITCARD RENDER */}


      {activeView==="cashback" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Month:</span>
            <input type="month" value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} className="text-xs bg-secondary border border-border rounded-md px-2 py-1.5 text-foreground"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {creditCards.map((card,i)=>{


  const today = new Date();
  const due = card.dueDate ? new Date(card.dueDate) : null;

  // ✅ REPLACE your old isDueSoon/isOverdue with THIS
  const daysLeft = due
    ? Math.ceil((due.getTime() - today.getTime()) / (1000*60*60*24))
    : null;

  const isOverdue = daysLeft !== null && daysLeft < 0;
  const isDueSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;


              const txs = card.transactions.filter(t=>t.date.slice(0,7)===monthFilter);
              const earned = calcMonthlyCashback(card,txs);
              const balance = card.cashbackBalance||0;
              const monthSpend = txs.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
              console.log("CARD DEBUG", card.transactions, card.repayments);
              return (
                <div key={card.id} className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    {/* <div><p className="font-semibold text-sm">{card.name}</p><p className="text-xs text-muted-foreground">{card.cashbackType}</p></div> */}
                    <div className="text-right"><p className="text-lg font-bold stat-up">AED {earned.toFixed(2)}</p><p className="text-xs text-muted-foreground">this month</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-secondary/40 rounded-lg p-2 text-center"><p className="text-[10px] text-muted-foreground">CB Balance</p><p className="text-sm font-bold stat-up">AED {balance.toFixed(2)}</p></div>
                    <div className="bg-secondary/40 rounded-lg p-2 text-center"><p className="text-[10px] text-muted-foreground">Month Spend</p><p className="text-sm font-bold">AED {monthSpend.toLocaleString()}</p></div>
                  </div>
                  {(card.cashbackRules||[]).slice(0,3).map((r,ri)=>(
                    <div key={ri} className="flex justify-between text-xs py-0.5"><span className="text-muted-foreground truncate">{r.description||`${r.category}: ${r.rate}%`}</span><span className="font-medium ml-2">{r.rate}%</span></div>
                  ))}
                  <div className="flex gap-2 mt-3">
                    {card.cashbackType === "liv_tiered" && earned>0&&<Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={()=>handleEarnCashback(card.id)}><Plus className="w-3 h-3"/>Earn AED {earned.toFixed(2)}</Button>}
                    {balance>0&&<Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 text-primary" onClick={()=>openRepay(card.id)}><RefreshCw className="w-3 h-3"/>Redeem</Button>}
                  </div>
                </div>
              );
            })}
          </div>
          {loyaltyPrograms.length>0 && (
            <div className="glass-card p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-amber-400"/>Loyalty Programs</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {loyaltyPrograms.map(lp=>(
                  <div key={lp.id} className="bg-secondary/40 rounded-lg p-3">
                    <p className="text-sm font-semibold">{lp.name}</p>
                    <p className="text-xs text-muted-foreground">{lp.provider}</p>
                    <p className="text-lg font-bold text-primary mt-1">{lp.pointsBalance.toLocaleString()} pts</p>
                    <p className="text-xs text-muted-foreground">AED {(lp.pointsBalance*(lp.pointsValue||0)).toFixed(2)} value</p>
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {["Cashback","Purchase","Miles","Account Credit"].map(opt=>(
                        <span key={opt} className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground">{opt}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeView==="cards" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Month:</span>
            <input type="month" value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} className="text-xs bg-secondary border border-border rounded-md px-2 py-1 text-foreground"/>
          </div>
          {creditCards.length===0 && <div className="p-8 text-center text-muted-foreground glass-card text-sm">No credit cards added.</div>}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {creditCards.filter(c => !filter.query || c.name.toLowerCase().includes(filter.query.toLowerCase()) || c.last4?.includes(filter.query) || c.issuer?.toLowerCase().includes(filter.query.toLowerCase())).map((card,i)=>{
              const util = calcUtilization(card);
              const monthTxs = card.transactions.filter(t=>t.date.slice(0,7)===monthFilter);
              const monthlyCashback = calcMonthlyCashback(card,monthTxs);
              const repayments = card.repayments||[];
              const tab = getTab(card.id);
             
             
              return (
                <motion.div key={card.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.1}} className="glass-card overflow-hidden">
                  <div className={`bg-gradient-to-r ${card.color} p-5`}>
                    {/* <p className="text-white font-display font-bold text-lg">{card.name}</p> */}




                    <div className="flex items-start justify-between">
                      <div><p className="text-white/70 text-xs mb-0.5">
  {card.issuer}
</p>

<p className="text-white font-display font-bold text-lg">
  {card.name}
</p>

<p className="text-white/60 text-xs mt-1">
  •••• •••• •••• {card.last4}
</p></div>
                      <div className="flex gap-1.5">
                        <button onClick={()=>openRepay(card.id)} className="bg-white/20 hover:bg-white/30 text-white rounded-lg p-1.5" title="Repay"><ArrowDownToLine className="w-3.5 h-3.5"/></button>
                        <button onClick={()=>{setRulesCardId(card.id);setRulesOpen(true);}} className="bg-white/20 hover:bg-white/30 text-white rounded-lg p-1.5" title="Policy"><Sparkles className="w-3.5 h-3.5"/></button>
                        <button onClick={()=>openCardEdit(card)} className="bg-white/20 hover:bg-white/30 text-white rounded-lg p-1.5"><Edit2 className="w-3.5 h-3.5"/></button>
                        <button onClick={()=>deleteCreditCard(card.id)} className="bg-white/20 hover:bg-red-500/40 text-white rounded-lg p-1.5"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <div><p className="text-white/60 text-xs">Balance Used</p><p className="text-white text-2xl font-display font-bold">AED {util.balance.toLocaleString()}</p></div>
                      <div className="text-right"><p className="text-white/60 text-xs">Limit</p><p className="text-white font-semibold">AED {card.limit.toLocaleString()}</p></div>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-white/60 text-[10px] mb-1"><span>Utilization</span><span>{util.pct.toFixed(1)}%</span></div>
                      <div className="w-full bg-white/20 rounded-full h-1.5"><div className="h-1.5 rounded-full transition-all" style={{width:`${util.pct}%`,backgroundColor:util.pct>80?"#f87171":util.pct>50?"#fbbf24":"white"}}/></div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div><p className="text-[10px] text-muted-foreground">Min Pay</p><p className="text-xs font-semibold">AED {card.minPayment}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Due</p><p className="text-xs font-semibold">{card.dueDate?card.dueDate.slice(8)+"/"+card.dueDate.slice(5,7):"—"}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Est. Cashback</p><p className="text-xs font-semibold stat-up">AED {monthlyCashback.toFixed(2)}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">CB Balance</p><p className="text-xs font-semibold stat-up">AED {(card.cashbackBalance||0).toFixed(2)}</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-lg overflow-hidden border border-border text-xs">
                        <button onClick={()=>setCardTab(p=>({...p,[card.id]:"transactions"}))} className={`px-3 py-1 ${tab==="transactions"?"bg-primary text-primary-foreground":"text-muted-foreground"}`}>Transactions</button>
                        <button onClick={()=>setCardTab(p=>({...p,[card.id]:"repayments"}))} className={`px-3 py-1 ${tab==="repayments"?"bg-primary text-primary-foreground":"text-muted-foreground"}`}>Repayments {repayments.length>0&&`(${repayments.length})`}</button>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 ml-auto" onClick={()=>openTxDialog(card.id)}><Plus className="w-3 h-3"/>Add</Button>
                    </div>
                    {tab==="transactions" && (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {monthTxs.length===0&&<p className="text-xs text-muted-foreground text-center py-3">No transactions this month</p>}
                        {monthTxs.map(tx=>(
                          <div key={tx.id} className="flex items-center justify-between py-1.5 group border-b border-border/40 last:border-0">
                            <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{tx.description}</p><p className="text-[10px] text-muted-foreground">{tx.category} · {tx.date}{tx.isInstallment?` · ${tx.installmentMonths}mo`:""}</p></div>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-semibold ${tx.amount>=0?"stat-up":"stat-down"}`}>{tx.amount>=0?"+":""}AED {Math.abs(tx.amount).toLocaleString()}</span>
                              <button onClick={()=>openTxDialog(card.id,tx)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-0.5"><Edit2 className="w-3 h-3"/></button>
                              <button onClick={()=>deleteCardTransaction(card.id,tx.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5"><Trash2 className="w-3 h-3"/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {tab==="repayments" && (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {repayments.length===0&&<p className="text-xs text-muted-foreground text-center py-3">No repayments</p>}
                        {repayments.map(r=>(
                          <div key={r.id} className="flex items-center justify-between py-1.5 group border-b border-border/40 last:border-0">
                            <div><p className="text-xs font-medium">{REPAY_METHODS.find(m=>m.value===r.method)?.label||r.method}</p><p className="text-[10px] text-muted-foreground">{r.date}{r.notes?` · ${r.notes}`:""}</p></div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold stat-up">+AED {r.amount.toLocaleString()}</span>
                              <button onClick={()=>deleteCardRepayment(card.id,r.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5"><Trash2 className="w-3 h-3"/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}










      {/* Add/Edit Card */}
      <Dialog open={cardOpen} onOpenChange={setCardOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editCard?"Edit":"Add"} Credit Card</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Card Name</Label><Input placeholder="e.g. Mashreq Neo Visa" value={cardForm.name} onChange={e=>setCardForm(f=>({...f,name:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Issuer / Bank</Label><Input placeholder="e.g. Mashreq" value={cardForm.issuer} onChange={e=>setCardForm(f=>({...f,issuer:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Last 4 Digits</Label><Input placeholder="4821" maxLength={4} value={cardForm.last4} onChange={e=>setCardForm(f=>({...f,last4:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Credit Limit</Label><Input type="number" placeholder="50000" value={cardForm.limit} onChange={e=>setCardForm(f=>({...f,limit:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Min Payment</Label><Input type="number" placeholder="500" value={cardForm.minPayment} onChange={e=>setCardForm(f=>({...f,minPayment:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Statement Date</Label><Input type="date" value={cardForm.statementDate} onChange={e=>setCardForm(f=>({...f,statementDate:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Payment Due Date</Label><Input type="date" value={cardForm.dueDate} onChange={e=>setCardForm(f=>({...f,dueDate:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5">
              <Label>Cashback / Rewards Policy</Label>
              <Select value={cardForm.cashbackType} onValueChange={v=>{ setCardForm(f=>({...f,cashbackType:v})); if(v!=="custom") setCustomRules(CASHBACK_PRESETS[v]||[]); }}>
                <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Cashback</SelectItem>
                  <SelectItem value="flat_1">Flat 1% All Spends</SelectItem>
                  <SelectItem value="flat_1_5">Flat 1.5% All Spends</SelectItem>
                  <SelectItem value="miles_1_5">Miles 1.5x per AED</SelectItem>
                  <SelectItem value="mashreq">Mashreq Neo (5% dining, tiered)</SelectItem>
                  <SelectItem value="liv_tiered">LIV Platinum (spend-tiered 0.75%–2.5%)</SelectItem>
                  <SelectItem value="tabby_plus">Tabby Plus (5% shopping)</SelectItem>
                  <SelectItem value="custom">Custom Rules</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(customRules.length>0||cardForm.cashbackType==="custom") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Rules {cardForm.cashbackType!=="custom"&&"(preview)"}</Label>
                  {cardForm.cashbackType==="custom" && <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={()=>setCustomRules(r=>[...r,{category:"Other",rate:1,description:""}])}><Plus className="w-3 h-3"/>Add Rule</Button>}
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {customRules.map((rule,ri)=>(
                    <div key={ri} className="flex items-center gap-2 bg-secondary/50 rounded-md p-2">
                      {cardForm.cashbackType==="custom" ? (
                        <>
                          <Input value={rule.category} onChange={e=>{const nr=[...customRules];nr[ri]={...nr[ri],category:e.target.value};setCustomRules(nr);}} placeholder="Category" className="h-6 text-xs bg-background border-border flex-1"/>
                          <Input type="number" value={rule.rate} onChange={e=>{const nr=[...customRules];nr[ri]={...nr[ri],rate:parseFloat(e.target.value)||0};setCustomRules(nr);}} placeholder="%" className="h-6 text-xs bg-background border-border w-16"/>
                          <Input value={rule.description||""} onChange={e=>{const nr=[...customRules];nr[ri]={...nr[ri],description:e.target.value};setCustomRules(nr);}} placeholder="Description" className="h-6 text-xs bg-background border-border w-28"/>
                          <Input type="number" value={rule.maxMonthly||""} onChange={e=>{const nr=[...customRules];nr[ri]={...nr[ri],maxMonthly:e.target.value?parseFloat(e.target.value):undefined};setCustomRules(nr);}} placeholder="Cap/mo" className="h-6 text-xs bg-background border-border w-20"/>
                          <button onClick={()=>setCustomRules(r=>r.filter((_,i)=>i!==ri))} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3"/></button>
                        </>
                      ) : (
                        <div className="flex justify-between w-full">
                          <span className="text-xs">{rule.description||`${rule.category}: ${rule.rate}%`}</span>
                          <div className="flex gap-2 text-xs"><span className="font-bold stat-up">{rule.rate}%</span>{rule.maxMonthly&&<span className="text-muted-foreground">cap {rule.maxMonthly}</span>}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1.5"><Label>Card Color</Label>
              <div className="flex gap-2 flex-wrap">{CARD_COLORS.map(c=><button key={c} onClick={()=>setCardForm(f=>({...f,color:c}))} className={`w-10 h-6 rounded-md bg-gradient-to-r ${c} border-2`} style={{borderColor:cardForm.color===c?"white":"transparent"}}/>)}</div>
            </div>
          </div>



          
          <DialogFooter>
            <Button variant="outline" onClick={()=>setCardOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCard} disabled={!cardForm.name}>{editCard?"Save Changes":"Add Card"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add TX */}
      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>{editingTx?"Edit":"Add"} Transaction</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Description</Label><Input value={txForm.description} onChange={e=>setTxForm(f=>({...f,description:e.target.value}))} className="bg-background border-border"/></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount (AED)</Label><Input type="number" value={txForm.amount} onChange={e=>setTxForm(f=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={txForm.date} onChange={e=>setTxForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>Category</Label>
              <Select value={txForm.category} onValueChange={v=>setTxForm(f=>({...f,category:v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2"><input type="checkbox" id="inst" checked={txForm.isInstallment} onChange={e=>setTxForm(f=>({...f,isInstallment:e.target.checked}))} className="rounded"/><Label htmlFor="inst" className="text-sm cursor-pointer">Installment / EMI Plan</Label></div>
            {txForm.isInstallment && (
              <div className="border border-border rounded-lg p-3 space-y-2 bg-secondary/20">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1"><Label className="text-xs">Months / Tenure</Label><Input type="number" value={txForm.installmentMonths} onChange={e=>setTxForm(f=>({...f,installmentMonths:e.target.value}))} placeholder="12" className="bg-background border-border h-8 text-xs"/></div>
                  <div className="space-y-1"><Label className="text-xs">Processing Fee (AED)</Label><Input type="number" value={txForm.installmentFee} onChange={e=>setTxForm(f=>({...f,installmentFee:e.target.value}))} placeholder="0" className="bg-background border-border h-8 text-xs"/></div>
                  <div className="space-y-1"><Label className="text-xs">Interest Rate (%)</Label><Input type="number" value={txForm.installmentInterestRate} onChange={e=>setTxForm(f=>({...f,installmentInterestRate:e.target.value}))} placeholder="0" className="bg-background border-border h-8 text-xs"/></div>
                </div>
                {txForm.installmentMonths && txForm.amount && (
                  <p className="text-[11px] text-primary">EMI ≈ AED {(((parseFloat(txForm.amount)||0)+(parseFloat(txForm.installmentFee)||0)) / (parseInt(txForm.installmentMonths)||1)).toFixed(2)}/mo · Will appear in Loans & EMI</p>
                )}
              </div>
            )}
            {loyaltyPrograms.length>0 && !editingTx && (
              <div className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="rdm" checked={txForm.redeemPoints} onChange={e=>setTxForm(f=>({...f,redeemPoints:e.target.checked}))} className="rounded"/>
                  <Label htmlFor="rdm" className="text-sm cursor-pointer flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400"/>Redeem loyalty points</Label>
                </div>
                {txForm.redeemPoints && (<>
                  <Select value={txForm.redeemPointsProgId} onValueChange={v=>setTxForm(f=>({...f,redeemPointsProgId:v}))}>
                    <SelectTrigger className="bg-background border-border text-xs h-7"><SelectValue placeholder="Select program"/></SelectTrigger>
                    <SelectContent>{loyaltyPrograms.map(lp=><SelectItem key={lp.id} value={lp.id}>{lp.name} ({lp.pointsBalance.toLocaleString()} pts)</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" value={txForm.redeemPointsAmt} onChange={e=>setTxForm(f=>({...f,redeemPointsAmt:e.target.value}))} placeholder="Points to redeem" className="bg-background border-border"/>
                </>)}
              </div>
            )}
          {loyaltyPrograms.length>0 && (
              <div className="border border-border rounded-lg p-3 space-y-2">
                <Label className="text-xs flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-amber-400"/>Earn Loyalty Points on Purchase</Label>
                <Select value={txForm.earnLoyaltyProgramId||"_none"} onValueChange={v=>setTxForm(f=>({...f,earnLoyaltyProgramId:v==="_none"?"":v}))}>
                  <SelectTrigger className="bg-background border-border text-xs h-7"><SelectValue placeholder="Select program (optional)"/></SelectTrigger>
                  <SelectContent><SelectItem value="_none">None</SelectItem>{loyaltyPrograms.map(lp=><SelectItem key={lp.id} value={lp.id}>{lp.name} ({lp.pointsBalance.toLocaleString()} pts) · {lp.earnRate||0}pts/AED</SelectItem>)}</SelectContent>
                </Select>
                {txForm.earnLoyaltyProgramId && txForm.earnLoyaltyProgramId !== "_none" && (
                  <div className="flex items-center gap-2 mt-2">
                    <Input type="number" step="1" placeholder={loyaltyPrograms.find(p=>p.id===txForm.earnLoyaltyProgramId)?.earnRate ? `Auto: ${Math.floor(Math.abs(parseFloat(txForm.amount)||0)*(loyaltyPrograms.find(p=>p.id===txForm.earnLoyaltyProgramId)?.earnRate||0))} pts` : "Enter points manually"} value={txForm.earnLoyaltyPointsManual} onChange={e=>setTxForm(f=>({...f,earnLoyaltyPointsManual:e.target.value}))} className="bg-background border-border h-7 text-xs flex-1"/>
                    <span className="text-xs text-muted-foreground">pts (leave blank for auto)</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setTxDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTx} disabled={!txForm.description||!txForm.amount}>{editingTx?"Save":"Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repayment */}
      <Dialog open={repayOpen} onOpenChange={setRepayOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Record Card Repayment</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount (AED)</Label><Input type="number" value={repayForm.amount} onChange={e=>setRepayForm(f=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={repayForm.date} onChange={e=>setRepayForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>Payment Method</Label>
              <Select value={repayForm.method} onValueChange={v=>setRepayForm(f=>({...f,method:v as CardRepayment["method"]}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                <SelectContent>{REPAY_METHODS.map(m=><SelectItem key={m.value} value={m.value}>{m.icon} {m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {repayForm.method==="bank_account" && (
              <div className="space-y-1.5"><Label>Deduct from Account</Label>
                <Select value={repayForm.sourceAccountId||"_none"} onValueChange={v=>setRepayForm(f=>({...f,sourceAccountId:v==="_none"?"":v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select account"/></SelectTrigger>
                  <SelectContent><SelectItem value="_none">Don't deduct</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {repayForm.method==="cashback" && <div className="p-2 bg-primary/10 rounded-lg text-xs text-primary flex items-center gap-2"><Info className="w-3.5 h-3.5"/>Deducts from your cashback balance (AED {(creditCards.find(c=>c.id===repayCardId)?.cashbackBalance||0).toFixed(2)} available)</div>}
            {repayForm.method==="loyalty_points" && loyaltyPrograms.length>0 && <div className="p-2 bg-amber-500/10 rounded-lg text-xs text-amber-400 flex items-center gap-2"><Star className="w-3.5 h-3.5"/>Available: {loyaltyPrograms[0].pointsBalance.toLocaleString()} pts</div>}
            <div className="space-y-1.5"><Label>Notes (optional)</Label><Input value={repayForm.notes} onChange={e=>setRepayForm(f=>({...f,notes:e.target.value}))} placeholder="e.g. Full payment" className="bg-background border-border"/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setRepayOpen(false)}>Cancel</Button>
            <Button onClick={handleRepay} disabled={!repayForm.amount}>Record Repayment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Policy Viewer */}
      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Cashback Policy — {creditCards.find(c=>c.id===rulesCardId)?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            {(creditCards.find(c=>c.id===rulesCardId)?.cashbackRules||[]).length===0 && <p className="text-xs text-muted-foreground text-center py-4">No cashback rules configured.</p>}
            {(creditCards.find(c=>c.id===rulesCardId)?.cashbackRules||[]).map((r,i)=>(
              <div key={i} className="flex items-center justify-between bg-secondary/50 rounded-md p-2.5">
                <p className="text-xs">{r.description||`${r.category}: ${r.rate}%`}</p>
                <div className="text-right"><span className="text-xs font-bold stat-up">{r.rate}%</span>{r.maxMonthly&&<p className="text-[10px] text-muted-foreground">cap AED {r.maxMonthly}/mo</p>}{r.minSpend!==undefined&&<p className="text-[10px] text-muted-foreground">min AED {r.minSpend}</p>}</div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>{ const c=creditCards.find(cc=>cc.id===rulesCardId); setRulesOpen(false); if(c) openCardEdit(c); }}>Edit Policy</Button>
            <Button onClick={()=>setRulesOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}