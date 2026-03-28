import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Banknote, Plus, TrendingDown, DollarSign, Calendar, Trash2, Edit2, ChevronDown, ChevronUp, Repeat, CheckCircle } from "lucide-react";
import { useDB, Loan } from "@/lib/database";
import { SearchFilter, EMPTY_FILTER, matchesFilter, SearchFilterState } from "@/components/ui/search-filter";

const LOAN_TYPES: Loan["type"][] = ["car","personal","home","credit_card_emi","other"];
const PAYMENT_METHODS = [
  { value:"bank_account",    label:"Bank Account",             icon:"🏦" },
  { value:"cash",            label:"Cash",                     icon:"💵" },
  { value:"credit_card",     label:"Credit Card",              icon:"💳" },
  { value:"standing_order",  label:"Standing Order / Auto-Debit", icon:"🔄" },
  { value:"cheque",          label:"Cheque",                   icon:"📄" },
  { value:"online",          label:"Online Banking / App",     icon:"📱" },
  { value:"other",           label:"Other",                    icon:"📌" },
];
const EMPTY_LOAN = { name:"", type:"personal" as Loan["type"], lender:"", totalAmount:"", emiAmount:"", interestRate:"", tenure:"", nextDueDate:"", color:"hsl(200,80%,50%)", notes:"", autoPayAccountId:"", autoPayCardId:"", autoPayEnabled:false };
const EMPTY_PAYMENT = { amount:"", date:new Date().toISOString().slice(0,10), note:"", paymentMethod:"bank_account" as any, accountId:"", creditCardId:"" };

