import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, RefreshCw, CheckCircle2, Clock, AlertTriangle, Trash2, Edit2, Tv, Wifi, Music, Cloud, Shield, Dumbbell, Zap, DollarSign, ChevronDown, ChevronUp, History } from "lucide-react";
import { useDB, RecurringBill } from "@/lib/database";
import { SearchFilter, EMPTY_FILTER, matchesFilter, SearchFilterState } from "@/components/ui/search-filter";

const ICON_MAP: Record<string,any> = { Tv, Wifi, Music, Cloud, Shield, Dumbbell, Zap, DollarSign };
const ICON_OPTIONS = ["Tv","Wifi","Music","Cloud","Shield","Dumbbell","Zap","DollarSign"];
const COLOR_OPTIONS = ["hsl(0,72%,51%)","hsl(140,70%,45%)","hsl(200,80%,50%)","hsl(280,70%,60%)","hsl(40,90%,55%)","hsl(160,84%,39%)","hsl(220,60%,55%)","hsl(330,70%,55%)"];
const CURRENCIES = ["AED","BDT","USD","EUR","GBP"];
const FREQUENCIES: RecurringBill["frequency"][] = ["daily","weekly","monthly","quarterly","yearly"];

const statusConfig = {
  paid:    { icon: CheckCircle2, className: "bg-primary/20 text-primary border-primary/30" },
  pending: { icon: Clock,        className: "bg-warning/20 text-warning border-warning/30" },
  overdue: { icon: AlertTriangle,className: "bg-destructive/20 text-destructive border-destructive/30" },
};

function getNextDueDate(dueDate: string, freq: RecurringBill["frequency"]): string {
  const d = new Date(dueDate);
  if (freq==="daily")     d.setDate(d.getDate()+1);
  else if (freq==="weekly")    d.setDate(d.getDate()+7);
  else if (freq==="monthly")   d.setMonth(d.getMonth()+1);
  else if (freq==="quarterly") d.setMonth(d.getMonth()+3);
  else if (freq==="yearly")    d.setFullYear(d.getFullYear()+1);
  return d.toISOString().slice(0,10);
}

