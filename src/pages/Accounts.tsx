import { SearchFilter, EMPTY_FILTER, matchesFilter, SearchFilterState } from "@/components/ui/search-filter";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Wallet, Plus, Trash2, Edit2, Building2, Banknote, TrendingUp, ArrowLeft, ArrowRightLeft, CreditCard, Target, Briefcase } from "lucide-react";
import { useDB, Account, uid } from "@/lib/database";

const CURRENCIES = ["AED","BDT","USD","EUR","GBP","SAR","OMR","KWD"];
const ACCOUNT_TYPES: Account["type"][] = ["savings","current","investment","cash","foreign"];
const COLOR_OPTIONS = ["hsl(160,84%,39%)","hsl(200,80%,50%)","hsl(280,70%,60%)","hsl(40,90%,55%)","hsl(0,72%,51%)","hsl(330,70%,55%)","hsl(220,60%,55%)","hsl(120,50%,45%)"];
const TYPE_ICONS: Record<string,any> = { savings:Wallet, current:Building2, investment:TrendingUp, cash:Banknote, foreign:Wallet };

export default function Accounts() {
  const db = useDB();
  const { accounts, addAccount, updateAccount, deleteAccount, getAccountBalance, transactions, transfers, creditCards, loans, savingsGoals, goals, businesses, cashEntries } = db;
  const [filter, setFilter] = useState<SearchFilterState>(EMPTY_FILTER);
  const [open, setOpen] = useState(false);
  const [editAcc, setEditAcc] = useState<Account|null>(null);
  const [selectedAccId, setSelectedAccId] = useState<string|null>(null);
  const [form, setForm] = useState<Omit<Account,"id">>({ name:"", bank:"", type:"savings", currency:"AED", openingBalance:0, color:COLOR_OPTIONS[0], isActive:true });

  const totalAed = accounts.filter(a=>a.currency==="AED").reduce((s,a)=>s+getAccountBalance(a.id),0);
  const openAdd = () => { setEditAcc(null); setForm({ name:"", bank:"", type:"savings", currency:"AED", openingBalance:0, color:COLOR_OPTIONS[0], isActive:true }); setOpen(true); };
  const openEdit = (a: Account) => { setEditAcc(a); setForm({ name:a.name, bank:a.bank, type:a.type, currency:a.currency, openingBalance:a.openingBalance||0, color:a.color, isActive:a.isActive }); setOpen(true); };
  const handleSubmit = () => {
    if (!form.name||!form.bank) return;
    if (editAcc) updateAccount(editAcc.id, form); else addAccount(form);
    setOpen(false);
  };

const handleRepayment = (amount: number, date: string, fromAccountId: string, toAccountId: string) => {
  // Step 1: Update Credit Card - Deduct repayment from credit card balance
  
  
  const updatedCreditCards = creditCards.map(card =>
    card.id === toAccountId
      ? {
          ...card,
          balance: card.balance - amount, // Deduct from credit card balance
          repayments: [
            ...(card.repayments || []),
            { id: uid(), date, amount, method: 'bank transfer', notes: 'Repayment from account' }
          ]
        }
      : card
  );

  // Call updateCreditCard if available in useDB
  updatedCreditCards.forEach(card => {
    updateCreditCard(card.id, card);  // Assuming `updateCreditCard` is available in `useDB`
  });

  // Step 2: Update Account - Add repayment transaction as a credit to the account
  const updatedAccounts = accounts.map(account =>
    account.id === fromAccountId
      ? {
          ...account,
          transactions: [
            ...account.transactions,
            { 
              id: uid(), 
              date, 
              amount, 
              category: 'repayment', 
              note: `Repayment to Credit Card - ${toAccountId}`,
              type: 'credit', // This is a credit transaction in the account
            }
          ]
        }
      : account
  );

  // Call updateAccount for the account repayment
  updatedAccounts.forEach(account => {
    updateAccount(account.id, account);  // Assuming `updateAccount` is available in `useDB`
  });
};

  const selectedAcc = accounts.find(a=>a.id===selectedAccId);
  const accDetail = useMemo(() => {
    if (!selectedAccId) return null;
    const acTxs = transactions.filter(t=>t.accountId===selectedAccId);
    const acTransfers = transfers.filter(t=>t.fromAccountId===selectedAccId||t.toAccountId===selectedAccId);
    const acLoans = loans.filter(l=>l.autoPayAccountId===selectedAccId||l.transactions.some(lt=>lt.accountId===selectedAccId));
    const acSavings = savingsGoals.filter(sg=>sg.transactions.some(st=>st.fromAccountId===selectedAccId));
    const acGoals = goals.filter(g=>g.linkedAccountId===selectedAccId||g.transactions.some(gt=>gt.fromAccountId===selectedAccId));
    const acBiz = businesses.filter(b=>b.transactions.some(bt=>bt.accountId===selectedAccId));
    const acRepayments = creditCards.flatMap(c=>(c.repayments||[]).filter(r=>r.sourceAccountId===selectedAccId).map(r=>({...r,cardName:c.name})));
    
    // Updated calculation logic:
    // Total In: Transactions > 0 + Incoming Transfers
    const txIn = acTxs.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
    const transferIn = acTransfers.filter(t=>t.toAccountId===selectedAccId).reduce((s,t)=>s+t.amountReceived,0);
    const totalIn = txIn + transferIn;

    // Total Out: Transactions < 0 + Outgoing Transfers + Fees from Transfers
    const txOut = acTxs.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
    const transferOut = acTransfers.filter(t=>t.fromAccountId===selectedAccId).reduce((s,t)=>s+t.amountSent,0);
    const transferFees = acTransfers.filter(t=>t.fromAccountId===selectedAccId).reduce((s,t)=>(t as any).fee?s+(t as any).fee:s,0);
    const totalOut = txOut + transferOut + transferFees;

    return { acTxs, acTransfers, acLoans, acSavings, acGoals, acBiz, acRepayments, totalIn, totalOut };
  }, [selectedAccId, transactions, transfers, loans, savingsGoals, goals, businesses, creditCards]);


//Updating Transaction List for Repayments

{accDetail.acTxs.map(t => (
  <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
    <div>
      <p className="text-xs font-medium text-foreground">{t.name}</p>
      <p className="text-[10px] text-muted-foreground">{t.category} · {t.date}</p>
      {(t as any).fee > 0 && <p className="text-[9px] text-muted-foreground italic">Fee: {selectedAcc.currency} {(t as any).fee}</p>}
    </div>
    <div className="text-right">
      <span className={`text-xs font-semibold ${t.amount >= 0 ? "stat-up" : "stat-down"}`}>
        {t.amount >= 0 ? "+" : ""}{selectedAcc.currency} {Math.abs(t.amount).toLocaleString()}
      </span>
    </div>
  </div>
))}







  if (selectedAcc && accDetail) {
    const Icon = TYPE_ICONS[selectedAcc.type]??Wallet;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1" onClick={()=>setSelectedAccId(null)}><ArrowLeft className="w-4 h-4"/>Back</Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{backgroundColor:`${selectedAcc.color}25`}}><Icon className="w-5 h-5" style={{color:selectedAcc.color}}/></div>
            <div><h1 className="text-xl font-display font-bold text-foreground">{selectedAcc.name}</h1><p className="text-xs text-muted-foreground">{selectedAcc.bank} · {selectedAcc.type} · {selectedAcc.currency}</p></div>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-display font-bold text-foreground">{selectedAcc.currency} {getAccountBalance(selectedAcc.id).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Current Balance</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4"><p className="text-xs text-muted-foreground">Total In</p><p className="text-lg font-bold stat-up">+{selectedAcc.currency} {accDetail.totalIn.toLocaleString()}</p></div>
          <div className="glass-card p-4"><p className="text-xs text-muted-foreground">Total Out</p><p className="text-lg font-bold stat-down">-{selectedAcc.currency} {accDetail.totalOut.toLocaleString()}</p></div>
          <div className="glass-card p-4"><p className="text-xs text-muted-foreground">Transactions</p><p className="text-lg font-bold text-foreground">{accDetail.acTxs.length}</p></div>
          <div className="glass-card p-4"><p className="text-xs text-muted-foreground">Transfers</p><p className="text-lg font-bold text-foreground">{accDetail.acTransfers.length}</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-card p-4">
            <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-primary"/>Transactions ({accDetail.acTxs.length})</h3>
            {accDetail.acTxs.length===0 && <p className="text-xs text-muted-foreground text-center py-3">No transactions yet</p>}
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {accDetail.acTxs.slice(0,30).map(t=>(
                <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                  <div>
                    <p className="text-xs font-medium text-foreground">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">{t.category} · {t.date}</p>
                    {(t as any).fee > 0 && <p className="text-[9px] text-muted-foreground italic">Fee: {selectedAcc.currency} {(t as any).fee}</p>}
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold ${t.amount>=0?"stat-up":"stat-down"}`}>{t.amount>=0?"+":""}{selectedAcc.currency} {Math.abs(t.amount).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-4">
            <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-primary"/>Transfers ({accDetail.acTransfers.length})</h3>
            {accDetail.acTransfers.length===0 && <p className="text-xs text-muted-foreground text-center py-3">No transfers</p>}
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {accDetail.acTransfers.map(t=>{
                const isFrom = t.fromAccountId===selectedAccId;
                const other = accounts.find(a=>a.id===(isFrom?t.toAccountId:t.fromAccountId));
                const fee = (t as any).fee || 0;
                return (
                  <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-foreground">{isFrom?"→ ":"← "}{other?.name||"External"}</p>
                      <p className="text-[10px] text-muted-foreground">{t.date}{t.notes?` · ${t.notes}`:""}</p>
                      {isFrom && fee > 0 && <p className="text-[9px] text-muted-foreground italic">Fee: {t.currencyFrom} {fee}</p>}
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-semibold ${isFrom?"stat-down":"stat-up"}`}>{isFrom?"-":"+"}{isFrom?t.currencyFrom:t.currencyTo} {(isFrom?t.amountSent:t.amountReceived).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {accDetail.acRepayments.length>0 && (
            <div className="glass-card p-4">
              <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary"/>Card Repayments ({accDetail.acRepayments.length})</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {accDetail.acRepayments.map(r=>(
                  <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                    <div><p className="text-xs font-medium text-foreground">{r.cardName}</p><p className="text-[10px] text-muted-foreground">{r.date} · {r.method.replace(/_/g," ")}</p></div>
                    <span className="text-xs font-semibold stat-down">-{selectedAcc.currency} {r.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {accDetail.acLoans.length>0 && (
            <div className="glass-card p-4">
              <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><Banknote className="w-4 h-4 text-primary"/>Linked Loans ({accDetail.acLoans.length})</h3>
              {accDetail.acLoans.map(l=>(
                <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                  <div><p className="text-xs font-medium text-foreground">{l.name}</p><p className="text-[10px] text-muted-foreground">{l.lender} · AED {l.emiAmount}/mo</p></div>
                  <span className="text-xs text-muted-foreground">AED {l.remainingBalance.toLocaleString()} left</span>
                </div>
              ))}
            </div>
          )}

          {accDetail.acBiz.length>0 && (
            <div className="glass-card p-4">
              <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><Briefcase className="w-4 h-4 text-primary"/>Business Activity</h3>
              {accDetail.acBiz.flatMap(b=>b.transactions.filter(t=>t.accountId===selectedAccId).map(t=>(
                <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                  <div><p className="text-xs font-medium text-foreground">{t.description}</p><p className="text-[10px] text-muted-foreground">{b.name} · {t.date}</p></div>
                  <span className={`text-xs font-semibold ${t.amount>=0?"stat-up":"stat-down"}`}>{t.amount>=0?"+":""}{selectedAcc.currency} {Math.abs(t.amount).toLocaleString()}</span>
                </div>
              )))}
            </div>
          )}

          {(accDetail.acGoals.length>0||accDetail.acSavings.length>0) && (
            <div className="glass-card p-4">
              <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-primary"/>Goals & Savings</h3>
              {accDetail.acGoals.map(g=>(
                <div key={g.id} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                  <p className="text-xs font-medium text-foreground">🎯 {g.name}</p>
                  <span className="text-xs text-muted-foreground">AED {g.currentAmount.toLocaleString()} / {g.targetAmount.toLocaleString()}</span>
                </div>
              ))}
              {accDetail.acSavings.map(s=>(
                <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                  <p className="text-xs font-medium text-foreground">🏦 {s.name}</p>
                  <span className="text-xs text-muted-foreground">{s.currency||"AED"} {s.current.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Accounts" subtitle={`${accounts.length} accounts · click any to explore`}
        action={<Button className="gap-2" onClick={openAdd}><Plus className="w-4 h-4"/>Add Account</Button>}/>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <StatCard title="Total (AED)" value={`AED ${totalAed.toLocaleString()}`} icon={Wallet}/>
        <StatCard title="Accounts" value={accounts.length.toString()} icon={Building2}/>
        <StatCard title="Currencies" value={[...new Set(accounts.map(a=>a.currency))].join(", ")} icon={TrendingUp}/>
      </div>
      <SearchFilter value={filter} onChange={setFilter} placeholder="Search accounts…" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {accounts.map((acc,i)=>{
            const Icon = TYPE_ICONS[acc.type]??Wallet;
            const txCount = transactions.filter(t=>t.accountId===acc.id).length;
            return (
              <motion.div key={acc.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:0.95}} transition={{delay:i*0.05}}
                onClick={()=>setSelectedAccId(acc.id)} className="glass-card p-4 group cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{backgroundColor:`${acc.color}25`}}><Icon className="w-5 h-5" style={{color:acc.color}}/></div>
                    <div><p className="text-sm font-semibold text-foreground">{acc.name}</p><p className="text-xs text-muted-foreground">{acc.bank} · {acc.type}</p></div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1" onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>openEdit(acc)} className="text-muted-foreground hover:text-foreground p-1"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>deleteAccount(acc.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
                <p className="text-2xl font-display font-bold text-foreground">{acc.currency} {getAccountBalance(acc.id).toLocaleString()}</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium" style={{backgroundColor:`${acc.color}20`,color:acc.color}}>{acc.currency}</div>
                  <span className="text-[10px] text-muted-foreground">{txCount} txs · tap to explore</span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
<Button onClick={() => handleRepayment(500, "2026-03-28", selectedAccId, "credit-card-id")}>
  Repay Credit Card
</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>{editAcc?"Edit":"Add"} Account</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Account Name</Label><Input placeholder="e.g. Mashreq Savings" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Bank / Institution</Label><Input placeholder="e.g. Mashreq" value={form.bank} onChange={e=>setForm(f=>({...f,bank:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Type</Label>
                <Select value={form.type} onValueChange={v=>setForm(f=>({...f,type:v as Account["type"]}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                  <SelectContent>{ACCOUNT_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Currency</Label>
                <Select value={form.currency} onValueChange={v=>setForm(f=>({...f,currency:v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Opening Balance (adjustments only)</Label><Input type="number" placeholder="0" value={(form as any).openingBalance} onChange={e=>setForm(f=>({...f,openingBalance:parseFloat(e.target.value)||0}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>Color</Label>
              <div className="flex gap-2 flex-wrap">{COLOR_OPTIONS.map(c=>(
                <button key={c} onClick={()=>setForm(f=>({...f,color:c}))} className="w-7 h-7 rounded-full border-2 transition-all" style={{backgroundColor:c,borderColor:form.color===c?"white":"transparent"}}/>
              ))}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.name||!form.bank}>{editAcc?"Save Changes":"Add Account"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}