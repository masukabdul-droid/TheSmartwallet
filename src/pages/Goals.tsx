import { SearchFilter, EMPTY_FILTER, matchesFilter, SearchFilterState } from "@/components/ui/search-filter";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, Plus, Trash2, ChevronDown, ChevronUp, Edit2, Wallet, ArrowRightLeft, ArrowDownLeft, Zap, TrendingUp } from "lucide-react";
import { useDB, Goal, GoalRule, GoalRuleType } from "@/lib/database";

const COLORS = ["hsl(160,84%,39%)","hsl(200,80%,50%)","hsl(280,70%,60%)","hsl(40,90%,55%)","hsl(0,72%,51%)","hsl(220,60%,55%)"];

const RULE_CONFIGS: { type: GoalRuleType; label: string; desc: string; multi: boolean; icon: string }[] = [
  { type:"one_shot",        label:"One-Shot Saving",    desc:"Transfer a lump sum to this goal immediately",              multi:true,  icon:"🎯" },
  { type:"set_forget",      label:"Set & Forget",       desc:"Daily, weekly or monthly auto deposits",                   multi:true,  icon:"⏰" },
  { type:"pay_yourself_first", label:"Pay Yourself First", desc:"Fixed amount moves to goal every time account is topped up", multi:true, icon:"💰" },
  { type:"spend_save",      label:"Spend & Save",       desc:"Save a fixed amount every time you make a purchase",       multi:true,  icon:"🛍️" },
  { type:"spend_less",      label:"Spend Less",         desc:"Set a budget, save the difference at period end",          multi:false, icon:"📉" },
  { type:"target_day",      label:"Target Day",         desc:"Set target date & amount — we calculate what you need",    multi:false, icon:"📅" },
];

const EMPTY_GOAL = { name:"", targetAmount:"", currentAmount:"0", monthlyContribution:"", linkedAccountId:"", startDate:new Date().toISOString().slice(0,10), targetDate:"", color:COLORS[0], medium:"account" as Goal["medium"], mediumLabel:"", interestEnabled:false, interestType:"percentage" as "percentage"|"fixed_amount", interestRate:"", interestFreq:"monthly" as "monthly"|"yearly", autoPayEnabled:false, autoPayAccountId:"", autoPayCreditCardId:"", autoPayFrequency:"monthly", autoPayStartDate:new Date().toISOString().slice(0,10) };
const EMPTY_TX = { amount:"", note:"", date:new Date().toISOString().slice(0,10), type:"deposit" as "deposit"|"withdraw", fromAccountId:"", toAccountId:"", fromCreditCardId:"" };

