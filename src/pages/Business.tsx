import { SearchFilter, EMPTY_FILTER, matchesFilter, SearchFilterState } from "@/components/ui/search-filter";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Briefcase, Plus, TrendingUp, DollarSign, Clock, Trash2, Edit2, Users, ArrowRight, BarChart2, Archive, CreditCard as CreditCardIcon, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useDB, Business, BusinessTx } from "@/lib/database";

const BIZ_TYPES = ["Online Retail","E-commerce","Freelance","Consulting","Food & Beverage","Technology","Real Estate","Trading","Other"];
const BIZ_STATUS = ["active","paused","completed","archived"];
const EMPTY_TX = { date:new Date().toISOString().slice(0,10), description:"", amount:"", category:"revenue" as "revenue"|"expense", accountId:"", creditCardId:"", deductFromAccount:true };
const EMPTY_PARTNER = { name:"", sharePercent:"", investment:"", joinDate:new Date().toISOString().slice(0,10), notes:"", email:"", phone:"", role:"", address:"" };

function durationLabel(startDate: string, endDate?: string) {
  const start = new Date(startDate).getTime();
  const end = endDate ? new Date(endDate).getTime() : Date.now();
  const days = Math.floor((end-start)/(1000*60*60*24));
  if (days<30) return `${days}d`;
  if (days<365) return `${Math.floor(days/30)}mo`;
  return `${(days/365).toFixed(1)}yr`;
}