export default function Installments() {
  const { loans, accounts, creditCards, addLoan, addLoanPayment, updateLoanPayment, deleteLoanPayment, updateLoan, deleteLoan, getAccountBalance } = useDB();
  const [expanded, setExpanded]   = useState<string|null>(null);
  const [loanOpen, setLoanOpen]   = useState(false);
  const [editLoan, setEditLoan]   = useState<Loan|null>(null);
  const [loanForm, setLoanForm]   = useState(EMPTY_LOAN);
  const [payDialogId, setPayDialogId] = useState("");
  const [payOpen, setPayOpen]     = useState(false);
  const [payForm, setPayForm]     = useState(EMPTY_PAYMENT);
  const [editPayId, setEditPayId] = useState<{loanId:string,txId:string}|null>(null);
  const [editPayForm, setEditPayForm] = useState({amount:"",note:"",date:"",paymentMethod:"bank_account",accountId:"",creditCardId:""});
  const [filter, setFilter]       = useState<SearchFilterState>(EMPTY_FILTER);

  const totalDebt = loans.reduce((s,l)=>s+l.remainingBalance,0);
  const totalEMI  = loans.reduce((s,l)=>s+l.emiAmount,0);
  const totalPaid = loans.reduce((s,l)=>s+l.paidAmount,0);

  const openLoanAdd  = () => { setEditLoan(null); setLoanForm(EMPTY_LOAN); setLoanOpen(true); };
  const openLoanEdit = (l: Loan) => {
    setEditLoan(l);
    setLoanForm({ name:l.name, type:l.type, lender:l.lender, totalAmount:String(l.totalAmount), emiAmount:String(l.emiAmount), interestRate:String(l.interestRate), tenure:String(l.tenure), nextDueDate:l.nextDueDate, color:l.color, notes:l.notes||"", autoPayAccountId:l.autoPayAccountId||"", autoPayCardId:l.autoPayCardId||"", autoPayEnabled:!!l.autoPayEnabled });
    setLoanOpen(true);
  };
  const handleSaveLoan = () => {
    if (!loanForm.name) return;
    const totalAmt = parseFloat(loanForm.totalAmount)||0;
    const paidAmt  = editLoan ? editLoan.paidAmount : 0;
    const data = { name:loanForm.name, type:loanForm.type, lender:loanForm.lender, totalAmount:totalAmt, paidAmount:paidAmt, remainingBalance:totalAmt-paidAmt, emiAmount:parseFloat(loanForm.emiAmount)||0, interestRate:parseFloat(loanForm.interestRate)||0, tenure:parseInt(loanForm.tenure)||0, monthsPaid:editLoan?editLoan.monthsPaid:0, nextDueDate:loanForm.nextDueDate, color:loanForm.color, notes:loanForm.notes, autoPayAccountId:loanForm.autoPayAccountId||undefined, autoPayCardId:loanForm.autoPayCardId||undefined, autoPayEnabled:loanForm.autoPayEnabled };
    if (editLoan) updateLoan(editLoan.id, data); else addLoan(data);
    setLoanOpen(false);
  };

  const openPay = (loanId: string, l: Loan) => {
    setPayDialogId(loanId);
    setPayForm({ ...EMPTY_PAYMENT, amount:String(l.emiAmount), accountId:l.autoPayAccountId||"", creditCardId:l.autoPayCardId||"", paymentMethod:l.autoPayAccountId?"bank_account":l.autoPayCardId?"credit_card":"bank_account" });
    setPayOpen(true);
  };
  const handlePay = () => {
    const amt = parseFloat(payForm.amount);
    if (!amt) return;
    const accountId    = payForm.paymentMethod==="bank_account" ? payForm.accountId||undefined : undefined;
    const creditCardId = payForm.paymentMethod==="credit_card"  ? payForm.creditCardId||undefined : undefined;
    addLoanPayment(payDialogId, { date:payForm.date, amount:amt, type:"payment", note:payForm.note||"EMI Payment", paymentMethod:payForm.paymentMethod, accountId, creditCardId });
    setPayOpen(false);
  };

  // Save edited payment — reflects in accounts
  const handleSaveEditPayment = (loanId: string, txId: string) => {
    const amt = parseFloat(editPayForm.amount);
    if (!amt) return;
    const accountId    = editPayForm.paymentMethod==="bank_account" ? editPayForm.accountId||undefined : undefined;
    const creditCardId = editPayForm.paymentMethod==="credit_card"  ? editPayForm.creditCardId||undefined : undefined;
    updateLoanPayment(loanId, txId, { amount:amt, note:editPayForm.note, date:editPayForm.date, paymentMethod:editPayForm.paymentMethod as any, accountId, creditCardId });
    setEditPayId(null);
  };

  const filteredLoans = useMemo(() =>
    loans.filter(l => matchesFilter(l as any, filter, "nextDueDate", ["name","lender","type"])),
    [loans, filter]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Loans & EMI" subtitle="Debt management"
        action={<Button className="gap-2" onClick={openLoanAdd}><Plus className="w-4 h-4"/>Add Loan</Button>}/>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Total Debt"   value={`AED ${totalDebt.toLocaleString()}`}  icon={TrendingDown} changeType="down"/>
        <StatCard title="Monthly EMI"  value={`AED ${totalEMI.toLocaleString()}`}   icon={Calendar}/>
        <StatCard title="Total Paid"   value={`AED ${totalPaid.toLocaleString()}`}  icon={DollarSign} changeType="up"/>
        <StatCard title="Loans"        value={loans.length.toString()}              icon={Banknote}/>
      </div>

      <SearchFilter value={filter} onChange={setFilter} placeholder="Search loans…" />

      <div className="space-y-4">
        {loans.length===0 && <div className="p-8 text-center text-muted-foreground glass-card text-sm">No loans added.</div>}
        {filteredLoans.map((loan,i)=>{
          const pct   = loan.totalAmount>0 ? Math.min(100,(loan.paidAmount/loan.totalAmount)*100) : 0;
          const isExp = expanded===loan.id;
          const autoPayAcc  = accounts.find(a=>a.id===loan.autoPayAccountId);
          const autoPayCard = creditCards.find(c=>c.id===loan.autoPayCardId);

          return (
            <motion.div key={loan.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.08}} className="glass-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{backgroundColor:`${loan.color}25`}}>
                    <Banknote className="w-5 h-5" style={{color:loan.color}}/>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{loan.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">{loan.lender} · {loan.type.replace("_"," ")}</p>
                      {loan.autoPayEnabled && (autoPayAcc||autoPayCard) && (
                        <span className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded"><Repeat className="w-2.5 h-2.5"/>Auto: {autoPayAcc?.name||autoPayCard?.name}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right mr-2">
                    <p className="text-lg font-display font-bold text-foreground">AED {loan.remainingBalance.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">remaining</p>
                  </div>
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={()=>openPay(loan.id,loan)}><CheckCircle className="w-3 h-3"/>Pay EMI</Button>
                  <button onClick={()=>openLoanEdit(loan)} className="text-muted-foreground hover:text-foreground p-1"><Edit2 className="w-3.5 h-3.5"/></button>
                  <button onClick={()=>deleteLoan(loan.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-4">
                <div><p className="text-xs text-muted-foreground">EMI</p><p className="text-sm font-semibold text-foreground">AED {loan.emiAmount.toLocaleString()}/mo</p></div>
                <div><p className="text-xs text-muted-foreground">Rate</p><p className="text-sm font-semibold text-foreground">{loan.interestRate}%</p></div>
                <div><p className="text-xs text-muted-foreground">Paid</p><p className="text-sm font-semibold stat-up">{loan.monthsPaid}/{loan.tenure} mo</p></div>
                <div><p className="text-xs text-muted-foreground">Due</p><p className="text-sm font-semibold text-foreground">{loan.nextDueDate.slice(8)}/{loan.nextDueDate.slice(5,7)}</p></div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Repaid {pct.toFixed(1)}%</span>
                  <span>AED {loan.paidAmount.toLocaleString()} of {loan.totalAmount.toLocaleString()}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{width:`${pct}%`,backgroundColor:loan.color}}/>
                </div>
              </div>

              {loan.transactions.length>0 && (
                <>
                  <button onClick={()=>setExpanded(isExp?null:loan.id)} className="mt-3 w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground">
                    <span>Payment History ({loan.transactions.length})</span>
                    {isExp?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}
                  </button>
                  <AnimatePresence>
                    {isExp && (
                      <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                        <div className="mt-2 space-y-1 border-t border-border pt-2 max-h-60 overflow-y-auto">
                          {[...loan.transactions].reverse().map(tx=>{
                            const pmLabel  = PAYMENT_METHODS.find(m=>m.value===tx.paymentMethod);
                            const isEditing = editPayId?.loanId===loan.id && editPayId?.txId===tx.id;
                            const linkedAcc  = accounts.find(a=>a.id===tx.accountId);
                            const linkedCard = creditCards.find(c=>c.id===tx.creditCardId);
                            return (
                              <div key={tx.id} className="text-xs py-1.5 group border-b border-border/30 last:border-0">
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-3 gap-2">
                                      <Input value={editPayForm.date} onChange={e=>setEditPayForm(f=>({...f,date:e.target.value}))} type="date" className="h-7 text-xs bg-background border-border"/>
                                      <Input value={editPayForm.amount} onChange={e=>setEditPayForm(f=>({...f,amount:e.target.value}))} type="number" placeholder="Amount" className="h-7 text-xs bg-background border-border"/>
                                      <Input value={editPayForm.note} onChange={e=>setEditPayForm(f=>({...f,note:e.target.value}))} placeholder="Note" className="h-7 text-xs bg-background border-border"/>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <Select value={editPayForm.paymentMethod} onValueChange={v=>setEditPayForm(f=>({...f,paymentMethod:v,accountId:"",creditCardId:""}))}>
                                        <SelectTrigger className="h-7 text-xs bg-background border-border"><SelectValue/></SelectTrigger>
                                        <SelectContent>{PAYMENT_METHODS.map(m=><SelectItem key={m.value} value={m.value}>{m.icon} {m.label}</SelectItem>)}</SelectContent>
                                      </Select>
                                      {editPayForm.paymentMethod==="bank_account" && (
                                        <Select value={editPayForm.accountId||"_none"} onValueChange={v=>setEditPayForm(f=>({...f,accountId:v==="_none"?"":v}))}>
                                          <SelectTrigger className="h-7 text-xs bg-background border-border"><SelectValue placeholder="Account"/></SelectTrigger>
                                          <SelectContent><SelectItem value="_none">None</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — AED {getAccountBalance(a.id).toLocaleString()}</SelectItem>)}</SelectContent>
                                        </Select>
                                      )}
                                      {editPayForm.paymentMethod==="credit_card" && (
                                        <Select value={editPayForm.creditCardId||"_none"} onValueChange={v=>setEditPayForm(f=>({...f,creditCardId:v==="_none"?"":v}))}>
                                          <SelectTrigger className="h-7 text-xs bg-background border-border"><SelectValue placeholder="Card"/></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="_none">None</SelectItem>
                                            {creditCards.map(c=>(
                                              <SelectItem key={c.id} value={c.id}>
                                                {c.name} ···{c.last4} — Balance AED {Math.abs(c.balance).toLocaleString()} / Limit AED {c.limit.toLocaleString()}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      )}
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={()=>handleSaveEditPayment(loan.id,tx.id)} className="text-primary text-[10px] font-medium px-2 py-1 border border-primary/30 rounded">Save</button>
                                      <button onClick={()=>setEditPayId(null)} className="text-muted-foreground text-[10px] px-2 py-1 border border-border rounded">Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-foreground font-medium">{tx.note}</p>
                                      <p className="text-muted-foreground">{tx.date}{pmLabel?` · ${pmLabel.icon} ${pmLabel.label}`:""}</p>
                                      {(linkedAcc||linkedCard) && <p className="text-[10px] text-primary">{linkedAcc?.name||linkedCard?.name}</p>}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-primary font-semibold">AED {tx.amount.toLocaleString()}</span>
                                      <button onClick={()=>{setEditPayId({loanId:loan.id,txId:tx.id});setEditPayForm({amount:String(tx.amount),note:tx.note,date:tx.date,paymentMethod:tx.paymentMethod||"bank_account",accountId:tx.accountId||"",creditCardId:tx.creditCardId||""});}} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"><Edit2 className="w-3 h-3"/></button>
                                      <button onClick={()=>deleteLoanPayment(loan.id,tx.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3"/></button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Add/Edit Loan Dialog */}
      <Dialog open={loanOpen} onOpenChange={setLoanOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editLoan?"Edit":"Add"} Loan</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Loan Name</Label><Input placeholder="e.g. Toyota Camry" value={loanForm.name} onChange={e=>setLoanForm(f=>({...f,name:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Lender</Label><Input placeholder="e.g. Emirates NBD" value={loanForm.lender} onChange={e=>setLoanForm(f=>({...f,lender:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Type</Label>
                <Select value={loanForm.type} onValueChange={v=>setLoanForm(f=>({...f,type:v as Loan["type"]}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                  <SelectContent>{LOAN_TYPES.map(t=><SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g," ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Total Amount</Label><Input type="number" value={loanForm.totalAmount} onChange={e=>setLoanForm(f=>({...f,totalAmount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>EMI Amount</Label><Input type="number" value={loanForm.emiAmount} onChange={e=>setLoanForm(f=>({...f,emiAmount:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Interest Rate %</Label><Input type="number" value={loanForm.interestRate} onChange={e=>setLoanForm(f=>({...f,interestRate:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Tenure (months)</Label><Input type="number" value={loanForm.tenure} onChange={e=>setLoanForm(f=>({...f,tenure:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Next Due Date</Label><Input type="date" value={loanForm.nextDueDate} onChange={e=>setLoanForm(f=>({...f,nextDueDate:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="border border-border rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="autopay" checked={loanForm.autoPayEnabled} onChange={e=>setLoanForm(f=>({...f,autoPayEnabled:e.target.checked}))} className="rounded"/>
                <Label htmlFor="autopay" className="text-sm cursor-pointer flex items-center gap-1"><Repeat className="w-3.5 h-3.5"/>Enable Auto-Payment Reminder</Label>
              </div>
              {loanForm.autoPayEnabled && (<>
                <div className="space-y-1.5"><Label className="text-xs">Auto-pay from Account</Label>
                  <Select value={loanForm.autoPayAccountId||"_none"} onValueChange={v=>setLoanForm(f=>({...f,autoPayAccountId:v==="_none"?"":v,autoPayCardId:""}))}>
                    <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger>
                    <SelectContent><SelectItem value="_none">None</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — AED {getAccountBalance(a.id).toLocaleString()}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Or auto-pay from Card</Label>
                  <Select value={loanForm.autoPayCardId||"_none"} onValueChange={v=>setLoanForm(f=>({...f,autoPayCardId:v==="_none"?"":v,autoPayAccountId:""}))}>
                    <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {creditCards.map(c=>(
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ···{c.last4} — Balance AED {Math.abs(c.balance).toLocaleString()} / Limit AED {c.limit.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setLoanOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveLoan} disabled={!loanForm.name}>{editLoan?"Save Changes":"Add Loan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay EMI Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Make EMI Payment</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount (AED)</Label><Input type="number" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={payForm.date} onChange={e=>setPayForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m=>(
                  <button key={m.value} onClick={()=>setPayForm(f=>({...f,paymentMethod:m.value}))} className={`py-2 px-3 rounded-lg text-xs border transition-all text-left ${payForm.paymentMethod===m.value?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground hover:bg-secondary"}`}>
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>
            </div>
            {payForm.paymentMethod==="bank_account" && (
              <div className="space-y-1.5"><Label>From Account</Label>
                <Select value={payForm.accountId||"_none"} onValueChange={v=>setPayForm(f=>({...f,accountId:v==="_none"?"":v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select account"/></SelectTrigger>
                  <SelectContent><SelectItem value="_none">Don't deduct</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — AED {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {payForm.paymentMethod==="credit_card" && (
              <div className="space-y-1.5"><Label>Credit Card</Label>
                <Select value={payForm.creditCardId||"_none"} onValueChange={v=>setPayForm(f=>({...f,creditCardId:v==="_none"?"":v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select card"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Select card</SelectItem>
                    {creditCards.map(c=>(
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ···{c.last4} — Balance AED {Math.abs(c.balance).toLocaleString()} / Limit AED {c.limit.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5"><Label>Note (optional)</Label><Input value={payForm.note} onChange={e=>setPayForm(f=>({...f,note:e.target.value}))} placeholder="e.g. March EMI" className="bg-background border-border"/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setPayOpen(false)}>Cancel</Button>
            <Button onClick={handlePay} disabled={!payForm.amount}>Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