export default function Goals() {
  const { goals, accounts, creditCards, transfers, addGoal, updateGoal, addGoalTransaction, withdrawFromGoal, addGoalInterest, deleteGoal, getAccountBalance, addCardTransaction } = useDB();
  const [filter, setFilter] = useState<SearchFilterState>(EMPTY_FILTER);
  const [expanded, setExpanded] = useState<string|null>(null);
  const [activeTab, setActiveTab] = useState<Record<string,"transactions"|"rules">>({});

  const [goalOpen, setGoalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal|null>(null);
  const [goalForm, setGoalForm] = useState(EMPTY_GOAL);

  const [txGoalId, setTxGoalId] = useState("");
  const [txOpen, setTxOpen] = useState(false);
  const [txForm, setTxForm] = useState(EMPTY_TX);

  const [ruleGoalId, setRuleGoalId] = useState("");
  const [editGTxGoalId, setEditGTxGoalId] = useState("");
  const [editGTxId, setEditGTxId] = useState<string|null>(null);
  const [editGTxForm, setEditGTxForm] = useState({ date:"", amount:"", type:"deposit" as "deposit"|"withdraw"|"interest", note:"" });
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState<Omit<GoalRule,"id">>({ type:"one_shot", isActive:true, amount:0, frequency:"monthly" });

  const openGoalAdd = () => { setEditGoal(null); setGoalForm(EMPTY_GOAL); setGoalOpen(true); };
  const openGoalEdit = (g: Goal) => {
    setEditGoal(g);
    setGoalForm({ name:g.name, targetAmount:String(g.targetAmount), currentAmount:String(g.currentAmount), monthlyContribution:String(g.monthlyContribution), linkedAccountId:g.linkedAccountId||"", startDate:g.startDate, targetDate:g.targetDate, color:g.color, medium:g.medium||"account", mediumLabel:g.mediumLabel||"", interestEnabled:!!g.interest?.enabled, interestType:g.interest?.type||"percentage", interestRate:String(g.interest?.rate||""), interestFreq:g.interest?.frequency||"monthly", autoPayEnabled:!!(g as any).autoPayEnabled, autoPayAccountId:(g as any).autoPayAccountId||"", autoPayCreditCardId:(g as any).autoPayCreditCardId||"", autoPayFrequency:(g as any).autoPayFrequency||"monthly", autoPayStartDate:(g as any).autoPayStartDate||new Date().toISOString().slice(0,10) });
    setGoalOpen(true);
  };
  const handleSaveGoal = () => {
    const data: any = { name:goalForm.name, targetAmount:parseFloat(goalForm.targetAmount)||0, currentAmount:parseFloat(goalForm.currentAmount)||0, monthlyContribution:parseFloat(goalForm.monthlyContribution)||0, linkedAccountId:goalForm.linkedAccountId||undefined, startDate:goalForm.startDate, targetDate:goalForm.targetDate, color:goalForm.color, medium:goalForm.medium, mediumLabel:goalForm.mediumLabel||undefined, rules:editGoal?.rules||[], interest:goalForm.interestEnabled?{ enabled:true, type:goalForm.interestType, rate:parseFloat(goalForm.interestRate)||0, frequency:goalForm.interestFreq }:undefined, autoPayEnabled:goalForm.autoPayEnabled, autoPayAccountId:goalForm.autoPayAccountId||undefined, autoPayCreditCardId:goalForm.autoPayCreditCardId||undefined, autoPayFrequency:goalForm.autoPayFrequency||"monthly", autoPayStartDate:goalForm.autoPayStartDate||undefined };
    if (editGoal) updateGoal(editGoal.id, data);
    else addGoal(data);
    setGoalOpen(false);
  };

  const openTxDialog = (goalId: string, type: "deposit"|"withdraw") => {
    const g = goals.find(g=>g.id===goalId);
    setTxGoalId(goalId);
    setTxForm({ ...EMPTY_TX, type, fromAccountId: type==="deposit"?g?.linkedAccountId||"":"", toAccountId: type==="withdraw"?g?.linkedAccountId||"":"" });
    setTxOpen(true);
  };
  const handleSaveTx = () => {
    const amt = parseFloat(txForm.amount)||0;
    if (!amt) return;
    const goal = goals.find(g=>g.id===txGoalId);
    if (txForm.type === "deposit") {
      addGoalTransaction(txGoalId, { amount:amt, note:txForm.note||"Deposit", date:txForm.date, type:"deposit", fromAccountId:txForm.fromAccountId||undefined });
      // Charge CC if selected
      if (txForm.fromCreditCardId) {
        addCardTransaction(txForm.fromCreditCardId, { date:txForm.date, description:`Goal: ${goal?.name||"Goal"}`, amount:-amt, category:"Goals" });
      }
    } else {
      withdrawFromGoal(txGoalId, { amount:amt, note:txForm.note||"Withdrawal", date:txForm.date, type:"withdraw", toAccountId:txForm.toAccountId||undefined });
    }
    setTxOpen(false);
  };

  const openRuleDialog = (goalId: string) => { setRuleGoalId(goalId); setRuleForm({ type:"one_shot", isActive:true, amount:0, frequency:"monthly" }); setRuleOpen(true); };
  const handleSaveRule = () => {
    const goal = goals.find(g=>g.id===ruleGoalId);
    if (!goal) return;
    const newRule: GoalRule = { ...ruleForm, id: Date.now().toString(36) };
    updateGoal(ruleGoalId, { rules:[...(goal.rules||[]), newRule] });
    setRuleOpen(false);
  };
  const removeRule = (goalId: string, ruleId: string) => {
    const g = goals.find(g=>g.id===goalId);
    if (g) updateGoal(goalId, { rules:(g.rules||[]).filter(r=>r.id!==ruleId) });
  };
  const toggleRule = (goalId: string, ruleId: string) => {
    const g = goals.find(g=>g.id===goalId);
    if (g) updateGoal(goalId, { rules:(g.rules||[]).map(r=>r.id===ruleId?{...r,isActive:!r.isActive}:r) });
  };

  const handleEditGTx = () => {
    if (!editGTxId||!editGTxGoalId) return;
    const g = goals.find(g=>g.id===editGTxGoalId); if(!g) return;
    const amt = parseFloat(editGTxForm.amount)||0;
    const signed = editGTxForm.type==="withdraw" ? -Math.abs(amt) : Math.abs(amt);
    const newTxs = g.transactions.map((t:any)=>t.id===editGTxId?{...t,date:editGTxForm.date,amount:signed,type:editGTxForm.type,note:editGTxForm.note}:t);
    const newCurrent = newTxs.reduce((s:number,t:any)=>s+t.amount,0);
    updateGoal(editGTxGoalId,{transactions:newTxs,currentAmount:newCurrent});
    setEditGTxId(null);
  };
  const handleDeleteGTx = (goalId:string, txId:string) => {
    const g = goals.find(g=>g.id===goalId); if(!g) return;
    const newTxs = g.transactions.filter((t:any)=>t.id!==txId);
    const newCurrent = newTxs.reduce((s:number,t:any)=>s+t.amount,0);
    updateGoal(goalId,{transactions:newTxs,currentAmount:newCurrent});
  };
  const getTab = (id:string) => activeTab[id]||"transactions";
  const setTab = (id:string, tab:"transactions"|"rules") => setActiveTab(p=>({...p,[id]:tab}));

  const totalTarget = goals.reduce((s,g)=>s+g.targetAmount,0);
  const totalSaved = goals.reduce((s,g)=>s+g.currentAmount,0);

  const daysToTarget = (targetDate: string) => {
    if (!targetDate) return null;
    const diff = Math.ceil((new Date(targetDate).getTime()-Date.now())/(1000*60*60*24));
    return diff > 0 ? diff : 0;
  };
  const dailyNeeded = (g: Goal) => {
    const days = daysToTarget(g.targetDate);
    if (!days) return null;
    const remaining = g.targetAmount - g.currentAmount;
    return remaining > 0 ? (remaining/days).toFixed(2) : "0";
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Goals" subtitle={`${goals.length} goals · AED ${totalSaved.toLocaleString()} / ${totalTarget.toLocaleString()} saved`}
        action={<Button className="gap-2" onClick={openGoalAdd}><Plus className="w-4 h-4"/>Add Goal</Button>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <StatCard title="Total Target" value={`AED ${totalTarget.toLocaleString()}`} icon={Target} />
        <StatCard title="Total Saved" value={`AED ${totalSaved.toLocaleString()}`} icon={Wallet} changeType="up" />
        <StatCard title="Overall Progress" value={`${totalTarget>0?((totalSaved/totalTarget)*100).toFixed(1):0}%`} icon={TrendingUp} changeType="up" />
      </div>

      <SearchFilter value={filter} onChange={setFilter} placeholder="Search goals…" />
      <div className="space-y-4">
        {goals.length===0 && <div className="p-8 text-center text-muted-foreground glass-card text-sm">No goals yet. Create your first savings goal!</div>}
        {goals.map((g,i)=>{
          const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
          const remaining = g.targetAmount - g.currentAmount;
          const days = daysToTarget(g.targetDate);
          const daily = dailyNeeded(g);
          const linkedAcct = accounts.find(a=>a.id===g.linkedAccountId);
          const tab = getTab(g.id);
          const isExp = expanded===g.id;

          return (
            <motion.div key={g.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}} className="glass-card overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{backgroundColor:`${g.color}25`}}>
                      <Target className="w-5 h-5" style={{color:g.color}}/>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{g.name}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        {linkedAcct && <Badge variant="secondary" className="text-[9px] gap-1"><Wallet className="w-2.5 h-2.5"/>{linkedAcct.name}</Badge>}
                        {g.medium==="physical" && <Badge variant="secondary" className="text-[9px]">🏠 Physical</Badge>}
                        {g.interest?.enabled && <Badge variant="secondary" className="text-[9px] gap-1"><TrendingUp className="w-2.5 h-2.5"/>Interest ON</Badge>}
                        {days !== null && <Badge variant="secondary" className="text-[9px]">📅 {days}d left</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-primary border-primary/30" onClick={()=>openTxDialog(g.id,"deposit")}><Plus className="w-3 h-3"/>Add</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={()=>openTxDialog(g.id,"withdraw")}><ArrowDownLeft className="w-3 h-3"/>Withdraw</Button>
                    {g.interest?.enabled && <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-amber-400 border-amber-500/30" onClick={()=>addGoalInterest(g.id, new Date().toISOString().slice(0,10))}><TrendingUp className="w-3 h-3"/>Interest</Button>}
                    <button onClick={()=>openGoalEdit(g)} className="text-muted-foreground hover:text-foreground p-1"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>deleteGoal(g.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
                
                {/* Progress */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-display font-bold text-foreground">AED {g.currentAmount.toLocaleString()}</span>
                    <span className="text-muted-foreground">of AED {g.targetAmount.toLocaleString()}</span>
                  </div>
                  <Progress value={Math.min(pct, 100)} className="h-2.5"/>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{pct.toFixed(1)}% complete</span>
                    <span>{remaining > 0 ? `AED ${remaining.toLocaleString()} remaining` : "🎉 Goal reached!"}</span>
                  </div>
                </div>

                {/* Quick stats */}
                {daily && remaining > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-secondary/30 rounded-lg p-2"><p className="text-[10px] text-muted-foreground">Daily needed</p><p className="text-xs font-semibold text-foreground">AED {daily}</p></div>
                    <div className="bg-secondary/30 rounded-lg p-2"><p className="text-[10px] text-muted-foreground">Monthly</p><p className="text-xs font-semibold text-foreground">AED {g.monthlyContribution.toLocaleString()}</p></div>
                    <div className="bg-secondary/30 rounded-lg p-2"><p className="text-[10px] text-muted-foreground">Rules</p><p className="text-xs font-semibold text-foreground">{(g.rules||[]).filter(r=>r.isActive).length} active</p></div>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-4 pt-3 border-b border-border pb-2">
                {(["transactions","rules"] as const).map(t=>(
                  <button key={t} onClick={()=>setTab(g.id,t)} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${tab===t?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>
                    {t==="transactions"?`History (${g.transactions.length})`:`Rules (${(g.rules||[]).length})`}
                  </button>
                ))}
              </div>

              {/* Expand */}
              <button onClick={()=>setExpanded(isExp?null:g.id)} className="w-full flex items-center justify-center py-2 text-xs text-muted-foreground hover:text-foreground">
                {isExp?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}
              </button>

              <AnimatePresence>
                {isExp && (
                  <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                    <div className="px-4 pb-4">
                      {tab==="transactions" && (
                        <div className="space-y-1 max-h-52 overflow-y-auto">
                          {g.transactions.length===0&&<p className="text-xs text-center text-muted-foreground py-2">No contributions yet.</p>}
                          {[...g.transactions].reverse().map(tx=>{
                            const srcAcc = accounts.find(a=>a.id===(tx.fromAccountId||tx.toAccountId));
                            const isEditingThis = editGTxId===tx.id&&editGTxGoalId===g.id;
                            return (
                              <div key={tx.id} className="py-1.5 border-b border-border/40 last:border-0 text-xs group">
                                {isEditingThis ? (
                                  <div className="flex flex-col gap-1.5">
                                    <div className="grid grid-cols-3 gap-1">
                                      <input type="date" value={editGTxForm.date} onChange={e=>setEditGTxForm(f=>({...f,date:e.target.value}))} className="h-6 rounded border border-border bg-background px-1 text-xs text-foreground"/>
                                      <input type="number" value={editGTxForm.amount} onChange={e=>setEditGTxForm(f=>({...f,amount:e.target.value}))} className="h-6 rounded border border-border bg-background px-1 text-xs text-foreground"/>
                                      <select value={editGTxForm.type} onChange={e=>setEditGTxForm(f=>({...f,type:e.target.value as any}))} className="h-6 rounded border border-border bg-background px-1 text-xs text-foreground"><option value="deposit">deposit</option><option value="withdraw">withdraw</option><option value="interest">interest</option></select>
                                    </div>
                                    <input value={editGTxForm.note} onChange={e=>setEditGTxForm(f=>({...f,note:e.target.value}))} placeholder="Note" className="h-6 w-full rounded border border-border bg-background px-1 text-xs text-foreground"/>
                                    <div className="flex gap-1.5"><button onClick={handleEditGTx} className="text-[10px] text-primary font-medium">Save</button><button onClick={()=>setEditGTxId(null)} className="text-[10px] text-muted-foreground">Cancel</button></div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="text-foreground font-medium">{tx.note||"Transaction"}</span>
                                      {srcAcc&&<span className="text-muted-foreground ml-2">· {srcAcc.name}</span>}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <Badge variant="secondary" className={`text-[9px] ${tx.type==="withdraw"?"bg-red-500/20 text-red-400":tx.type==="interest"?"bg-amber-500/20 text-amber-400":"bg-primary/20 text-primary"}`}>{tx.type||"deposit"}</Badge>
                                      <span className={`font-semibold ${tx.amount<0?"stat-down":"stat-up"}`}>{tx.amount>0?"+":""}{tx.amount.toLocaleString()}</span>
                                      <span className="text-muted-foreground">{tx.date}</span>
                                      <button onClick={()=>{setEditGTxGoalId(g.id);setEditGTxId(tx.id);setEditGTxForm({date:tx.date,amount:String(Math.abs(tx.amount)),type:(tx.type||"deposit") as any,note:tx.note||""});}} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-0.5"><Edit2 className="w-3 h-3"/></button>
                                      <button onClick={()=>handleDeleteGTx(g.id,tx.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5"><Trash2 className="w-3 h-3"/></button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {tab==="rules" && (
                        <div className="space-y-2">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 w-full" onClick={()=>openRuleDialog(g.id)}><Plus className="w-3 h-3"/>Add Rule</Button>
                          {(g.rules||[]).length===0&&<p className="text-xs text-center text-muted-foreground py-2">No saving rules configured.</p>}
                          {(g.rules||[]).map(rule=>{
                            const cfg = RULE_CONFIGS.find(r=>r.type===rule.type);
                            return (
                              <div key={rule.id} className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${rule.isActive?"border-primary/30 bg-primary/5":"border-border bg-secondary/20 opacity-60"}`}>
                                <div className="flex items-center gap-2">
                                  <span>{cfg?.icon}</span>
                                  <div>
                                    <p className="font-medium text-foreground">{cfg?.label}</p>
                                    <p className="text-muted-foreground">{rule.amount?`AED ${rule.amount}`:""}{rule.percent?`${rule.percent}%`:""}{rule.frequency?` / ${rule.frequency}`:""}{rule.targetDate?` by ${rule.targetDate}`:""}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={()=>toggleRule(g.id,rule.id)} className={`text-[10px] px-2 py-0.5 rounded border ${rule.isActive?"border-primary text-primary":"border-border text-muted-foreground"}`}>{rule.isActive?"ON":"OFF"}</button>
                                  <button onClick={()=>removeRule(g.id,rule.id)} className="text-muted-foreground hover:text-destructive p-0.5"><Trash2 className="w-3 h-3"/></button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Add/Edit Goal */}
      <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editGoal?"Edit":"New"} Goal</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Goal Name</Label><Input placeholder="e.g. Emergency Fund" value={goalForm.name} onChange={e=>setGoalForm(f=>({...f,name:e.target.value}))} className="bg-background border-border"/></div>
            
            <div className="space-y-1.5">
              <Label>Savings Medium</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["account","physical","other"] as const).map(m=>(
                  <button key={m} onClick={()=>setGoalForm(f=>({...f,medium:m}))} className={`py-2 rounded-lg text-xs border capitalize ${goalForm.medium===m?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground"}`}>
                    {m==="account"?"🏦 Account":m==="physical"?"🏠 Physical":"📦 Other"}
                  </button>
                ))}
              </div>
            </div>

            {goalForm.medium==="account" && (
              <div className="space-y-1.5">
                <Label>Linked Account (contributions deduct from this)</Label>
                <Select value={goalForm.linkedAccountId||"_none"} onValueChange={v=>setGoalForm(f=>({...f,linkedAccountId:v==="_none"?"":v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select account"/></SelectTrigger>
                  <SelectContent><SelectItem value="_none">None</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {goalForm.medium!=="account" && <div className="space-y-1.5"><Label>Medium Label</Label><Input placeholder="e.g. Piggy bank, Physical safe" value={goalForm.mediumLabel} onChange={e=>setGoalForm(f=>({...f,mediumLabel:e.target.value}))} className="bg-background border-border"/></div>}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Target Amount</Label><Input type="number" value={goalForm.targetAmount} onChange={e=>setGoalForm(f=>({...f,targetAmount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Current Saved</Label><Input type="number" value={goalForm.currentAmount} onChange={e=>setGoalForm(f=>({...f,currentAmount:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Monthly Contribution</Label><Input type="number" value={goalForm.monthlyContribution} onChange={e=>setGoalForm(f=>({...f,monthlyContribution:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Target Date</Label><Input type="date" value={goalForm.targetDate} onChange={e=>setGoalForm(f=>({...f,targetDate:e.target.value}))} className="bg-background border-border"/></div>
            </div>

            {/* Interest/Profit */}
            <div className="border border-border rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="interest" checked={goalForm.interestEnabled} onChange={e=>setGoalForm(f=>({...f,interestEnabled:e.target.checked}))} className="rounded"/>
                <Label htmlFor="interest" className="text-sm cursor-pointer flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5"/>Enable Interest / Profit</Label>
              </div>
              {goalForm.interestEnabled && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select value={goalForm.interestType} onValueChange={v=>setGoalForm(f=>({...f,interestType:v as any}))}>
                      <SelectTrigger className="bg-background border-border h-8 text-xs"><SelectValue/></SelectTrigger>
                      <SelectContent><SelectItem value="percentage">% Rate</SelectItem><SelectItem value="fixed_amount">Fixed AED</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs">Rate {goalForm.interestType==="percentage"?"%":"AED"}</Label><Input type="number" placeholder="2.5" value={goalForm.interestRate} onChange={e=>setGoalForm(f=>({...f,interestRate:e.target.value}))} className="bg-background border-border h-8 text-xs"/></div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Frequency</Label>
                    <Select value={goalForm.interestFreq} onValueChange={v=>setGoalForm(f=>({...f,interestFreq:v as any}))}>
                      <SelectTrigger className="bg-background border-border h-8 text-xs"><SelectValue/></SelectTrigger>
                      <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex gap-2">{COLORS.map(c=><button key={c} onClick={()=>setGoalForm(f=>({...f,color:c}))} className={`w-7 h-7 rounded-full border-2 transition-all ${goalForm.color===c?"border-white scale-110":"border-transparent"}`} style={{backgroundColor:c}}/>)}</div>
            </div>

            {/* Auto-Payment */}
            <div className="border border-border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-1">💳 Auto-Payment</Label>
                <Switch checked={goalForm.autoPayEnabled} onCheckedChange={v=>setGoalForm((f:any)=>({...f,autoPayEnabled:v}))}/>
              </div>
              {goalForm.autoPayEnabled && (<>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5"><Label className="text-xs">Frequency</Label>
                    <Select value={(goalForm as any).autoPayFrequency||"monthly"} onValueChange={v=>setGoalForm((f:any)=>({...f,autoPayFrequency:v}))}>
                      <SelectTrigger className="bg-background border-border h-8 text-xs"><SelectValue/></SelectTrigger>
                      <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs">Start Date</Label><input type="date" value={(goalForm as any).autoPayStartDate||""} onChange={e=>setGoalForm((f:any)=>({...f,autoPayStartDate:e.target.value}))} className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"/></div>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">From Account</Label>
                  <Select value={goalForm.autoPayAccountId||"_none"} onValueChange={v=>setGoalForm((f:any)=>({...f,autoPayAccountId:v==="_none"?"":v,autoPayCreditCardId:""}))}>
                    <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger>
                    <SelectContent><SelectItem value="_none">None</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Or from Credit Card</Label>
                  <Select value={goalForm.autoPayCreditCardId||"_none"} onValueChange={v=>setGoalForm((f:any)=>({...f,autoPayCreditCardId:v==="_none"?"":v,autoPayAccountId:""}))}>
                    <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger>
                    <SelectContent><SelectItem value="_none">None</SelectItem>{creditCards.map(c=><SelectItem key={c.id} value={c.id}>{c.name} — AED {c.limit.toLocaleString()} limit</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setGoalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveGoal} disabled={!goalForm.name||!goalForm.targetAmount}>{editGoal?"Save Changes":"Add Goal"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit/Withdraw */}
      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>{txForm.type==="deposit"?"Deposit to":"Withdraw from"} Goal</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount (AED)</Label><Input type="number" placeholder="1000" value={txForm.amount} onChange={e=>setTxForm(f=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={txForm.date} onChange={e=>setTxForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>Note</Label><Input placeholder="e.g. Monthly saving" value={txForm.note} onChange={e=>setTxForm(f=>({...f,note:e.target.value}))} className="bg-background border-border"/></div>
            {txForm.type==="deposit" && (
              <div className="space-y-1.5">
                <Label>Deduct from Account (optional)</Label>
                <Select value={txForm.fromAccountId||"_none"} onValueChange={v=>setTxForm(f=>({...f,fromAccountId:v==="_none"?"":v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Manual (no deduction)"/></SelectTrigger>
                  <SelectContent><SelectItem value="_none">Manual (no account deduction)</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {txForm.type==="withdraw" && (
              <div className="space-y-1.5">
                <Label>Transfer to Account (optional)</Label>
                <Select value={txForm.toAccountId||"_none"} onValueChange={v=>setTxForm(f=>({...f,toAccountId:v==="_none"?"":v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Withdraw only (no account credit)"/></SelectTrigger>
                  <SelectContent><SelectItem value="_none">No account credit</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {txForm.fromAccountId && txForm.amount && <div className="p-2 bg-amber-500/10 rounded text-xs text-amber-400">AED {txForm.amount} will be deducted from {accounts.find(a=>a.id===txForm.fromAccountId)?.name}</div>}
                {txForm.type==="deposit" && (<div className="space-y-1.5"><Label className="text-xs">Or charge Credit Card (optional)</Label>
                  <Select value={txForm.fromCreditCardId||"_none"} onValueChange={v=>setTxForm(f=>({...f,fromCreditCardId:v==="_none"?"":v,fromAccountId:v!=="_none"&&v?"":f.fromAccountId}))}>
                    <SelectTrigger className="bg-background border-border h-8 text-xs"><SelectValue placeholder="None"/></SelectTrigger>
                    <SelectContent><SelectItem value="_none">None</SelectItem>{creditCards.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>)}
            {txForm.toAccountId && txForm.amount && <div className="p-2 bg-primary/10 rounded text-xs text-primary">AED {txForm.amount} will be added to {accounts.find(a=>a.id===txForm.toAccountId)?.name}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setTxOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTx} disabled={!txForm.amount}>{txForm.type==="deposit"?"Deposit":"Withdraw"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Rule */}
      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent className="w-full sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>Add Saving Rule</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rule Type</Label>
              {RULE_CONFIGS.map(cfg=>(
                <button key={cfg.type} onClick={()=>setRuleForm(f=>({...f,type:cfg.type}))} className={`w-full text-left p-3 rounded-lg border text-xs transition-all ${ruleForm.type===cfg.type?"border-primary bg-primary/10":"border-border hover:bg-secondary/50"}`}>
                  <div className="flex items-center gap-2 font-medium text-foreground mb-0.5">{cfg.icon} {cfg.label} {cfg.multi?<span className="text-[9px] text-muted-foreground">(multi-active)</span>:<span className="text-[9px] text-amber-400">(single-active)</span>}</div>
                  <div className="text-muted-foreground">{cfg.desc}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {["one_shot","set_forget","pay_yourself_first","spend_save"].includes(ruleForm.type) && (
                <div className="space-y-1.5"><Label>Amount (AED)</Label><Input type="number" placeholder="500" value={ruleForm.amount||""} onChange={e=>setRuleForm(f=>({...f,amount:parseFloat(e.target.value)||0}))} className="bg-background border-border"/></div>
              )}
              {ruleForm.type==="spend_less" && (
                <div className="space-y-1.5"><Label>Budget Limit (AED)</Label><Input type="number" value={ruleForm.budgetLimit||""} onChange={e=>setRuleForm(f=>({...f,budgetLimit:parseFloat(e.target.value)||0}))} className="bg-background border-border"/></div>
              )}
              {ruleForm.type==="target_day" && (
                <div className="space-y-1.5"><Label>Target Date</Label><Input type="date" value={ruleForm.targetDate||""} onChange={e=>setRuleForm(f=>({...f,targetDate:e.target.value}))} className="bg-background border-border"/></div>
              )}
              {["set_forget","spend_save"].includes(ruleForm.type) && (
                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <Select value={ruleForm.frequency||"monthly"} onValueChange={v=>setRuleForm(f=>({...f,frequency:v as any}))}>
                    <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
                  </Select>
                </div>
              )}
              {ruleForm.type==="pay_yourself_first" && (
                <div className="space-y-1.5">
                  <Label>Trigger Account</Label>
                  <Select value={ruleForm.triggerAccountId||"_none"} onValueChange={v=>setRuleForm(f=>({...f,triggerAccountId:v==="_none"?"":v}))}>
                    <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Any account"/></SelectTrigger>
                    <SelectContent><SelectItem value="_none">Any top-up</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setRuleOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRule}>Add Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
