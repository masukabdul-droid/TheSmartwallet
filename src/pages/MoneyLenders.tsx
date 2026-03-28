import { SearchFilter, EMPTY_FILTER, matchesFilter, SearchFilterState } from "@/components/ui/search-filter";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Trash2, Edit2, ChevronDown, ChevronUp, HandCoins, DollarSign, ArrowDownLeft, ArrowUpRight, AlertCircle, CheckCircle2, Minus, Search, Filter } from "lucide-react";
import { useDB, MoneyLender, LendRecord } from "@/lib/database";

const COLORS = ["hsl(160,84%,39%)","hsl(200,80%,50%)","hsl(280,70%,60%)","hsl(40,90%,55%)","hsl(0,72%,51%)","hsl(220,60%,55%)","hsl(330,70%,55%)"];
const CURRENCIES = ["AED","BDT","USD","EUR","GBP","INR"];
const SCHEDULES: LendRecord["returnSchedule"][] = ["one_time","daily","weekly","monthly","yearly"];

const STATUS_CONFIG = {
  active:    { label:"Active",         color:"bg-primary/20 text-primary",         icon:"🟢" },
  partially_paid: { label:"Partial",   color:"bg-amber-500/20 text-amber-400",     icon:"🟡" },
  settled:   { label:"Settled",        color:"bg-green-500/20 text-green-400",     icon:"✅" },
  waived:    { label:"Waived",         color:"bg-secondary text-muted-foreground", icon:"🚫" },
};

const EMPTY_LENDER = { name:"", phone:"", email:"", notes:"", color:COLORS[0] };
const EMPTY_RECORD: any = { type:"lent", amount:"", currency:"AED", description:"", issueDate:new Date().toISOString().slice(0,10), dueDate:"", returnSchedule:"one_time", linkedAccountId:"", interestType:"none", interestRate:"", interestFixed:"" };
const EMPTY_PAYMENT = { date:new Date().toISOString().slice(0,10), amount:"", note:"", linkedAccountId:"", isInterest:false };