export default function BusinessPage() {
  const { businesses, addBusiness, addBusinessTx, updateBusiness, updateBusinessTx, deleteBusinessTx, deleteBusiness, accounts, creditCards, addBusinessPartner, updateBusinessPartner, deleteBusinessPartner, addProfitTransfer, addPartnerAccountTx, getAccountBalance } = useDB();
  const [filter, setFilter] = useState<SearchFilterState>(EMPTY_FILTER);
  const [showArchived, setShowArchived] = useState(false);
  const [activeTab, setActiveTab] = useState<Record<string,"transactions"|"partners"|"pl"|"forecast">>({});
  const getTab = (id: string) => activeTab[id]||"transactions";

  const [bizOpen, setBizOpen] = useState(false);
  const [editBiz, setEditBiz] = useState<Business|null>(null);
  const [bizForm, setBizForm] = useState<Omit<Business,"id"|"transactions">>({ name:"", type:"Online Retail", status:"active", startDate:new Date().toISOString().slice(0,10), color:"hsl(160,84%,39%)" });

  const [txDialogBizId, setTxDialogBizId] = useState("");
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<BusinessTx|null>(null);
  const [txForm, setTxForm] = useState(EMPTY_TX);

  const [partnerDialogBizId, setPartnerDialogBizId] = useState("");
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [partnerForm, setPartnerForm] = useState<any>(EMPTY_PARTNER);
  const [editPartnerId, setEditPartnerId] = useState<string|null>(null);
  const [partnerAccOpen, setPartnerAccOpen] = useState(false);
  const [partnerAccBizId, setPartnerAccBizId] = useState("");
  const [partnerAccPartnerId, setPartnerAccPartnerId] = useState("");
  const [partnerAccForm, setPartnerAccForm] = useState({ type:"credit" as "credit"|"debit"|"reinvest", amount:"", description:"", date:new Date().toISOString().slice(0,10), toAccountId:"" });

  const [profitDialogBizId, setProfitDialogBizId] = useState("");
  const [profitOpen, setProfitOpen] = useState(false);
  const [profitForm, setProfitForm] = useState({ amount:"", toAccountId:"", partnerId:"", date:new Date().toISOString().slice(0,10), notes:"" });

  const openBizAdd = () => { setEditBiz(null); setBizForm({ name:"", type:"Online Retail", status:"active", startDate:new Date().toISOString().slice(0,10), color:"hsl(160,84%,39%)" }); setBizOpen(true); };
  const openBizEdit = (b: Business) => { setEditBiz(b); setBizForm({ name:b.name, type:b.type, status:b.status, startDate:b.startDate, endDate:b.endDate, color:b.color, notes:b.notes }); setBizOpen(true); };
  const handleSaveBiz = () => { if (!bizForm.name) return; if (editBiz) updateBusiness(editBiz.id, bizForm); else addBusiness(bizForm); setBizOpen(false); };

  const openTxDialog = (bizId: string, tx?: BusinessTx) => {
    setTxDialogBizId(bizId); setEditingTx(tx||null);
    setTxForm(tx ? { date:tx.date, description:tx.description, amount:String(Math.abs(tx.amount)), category:tx.category, accountId:tx.accountId||"", creditCardId:tx.creditCardId||"", deductFromAccount:true } : EMPTY_TX);
    setTxDialogOpen(true);
  };
  const handleSaveTx = () => {
    const amount = parseFloat(txForm.amount);
    if (!txForm.description||isNaN(amount)||!txDialogBizId) return;
    const txData = { date:txForm.date, description:txForm.description, amount:txForm.category==="expense"?-Math.abs(amount):Math.abs(amount), category:txForm.category, accountId:txForm.accountId||undefined, creditCardId:txForm.creditCardId||undefined };
    if (editingTx) { updateBusinessTx(txDialogBizId, editingTx.id, txData); }
    else { addBusinessTx(txDialogBizId, txData, txForm.deductFromAccount); }
    setTxDialogOpen(false);
  };

  const openPartnerDialog = (bizId: string, existing?: any) => {
    setPartnerDialogBizId(bizId);
    setEditPartnerId(existing?.id||null);
    setPartnerForm(existing ? { name:existing.name, sharePercent:String(existing.sharePercent), investment:String(existing.investment), joinDate:existing.joinDate, notes:existing.notes||"", email:existing.email||"", phone:existing.phone||"", role:existing.role||"", address:existing.address||"" } : EMPTY_PARTNER);
    setPartnerOpen(true);
  };
  const handleSavePartner = () => {
    if (!partnerForm.name) return;
    const data = { name:partnerForm.name, sharePercent:parseFloat(partnerForm.sharePercent)||0, investment:parseFloat(partnerForm.investment)||0, joinDate:partnerForm.joinDate, notes:partnerForm.notes||undefined, email:partnerForm.email||undefined, phone:partnerForm.phone||undefined, role:partnerForm.role||undefined, address:partnerForm.address||undefined };
    if (editPartnerId) updateBusinessPartner(partnerDialogBizId, editPartnerId, data);
    else addBusinessPartner(partnerDialogBizId, data);
    setPartnerOpen(false);
  };
  const handlePartnerAccTx = () => {
    const amt = parseFloat(partnerAccForm.amount); if (!amt) return;
    addPartnerAccountTx(partnerAccBizId, partnerAccPartnerId, { date:partnerAccForm.date, amount:amt, type:partnerAccForm.type, description:partnerAccForm.description||`Partner account ${partnerAccForm.type}`, toAccountId:partnerAccForm.toAccountId||undefined }, partnerAccForm.type==="debit"?partnerAccForm.toAccountId:undefined);
    setPartnerAccOpen(false);
  };

  const openProfitTransfer = (bizId: string) => { setProfitDialogBizId(bizId); setProfitForm({ amount:"", toAccountId:"", partnerId:"", date:new Date().toISOString().slice(0,10), notes:"" }); setProfitOpen(true); };
  const handleProfitTransfer = () => {
    const amt = parseFloat(profitForm.amount);
    if (!amt||!profitForm.toAccountId) return;
    addProfitTransfer(profitDialogBizId, { date:profitForm.date, amount:amt, toAccountId:profitForm.toAccountId, partnerId:profitForm.partnerId||undefined, notes:profitForm.notes||undefined });
    setProfitOpen(false);
  };

  const visible = businesses.filter(b=>showArchived?true:b.status!=="archived");
  const totalRevenue = businesses.flatMap(b=>b.transactions.filter(t=>t.category==="revenue")).reduce((s,t)=>s+t.amount,0);
  const totalExpense = businesses.flatMap(b=>b.transactions.filter(t=>t.category==="expense")).reduce((s,t)=>s+Math.abs(t.amount),0);
  const totalProfit = totalRevenue - totalExpense;

  return (
    <div className="space-y-6">
      <PageHeader title="Short-Term Business" subtitle="Side hustles & ventures"
        action={<div className="flex gap-2"><Button variant="outline" size="sm" className="gap-1 text-xs" onClick={()=>setShowArchived(!showArchived)}><Archive className="w-3.5 h-3.5"/>{showArchived?"Hide":"Show"} Archived</Button><Button className="gap-2" onClick={openBizAdd}><Plus className="w-4 h-4"/>New Venture</Button></div>}/>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Total Revenue" value={`AED ${totalRevenue.toLocaleString()}`} icon={DollarSign} changeType="up"/>
        <StatCard title="Total Expenses" value={`AED ${totalExpense.toLocaleString()}`} icon={Briefcase}/>
        <StatCard title="Net Profit" value={`AED ${totalProfit.toLocaleString()}`} icon={TrendingUp} changeType={totalProfit>=0?"up":"down"} change={totalExpense>0?`${((totalProfit/totalExpense)*100).toFixed(0)}% ROI`:""}/>
        <StatCard title="Active" value={String(businesses.filter(b=>b.status==="active").length)} icon={Clock}/>
      </div>

      {/* Chart */}
      {businesses.length > 0 && (() => {
        const chartMap: Record<string,{revenue:number,expense:number}> = {};
        businesses.flatMap(b=>b.transactions).forEach(tx=>{
          const mo = tx.date.slice(0,7);
          if (!chartMap[mo]) chartMap[mo]={revenue:0,expense:0};
          if (tx.category==="revenue") chartMap[mo].revenue+=tx.amount;
          else chartMap[mo].expense+=Math.abs(tx.amount);
        });
        const chartData = Object.entries(chartMap).sort().slice(-6).map(([mo,v])=>({month:mo.slice(5),...v,profit:v.revenue-v.expense}));
        return (
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Revenue vs Expenses (last 6 months)</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/><XAxis dataKey="month" tick={{fill:"hsl(215,20%,65%)",fontSize:11}}/><YAxis tick={{fill:"hsl(215,20%,65%)",fontSize:11}}/><Tooltip contentStyle={{background:"hsl(224,71%,14%)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:11}}/><Bar dataKey="revenue" fill="hsl(160,84%,39%)" radius={[3,3,0,0]}/><Bar dataKey="expense" fill="hsl(0,72%,51%)" radius={[3,3,0,0]}/></BarChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      <SearchFilter value={filter} onChange={setFilter} placeholder="Search business…" />
      <div className="space-y-4">
        {visible.length===0 && <div className="p-8 text-center text-muted-foreground glass-card text-sm">No ventures yet.</div>}
        {visible.map((biz,i)=>{
          const revenue = biz.transactions.filter(t=>t.category==="revenue").reduce((s,t)=>s+t.amount,0);
          const expenses = biz.transactions.filter(t=>t.category==="expense").reduce((s,t)=>s+Math.abs(t.amount),0);
          const profit = revenue - expenses;
          const partners = biz.partners||[];
          const profitTransfers = biz.profitTransfers||[];
          const tab = getTab(biz.id);

          // Monthly P&L
          const monthlyPL: Record<string,{revenue:number,expense:number}> = {};
          biz.transactions.forEach(tx=>{ const mo=tx.date.slice(0,7); if(!monthlyPL[mo]) monthlyPL[mo]={revenue:0,expense:0}; if(tx.category==="revenue") monthlyPL[mo].revenue+=tx.amount; else monthlyPL[mo].expense+=Math.abs(tx.amount); });
          const plData = Object.entries(monthlyPL).sort().map(([mo,v])=>({month:mo,profit:v.revenue-v.expense,revenue:v.revenue,expense:v.expense}));
          const avgMonthlyProfit = plData.length>0 ? plData.reduce((s,d)=>s+d.profit,0)/plData.length : 0;
          const forecastMonths = 3;
          const forecast = Array.from({length:forecastMonths}).map((_,i)=>({
            month:`+${i+1}mo`, revenue:avgMonthlyProfit>0?avgMonthlyProfit*1.05*(i+1):0, expense:expenses/Math.max(plData.length,1), profit:avgMonthlyProfit*(i+1)
          }));

          return (
            <motion.div key={biz.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}} className="glass-card">
              <div className="p-5 border-b border-border">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{backgroundColor:`${biz.color}25`}}><Briefcase className="w-5 h-5" style={{color:biz.color}}/></div>
                    <div>
                      <p className="font-semibold text-foreground">{biz.name}</p>
                      <p className="text-xs text-muted-foreground">{biz.type} · {durationLabel(biz.startDate,biz.endDate)} · {biz.status}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-2">
                      <p className={`text-sm font-bold ${profit>=0?"stat-up":"stat-down"}`}>{profit>=0?"+":""}AED {profit.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Net Profit</p>
                    </div>
                    {profit>0 && <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={()=>openProfitTransfer(biz.id)}><ArrowRight className="w-3 h-3"/>Move Profit</Button>}
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={()=>openTxDialog(biz.id)}><Plus className="w-3 h-3"/>Tx</Button>
                    <button onClick={()=>openBizEdit(biz)} className="text-muted-foreground hover:text-foreground p-1"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>deleteBusiness(biz.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-3">
                  <div><p className="text-xs text-muted-foreground">Revenue</p><p className="text-sm font-semibold stat-up">AED {revenue.toLocaleString()}</p></div>
                  <div><p className="text-xs text-muted-foreground">Expenses</p><p className="text-sm font-semibold stat-down">AED {expenses.toLocaleString()}</p></div>
                  <div><p className="text-xs text-muted-foreground">Partners</p><p className="text-sm font-semibold text-foreground">{partners.length}</p></div>
                  <div><p className="text-xs text-muted-foreground">Profit Moved</p><p className="text-sm font-semibold text-foreground">AED {profitTransfers.reduce((s,t)=>s+t.amount,0).toLocaleString()}</p></div>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-4 pt-3 flex gap-1">
                {(["transactions","partners","pl","forecast"] as const).map(t=>(
                  <button key={t} onClick={()=>setActiveTab(prev=>({...prev,[biz.id]:t}))} className={`px-3 py-1 rounded-md text-xs transition-colors capitalize ${tab===t?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>{t==="pl"?"P&L":t}</button>
                ))}
              </div>

              <div className="p-4">
                {tab==="transactions" && (
                  <div className="space-y-1 max-h-56 overflow-y-auto">
                    {biz.transactions.length===0 && <p className="text-xs text-center text-muted-foreground py-4">No transactions yet.</p>}
                    {[...biz.transactions].reverse().map(tx=>{
                      const srcAcc = accounts.find(a=>a.id===tx.accountId);
                      const srcCard = creditCards.find(c=>c.id===tx.creditCardId);
                      return (
                        <div key={tx.id} className="flex items-center justify-between py-1.5 group border-b border-border/40 last:border-0">
                          <div>
                            <p className="text-xs font-medium text-foreground">{tx.description}</p>
                            <p className="text-[10px] text-muted-foreground">{tx.date}{srcAcc?` · ${srcAcc.name}`:""}{srcCard?` · 💳 ${srcCard.name}`:""}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-semibold ${tx.amount>=0?"stat-up":"stat-down"}`}>{tx.amount>=0?"+":""}AED {Math.abs(tx.amount).toLocaleString()}</span>
                            <button onClick={()=>openTxDialog(biz.id,tx)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-0.5"><Edit2 className="w-3 h-3"/></button>
                            <button onClick={()=>deleteBusinessTx(biz.id,tx.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5"><Trash2 className="w-3 h-3"/></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {tab==="partners" && (
                  <div className="space-y-3">
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={()=>openPartnerDialog(biz.id)}><Plus className="w-3 h-3"/>Add Partner</Button>
                    {partners.length===0 && <p className="text-xs text-muted-foreground text-center py-3">No partners added.</p>}
                    {partners.map(p=>{
                      const share = profit * p.sharePercent / 100;
                      return (
                        <div key={p.id} className="flex items-center justify-between bg-secondary/40 rounded-lg p-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{p.name}{p.role?<span className="ml-2 text-[10px] text-muted-foreground">({p.role})</span>:null}</p>
                            <p className="text-xs text-muted-foreground">{p.sharePercent}% share · Invested AED {p.investment.toLocaleString()} · Joined {p.joinDate}</p>
                            {(p.email||p.phone)&&<p className="text-[10px] text-muted-foreground">{p.email}{p.email&&p.phone?" · ":""}{p.phone}</p>}
                            <p className="text-[10px] text-primary">💼 Account balance: AED {(p.partnerAccountBalance||0).toFixed(2)}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${share>=0?"stat-up":"stat-down"}`}>{share>=0?"+":""}AED {Math.abs(share).toFixed(0)}</p>
                            <p className="text-xs text-muted-foreground">profit share</p>
                          </div>
                            <div className="flex gap-1">
                          <button onClick={()=>{setPartnerAccBizId(biz.id);setPartnerAccPartnerId(p.id);setPartnerAccForm({type:"credit",amount:"",description:"",date:new Date().toISOString().slice(0,10),toAccountId:""});setPartnerAccOpen(true);}} className="text-muted-foreground hover:text-primary p-1" title="Partner account transaction"><Wallet className="w-3.5 h-3.5"/></button>
                          <button onClick={()=>openPartnerDialog(biz.id,p)} className="text-muted-foreground hover:text-foreground p-1"><Edit2 className="w-3.5 h-3.5"/></button>
                          <button onClick={()=>{setProfitDialogBizId(biz.id);setProfitForm({amount:"",toAccountId:"",partnerId:p.id,date:new Date().toISOString().slice(0,10),notes:""});setProfitOpen(true);}} className="text-muted-foreground hover:text-primary p-1" title="Transfer profit share"><ArrowRight className="w-3.5 h-3.5"/></button>
                          <button onClick={()=>deleteBusinessPartner(biz.id,p.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                        </div>
                        </div>
                      );
                    })}
                    {profitTransfers.length>0 && <div className="mt-2 space-y-1"><p className="text-xs font-medium text-muted-foreground">Profit Transfers</p>{profitTransfers.map(t=>{const acc=accounts.find(a=>a.id===t.toAccountId);const partner=partners.find(p=>p.id===t.partnerId);return(<div key={t.id} className="flex justify-between text-xs py-1"><span>{t.date}{partner?` → ${partner.name}`:""}{acc?` → ${acc.name}`:""}</span><span className="stat-up">+AED {t.amount.toLocaleString()}</span></div>);})}</div>}
                  </div>
                )}

                {tab==="pl" && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-secondary/40 rounded-lg p-3"><p className="text-xs text-muted-foreground">Gross Revenue</p><p className="text-sm font-bold stat-up">AED {revenue.toLocaleString()}</p></div>
                      <div className="bg-secondary/40 rounded-lg p-3"><p className="text-xs text-muted-foreground">Total Expenses</p><p className="text-sm font-bold stat-down">AED {expenses.toLocaleString()}</p></div>
                      <div className="bg-secondary/40 rounded-lg p-3"><p className="text-xs text-muted-foreground">Net Profit</p><p className={`text-sm font-bold ${profit>=0?"stat-up":"stat-down"}`}>AED {profit.toLocaleString()}</p></div>
                      <div className="bg-secondary/40 rounded-lg p-3"><p className="text-xs text-muted-foreground">Profit Margin</p><p className={`text-sm font-bold ${profit>=0?"stat-up":"stat-down"}`}>{revenue>0?((profit/revenue)*100).toFixed(1):0}%</p></div>
                    </div>
                    {plData.length>0&&<ResponsiveContainer width="100%" height={120}><BarChart data={plData.slice(-6)}><XAxis dataKey="month" tick={{fill:"hsl(215,20%,65%)",fontSize:10}}/><YAxis tick={{fill:"hsl(215,20%,65%)",fontSize:10}}/><Tooltip contentStyle={{background:"hsl(224,71%,14%)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:10}}/><Bar dataKey="profit" fill={profit>=0?"hsl(160,84%,39%)":"hsl(0,72%,51%)"} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer>}
                  </div>
                )}

                {tab==="forecast" && (
                  <div className="space-y-3">
                    <div className="bg-secondary/40 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Avg Monthly Profit</p>
                      <p className={`text-sm font-bold ${avgMonthlyProfit>=0?"stat-up":"stat-down"}`}>AED {avgMonthlyProfit.toFixed(0)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">3-Month Forecast (based on historical avg)</p>
                    {forecast.map((f,fi)=>(
                      <div key={fi} className="flex items-center justify-between bg-secondary/30 rounded-md p-2.5">
                        <span className="text-xs font-medium text-foreground">{f.month}</span>
                        <span className={`text-xs font-semibold ${f.profit>=0?"stat-up":"stat-down"}`}>{f.profit>=0?"+":""}AED {f.profit.toFixed(0)}</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground">⚠ Forecast is based on historical averages and not financial advice.</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Add/Edit Business */}
      <Dialog open={bizOpen} onOpenChange={setBizOpen}>
        <DialogContent className="w-full sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>{editBiz?"Edit":"New"} Venture</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Name</Label><Input value={bizForm.name} onChange={e=>setBizForm(f=>({...f,name:e.target.value}))} placeholder="e.g. E-commerce Store" className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Type</Label>
                <Select value={bizForm.type} onValueChange={v=>setBizForm(f=>({...f,type:v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                  <SelectContent>{BIZ_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Start Date</Label><Input type="date" value={bizForm.startDate} onChange={e=>setBizForm(f=>({...f,startDate:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Status</Label>
                <Select value={bizForm.status} onValueChange={v=>setBizForm(f=>({...f,status:v as any}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                  <SelectContent>{BIZ_STATUS.map(s=><SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setBizOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveBiz} disabled={!bizForm.name}>{editBiz?"Save":"Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Transaction */}
      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>{editingTx?"Edit":"Add"} Transaction</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Description</Label><Input value={txForm.description} onChange={e=>setTxForm(f=>({...f,description:e.target.value}))} className="bg-background border-border"/></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount</Label><Input type="number" value={txForm.amount} onChange={e=>setTxForm(f=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Type</Label>
                <Select value={txForm.category} onValueChange={v=>setTxForm(f=>({...f,category:v as any}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="revenue">Revenue</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={txForm.date} onChange={e=>setTxForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            <div className="space-y-1.5"><Label>Deduct from Bank Account</Label>
              <Select value={txForm.accountId||"_none"} onValueChange={v=>setTxForm(f=>({...f,accountId:v==="_none"?"":v,creditCardId:""}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger>
                <SelectContent><SelectItem value="_none">None</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Or charge to Credit Card</Label>
              <Select value={txForm.creditCardId||"_none"} onValueChange={v=>setTxForm(f=>({...f,creditCardId:v==="_none"?"":v,accountId:""}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger>
                <SelectContent><SelectItem value="_none">None</SelectItem>{creditCards.map(c=><SelectItem key={c.id} value={c.id}>{c.name} — AED {c.limit.toLocaleString()} limit</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setTxDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTx} disabled={!txForm.description||!txForm.amount}>{editingTx?"Save":"Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Partner */}
      <Dialog open={partnerOpen} onOpenChange={setPartnerOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>{editPartnerId?"Edit":"Add"} Partner</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Partner Name</Label><Input value={partnerForm.name} onChange={e=>setPartnerForm(f=>({...f,name:e.target.value}))} className="bg-background border-border"/></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Share %</Label><Input type="number" value={partnerForm.sharePercent} onChange={e=>setPartnerForm(f=>({...f,sharePercent:e.target.value}))} placeholder="25" className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Investment (AED)</Label><Input type="number" value={partnerForm.investment} onChange={e=>setPartnerForm(f=>({...f,investment:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>Join Date</Label><Input type="date" value={partnerForm.joinDate} onChange={e=>setPartnerForm((f:any)=>({...f,joinDate:e.target.value}))} className="bg-background border-border"/></div>
            <div className="pt-1 border-t border-border text-xs text-muted-foreground font-medium">Optional Details</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Role / Title</Label><Input placeholder="e.g. COO, Investor" value={partnerForm.role||""} onChange={e=>setPartnerForm((f:any)=>({...f,role:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label className="text-xs">Email</Label><Input type="email" placeholder="partner@email.com" value={partnerForm.email||""} onChange={e=>setPartnerForm((f:any)=>({...f,email:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Phone</Label><Input placeholder="+971 XX XXXXXXX" value={partnerForm.phone||""} onChange={e=>setPartnerForm((f:any)=>({...f,phone:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label className="text-xs">Notes</Label><Input placeholder="e.g. Silent partner" value={partnerForm.notes||""} onChange={e=>setPartnerForm((f:any)=>({...f,notes:e.target.value}))} className="bg-background border-border"/></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setPartnerOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePartner} disabled={!partnerForm.name}>{editPartnerId?"Save":"Add Partner"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Profit */}
      <Dialog open={profitOpen} onOpenChange={setProfitOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Move Profit to Account</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Amount (AED)</Label><Input type="number" value={profitForm.amount} onChange={e=>setProfitForm(f=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
            <div className="space-y-1.5"><Label>To Account</Label>
              <Select value={profitForm.toAccountId||"_none"} onValueChange={v=>setProfitForm(f=>({...f,toAccountId:v==="_none"?"":v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select account"/></SelectTrigger>
                <SelectContent><SelectItem value="_none">Select account</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>For Partner (optional)</Label>
              <Select value={profitForm.partnerId||"_none"} onValueChange={v=>setProfitForm(f=>({...f,partnerId:v==="_none"?"":v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="General / All"/></SelectTrigger>
                <SelectContent><SelectItem value="_none">General / All</SelectItem>{(businesses.find(b=>b.id===profitDialogBizId)?.partners||[]).map(p=><SelectItem key={p.id} value={p.id}>{p.name} ({p.sharePercent}%)</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={profitForm.date} onChange={e=>setProfitForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={profitForm.notes} onChange={e=>setProfitForm(f=>({...f,notes:e.target.value}))} className="bg-background border-border"/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setProfitOpen(false)}>Cancel</Button>
            <Button onClick={handleProfitTransfer} disabled={!profitForm.amount||!profitForm.toAccountId}>Move Profit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Partner Account Transaction Dialog */}
      <Dialog open={partnerAccOpen} onOpenChange={setPartnerAccOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>Partner Account — {businesses.find(b=>b.id===partnerAccBizId)?.partners?.find(p=>p.id===partnerAccPartnerId)?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="p-2 bg-secondary/40 rounded-lg text-xs text-center">
              Account Balance: <span className="font-bold text-primary">AED {(businesses.find(b=>b.id===partnerAccBizId)?.partners?.find(p=>p.id===partnerAccPartnerId)?.partnerAccountBalance||0).toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["credit","debit","reinvest"] as const).map(t=>(
                <button key={t} onClick={()=>setPartnerAccForm(f=>({...f,type:t}))} className={`py-2 rounded-lg text-xs border capitalize transition-all ${partnerAccForm.type===t?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground"}`}>
                  {t==="credit"?"💰 Credit":t==="debit"?"🏧 Withdraw":"🔄 Reinvest"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount (AED)</Label><Input type="number" value={partnerAccForm.amount} onChange={e=>setPartnerAccForm(f=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={partnerAccForm.date} onChange={e=>setPartnerAccForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            {partnerAccForm.type==="debit"&&(
              <div className="space-y-1.5"><Label>Transfer to Account</Label>
                <Select value={partnerAccForm.toAccountId||"_none"} onValueChange={v=>setPartnerAccForm(f=>({...f,toAccountId:v==="_none"?"":v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select account (optional)"/></SelectTrigger>
                  <SelectContent><SelectItem value="_none">No account transfer</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {partnerAccForm.type==="reinvest"&&(
              <div className="p-2 bg-primary/10 rounded-lg text-xs text-primary">🔄 Amount deducted from partner account and added as business investment</div>
            )}
            <div className="space-y-1.5"><Label>Description (optional)</Label><Input value={partnerAccForm.description} onChange={e=>setPartnerAccForm(f=>({...f,description:e.target.value}))} placeholder="e.g. Monthly profit share" className="bg-background border-border"/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setPartnerAccOpen(false)}>Cancel</Button>
            <Button onClick={handlePartnerAccTx} disabled={!partnerAccForm.amount}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