export default function Recurring() {
  const { recurringBills, addRecurringBill, updateBillStatus, payRecurringBill, deleteRecurringPayment, updateRecurringBill, deleteRecurringBill, accounts, creditCards, loyaltyPrograms, addLoyaltyTx, getAccountBalance } = useDB();

  const [payBillId, setPayBillId] = useState("");
  const [payOpen, setPayOpen]     = useState(false);
  const [payForm, setPayForm]     = useState<any>({ method:"account", accountId:"", cardId:"", loyaltyProgramId:"", loyaltyPointsManual:"" });
  const [open, setOpen]           = useState(false);
  const [editBill, setEditBill]   = useState<RecurringBill|null>(null);
  const [historyBillId, setHistoryBillId] = useState<string|null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Record<string,boolean>>({});
  const [filter, setFilter]       = useState<SearchFilterState>(EMPTY_FILTER);
  const [form, setForm]           = useState<any>({ name:"", category:"", amount:0, currency:"AED", frequency:"monthly", dueDate:"", status:"pending", autoPay:false, iconName:"DollarSign", color:COLOR_OPTIONS[0], notes:"", accountId:"", creditCardId:"", loyaltyProgramId:"" });

  const monthly  = recurringBills.filter(b=>b.frequency==="monthly").reduce((s,b)=>s+b.amount,0);
  const paid     = recurringBills.filter(b=>b.status==="paid");
  const overdue  = recurringBills.filter(b=>b.status==="overdue");

  const openAdd  = () => { setEditBill(null); setForm({ name:"", category:"", amount:0, currency:"AED", frequency:"monthly", dueDate:"", status:"pending", autoPay:false, iconName:"DollarSign", color:COLOR_OPTIONS[0], notes:"", accountId:"", creditCardId:"", loyaltyProgramId:"" }); setOpen(true); };
  const openEdit = (b: RecurringBill) => { setEditBill(b); setForm({ name:b.name, category:b.category, amount:b.amount, currency:b.currency, frequency:b.frequency, dueDate:b.dueDate, status:b.status, autoPay:b.autoPay, iconName:b.iconName, color:b.color, notes:b.notes??"", accountId:b.accountId??"", creditCardId:b.creditCardId??"", loyaltyProgramId:(b as any).loyaltyProgramId??"" }); setOpen(true); };

  const handleSubmit = () => {
    if (!form.name||!form.amount) return;
    if (editBill) updateRecurringBill(editBill.id, form);
    else addRecurringBill({ ...form, paymentHistory:[] });
    setOpen(false);
  };

  const openPay = (id: string) => {
    setPayBillId(id);
    setPayForm({ method:"account", accountId:accounts[0]?.id??"", cardId:"", loyaltyProgramId:"", loyaltyPointsManual:"" });
    setPayOpen(true);
  };
  const handlePay = () => {
    payRecurringBill(payBillId, payForm.method, payForm.method==="account"?payForm.accountId:undefined, payForm.method==="card"?payForm.cardId:undefined);
    const bill2 = recurringBills.find(b=>b.id===payBillId);
    const activeProgId = payForm.loyaltyProgramId || (bill2 as any)?.loyaltyProgramId;
    if (activeProgId && bill2) {
      const prog = loyaltyPrograms.find(p=>p.id===activeProgId);
      if (prog) {
        const manualPts = parseFloat(payForm.loyaltyPointsManual||"");
        const autoPts   = prog.earnRate ? Math.floor(bill2.amount*(prog.earnRate)) : 1;
        const pts       = manualPts>0 ? manualPts : autoPts;
        addLoyaltyTx(activeProgId, { date:new Date().toISOString().slice(0,10), points:pts, type:"earned", description:`${bill2.name} payment` });
      }
    }
    setPayOpen(false);
  };

  const filteredBills = useMemo(() =>
    recurringBills.filter(b => matchesFilter(b as any, filter, "dueDate", ["name","category","frequency"])),
    [recurringBills, filter]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Recurring Bills" subtitle="Subscriptions, bills & auto-pay"
        action={<Button className="gap-2" onClick={openAdd}><Plus className="w-4 h-4"/> Add Bill</Button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Monthly Recurring" value={`AED ${monthly.toLocaleString()}`}                        icon={RefreshCw} />
        <StatCard title="Paid"    value={paid.length.toString()} icon={CheckCircle2} changeType="up"   change={`AED ${paid.reduce((s,b)=>s+b.amount,0)}`} />
        <StatCard title="Pending" value={recurringBills.filter(b=>b.status==="pending").length.toString()} icon={Clock} />
        <StatCard title="Overdue" value={overdue.length.toString()} icon={AlertTriangle} changeType={overdue.length>0?"down":"up"} change={overdue.length>0?"Action needed":"All clear"} />
      </div>

      <SearchFilter value={filter} onChange={setFilter} placeholder="Search bills…" />

      <motion.div initial={{opacity:0}} animate={{opacity:1}} className="glass-card divide-y divide-border">
        {recurringBills.length===0 && <div className="p-8 text-center text-muted-foreground text-sm">No recurring bills added.</div>}
        <AnimatePresence>
          {filteredBills.map((bill,i) => {
            const Icon       = ICON_MAP[bill.iconName]??DollarSign;
            const sc         = statusConfig[bill.status];
            const StatusIcon = sc.icon;
            const linkedAcc  = accounts.find(a=>a.id===bill.accountId);
            const linkedCard = creditCards.find(c=>c.id===bill.creditCardId);
            const nextDue    = bill.status==="paid" ? getNextDueDate(bill.dueDate, bill.frequency) : null;
            const histOpen   = expandedHistory[bill.id];
            const payments   = bill.paymentHistory || [];

            return (
              <motion.div key={bill.id} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} exit={{opacity:0}} transition={{delay:i*0.03}} className="flex flex-col hover:bg-secondary/10 transition-colors">
                <div className="flex items-center justify-between p-4 group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{backgroundColor:`${bill.color}20`}}>
                      <Icon className="w-5 h-5" style={{color:bill.color}}/>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{bill.name}</p>
                        {bill.autoPay && <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">Auto</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{bill.category} · Due {bill.dueDate} · {bill.frequency}</p>
                      {nextDue && <p className="text-[10px] text-amber-400">Next due: {nextDue}</p>}
                      {(linkedAcc||linkedCard) && <p className="text-[10px] text-primary">{bill.autoPay?"🔄 Auto":"💳"} {linkedAcc?.name||linkedCard?.name}</p>}
                      {(bill as any).loyaltyProgramId && <p className="text-[10px] text-amber-400">🎁 {loyaltyPrograms.find(p=>p.id===(bill as any).loyaltyProgramId)?.name}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {(["paid","pending","overdue"] as const).map(s=>(
                        <button key={s} onClick={()=>updateBillStatus(bill.id,s)} className={`text-[9px] px-1.5 py-0.5 rounded border transition-all ${bill.status===s?sc.className:"opacity-30 hover:opacity-70 border-border"}`}>{s}</button>
                      ))}
                    </div>
                    <span className="text-sm font-semibold text-foreground min-w-[70px] text-right">{bill.currency} {bill.amount.toLocaleString()}</span>
                    {bill.status!=="paid" && <Button size="sm" className="h-6 text-[10px] gap-1 opacity-0 group-hover:opacity-100" onClick={()=>openPay(bill.id)}><CheckCircle2 className="w-2.5 h-2.5"/>Pay</Button>}
                    {payments.length>0 && (
                      <button onClick={()=>setExpandedHistory(p=>({...p,[bill.id]:!p[bill.id]}))} className="text-muted-foreground hover:text-foreground p-1">
                        <History className="w-3.5 h-3.5"/>
                      </button>
                    )}
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      <button onClick={()=>openEdit(bill)} className="text-muted-foreground hover:text-foreground p-1"><Edit2 className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>deleteRecurringBill(bill.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                </div>

                {/* Payment History */}
                <AnimatePresence>
                  {histOpen && payments.length>0 && (
                    <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                      <div className="px-4 pb-3 border-t border-border/40">
                        <p className="text-xs font-medium text-muted-foreground py-2">Payment History</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {[...payments].reverse().map(p=>{
                            const pAcc  = accounts.find(a=>a.id===p.accountId);
                            const pCard = creditCards.find(c=>c.id===p.cardId);
                            return (
                              <div key={p.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/20 last:border-0 group">
                                <div>
                                  <span className="text-foreground">{p.date}</span>
                                  <span className="text-muted-foreground ml-2">via {p.method}</span>
                                  {(pAcc||pCard) && <span className="text-primary ml-1">— {pAcc?.name||pCard?.name}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-primary font-medium">{bill.currency} {p.amount.toLocaleString()}</span>
                                  <button onClick={()=>deleteRecurringPayment(bill.id, p.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3"/></button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* Add/Edit Bill Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editBill?"Edit":"Add"} Recurring Bill</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Name</Label><Input placeholder="e.g. Netflix" value={form.name} onChange={e=>setForm((f:any)=>({...f,name:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Category</Label><Input placeholder="e.g. Entertainment" value={form.category} onChange={e=>setForm((f:any)=>({...f,category:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Amount</Label><Input type="number" placeholder="0" value={form.amount||""} onChange={e=>setForm((f:any)=>({...f,amount:parseFloat(e.target.value)||0}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Currency</Label>
                <Select value={form.currency} onValueChange={v=>setForm((f:any)=>({...f,currency:v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={v=>setForm((f:any)=>({...f,frequency:v as RecurringBill["frequency"]}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                  <SelectContent>{FREQUENCIES.map(fr=><SelectItem key={fr} value={fr}>{fr}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={e=>setForm((f:any)=>({...f,dueDate:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Icon</Label>
                <Select value={form.iconName} onValueChange={v=>setForm((f:any)=>({...f,iconName:v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                  <SelectContent>{ICON_OPTIONS.map(ic=><SelectItem key={ic} value={ic}>{ic}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Payment account linkage - always visible */}
            <div className="space-y-2 border border-border rounded-lg p-3">
              <Label className="text-xs font-medium">💳 Link Payment Method (optional)</Label>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Deduct from Account</Label>
                <Select value={form.accountId||"_none"} onValueChange={v=>setForm((f:any)=>({...f,accountId:v==="_none"?"":v,creditCardId:""}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger>
                  <SelectContent><SelectItem value="_none">None</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — AED {getAccountBalance(a.id).toLocaleString()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Or charge to Credit Card</Label>
                <Select value={form.creditCardId||"_none"} onValueChange={v=>setForm((f:any)=>({...f,creditCardId:v==="_none"?"":v,accountId:""}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger>
                  <SelectContent><SelectItem value="_none">None</SelectItem>{creditCards.map(c=><SelectItem key={c.id} value={c.id}>{c.name} ···{c.last4}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <Label>Auto-Pay enabled</Label>
              <Switch checked={form.autoPay} onCheckedChange={v=>setForm((f:any)=>({...f,autoPay:v}))}/>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">🎁 Earn Loyalty Points (optional)</Label>
              <Select value={(form as any).loyaltyProgramId||"_none"} onValueChange={v=>setForm((f:any)=>({...f,loyaltyProgramId:v==="_none"?"":v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="No loyalty program"/></SelectTrigger>
                <SelectContent><SelectItem value="_none">None</SelectItem>{loyaltyPrograms.map(p=><SelectItem key={p.id} value={p.id}>{p.name}{p.earnRate?` (${p.earnRate} pts/AED)`:""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">{COLOR_OPTIONS.map(c=>(
                <button key={c} onClick={()=>setForm((f:any)=>({...f,color:c}))} className="w-7 h-7 rounded-full border-2 transition-all" style={{backgroundColor:c,borderColor:form.color===c?"white":"transparent"}}/>
              ))}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.name||!form.amount}>{editBill?"Save":"Add Bill"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Pay Bill</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {(() => { const b = recurringBills.find(b=>b.id===payBillId); return (
              <p className="text-sm text-muted-foreground">Bill: <span className="text-foreground font-medium">{b?.name}</span> — {b?.currency} {b?.amount}</p>
            ); })()}
            <div className="grid grid-cols-3 gap-2">
              {[{v:"account",l:"🏦 Account"},{v:"card",l:"💳 Credit Card"},{v:"cash",l:"💵 Cash"}].map(m=>(
                <button key={m.v} onClick={()=>setPayForm((f:any)=>({...f,method:m.v}))} className={`py-2 rounded-lg text-xs border ${payForm.method===m.v?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground"}`}>{m.l}</button>
              ))}
            </div>
            {payForm.method==="account" && (
              <Select value={payForm.accountId||"_none"} onValueChange={v=>setPayForm((f:any)=>({...f,accountId:v==="_none"?"":v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select account"/></SelectTrigger>
                <SelectContent><SelectItem value="_none">Select account</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — AED {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
              </Select>
            )}
            {payForm.method==="card" && (
              <Select value={payForm.cardId||"_none"} onValueChange={v=>setPayForm((f:any)=>({...f,cardId:v==="_none"?"":v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select card"/></SelectTrigger>
                <SelectContent><SelectItem value="_none">Select card</SelectItem>{creditCards.map(c=><SelectItem key={c.id} value={c.id}>{c.name} ···{c.last4} — Balance AED {Math.abs(c.balance).toLocaleString()} / Limit AED {c.limit.toLocaleString()}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {/* Loyalty points */}
            <div className="space-y-2 border border-border/40 rounded-lg p-3">
              <Label className="text-xs font-medium">🎁 Loyalty Points</Label>
              {(() => {
                const bill = recurringBills.find(b=>b.id===payBillId);
                const savedProgId = (bill as any)?.loyaltyProgramId;
                const activeProgId = payForm.loyaltyProgramId || savedProgId || "";
                const prog = loyaltyPrograms.find(p=>p.id===activeProgId);
                const autoPoints = prog?.earnRate ? Math.floor((bill?.amount||0)*(prog.earnRate)) : 0;
                return (<>
                  {!savedProgId && (
                    <Select value={payForm.loyaltyProgramId||"_none"} onValueChange={v=>setPayForm((f:any)=>({...f,loyaltyProgramId:v==="_none"?"":v,loyaltyPointsManual:""}))}>
                      <SelectTrigger className="bg-background border-border h-8 text-xs"><SelectValue placeholder="No loyalty program"/></SelectTrigger>
                      <SelectContent><SelectItem value="_none">None</SelectItem>{loyaltyPrograms.map(p=><SelectItem key={p.id} value={p.id}>{p.name}{p.earnRate?` · ${p.earnRate} pts/AED`:""}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  {activeProgId && prog && (
                    <div className="space-y-2">
                      <Input type="number" placeholder={`Auto: ${autoPoints} pts`} value={payForm.loyaltyPointsManual||""} onChange={e=>setPayForm((f:any)=>({...f,loyaltyPointsManual:e.target.value}))} className="bg-background border-border h-8 text-xs"/>
                      <p className="text-[10px] text-amber-400">→ Will earn {payForm.loyaltyPointsManual ? parseFloat(payForm.loyaltyPointsManual||"0") : autoPoints} pts in {prog.name}</p>
                    </div>
                  )}
                </>);
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setPayOpen(false)}>Cancel</Button>
            <Button onClick={handlePay}>Mark as Paid</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