export default function MoneyLenders() {
  const { moneyLenders, accounts, addMoneyLender, updateMoneyLender, deleteMoneyLender, addLendRecord, updateLendRecord, deleteLendRecord, addLendPayment, updateLendPayment, deleteLendPayment, waiveLendRecord, getAccountBalance } = useDB();
  const [filter, setFilter] = useState<SearchFilterState>(EMPTY_FILTER);
  const [expanded, setExpanded] = useState<string|null>(null);

  const [lenderOpen, setLenderOpen] = useState(false);
  const [editLender, setEditLender] = useState<MoneyLender|null>(null);
  const [lenderForm, setLenderForm] = useState(EMPTY_LENDER);

  const [recordOpen, setRecordOpen] = useState(false);
  const [recordLenderId, setRecordLenderId] = useState("");
  const [recordForm, setRecordForm] = useState<any>(EMPTY_RECORD);
  const [editingRecordId, setEditingRecordId] = useState<string|null>(null);

  const [payOpen, setPayOpen] = useState(false);
  const [payLenderId, setPayLenderId] = useState("");
  const [payRecordId, setPayRecordId] = useState("");
  const [payForm, setPayForm] = useState(EMPTY_PAYMENT);
  const [editingPaymentId, setEditingPaymentId] = useState<string|null>(null);

  const [waiveConfirm, setWaiveConfirm] = useState<{lenderId:string;recordId:string}|null>(null);
  const [filterName, setFilterName] = useState("");
  const [filterType, setFilterType] = useState("all"); // all | lent | borrowed
  const [filterStatus, setFilterStatus] = useState("all"); // all | active | partially_paid | settled | waived
  const [filterMonth, setFilterMonth] = useState("all"); // all | 1..12
  const [filterYear, setFilterYear] = useState("all"); // all | 2020..currentYear
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const totalLent = moneyLenders.flatMap(m=>m.records).filter(r=>r.type==="lent"&&r.status!=="settled"&&r.status!=="waived").reduce((s,r)=>s+r.amount,0);
  const totalBorrowed = moneyLenders.flatMap(m=>m.records).filter(r=>r.type==="borrowed"&&r.status!=="settled"&&r.status!=="waived").reduce((s,r)=>s+r.amount,0);
  const pendingCount = moneyLenders.flatMap(m=>m.records).filter(r=>r.status==="active"||r.status==="partially_paid").length;
  const totalWaived = moneyLenders.flatMap(m=>m.records).filter(r=>r.status==="waived").reduce((s,r)=>s+r.amount,0);
  const lifeTimeLent = moneyLenders.flatMap(m=>m.records).filter(r=>r.type==="lent").reduce((s,r)=>s+r.amount,0);
  const lifeTimeBorrowed = moneyLenders.flatMap(m=>m.records).filter(r=>r.type==="borrowed").reduce((s,r)=>s+r.amount,0);
  // Filtered lenders based on search and filters
  const filteredLenders = moneyLenders.filter(m=>{
    if (filterName && !m.name.toLowerCase().includes(filterName.toLowerCase()) && !m.phone?.includes(filterName) && !m.email?.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterType !== "all" || filterStatus !== "all" || filterMonth !== "all" || filterYear !== "all" || filterDateFrom || filterDateTo) {
      const hasMatchingRecord = m.records.some(r=>{
        if (filterType !== "all" && r.type !== filterType) return false;
        if (filterStatus !== "all" && r.status !== filterStatus) return false;
        if (filterMonth !== "all" || filterYear !== "all") {
          const d = new Date(r.issueDate);
          if (filterMonth !== "all" && d.getMonth() + 1 !== parseInt(filterMonth)) return false;
          if (filterYear !== "all" && d.getFullYear() !== parseInt(filterYear)) return false;
        }
        if (filterDateFrom && r.issueDate < filterDateFrom) return false;
        if (filterDateTo && r.issueDate > filterDateTo) return false;
        return true;
      });
      if (!hasMatchingRecord) return false;
    }
    return true;
  });

  // Dashboard stats that reflect current filters
  const filteredRecords = filteredLenders.flatMap(m=>m.records).filter(r=>{
    if (filterType !== "all" && r.type !== filterType) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterMonth !== "all" || filterYear !== "all") {
      const d = new Date(r.issueDate);
      if (filterMonth !== "all" && d.getMonth()+1 !== parseInt(filterMonth)) return false;
      if (filterYear !== "all" && d.getFullYear() !== parseInt(filterYear)) return false;
    }
    if (filterDateFrom && r.issueDate < filterDateFrom) return false;
    if (filterDateTo && r.issueDate > filterDateTo) return false;
    return true;
  });
  const filteredTotalLent = filteredRecords.filter(r=>r.type==="lent"&&r.status!=="settled"&&r.status!=="waived").reduce((s,r)=>s+r.amount,0);
  const filteredTotalBorrowed = filteredRecords.filter(r=>r.type==="borrowed"&&r.status!=="settled"&&r.status!=="waived").reduce((s,r)=>s+r.amount,0);
  const filteredWaived = filteredRecords.filter(r=>r.status==="waived").reduce((s,r)=>s+r.amount,0);
  const filteredPending = filteredRecords.filter(r=>r.status==="active"||r.status==="partially_paid").length;
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from(new Set(moneyLenders.flatMap(m=>m.records).map(r=>new Date(r.issueDate).getFullYear()))).sort((a,b)=>b-a);
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const openAddLender = () => { setEditLender(null); setLenderForm(EMPTY_LENDER); setLenderOpen(true); };
  const openEditLender = (m: MoneyLender) => { setEditLender(m); setLenderForm({ name:m.name, phone:m.phone||"", email:m.email||"", notes:m.notes||"", color:m.color }); setLenderOpen(true); };
  const handleSaveLender = () => {
    if (!lenderForm.name) return;
    if (editLender) updateMoneyLender(editLender.id, lenderForm);
    else addMoneyLender(lenderForm);
    setLenderOpen(false);
  };

  const openAddRecord = (lenderId: string, record?: any) => {
    setRecordLenderId(lenderId);
    if (record) {
      setEditingRecordId(record.id);
      setRecordForm({
        type: record.type,
        amount: String(record.amount),
        currency: record.currency,
        description: record.description,
        issueDate: record.issueDate,
        dueDate: record.dueDate || "",
        returnSchedule: record.returnSchedule,
        linkedAccountId: record.linkedAccountId || "",
        interestType: record.interestType,
        interestRate: record.interestRate ? String(record.interestRate) : "",
        interestFixed: record.interestFixed ? String(record.interestFixed) : ""
      });
    } else {
      setEditingRecordId(null);
      setRecordForm(EMPTY_RECORD);
    }
    setRecordOpen(true);
  };
  const handleSaveRecord = () => {
    const amt = parseFloat(recordForm.amount);
    if (!amt||!recordLenderId) return;
    const recordData = {
      type: recordForm.type,
      amount: amt,
      currency: recordForm.currency,
      description: recordForm.description,
      issueDate: recordForm.issueDate,
      dueDate: recordForm.dueDate || undefined,
      returnSchedule: recordForm.returnSchedule,
      linkedAccountId: recordForm.linkedAccountId || undefined,
      interestType: recordForm.interestType,
      interestRate: recordForm.interestRate ? parseFloat(recordForm.interestRate) : undefined,
      interestFixed: recordForm.interestFixed ? parseFloat(recordForm.interestFixed) : undefined,
      status: editingRecordId ? undefined : "active" as const
    };
    if (editingRecordId) {
      updateLendRecord(recordLenderId, editingRecordId, recordData);
    } else {
      addLendRecord(recordLenderId, recordData);
    }
    setRecordOpen(false);
  };
  const handleDeleteRecord = () => {
    if (!editingRecordId || !recordLenderId) return;
    if (confirm("Delete this record? Associated payments will also be deleted.")) {
      deleteLendRecord(recordLenderId, editingRecordId);
      setRecordOpen(false);
    }
  };

  const openPay = (lenderId: string, recordId: string, paymentId?: string) => {
    const r = moneyLenders.find(m=>m.id===lenderId)?.records.find(r=>r.id===recordId);
    setPayLenderId(lenderId); setPayRecordId(recordId);
    if (paymentId) {
      setEditingPaymentId(paymentId);
      const payment = r?.payments.find(p => p.id === paymentId);
      setPayForm({
        date: payment?.date || new Date().toISOString().slice(0,10),
        amount: String(payment?.amount || ""),
        note: payment?.note || "",
        linkedAccountId: payment?.linkedAccountId || r?.linkedAccountId || "",
        isInterest: payment?.isInterest || false
      });
    } else {
      setEditingPaymentId(null);
      setPayForm({ ...EMPTY_PAYMENT, linkedAccountId: r?.linkedAccountId||"" });
    }
    setPayOpen(true);
  };
  const handlePay = () => {
    const amt = parseFloat(payForm.amount);
    if (!amt) return;
    const paymentData = {
      date: payForm.date,
      amount: amt,
      note: payForm.note,
      linkedAccountId: payForm.linkedAccountId || undefined,
      isInterest: payForm.isInterest
    };
    if (editingPaymentId) {
      updateLendPayment(payLenderId, payRecordId, editingPaymentId, paymentData);
    } else {
      addLendPayment(payLenderId, payRecordId, paymentData);
    }
    setPayOpen(false);
  };
  const handleDeletePayment = () => {
    if (!editingPaymentId || !payLenderId || !payRecordId) return;
    if (confirm("Delete this payment?")) {
      deleteLendPayment(payLenderId, payRecordId, editingPaymentId);
      setPayOpen(false);
    }
  };

  const getInterestAccrued = (r: LendRecord): number => {
    if (!r.interestType||r.interestType==="none") return 0;
    const days = (Date.now()-new Date(r.issueDate).getTime())/(1000*60*60*24);
    if (r.interestType==="percentage"&&r.interestRate) return r.amount*(r.interestRate/100)*(days/365);
    if (r.interestType==="fixed"&&r.interestFixed) return r.interestFixed;
    return 0;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Money Lenders" subtitle="Track borrowed & lent money"
        action={<Button className="gap-2" onClick={openAddLender}><Plus className="w-4 h-4"/>Add Person</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Active Lent" value={`AED ${filteredTotalLent.toLocaleString()}`} icon={ArrowUpRight} changeType="down" />
        <StatCard title="Active Borrowed" value={`AED ${filteredTotalBorrowed.toLocaleString()}`} icon={ArrowDownLeft} changeType="down" />
        <StatCard title="Waived" value={`AED ${filteredWaived.toLocaleString()}`} icon={CheckCircle2} />
        <StatCard title="Pending" value={filteredPending.toString()} icon={AlertCircle} changeType={filteredPending>0?"down":"up"} />
      </div>

      {/* Lifetime summary */}
      <div className="glass-card p-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>📊 Lifetime Lent: <strong className="text-foreground">AED {lifeTimeLent.toLocaleString()}</strong></span>
        <span>📊 Lifetime Borrowed: <strong className="text-foreground">AED {lifeTimeBorrowed.toLocaleString()}</strong></span>
        <span>🚫 Total Waived: <strong className="text-foreground">AED {totalWaived.toLocaleString()}</strong></span>
        <span>👥 People: <strong className="text-foreground">{filteredLenders.length}/{moneyLenders.length}</strong></span>
        {(filterName||filterType!=="all"||filterStatus!=="all"||filterMonth!=="all"||filterYear!=="all") && <span className="text-primary">⚡ Filtered view</span>}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-40">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0"/>
          <input value={filterName} onChange={e=>setFilterName(e.target.value)} placeholder="Search by name, phone, email..." className="bg-transparent text-sm flex-1 outline-none text-foreground placeholder:text-muted-foreground"/>
        </div>
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground">
          <option value="all">All Types</option>
          <option value="lent">Lent</option>
          <option value="borrowed">Borrowed</option>
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="partially_paid">Partial</option>
          <option value="settled">Settled</option>
          <option value="waived">Waived</option>
        </select>
        <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground">
          <option value="all">All Months</option>
          {MONTHS.map((m,i)=><option key={i+1} value={String(i+1)}>{m}</option>)}
        </select>
        <select value={filterYear} onChange={e=>setFilterYear(e.target.value)} className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground">
          <option value="all">All Years</option>
          {availableYears.map(y=><option key={y} value={String(y)}>{y}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} placeholder="From" className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground w-32"/>
          <span className="text-muted-foreground">to</span>
          <input type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)} placeholder="To" className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground w-32"/>
        </div>
        {(filterName||filterType!=="all"||filterStatus!=="all"||filterMonth!=="all"||filterYear!=="all"||filterDateFrom||filterDateTo) && <button onClick={()=>{setFilterName("");setFilterType("all");setFilterStatus("all");setFilterMonth("all");setFilterYear("all");setFilterDateFrom("");setFilterDateTo("");}} className="text-xs text-muted-foreground hover:text-foreground">✕ Clear</button>}
      </div>

      {filteredLenders.length===0 && (
        <div className="glass-card p-12 text-center">
          <HandCoins className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3"/>
          <p className="text-muted-foreground">No records yet</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Track money lent to friends, family, or borrowed from others.</p>
          <Button className="mt-4 gap-2" onClick={openAddLender}><Plus className="w-4 h-4"/>Add First Person</Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {filteredLenders.map((lender,i)=>{
          const activeRecords = lender.records.filter(r=>r.status==="active"||r.status==="partially_paid");
          const totalOut = lender.records.filter(r=>r.type==="lent").reduce((s,r)=>s+r.amount,0);
          const totalIn = lender.records.filter(r=>r.type==="borrowed").reduce((s,r)=>s+r.amount,0);
          const isExp = expanded===lender.id;

          return (
            <motion.div key={lender.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.08}} className="glass-card overflow-hidden">
              <div className="p-5 border-b border-border" style={{borderLeftColor:lender.color,borderLeftWidth:4}}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold" style={{backgroundColor:`${lender.color}25`,color:lender.color}}>
                      {lender.name.slice(0,1).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{lender.name}</p>
                      <p className="text-xs text-muted-foreground">{lender.phone||lender.email||"No contact"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={()=>openAddRecord(lender.id)}><Plus className="w-3 h-3"/>Record</Button>
                    <button onClick={()=>openEditLender(lender)} className="text-muted-foreground hover:text-foreground p-1"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>deleteMoneyLender(lender.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs">
                  <div><p className="text-muted-foreground">Lent Out</p><p className="font-semibold stat-down">AED {totalOut.toLocaleString()}</p></div>
                  <div><p className="text-muted-foreground">Borrowed</p><p className="font-semibold stat-up">AED {totalIn.toLocaleString()}</p></div>
                  <div><p className="text-muted-foreground">Pending</p><p className="font-semibold text-amber-400">{activeRecords.length} records</p></div>
                </div>
              </div>

              <button onClick={()=>setExpanded(isExp?null:lender.id)} className="w-full flex items-center justify-center py-2.5 text-xs text-muted-foreground hover:text-foreground border-b border-border">
                {isExp?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}
              </button>

              <AnimatePresence>
                {isExp && (
                  <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                    <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
                      {lender.records.length===0&&<p className="text-xs text-center text-muted-foreground">No records yet.</p>}
                      {lender.records.map(r=>{
                        const paid = r.payments.filter(p=>!p.isInterest).reduce((s,p)=>s+p.amount,0);
                        const interest = getInterestAccrued(r);
                        const remaining = r.amount - paid;
                        const sc = STATUS_CONFIG[r.status];
                        return (
                          <div key={r.id} className="border border-border rounded-lg p-3">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs">{r.type==="lent"?"↑ Lent":"↓ Borrowed"}</span>
                                  <Badge className={`text-[9px] ${sc.color}`}>{sc.icon} {sc.label}</Badge>
                                  {r.dueDate&&new Date(r.dueDate)<new Date()&&r.status==="active"&&<Badge className="text-[9px] bg-red-500/20 text-red-400">Overdue</Badge>}
                                </div>
                                <p className="text-sm font-medium text-foreground mt-0.5">{r.description}</p>
                                <p className="text-[10px] text-muted-foreground">Issued {r.issueDate}{r.dueDate?` · Due ${r.dueDate}`:""}{r.returnSchedule!=="one_time"?` · ${r.returnSchedule}`:""}</p>
                              </div>
                              <div className="flex items-start gap-2">
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-bold text-foreground">{r.currency} {r.amount.toLocaleString()}</p>
                                  {remaining>0&&<p className="text-xs text-amber-400">Remaining: {remaining.toLocaleString()}</p>}
                                  {interest>0&&<p className="text-[10px] text-muted-foreground">~Interest: {interest.toFixed(2)}</p>}
                                </div>
                                <div className="flex flex-col gap-1">
                                  <button onClick={()=>openAddRecord(lender.id,r)} className="text-muted-foreground hover:text-foreground p-1" title="Edit record"><Edit2 className="w-3.5 h-3.5"/></button>
                                  <button onClick={()=>{ if(confirm("Delete this record?")) deleteLendRecord(lender.id,r.id); }} className="text-muted-foreground hover:text-destructive p-1" title="Delete record"><Trash2 className="w-3.5 h-3.5"/></button>
                                </div>
                              </div>
                            </div>
                            {r.status!=="settled"&&r.status!=="waived" && (
                              <div className="flex gap-1.5 flex-wrap">
                                <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={()=>openPay(lender.id,r.id)}><Plus className="w-2.5 h-2.5"/>Payment</Button>
                                <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-amber-400 border-amber-500/30" onClick={()=>setWaiveConfirm({lenderId:lender.id,recordId:r.id})}><Minus className="w-2.5 h-2.5"/>Waive</Button>
                              </div>
                            )}
                            {r.payments.length>0&&(
                              <div className="mt-2 space-y-0.5">
                                {r.payments.map(p=>(
                                  <div key={p.id} className="flex justify-between items-center text-[10px] text-muted-foreground group">
                                    <span className="flex items-center gap-2">
                                      {p.date} · {p.note||"Payment"}{p.isInterest?" (interest)":""}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-green-400">+{p.amount.toLocaleString()}</span>
                                      <button onClick={()=>openPay(lender.id,r.id,p.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-0.5" title="Edit payment"><Edit2 className="w-3 h-3"/></button>
                                      <button onClick={()=>{ if(confirm("Delete this payment?")) deleteLendPayment(lender.id,r.id,p.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5" title="Delete payment"><Trash2 className="w-3 h-3"/></button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Add/Edit Person */}
      <Dialog open={lenderOpen} onOpenChange={setLenderOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>{editLender?"Edit":"Add"} Person</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Name</Label><Input placeholder="e.g. Ahmed, Brother, Company" value={lenderForm.name} onChange={e=>setLenderForm(f=>({...f,name:e.target.value}))} className="bg-background border-border"/></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Phone (opt.)</Label><Input value={lenderForm.phone} onChange={e=>setLenderForm(f=>({...f,phone:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Email (opt.)</Label><Input value={lenderForm.email} onChange={e=>setLenderForm(f=>({...f,email:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={lenderForm.notes} onChange={e=>setLenderForm(f=>({...f,notes:e.target.value}))} className="bg-background border-border"/></div>
            <div className="space-y-1.5"><Label>Color</Label><div className="flex gap-2">{COLORS.map(c=><button key={c} onClick={()=>setLenderForm(f=>({...f,color:c}))} className="w-7 h-7 rounded-full border-2" style={{backgroundColor:c,borderColor:lenderForm.color===c?"white":"transparent"}}/>)}</div></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setLenderOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveLender} disabled={!lenderForm.name}>{editLender?"Save":"Add Person"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Record */}
      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="w-full sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingRecordId ? "Edit Lending Record" : "Add Lending Record"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={()=>setRecordForm((f:any)=>({...f,type:"lent"}))} className={`py-2 rounded-lg text-xs border ${recordForm.type==="lent"?"border-destructive bg-destructive/10 text-destructive":"border-border text-muted-foreground"}`}>↑ I Lent Money</button>
              <button onClick={()=>setRecordForm((f:any)=>({...f,type:"borrowed"}))} className={`py-2 rounded-lg text-xs border ${recordForm.type==="borrowed"?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground"}`}>↓ I Borrowed Money</button>
            </div>
            <div className="space-y-1.5"><Label>Description</Label><Input placeholder="e.g. Rent help, Emergency loan" value={recordForm.description} onChange={e=>setRecordForm((f:any)=>({...f,description:e.target.value}))} className="bg-background border-border"/></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5 col-span-2"><Label>Amount</Label><Input type="number" value={recordForm.amount} onChange={e=>setRecordForm((f:any)=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Currency</Label><Select value={recordForm.currency} onValueChange={v=>setRecordForm((f:any)=>({...f,currency:v}))}><SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger><SelectContent>{CURRENCIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Issue Date</Label><Input type="date" value={recordForm.issueDate} onChange={e=>setRecordForm((f:any)=>({...f,issueDate:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Due Date (opt.)</Label><Input type="date" value={recordForm.dueDate} onChange={e=>setRecordForm((f:any)=>({...f,dueDate:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Return Schedule</Label><Select value={recordForm.returnSchedule} onValueChange={v=>setRecordForm((f:any)=>({...f,returnSchedule:v}))}><SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger><SelectContent>{SCHEDULES.map(s=><SelectItem key={s} value={s!} className="capitalize">{s}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Linked Account</Label><Select value={recordForm.linkedAccountId||"_none"} onValueChange={v=>setRecordForm((f:any)=>({...f,linkedAccountId:v==="_none"?"":v}))}><SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger><SelectContent><SelectItem value="_none">None</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — AED {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="border border-border rounded-lg p-3 space-y-2">
              <Label className="text-xs">Interest / Fees</Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label className="text-[10px]">Type</Label><Select value={recordForm.interestType} onValueChange={v=>setRecordForm((f:any)=>({...f,interestType:v}))}><SelectTrigger className="bg-background border-border h-7 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="percentage">% Rate</SelectItem><SelectItem value="fixed">Fixed AED</SelectItem></SelectContent></Select></div>
                {recordForm.interestType==="percentage"&&<div className="space-y-1 col-span-2"><Label className="text-[10px]">Annual Rate %</Label><Input type="number" placeholder="5" value={recordForm.interestRate} onChange={e=>setRecordForm((f:any)=>({...f,interestRate:e.target.value}))} className="bg-background border-border h-7 text-xs"/></div>}
                {recordForm.interestType==="fixed"&&<div className="space-y-1 col-span-2"><Label className="text-[10px]">Fixed Amount</Label><Input type="number" value={recordForm.interestFixed} onChange={e=>setRecordForm((f:any)=>({...f,interestFixed:e.target.value}))} className="bg-background border-border h-7 text-xs"/></div>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setRecordOpen(false)}>Cancel</Button>
            {editingRecordId && <Button variant="destructive" onClick={handleDeleteRecord}>Delete</Button>}
            <Button onClick={handleSaveRecord} disabled={!recordForm.amount}>{editingRecordId ? "Save Changes" : "Add Record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record/Edit Payment */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingPaymentId ? "Edit Payment" : "Record Payment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount</Label><Input type="number" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={payForm.date} onChange={e=>setPayForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>Note</Label><Input placeholder="e.g. Partial repayment" value={payForm.note} onChange={e=>setPayForm(f=>({...f,note:e.target.value}))} className="bg-background border-border"/></div>
            <div className="space-y-1.5"><Label>Link to Account (optional)</Label>
              <Select value={payForm.linkedAccountId||"_none"} onValueChange={v=>setPayForm(f=>({...f,linkedAccountId:v==="_none"?"":v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="No account"/></SelectTrigger>
                <SelectContent><SelectItem value="_none">No account</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — AED {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isInterest" checked={payForm.isInterest} onChange={e=>setPayForm(f=>({...f,isInterest:e.target.checked}))} className="rounded"/>
              <Label htmlFor="isInterest" className="text-sm cursor-pointer">This is an interest/fee payment</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setPayOpen(false)}>Cancel</Button>
            {editingPaymentId && <Button variant="destructive" onClick={handleDeletePayment}>Delete</Button>}
            <Button onClick={handlePay} disabled={!payForm.amount}>{editingPaymentId ? "Save Changes" : "Record Payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Waive Confirm */}
      <Dialog open={!!waiveConfirm} onOpenChange={()=>setWaiveConfirm(null)}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Waive Unpaid Amount?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">This marks the remaining amount as waived — it will never be received or paid. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setWaiveConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={()=>{ if(waiveConfirm) { waiveLendRecord(waiveConfirm.lenderId, waiveConfirm.recordId); setWaiveConfirm(null); } }}>Waive Amount</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
