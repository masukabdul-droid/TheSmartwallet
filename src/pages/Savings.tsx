import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { PiggyBank, Plus, TrendingUp, Landmark, Trash2, Edit2, ChevronDown, ChevronUp, Bell, ArrowRightLeft } from "lucide-react";
import { useDB, SavingsGoal, FixedDeposit } from "@/lib/database";
import { SearchFilter, EMPTY_FILTER, matchesFilter, SearchFilterState } from "@/components/ui/search-filter";

const COLOR_OPTIONS = ["hsl(160, 84%, 39%)","hsl(200, 80%, 50%)","hsl(280, 70%, 60%)","hsl(40, 90%, 55%)","hsl(330, 70%, 55%)","hsl(0, 72%, 51%)"];
const SAVINGS_TYPES = [{ id:"regular", label:"Regular Savings" },{ id:"national_bond", label:"UAE National Bond" },{ id:"ifarmer", label:"iFarmer BD" },{ id:"wegro", label:"Wegro" },{ id:"biniyog", label:"Biniyog BD" },{ id:"other", label:"Other" }];
const ROI_TYPES = [{ id:"daily", label:"Daily Interest (auto-credit)" },{ id:"percentage", label:"Fixed %\u00a0p.a." },{ id:"monthly_fixed", label:"Monthly Interest" },{ id:"quarterly", label:"Quarterly" },{ id:"yearly", label:"Yearly" },{ id:"fixed_year", label:"Fixed Year" },{ id:"moving_roi", label:"Variable ROI" },{ id:"not_guaranteed", label:"Not Guaranteed" }];
const EMPTY_GOAL: any = { name:"", type:"regular", target:"", current:"0", monthly:"", color:COLOR_OPTIONS[0], platform:"", interestRate:"", roiType:"percentage", startDate:new Date().toISOString().slice(0,10), maturityDate:"", notes:"", linkedAccountId:"", autoPayEnabled:false, autoPayAccountId:"", autoPayCreditCardId:"", autoPayFrequency:"monthly", autoPayStartDate:new Date().toISOString().slice(0,10) };
const EMPTY_TX = { date:new Date().toISOString().slice(0,10), amount:"", type:"deposit" as "deposit"|"withdrawal"|"profit", note:"", fromAccountId:"" };
const EMPTY_FD: any = { bank:"", amount:"", rate:"", tenure:"12 months", maturity:"", currency:"AED", linkedAccountId:"", notes:"", reminderDays:"7", accountId:"" };

export default function Savings() {
  const { savingsGoals, addSavingsGoal, updateSavingsGoal, deleteSavingsGoal, fixedDeposits, addFixedDeposit, updateFixedDeposit, moveMaturedFD, deleteFixedDeposit, addSavingsTx, accounts, creditCards, addTransaction, getAccountBalance, withdrawFromSavings } = useDB();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawGoalId, setWithdrawGoalId] = useState("");
  const [withdrawForm, setWithdrawForm] = useState({ date: new Date().toISOString().slice(0,10), amount: "", fees: "", misc: "", note: "Withdrawal", toAccountId: "", toCreditCardId: "" });
  const [expanded, setExpanded] = useState<string|null>(null);
  const [filter, setFilter] = useState<SearchFilterState>(EMPTY_FILTER);
  const [goalOpen, setGoalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<SavingsGoal|null>(null);
  const [goalForm, setGoalForm] = useState<any>(EMPTY_GOAL);
  const [txOpen, setTxOpen] = useState(false);
  const [txGoalId, setTxGoalId] = useState("");
  const [txForm, setTxForm] = useState(EMPTY_TX);
  const [editTxGoalId, setEditTxGoalId] = useState("");
  const [editTxId, setEditTxId] = useState<string|null>(null);
  const [editTxForm, setEditTxForm] = useState({ date:"", amount:"", type:"deposit" as "deposit"|"withdrawal"|"profit", note:"" });
  const [fdOpen, setFdOpen] = useState(false);
  const [editFD, setEditFD] = useState<FixedDeposit|null>(null);
  const [fdForm, setFdForm] = useState<any>(EMPTY_FD);
  const [moveFDId, setMoveFDId] = useState<string|null>(null);
  const [moveFDForm, setMoveFDForm] = useState({ accountId:"", date:new Date().toISOString().slice(0,10) });
  const today = new Date();

  const openGoalAdd = () => { setEditGoal(null); setGoalForm(EMPTY_GOAL); setGoalOpen(true); };
  const openGoalEdit = (g: SavingsGoal) => {
    setEditGoal(g);
    setGoalForm({ name:g.name, type:g.type, target:String(g.target), current:String(g.current), monthly:String(g.monthly||""), color:g.color, platform:(g as any).platform||"", interestRate:String((g as any).interestRate||""), roiType:(g as any).roiType||"percentage", startDate:(g as any).startDate||new Date().toISOString().slice(0,10), maturityDate:(g as any).maturityDate||"", notes:g.notes||"", linkedAccountId:(g as any).linkedAccountId||"", autoPayEnabled:!!(g as any).autoPayEnabled, autoPayAccountId:(g as any).autoPayAccountId||"", autoPayCreditCardId:(g as any).autoPayCreditCardId||"", autoPayFrequency:(g as any).autoPayFrequency||"monthly", autoPayStartDate:(g as any).autoPayStartDate||new Date().toISOString().slice(0,10) });
    setGoalOpen(true);
  };
  const handleSaveGoal = () => {
    if (!goalForm.name||!goalForm.target) return;
    const data: any = { name:goalForm.name, type:goalForm.type, target:parseFloat(goalForm.target)||0, current:parseFloat(goalForm.current)||0, monthly:parseFloat(goalForm.monthly)||0, color:goalForm.color, platform:goalForm.platform||undefined, interestRate:parseFloat(goalForm.interestRate)||undefined, roiType:goalForm.roiType, startDate:goalForm.startDate, maturityDate:goalForm.maturityDate||undefined, notes:goalForm.notes||undefined, linkedAccountId:goalForm.linkedAccountId||undefined, autoPayEnabled:goalForm.autoPayEnabled, autoPayAccountId:goalForm.autoPayAccountId||undefined, autoPayCreditCardId:goalForm.autoPayCreditCardId||undefined, autoPayFrequency:goalForm.autoPayFrequency||"monthly", autoPayStartDate:goalForm.autoPayStartDate||undefined };
    if (editGoal) updateSavingsGoal(editGoal.id, data); else addSavingsGoal(data);
    setGoalOpen(false);
  };

  const openTx = (id: string) => { setTxGoalId(id); setTxForm(EMPTY_TX); setTxOpen(true); };
  const openWithdraw = (id: string) => {
    setWithdrawGoalId(id);
    setWithdrawForm({ date: new Date().toISOString().slice(0,10), amount: "", fees: "", misc: "", note: "Withdrawal", toAccountId: accounts[0]?.id||"", toCreditCardId: "" });
    setWithdrawOpen(true);
  };
  const handleWithdraw = () => {
    const amt = parseFloat(withdrawForm.amount);
    if (!amt || amt <= 0) return;
    withdrawFromSavings(withdrawGoalId, {
      date: withdrawForm.date,
      amount: amt,
      fees: withdrawForm.fees ? parseFloat(withdrawForm.fees) : undefined,
      misc: withdrawForm.misc ? parseFloat(withdrawForm.misc) : undefined,
      note: withdrawForm.note,
      toAccountId: withdrawForm.toAccountId || undefined,
      toCreditCardId: withdrawForm.toCreditCardId || undefined,
    });
    setWithdrawOpen(false);
  };
  const handleSaveTx = () => {
    const amt = parseFloat(txForm.amount); if (!amt||amt<=0) return;
    const signed = txForm.type==="withdrawal" ? -amt : amt;
    addSavingsTx(txGoalId, { date:txForm.date, amount:signed, type:txForm.type, note:txForm.note, fromAccountId:txForm.fromAccountId||undefined });
    if (txForm.fromAccountId&&txForm.type==="deposit") {
      const g = savingsGoals.find(g=>g.id===txGoalId);
      addTransaction({ name:`Savings: ${g?.name||"Goal"}`, amount:-amt, type:"expense", category:"Transfer", accountId:txForm.fromAccountId, date:txForm.date });
    }
    setTxOpen(false);
  };

  const handleEditTx = () => {
    if (!editTxId||!editTxGoalId) return;
    const g = savingsGoals.find(g=>g.id===editTxGoalId); if (!g) return;
    const amt = parseFloat(editTxForm.amount)||0;
    const signed = editTxForm.type==="withdrawal" ? -Math.abs(amt) : Math.abs(amt);
    const newTxs = (g.transactions||[]).map((t:any)=>t.id===editTxId?{...t,date:editTxForm.date,amount:signed,type:editTxForm.type,note:editTxForm.note}:t);
    const newCurrent = newTxs.reduce((s:number,t:any)=>s+t.amount,0);
    updateSavingsGoal(editTxGoalId,{transactions:newTxs,current:newCurrent});
    setEditTxId(null);
  };
  const handleDeleteTx = (goalId:string, txId:string) => {
    const g = savingsGoals.find(g=>g.id===goalId); if (!g) return;
    const newTxs = (g.transactions||[]).filter((t:any)=>t.id!==txId);
    const newCurrent = newTxs.reduce((s:number,t:any)=>s+t.amount,0);
    updateSavingsGoal(goalId,{transactions:newTxs,current:newCurrent});
  };
  const openFDAdd = () => { setEditFD(null); setFdForm(EMPTY_FD); setFdOpen(true); };
  const openFDEdit = (fd: FixedDeposit) => { setEditFD(fd); setFdForm({ bank:fd.bank, amount:String(fd.amount), rate:String(fd.rate), tenure:fd.tenure, maturity:fd.maturity, currency:fd.currency, linkedAccountId:fd.linkedAccountId||"", notes:fd.notes||"", reminderDays:String(fd.reminderDays||7), accountId:fd.accountId||"" }); setFdOpen(true); };
  const handleSaveFD = () => {
    if (!fdForm.bank||!fdForm.amount) return;
    const data: Omit<FixedDeposit,"id"> = { bank:fdForm.bank, amount:parseFloat(fdForm.amount)||0, rate:parseFloat(fdForm.rate)||0, tenure:fdForm.tenure, maturity:fdForm.maturity, currency:fdForm.currency, linkedAccountId:fdForm.linkedAccountId||undefined, notes:fdForm.notes||undefined, reminderDays:parseInt(fdForm.reminderDays)||7, accountId:fdForm.accountId||undefined };
    if (editFD) updateFixedDeposit(editFD.id, data); else addFixedDeposit(data);
    setFdOpen(false);
  };
  const handleMoveFD = () => { if (!moveFDId||!moveFDForm.accountId) return; moveMaturedFD(moveFDId, moveFDForm.accountId, moveFDForm.date); setMoveFDId(null); };

  const totalSaved = savingsGoals.reduce((s,g)=>s+g.current,0);
  const totalDeposits = fixedDeposits.reduce((s,d)=>s+d.amount,0);
  const totalReturns = fixedDeposits.reduce((s,d)=>s+Math.round(d.amount*d.rate/100*(parseInt(d.tenure)||12)/12),0);
  const maturingSoon = fixedDeposits.filter(fd => { if (!fd.maturity) return false; const days=Math.ceil((new Date(fd.maturity).getTime()-today.getTime())/(1000*60*60*24)); return days>=0&&days<=(fd.reminderDays||7); });

  return (
    <div className="space-y-6">
      <PageHeader title="Savings" subtitle="Goals, deposits & returns" action={<div className="flex gap-2"><Button variant="outline" className="gap-2" onClick={openFDAdd}><Plus className="w-4 h-4"/>Add Deposit</Button><Button className="gap-2" onClick={openGoalAdd}><Plus className="w-4 h-4"/>New Goal</Button></div>}/>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <StatCard title="Total Saved" value={`AED ${totalSaved.toLocaleString()}`} icon={PiggyBank} change="+15%" changeType="up"/>
        <StatCard title="Fixed Deposits" value={`AED ${totalDeposits.toLocaleString()}`} icon={Landmark} subtitle={`${fixedDeposits.length} active`}/>
        <StatCard title="Expected Returns" value={`AED ${totalReturns.toLocaleString()}`} icon={TrendingUp} changeType="up"/>
      </div>

      {maturingSoon.length>0&&(<div className="glass-card p-4 border border-amber-500/30 bg-amber-500/5"><div className="flex items-center gap-2 mb-2"><Bell className="w-4 h-4 text-amber-400"/><p className="text-sm font-medium text-amber-400">Fixed Deposits Maturing Soon</p></div>{maturingSoon.map(fd=>{const days=Math.ceil((new Date(fd.maturity).getTime()-today.getTime())/(1000*60*60*24));return <p key={fd.id} className="text-xs text-muted-foreground">• {fd.bank} — {fd.currency} {fd.amount.toLocaleString()} matures in {days} day{days!==1?"s":""} ({fd.maturity})</p>;})}</div>)}

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Savings Goals</h2>
        <SearchFilter value={filter} onChange={setFilter} placeholder="Search savings goals…" className="mb-3" />
        <div className="space-y-3">
          {savingsGoals.length===0&&<div className="p-8 text-center text-muted-foreground glass-card text-sm">No savings goals yet.</div>}
          {savingsGoals.filter(g => !filter.query || g.name.toLowerCase().includes(filter.query.toLowerCase()) || (g as any).platform?.toLowerCase().includes(filter.query.toLowerCase())).map((goal,i)=>{
            const pct=goal.target>0?Math.min(100,(goal.current/goal.target)*100):0;
            const isExp=expanded===goal.id;
            const autoAcc=accounts.find(a=>a.id===(goal as any).autoPayAccountId);
            const autoCard=creditCards.find(c=>c.id===(goal as any).autoPayCreditCardId);
            return (<motion.div key={goal.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}} className="glass-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{backgroundColor:`${goal.color}25`}}><PiggyBank className="w-4 h-4" style={{color:goal.color}}/></div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{goal.name}</p>
                    <p className="text-xs text-muted-foreground">{SAVINGS_TYPES.find(t=>t.id===goal.type)?.label}{(goal as any).platform?` · ${(goal as any).platform}`:""}</p>
                    {(autoAcc||autoCard)&&<span className="text-[10px] text-primary">🔄 Auto {(goal as any).autoPayFrequency||"monthly"}: {autoAcc?.name||autoCard?.name}{(goal as any).autoPayStartDate?` from ${(goal as any).autoPayStartDate}`:""}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={()=>openTx(goal.id)}><Plus className="w-3 h-3"/>Add</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-amber-400 border-amber-400/40 hover:bg-amber-400/10" onClick={()=>openWithdraw(goal.id)}><ArrowRightLeft className="w-3 h-3"/>Withdraw</Button>
                  <button onClick={()=>openGoalEdit(goal)} className="text-muted-foreground hover:text-foreground p-1"><Edit2 className="w-3.5 h-3.5"/></button>
                  <button onClick={()=>deleteSavingsGoal(goal.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3 text-xs">
                <div><p className="text-muted-foreground">Saved</p><p className="font-semibold">AED {goal.current.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Target</p><p className="font-semibold">AED {goal.target.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Monthly</p><p className="font-semibold">AED {goal.monthly.toLocaleString()}</p></div>
              </div>
              <div><div className="flex justify-between text-[10px] text-muted-foreground mb-1"><span>{pct.toFixed(1)}%</span><span>{goal.current.toLocaleString()} / {goal.target.toLocaleString()}</span></div><div className="w-full bg-secondary rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{width:`${pct}%`,backgroundColor:goal.color}}/></div></div>
              {(goal.transactions||[]).length>0&&(<><button onClick={()=>setExpanded(isExp?null:goal.id)} className="mt-2 w-full flex items-center justify-between text-[10px] text-muted-foreground hover:text-foreground"><span>History ({goal.transactions.length})</span>{isExp?<ChevronUp className="w-3.5 h-3.5"/>:<ChevronDown className="w-3.5 h-3.5"/>}</button><AnimatePresence>{isExp&&(<motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden"><div className="mt-2 space-y-1 max-h-40 overflow-y-auto border-t border-border pt-2">{[...goal.transactions].reverse().map(tx=>(<div key={tx.id} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">

    <div>
      <p className="text-foreground">{tx.note}</p>
      <p className="text-muted-foreground">{tx.date}</p>
    </div>

    <div className="flex items-center gap-2">

      <span className={`font-semibold ${tx.amount>=0?"stat-up":"stat-down"}`}>
        {tx.amount>=0?"+":""}AED {Math.abs(tx.amount).toLocaleString()}
      </span>

      <button
        onClick={()=>{
          setEditTxGoalId(goal.id)
          setEditTxId(tx.id)
          setEditTxForm({
            date:tx.date,
            amount:String(Math.abs(tx.amount)),
            type:tx.type,
            note:tx.note
          })
        }}
        className="text-muted-foreground hover:text-foreground"
      >
        <Edit2 className="w-3 h-3"/>
      </button>

      <button
        onClick={()=>handleDeleteTx(goal.id, tx.id)}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="w-3 h-3"/>
      </button>

    </div>

  </div>))}</div></motion.div>)}</AnimatePresence></>)}
            </motion.div>);
          })}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Fixed Deposits</h2>
        <div className="space-y-3">
          {fixedDeposits.length===0&&<div className="p-8 text-center text-muted-foreground glass-card text-sm">No fixed deposits added.</div>}
          {fixedDeposits.map((fd,i)=>{
            const ret=Math.round(fd.amount*fd.rate/100*(parseInt(fd.tenure)||12)/12);
            const daysLeft=fd.maturity?Math.ceil((new Date(fd.maturity).getTime()-today.getTime())/(1000*60*60*24)):null;
            const isMatured=daysLeft!==null&&daysLeft<=0;
            const linkedAcc=accounts.find(a=>a.id===fd.linkedAccountId);
            return (<motion.div key={fd.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}} className={`glass-card p-4 ${isMatured?"border border-green-500/40 bg-green-500/5":""}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-medium text-foreground text-sm">{fd.bank}</p>
                    {isMatured&&<span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">Matured</span>}
                    {daysLeft!==null&&daysLeft>0&&daysLeft<=(fd.reminderDays||7)&&<span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">Maturing Soon</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{fd.tenure} · {fd.rate}% · Matures: {fd.maturity}</p>
                  {linkedAcc&&<p className="text-[10px] text-primary mt-0.5">→ Auto: {linkedAcc.name}</p>}
                  {fd.notes&&<p className="text-[10px] text-muted-foreground">{fd.notes}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="text-sm font-bold">{fd.currency} {fd.amount.toLocaleString()}</p>
                  <p className="text-[10px] text-green-400">+{fd.currency} {ret.toLocaleString()}</p>
                  <p className="text-[10px] text-primary font-bold">= {fd.currency} {(fd.amount+ret).toLocaleString()}</p>
                  <div className="flex gap-1 mt-1">
                    {isMatured&&<Button size="sm" className="h-6 text-[10px] gap-1 bg-green-600 hover:bg-green-700" onClick={()=>{setMoveFDId(fd.id);setMoveFDForm({accountId:fd.linkedAccountId||"",date:new Date().toISOString().slice(0,10)})}}><ArrowRightLeft className="w-2.5 h-2.5"/>Move</Button>}
                    <button onClick={()=>openFDEdit(fd)} className="text-muted-foreground hover:text-foreground p-1"><Edit2 className="w-3 h-3"/></button>
                    <button onClick={()=>deleteFixedDeposit(fd.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3 h-3"/></button>
                  </div>
                </div>
              </div>
              {daysLeft!==null&&daysLeft>0&&(<div className="mt-2"><div className="flex justify-between text-[10px] text-muted-foreground mb-1"><span>Time remaining</span><span>{daysLeft} days left</span></div><div className="w-full bg-secondary rounded-full h-1"><div className="h-1 rounded-full bg-primary" style={{width:`${Math.max(5,100-daysLeft/365*100)}%`}}/></div></div>)}
            </motion.div>);
          })}
        </div>
      </div>

      {/* Add/Edit Goal */}
      <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editGoal?"Edit":"New"} Savings Goal</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Name</Label><Input value={goalForm.name} onChange={e=>setGoalForm((f:any)=>({...f,name:e.target.value}))} placeholder="e.g. Emergency Fund" className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Type</Label><Select value={goalForm.type} onValueChange={v=>setGoalForm((f:any)=>({...f,type:v}))}><SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger><SelectContent>{SAVINGS_TYPES.map(t=><SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Target (AED)</Label><Input type="number" value={goalForm.target} onChange={e=>setGoalForm((f:any)=>({...f,target:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Current (AED)</Label><Input type="number" value={goalForm.current} onChange={e=>setGoalForm((f:any)=>({...f,current:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Monthly (AED)</Label><Input type="number" value={goalForm.monthly} onChange={e=>setGoalForm((f:any)=>({...f,monthly:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>ROI Type</Label><Select value={goalForm.roiType} onValueChange={v=>setGoalForm((f:any)=>({...f,roiType:v}))}><SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger><SelectContent>{ROI_TYPES.map(r=><SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5">
                <Label>{goalForm.roiType==="daily" ? "Daily Rate (% or AED)" : "Interest Rate %"}</Label>
                <Input type="number" value={goalForm.interestRate} onChange={e=>setGoalForm((f:any)=>({...f,interestRate:e.target.value}))} placeholder={goalForm.roiType==="daily"?"0.01 (%) or 0.5 (AED)":"5.5"} className="bg-background border-border"/>
                {goalForm.roiType==="daily" && goalForm.interestRate && goalForm.current && (() => {
                  const rate = parseFloat(goalForm.interestRate);
                  const bal = parseFloat(goalForm.current);
                  if (!rate || !bal) return null;
                  const isPercent = rate < 10;
                  const dailyAed = isPercent ? (bal * rate / 100) : rate;
                  const dailyPct = isPercent ? rate : (rate / bal * 100);
                  return (
                    <p className="text-[11px] text-primary mt-1">≈ AED {dailyAed.toFixed(4)}/day · {dailyPct.toFixed(4)}% per day</p>
                  );
                })()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Start Date</Label><Input type="date" value={goalForm.startDate} onChange={e=>setGoalForm((f:any)=>({...f,startDate:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Maturity Date</Label><Input type="date" value={goalForm.maturityDate} onChange={e=>setGoalForm((f:any)=>({...f,maturityDate:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>Platform</Label><Input value={goalForm.platform} onChange={e=>setGoalForm((f:any)=>({...f,platform:e.target.value}))} placeholder="e.g. UAE National Bonds" className="bg-background border-border"/></div>
            <div className="border border-border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between"><Label className="text-sm font-medium">Enable Auto-Payment</Label><Switch checked={goalForm.autoPayEnabled} onCheckedChange={v=>setGoalForm((f:any)=>({...f,autoPayEnabled:v}))}/></div>
              {goalForm.autoPayEnabled&&(<>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5"><Label className="text-xs">Frequency</Label>
                    <Select value={goalForm.autoPayFrequency||"monthly"} onValueChange={v=>setGoalForm((f:any)=>({...f,autoPayFrequency:v}))}>
                      <SelectTrigger className="bg-background border-border h-8 text-xs"><SelectValue/></SelectTrigger>
                      <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs">Start Date</Label><input type="date" value={goalForm.autoPayStartDate||""} onChange={e=>setGoalForm((f:any)=>({...f,autoPayStartDate:e.target.value}))} className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"/></div>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">From Account</Label><Select value={goalForm.autoPayAccountId||"_none"} onValueChange={v=>setGoalForm((f:any)=>({...f,autoPayAccountId:v==="_none"?"":v,autoPayCreditCardId:""}))}>  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger><SelectContent><SelectItem value="_none">None</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label className="text-xs">Or from Credit Card</Label><Select value={goalForm.autoPayCreditCardId||"_none"} onValueChange={v=>setGoalForm((f:any)=>({...f,autoPayCreditCardId:v==="_none"?"":v,autoPayAccountId:""}))}>  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger><SelectContent><SelectItem value="_none">None</SelectItem>{creditCards.map(c=><SelectItem key={c.id} value={c.id}>{c.name} — AED {c.limit.toLocaleString()} limit</SelectItem>)}</SelectContent></Select></div>
              </>)}
            </div>
            <div className="space-y-1.5"><Label>Color</Label><div className="flex gap-2">{COLOR_OPTIONS.map(c=><button key={c} onClick={()=>setGoalForm((f:any)=>({...f,color:c}))} className="w-7 h-7 rounded-full border-2 transition-all" style={{backgroundColor:c,borderColor:goalForm.color===c?"white":"transparent"}}/>)}</div></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setGoalOpen(false)}>Cancel</Button><Button onClick={handleSaveGoal} disabled={!goalForm.name||!goalForm.target}>{editGoal?"Save":"Add Goal"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Transaction */}
      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Add Savings Transaction</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-3 gap-2">{(["deposit","withdrawal","profit"] as const).map(t=>(<button key={t} onClick={()=>setTxForm(f=>({...f,type:t}))} className={`py-2 rounded-lg text-xs border capitalize ${txForm.type===t?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground"}`}>{t}</button>))}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount (AED)</Label><Input type="number" value={txForm.amount} onChange={e=>setTxForm(f=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={txForm.date} onChange={e=>setTxForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            {txForm.type==="deposit"&&(<div className="space-y-1.5"><Label>From Account</Label><Select value={txForm.fromAccountId||"_none"} onValueChange={v=>setTxForm(f=>({...f,fromAccountId:v==="_none"?"":v}))}><SelectTrigger className="bg-background border-border"><SelectValue placeholder="Manual / External"/></SelectTrigger><SelectContent><SelectItem value="_none">Manual</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} ({a.currency} {getAccountBalance(a.id).toLocaleString()})</SelectItem>)}</SelectContent></Select></div>)}
            <div className="space-y-1.5"><Label>Note</Label><Input value={txForm.note} onChange={e=>setTxForm(f=>({...f,note:e.target.value}))} placeholder="Monthly deposit" className="bg-background border-border"/></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setTxOpen(false)}>Cancel</Button><Button onClick={handleSaveTx} disabled={!txForm.amount}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

{/* Edit Transaction history */}

<Dialog open={!!editTxId} onOpenChange={()=>setEditTxId(null)}>
  <DialogContent className="w-full sm:max-w-sm bg-card border-border">
    <DialogHeader>
      <DialogTitle>Edit Savings Transaction</DialogTitle>
    </DialogHeader>

    <div className="space-y-3 py-2">

      <div className="grid grid-cols-3 gap-2">
        {(["deposit","withdrawal","profit"] as const).map(t=>(
          <button
            key={t}
            onClick={()=>setEditTxForm(f=>({...f,type:t}))}
            className={`py-2 rounded-lg text-xs border capitalize ${
              editTxForm.type===t
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Amount (AED)</Label>
          <Input
            type="number"
            value={editTxForm.amount}
            onChange={e=>setEditTxForm(f=>({...f,amount:e.target.value}))}
            className="bg-background border-border"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input
            type="date"
            value={editTxForm.date}
            onChange={e=>setEditTxForm(f=>({...f,date:e.target.value}))}
            className="bg-background border-border"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Note</Label>
        <Input
          value={editTxForm.note}
          onChange={e=>setEditTxForm(f=>({...f,note:e.target.value}))}
          className="bg-background border-border"
        />
      </div>

    </div>

    <DialogFooter>
      <Button variant="outline" onClick={()=>setEditTxId(null)}>
        Cancel
      </Button>

      <Button
        onClick={()=>{
          handleEditTx()
        }}
        disabled={!editTxForm.amount}
      >
        Save Changes
      </Button>
    </DialogFooter>

  </DialogContent>
</Dialog>




      {/* Add/Edit Fixed Deposit */}
      <Dialog open={fdOpen} onOpenChange={setFdOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editFD?"Edit":"Add"} Fixed Deposit</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Bank / Institution</Label><Input value={fdForm.bank} onChange={e=>setFdForm((f:any)=>({...f,bank:e.target.value}))} placeholder="Emirates NBD" className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Currency</Label><Select value={fdForm.currency} onValueChange={v=>setFdForm((f:any)=>({...f,currency:v}))}><SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger><SelectContent>{["AED","USD","EUR","GBP","BDT"].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Amount</Label><Input type="number" value={fdForm.amount} onChange={e=>setFdForm((f:any)=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Interest %</Label><Input type="number" step="0.01" value={fdForm.rate} onChange={e=>setFdForm((f:any)=>({...f,rate:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Tenure</Label><Input value={fdForm.tenure} onChange={e=>setFdForm((f:any)=>({...f,tenure:e.target.value}))} placeholder="12 months" className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Maturity Date</Label><Input type="date" value={fdForm.maturity} onChange={e=>setFdForm((f:any)=>({...f,maturity:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Remind (days before)</Label><Input type="number" value={fdForm.reminderDays} onChange={e=>setFdForm((f:any)=>({...f,reminderDays:e.target.value}))} placeholder="7" className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>Source Account</Label><Select value={fdForm.accountId||"_none"} onValueChange={v=>setFdForm((f:any)=>({...f,accountId:v==="_none"?"":v}))}><SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger><SelectContent><SelectItem value="_none">None</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Auto-transfer matured amount to</Label><Select value={fdForm.linkedAccountId||"_none"} onValueChange={v=>setFdForm((f:any)=>({...f,linkedAccountId:v==="_none"?"":v}))}><SelectTrigger className="bg-background border-border"><SelectValue placeholder="None (manual)"/></SelectTrigger><SelectContent><SelectItem value="_none">None (manual)</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} ({a.currency} {getAccountBalance(a.id).toLocaleString()})</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={fdForm.notes} onChange={e=>setFdForm((f:any)=>({...f,notes:e.target.value}))} className="bg-background border-border"/></div>
            {fdForm.amount&&fdForm.rate&&(<div className="bg-secondary/50 rounded-lg p-3 text-xs"><p className="text-muted-foreground mb-1">At maturity:</p><p className="font-bold text-primary">{fdForm.currency} {(parseFloat(fdForm.amount)*(1+parseFloat(fdForm.rate)/100*(parseInt(fdForm.tenure)||12)/12)).toLocaleString(undefined,{maximumFractionDigits:0})}</p><p className="text-green-400">+{Math.round(parseFloat(fdForm.amount)*parseFloat(fdForm.rate)/100*(parseInt(fdForm.tenure)||12)/12).toLocaleString()} returns</p></div>)}
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setFdOpen(false)}>Cancel</Button><Button onClick={handleSaveFD} disabled={!fdForm.bank||!fdForm.amount}>{editFD?"Save":"Add Deposit"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Matured FD */}
      <Dialog open={!!moveFDId} onOpenChange={()=>setMoveFDId(null)}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Move Matured Deposit to Account</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {moveFDId&&(()=>{const fd=fixedDeposits.find(f=>f.id===moveFDId);if(!fd)return null;const ret=Math.round(fd.amount*fd.rate/100*(parseInt(fd.tenure)||12)/12);return(<div className="bg-secondary/50 rounded-lg p-3 text-xs space-y-1"><p className="text-muted-foreground">Principal: <span className="font-medium text-foreground">{fd.currency} {fd.amount.toLocaleString()}</span></p><p className="text-muted-foreground">Returns: <span className="text-green-400 font-medium">+{fd.currency} {ret.toLocaleString()}</span></p><p className="text-muted-foreground font-medium">Total: <span className="text-primary font-bold">{fd.currency} {(fd.amount+ret).toLocaleString()}</span></p></div>);})()}
            <div className="space-y-1.5"><Label>To Account</Label><Select value={moveFDForm.accountId} onValueChange={v=>setMoveFDForm(f=>({...f,accountId:v}))}><SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select account"/></SelectTrigger><SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} ({a.currency} {getAccountBalance(a.id).toLocaleString()})</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={moveFDForm.date} onChange={e=>setMoveFDForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setMoveFDId(null)}>Cancel</Button><Button onClick={handleMoveFD} disabled={!moveFDForm.accountId}>Move to Account</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Savings Withdrawal Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Withdraw from Savings</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {(() => { const g = savingsGoals.find(g=>g.id===withdrawGoalId); return g ? (
              <div className="p-3 bg-secondary/50 rounded-xl text-xs">
                <p className="text-muted-foreground">Goal: <span className="text-foreground font-semibold">{g.name}</span></p>
                <p className="text-muted-foreground mt-0.5">Available: <span className="text-primary font-semibold">AED {g.current.toLocaleString()}</span></p>
              </div>
            ) : null; })()}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Withdrawal Amount</Label><Input type="number" placeholder="0" value={withdrawForm.amount} onChange={e=>setWithdrawForm(f=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={withdrawForm.date} onChange={e=>setWithdrawForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Fees (optional)</Label><Input type="number" placeholder="0" value={withdrawForm.fees} onChange={e=>setWithdrawForm(f=>({...f,fees:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Misc Charges (optional)</Label><Input type="number" placeholder="0" value={withdrawForm.misc} onChange={e=>setWithdrawForm(f=>({...f,misc:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>Note</Label><Input value={withdrawForm.note} onChange={e=>setWithdrawForm(f=>({...f,note:e.target.value}))} className="bg-background border-border"/></div>
            {/* Destination */}
            <div className="space-y-3 border border-border rounded-lg p-3">
              <Label className="text-xs font-medium">Transfer proceeds to</Label>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Bank Account</Label>
                <Select value={withdrawForm.toAccountId||"_none"} onValueChange={v=>setWithdrawForm(f=>({...f,toAccountId:v==="_none"?"":v,toCreditCardId:""}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None — hold as cash"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None — don't credit account</SelectItem>
                    {accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — AED {getAccountBalance(a.id).toLocaleString()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {!withdrawForm.toAccountId && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Or Credit Card Repayment</Label>
                  <Select value={withdrawForm.toCreditCardId||"_none"} onValueChange={v=>setWithdrawForm(f=>({...f,toCreditCardId:v==="_none"?"":v,toAccountId:""}))}>
                    <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {creditCards.map(c=><SelectItem key={c.id} value={c.id}>{c.name} ···{c.last4} — Balance AED {Math.abs(c.balance).toLocaleString()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {withdrawForm.amount && (
              <div className="rounded-lg p-2.5 bg-amber-400/10 text-amber-400 text-xs space-y-0.5">
                <p>Withdrawal: AED {parseFloat(withdrawForm.amount||"0").toFixed(2)}</p>
                {withdrawForm.fees && <p>Fees: AED {parseFloat(withdrawForm.fees||"0").toFixed(2)}</p>}
                {withdrawForm.misc && <p>Misc: AED {parseFloat(withdrawForm.misc||"0").toFixed(2)}</p>}
                <p className="font-semibold border-t border-amber-400/20 pt-0.5 mt-1">
                  Total deducted: AED {(parseFloat(withdrawForm.amount||"0")+parseFloat(withdrawForm.fees||"0")+parseFloat(withdrawForm.misc||"0")).toFixed(2)}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setWithdrawOpen(false)}>Cancel</Button>
            <Button onClick={handleWithdraw} disabled={!withdrawForm.amount} className="bg-amber-500 hover:bg-amber-600 text-white">Withdraw</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
