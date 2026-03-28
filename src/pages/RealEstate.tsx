import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, Plus, TrendingUp, DollarSign, Percent, MapPin, Trash2, Edit2, Wrench, ArrowRight, ChevronDown, ChevronUp, Settings, Pencil, PieChart, Tag, Banknote } from "lucide-react";
import { useDB, Property } from "@/lib/database";
import { SearchFilter, EMPTY_FILTER, matchesFilter, SearchFilterState } from "@/components/ui/search-filter";

const PROP_TYPES  = ["Residential","Commercial","Industrial","Land","Mixed Use"];
const PROP_STATUS = [
  { value:"owned",      label:"Owned (Vacant)",   icon:"🏠" },
  { value:"rented_out", label:"Rented Out",        icon:"🔑" },
  { value:"leased",     label:"Leased",            icon:"📄" },
  { value:"sold",       label:"Sold",              icon:"💰" },
  { value:"vacant",     label:"Vacant / For Sale", icon:"🏗️" },
  { value:"closed",     label:"Closed / Sold",     icon:"✅" },
];
const COST_CATS  = ["maintenance","government","transaction","insurance","other"];
const COST_PAY   = [{v:"cash",l:"💵 Cash"},{v:"bank_account",l:"🏦 Bank Account"},{v:"credit_card",l:"💳 Credit Card"},{v:"other",l:"📌 Other"}];
const COLORS     = ["hsl(160,84%,39%)","hsl(200,80%,50%)","hsl(280,70%,60%)","hsl(40,90%,55%)","hsl(330,70%,55%)"];
const CURRENCIES = ["AED","BDT","USD","EUR","GBP"];

const EMPTY_FORM: any = {
  platform:"_none", name:"", location:"", invested:"", currentValue:"", roi:"",
  monthlyRental:"", occupancy:"95", type:"Residential", color:COLORS[0],
  currency:"AED", purchaseDate:"", status:"owned", rentalStartDate:"",
  saleDate:"", salePrice:"", saleAccountId:"",
  govFees:"", transactionFees:"", notes:"", rentalAccountId:"",
  purchaseAccountId:"", purchaseCreditCardId:"",
  isShareInvestment: false,
};
const EMPTY_SHARE: any = {
  date:"", totalPropertyValue:"", sharesTotal:"", sharesPurchased:"",
  ownershipPercent:"", amountInvested:"", purchaseTransactionCost:"",
  referenceCode:"", annualizedRentalYield:"", annualizedROI:"",
  currency:"AED", nextPaymentDate:"",
  fromAccountId:"", fromCreditCardId:"",
};

export default function RealEstate() {
  const { properties, accounts, creditCards, addProperty, updateProperty, deleteProperty,
          addRentalEntry, updateRentalEntry, deleteRentalEntry,
          addPropertyCost, updatePropertyCost, deletePropertyCost,
          transferRentalToAccount, getAccountBalance,
          realEstatePlatforms, addRealEstatePlatform, updateRealEstatePlatform, deleteRealEstatePlatform } = useDB();

  const [platMgrOpen, setPlatMgrOpen] = useState(false);
  const [newPlat, setNewPlat]         = useState("");
  const [editPlat, setEditPlat]       = useState<{old:string,val:string}|null>(null);
  const [propTabs, setPropTabs]       = useState<Record<string,"rental"|"costs"|"share">>({});
  const [expanded, setExpanded]       = useState<string|null>(null);
  const [filter, setFilter]           = useState<SearchFilterState>(EMPTY_FILTER);

  // Property dialog
  const [propOpen, setPropOpen] = useState(false);
  const [editProp, setEditProp] = useState<Property|null>(null);
  const [form, setForm]         = useState<any>(EMPTY_FORM);
  const [shareForm, setShareForm] = useState<any>(EMPTY_SHARE);

  // Rental dialog
  const [rentalPropId, setRentalPropId]   = useState<string|null>(null);
  const [editRentalId, setEditRentalId]   = useState<string|null>(null);
  const [rentalForm, setRentalForm]       = useState({ date:new Date().toISOString().slice(0,10), amount:"", note:"Monthly rental income", transferToAccountId:"" });

  // Cost dialog
  const [costPropId, setCostPropId]       = useState<string|null>(null);
  const [editCostId, setEditCostId]       = useState<string|null>(null);
  const [costForm, setCostForm]           = useState<any>({ date:new Date().toISOString().slice(0,10), amount:"", category:"maintenance", description:"", paymentMethod:"cash", accountId:"", creditCardId:"" });

  // Transfer balance
  const [transferPropId, setTransferPropId] = useState<string|null>(null);
  const [transferForm, setTransferForm]     = useState({ accountId:"", amount:"", date:new Date().toISOString().slice(0,10) });

  // Stats
  const soldProperties   = properties.filter(p=>p.status==="sold"||p.status==="closed");
  const activeProperties = properties.filter(p=>p.status!=="sold"&&p.status!=="closed");
  const totalInvested    = activeProperties.reduce((s,p)=>s+p.invested,0);
  const totalValue       = activeProperties.reduce((s,p)=>s+p.currentValue,0);
  const totalMonthlyRent = activeProperties.filter(p=>["rented_out","leased"].includes(p.status||"")).reduce((s,p)=>s+p.monthlyRental,0);
  const soldProfit       = soldProperties.reduce((s,p)=>s+((p.salePrice||0)-p.invested),0);

  const getTab = (id:string) => propTabs[id]||"rental";
  const setTab = (id:string, tab:"rental"|"costs"|"share") => setPropTabs(p=>({...p,[id]:tab}));

  const openAdd  = () => { setEditProp(null); setForm(EMPTY_FORM); setShareForm(EMPTY_SHARE); setPropOpen(true); };
  const openEdit = (p: Property) => {
    setEditProp(p);
    setForm({
      platform:p.platform||"_none", name:p.name, location:p.location,
      invested:String(p.invested), currentValue:String(p.currentValue), roi:String(p.roi),
      monthlyRental:String(p.monthlyRental), occupancy:String(p.occupancy), type:p.type,
      color:p.color, currency:p.currency, purchaseDate:p.purchaseDate||"", status:(p.status||"owned"),
      rentalStartDate:p.rentalStartDate||"", saleDate:p.saleDate||"", salePrice:String(p.salePrice||""),
      saleAccountId:p.saleAccountId||"", govFees:String(p.govFees||""), transactionFees:String(p.transactionFees||""),
      notes:p.notes||"", rentalAccountId:p.rentalAccountId||"",
      purchaseAccountId:p.purchaseAccountId||"", purchaseCreditCardId:p.purchaseCreditCardId||"",
      isShareInvestment:p.isShareInvestment||false,
    });
    if (p.shareDetails) {
      setShareForm({
        date:p.shareDetails.date||"", totalPropertyValue:String(p.shareDetails.totalPropertyValue||""),
        sharesTotal:String(p.shareDetails.sharesTotal||""), sharesPurchased:String(p.shareDetails.sharesPurchased||""),
        ownershipPercent:String(p.shareDetails.ownershipPercent||""), amountInvested:String(p.shareDetails.amountInvested||""),
        purchaseTransactionCost:String(p.shareDetails.purchaseTransactionCost||""),
        referenceCode:p.shareDetails.referenceCode||"",
        annualizedRentalYield:String(p.shareDetails.annualizedRentalYield||""),
        annualizedROI:String(p.shareDetails.annualizedROI||""),
        currency:p.shareDetails.currency||"AED", nextPaymentDate:p.shareDetails.nextPaymentDate||"",
        fromAccountId:p.shareDetails.fromAccountId||"", fromCreditCardId:p.shareDetails.fromCreditCardId||"",
      });
    }
    setPropOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name) return;
    const shareDetails = form.isShareInvestment ? {
      date:shareForm.date, totalPropertyValue:parseFloat(shareForm.totalPropertyValue)||0,
      sharesTotal:parseFloat(shareForm.sharesTotal)||0, sharesPurchased:parseFloat(shareForm.sharesPurchased)||0,
      ownershipPercent:parseFloat(shareForm.ownershipPercent)||0, amountInvested:parseFloat(shareForm.amountInvested)||0,
      purchaseTransactionCost:parseFloat(shareForm.purchaseTransactionCost)||0,
      referenceCode:shareForm.referenceCode, annualizedRentalYield:parseFloat(shareForm.annualizedRentalYield)||0,
      annualizedROI:parseFloat(shareForm.annualizedROI)||0, currency:shareForm.currency||"AED",
      nextPaymentDate:shareForm.nextPaymentDate, fromAccountId:shareForm.fromAccountId||undefined,
      fromCreditCardId:shareForm.fromCreditCardId||undefined,
    } : undefined;

    const data: any = {
      platform:form.platform==="_none"?"":form.platform, name:form.name, location:form.location,
      invested:parseFloat(form.invested)||0, currentValue:parseFloat(form.currentValue)||0,
      roi:parseFloat(form.roi)||0, monthlyRental:parseFloat(form.monthlyRental)||0,
      occupancy:parseFloat(form.occupancy)||0, type:form.type, color:form.color,
      currency:form.currency, purchaseDate:form.purchaseDate, status:form.status,
      rentalStartDate:form.rentalStartDate||undefined, saleDate:form.saleDate||undefined,
      salePrice:form.salePrice?parseFloat(form.salePrice):undefined,
      saleAccountId:form.saleAccountId||undefined,
      govFees:form.govFees?parseFloat(form.govFees):undefined,
      transactionFees:form.transactionFees?parseFloat(form.transactionFees):undefined,
      notes:form.notes, rentalAccountId:form.rentalAccountId||undefined,
      rentalPendingBalance:editProp?.rentalPendingBalance||0,
      purchaseAccountId:form.purchaseAccountId||undefined,
      purchaseCreditCardId:form.purchaseCreditCardId||undefined,
      isShareInvestment:form.isShareInvestment,
      shareDetails,
    };
    if (editProp) updateProperty(editProp.id, data);
    else addProperty(data);
    setPropOpen(false); setEditProp(null);
  };

  // Rental
  const openRental = (propId: string, rentalEntry?: any) => {
    const prop = properties.find(p=>p.id===propId);
    setRentalPropId(propId);
    if (rentalEntry) {
      setEditRentalId(rentalEntry.id);
      setRentalForm({ date:rentalEntry.date, amount:String(rentalEntry.amount), note:rentalEntry.note, transferToAccountId:rentalEntry.transferredToAccountId||"" });
    } else {
      setEditRentalId(null);
      setRentalForm({ date:new Date().toISOString().slice(0,10), amount:String(prop?.monthlyRental||""), note:"Monthly rental income", transferToAccountId:prop?.rentalAccountId||"" });
    }
  };
  const handleSaveRental = () => {
    if (!rentalPropId||!rentalForm.amount) return;
    if (editRentalId) {
      updateRentalEntry(rentalPropId, editRentalId, { date:rentalForm.date, amount:parseFloat(rentalForm.amount), note:rentalForm.note, transferredToAccountId:rentalForm.transferToAccountId||undefined });
    } else {
      addRentalEntry(rentalPropId, { date:rentalForm.date, amount:parseFloat(rentalForm.amount), note:rentalForm.note, transferredToAccountId:rentalForm.transferToAccountId||undefined });
      if (rentalForm.transferToAccountId) {
        transferRentalToAccount(rentalPropId, rentalForm.transferToAccountId, parseFloat(rentalForm.amount), rentalForm.date);
      }
    }
    setRentalPropId(null); setEditRentalId(null);
  };

  // Cost
  const openCost = (propId: string, costEntry?: any) => {
    setCostPropId(propId);
    if (costEntry) {
      setEditCostId(costEntry.id);
      setCostForm({ date:costEntry.date, amount:String(costEntry.amount), category:costEntry.category, description:costEntry.description, paymentMethod:costEntry.paymentMethod||"cash", accountId:costEntry.accountId||"", creditCardId:costEntry.creditCardId||"" });
    } else {
      setEditCostId(null);
      setCostForm({ date:new Date().toISOString().slice(0,10), amount:"", category:"maintenance", description:"", paymentMethod:"cash", accountId:"", creditCardId:"" });
    }
  };
  const handleSaveCost = () => {
    if (!costPropId||!costForm.amount) return;
    if (editCostId) {
      updatePropertyCost(costPropId, editCostId, { date:costForm.date, amount:parseFloat(costForm.amount), category:costForm.category, description:costForm.description, paymentMethod:costForm.paymentMethod, accountId:costForm.accountId||undefined, creditCardId:costForm.creditCardId||undefined });
    } else {
      addPropertyCost(costPropId, { date:costForm.date, amount:parseFloat(costForm.amount), category:costForm.category, description:costForm.description, paymentMethod:costForm.paymentMethod, accountId:costForm.paymentMethod==="bank_account"?costForm.accountId||undefined:undefined, creditCardId:costForm.paymentMethod==="credit_card"?costForm.creditCardId||undefined:undefined });
    }
    setCostPropId(null); setEditCostId(null);
  };

  const openTransfer = (propId: string) => {
    const prop = properties.find(p=>p.id===propId);
    setTransferPropId(propId);
    setTransferForm({ accountId:prop?.rentalAccountId||"", amount:String(prop?.rentalPendingBalance||""), date:new Date().toISOString().slice(0,10) });
  };
  const handleTransfer = () => {
    const amt = parseFloat(transferForm.amount);
    if (!transferPropId||!amt||!transferForm.accountId) return;
    transferRentalToAccount(transferPropId, transferForm.accountId, amt, transferForm.date);
    setTransferPropId(null);
  };

  const yearsOwned = (d: string) => {
    if (!d) return "";
    const diff = (Date.now()-new Date(d).getTime())/(1000*60*60*24*365);
    return diff<1?`${Math.floor(diff*12)}mo`:`${diff.toFixed(1)}yr`;
  };

  const filteredProps = useMemo(() =>
    properties.filter(p => matchesFilter(p as any, filter, "purchaseDate", ["name","location","platform","type"])),
    [properties, filter]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Real Estate" subtitle="Properties & rental income"
        action={<div className="flex gap-2"><Button variant="outline" className="gap-2 h-9" onClick={()=>setPlatMgrOpen(true)}><Settings className="w-3.5 h-3.5"/>Platforms</Button><Button className="gap-2" onClick={openAdd}><Plus className="w-4 h-4"/>Add Property</Button></div>}/>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Invested"   value={`AED ${totalInvested.toLocaleString()}`}      icon={Building2}/>
        <StatCard title="Current Value"    value={`AED ${totalValue.toLocaleString()}`}          icon={TrendingUp} change={totalInvested>0?`+${((totalValue-totalInvested)/totalInvested*100).toFixed(1)}%`:"0%"} changeType="up"/>
        <StatCard title="Monthly Rental"   value={`AED ${totalMonthlyRent}`}                     icon={DollarSign}/>
        <StatCard title="Sold Profit"      value={`AED ${soldProfit.toLocaleString()}`}          icon={Percent} changeType={soldProfit>=0?"up":"down"}/>
      </div>

      <SearchFilter value={filter} onChange={setFilter} placeholder="Search properties…" />

      {properties.length===0 && <div className="p-8 text-center text-muted-foreground glass-card text-sm">No properties added.</div>}

      {/* Sold properties stat cards */}
      {soldProperties.length>0 && (
        <div className="glass-card p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">SOLD / CLOSED PROPERTIES</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {soldProperties.map(p=>{
              const profit = (p.salePrice||0) - p.invested;
              const roi    = p.invested>0 ? (profit/p.invested*100).toFixed(1) : "0";
              return (
                <div key={p.id} className="p-3 rounded-xl bg-secondary/40 border border-border">
                  <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.location}</p>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
                    <div><span className="text-muted-foreground">Invested</span><p className="font-semibold">{p.currency} {p.invested.toLocaleString()}</p></div>
                    <div><span className="text-muted-foreground">Sold</span><p className="font-semibold text-primary">{p.currency} {(p.salePrice||0).toLocaleString()}</p></div>
                    <div><span className="text-muted-foreground">Profit</span><p className={`font-semibold ${profit>=0?"stat-up":"stat-down"}`}>{p.currency} {profit.toLocaleString()}</p></div>
                  </div>
                  <p className="text-[10px] text-amber-400 mt-1">ROI: {roi}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredProps.map((prop,i)=>{
          const statusInfo = PROP_STATUS.find(s=>s.value===(prop.status||"owned"));
          const totalCosts = (prop.maintenanceCosts||[]).reduce((s,c)=>s+c.amount,0);
          const totalRent  = prop.rentalHistory.filter(r=>r.amount>0).reduce((s,r)=>s+r.amount,0);
          const pending    = prop.rentalPendingBalance||0;
          const tab        = getTab(prop.id);
          const isExp      = expanded===prop.id;

          return (
            <motion.div key={prop.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.08}} className="glass-card overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {prop.platform && <span className="text-xs px-2 py-0.5 rounded-md bg-secondary">{prop.platform}</span>}
                    <span className="text-xs px-2 py-0.5 rounded-md bg-secondary">{statusInfo?.icon} {statusInfo?.label}</span>
                    {prop.isShareInvestment && <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">📊 Share</Badge>}
                  </div>
                  <div className="flex items-center gap-1">
                    {pending>0 && <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={()=>openTransfer(prop.id)}><ArrowRight className="w-3 h-3"/>AED {pending.toLocaleString()}</Button>}
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={()=>openCost(prop.id)}><Wrench className="w-3 h-3"/>Cost</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={()=>openRental(prop.id)}><Plus className="w-3 h-3"/>Rent</Button>
                    <button onClick={()=>openEdit(prop)} className="text-muted-foreground hover:text-foreground p-1"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>deleteProperty(prop.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
                <h3 className="font-display font-semibold text-foreground">{prop.name}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{prop.location}</span>
                  {prop.purchaseDate && <span>Owned {yearsOwned(prop.purchaseDate)}</span>}
                </div>
              </div>

              {/* Stats grid */}
              <div className="p-4 grid grid-cols-3 gap-3 border-b border-border">
                <div><p className="text-[10px] text-muted-foreground">Invested</p><p className="text-sm font-semibold">{prop.currency} {prop.invested.toLocaleString()}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Value</p><p className="text-sm font-semibold text-primary">{prop.currency} {prop.currentValue.toLocaleString()}</p></div>
                <div><p className="text-[10px] text-muted-foreground">ROI</p><p className="text-sm font-semibold stat-up">{prop.roi}%</p></div>
                <div><p className="text-[10px] text-muted-foreground">Monthly Rent</p><p className="text-sm font-semibold">{prop.currency} {prop.monthlyRental}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Total Received</p><p className="text-sm font-semibold stat-up">{prop.currency} {totalRent.toLocaleString()}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Total Costs</p><p className="text-sm font-semibold stat-down">{prop.currency} {totalCosts.toLocaleString()}</p></div>
              </div>

              {/* Share details if applicable */}
              {prop.isShareInvestment && prop.shareDetails && (
                <div className="px-4 py-3 border-b border-border bg-secondary/20">
                  <p className="text-[10px] font-semibold text-amber-400 mb-2">📊 SHARE INVESTMENT</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Shares Purchased</span><span className="font-medium">{prop.shareDetails.sharesPurchased?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Ownership %</span><span className="font-medium">{prop.shareDetails.ownershipPercent}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Rental Yield</span><span className="font-medium stat-up">{prop.shareDetails.annualizedRentalYield}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Annualized ROI</span><span className="font-medium stat-up">{prop.shareDetails.annualizedROI}%</span></div>
                    {prop.shareDetails.nextPaymentDate && <div className="flex justify-between col-span-2"><span className="text-muted-foreground">Next Payment</span><span className="font-medium text-primary">{prop.shareDetails.nextPaymentDate}</span></div>}
                    {prop.shareDetails.referenceCode && <div className="flex justify-between col-span-2"><span className="text-muted-foreground">Ref Code</span><span className="font-medium font-mono text-xs">{prop.shareDetails.referenceCode}</span></div>}
                  </div>
                </div>
              )}

              {/* Extra info */}
              {(prop.rentalStartDate||prop.govFees||prop.transactionFees||prop.notes||(prop.status==="sold"&&prop.salePrice)) && (
                <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground flex flex-wrap gap-3">
                  {prop.rentalStartDate && <span>🗓️ Rent from {prop.rentalStartDate}</span>}
                  {prop.govFees && <span>🏛️ Govt fees: {prop.currency} {prop.govFees.toLocaleString()}</span>}
                  {prop.transactionFees && <span>📄 Tx fees: {prop.currency} {prop.transactionFees.toLocaleString()}</span>}
                  {prop.status==="sold" && prop.salePrice && <span className="text-primary font-medium">💰 Sold: {prop.currency} {prop.salePrice.toLocaleString()} · Profit: {prop.currency} {(prop.salePrice-prop.invested).toLocaleString()}</span>}
                </div>
              )}

              {/* Occupancy */}
              <div className="px-4 py-2 border-b border-border">
                <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Occupancy</span><span>{prop.occupancy}%</span></div>
                <div className="w-full bg-secondary rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{width:`${prop.occupancy}%`,backgroundColor:prop.color}}/></div>
              </div>

              {/* Tab switcher */}
              <div className="flex gap-1 px-4 pt-3">
                {(["rental","costs"] as const).map(t=>(
                  <button key={t} onClick={()=>setTab(prop.id,t)} className={`px-3 py-1 rounded-md text-xs transition-colors capitalize ${tab===t?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>
                    {t==="rental"?`Rental (${prop.rentalHistory.filter(r=>r.amount>0).length})`:`Costs (${(prop.maintenanceCosts||[]).length})`}
                  </button>
                ))}
              </div>

              {/* Expand toggle */}
              <button onClick={()=>setExpanded(isExp?null:prop.id)} className="w-full flex items-center justify-center py-2 text-xs text-muted-foreground hover:text-foreground">
                {isExp?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}
              </button>

              <AnimatePresence>
                {isExp && (
                  <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                    <div className="px-4 pb-4">
                      {tab==="rental" && (
                        <div className="space-y-1 max-h-52 overflow-y-auto">
                          {prop.rentalHistory.filter(r=>r.amount>0).length===0 && <p className="text-xs text-center text-muted-foreground py-2">No rental income recorded.</p>}
                          {prop.rentalHistory.filter(r=>r.amount>0).slice().reverse().map(r=>(
                            <div key={r.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0 group">
                              <div>
                                <p className="font-medium text-foreground">{r.note||"Rental income"}</p>
                                {r.transferredToAccountId && <p className="text-[10px] text-primary">→ {accounts.find(a=>a.id===r.transferredToAccountId)?.name}</p>}
                              </div>
                              <div className="text-right flex items-center gap-2">
                                <div><p className="font-semibold stat-up">+{prop.currency} {r.amount.toLocaleString()}</p><p className="text-muted-foreground">{r.date}</p></div>
                                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                  <button onClick={()=>openRental(prop.id,r)} className="text-muted-foreground hover:text-foreground p-0.5"><Edit2 className="w-3 h-3"/></button>
                                  <button onClick={()=>deleteRentalEntry(prop.id,r.id)} className="text-muted-foreground hover:text-destructive p-0.5"><Trash2 className="w-3 h-3"/></button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {tab==="costs" && (
                        <div className="space-y-1 max-h-52 overflow-y-auto">
                          {(prop.maintenanceCosts||[]).length===0 && <p className="text-xs text-center text-muted-foreground py-2">No costs recorded.</p>}
                          {(prop.maintenanceCosts||[]).slice().reverse().map(c=>(
                            <div key={c.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0 group">
                              <div>
                                <p className="font-medium text-foreground">{c.description}</p>
                                <p className="text-muted-foreground capitalize">{c.category}{c.paymentMethod?` · ${c.paymentMethod.replace(/_/g," ")}`:""}</p>
                              </div>
                              <div className="text-right flex items-center gap-2">
                                <div><p className="font-semibold stat-down">-{prop.currency} {c.amount.toLocaleString()}</p><p className="text-muted-foreground">{c.date}</p></div>
                                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                  <button onClick={()=>openCost(prop.id,c)} className="text-muted-foreground hover:text-foreground p-0.5"><Edit2 className="w-3 h-3"/></button>
                                  <button onClick={()=>deletePropertyCost(prop.id,c.id)} className="text-muted-foreground hover:text-destructive p-0.5"><Trash2 className="w-3 h-3"/></button>
                                </div>
                              </div>
                            </div>
                          ))}
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

      {/* Add/Edit Property Dialog */}
      <Dialog open={propOpen} onOpenChange={setPropOpen}>
        <DialogContent className="sm:max-w-xl bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editProp?"Edit":"Add"} Property</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {/* Share investment toggle */}
            <div className="flex items-center gap-3 p-3 bg-amber-400/5 border border-amber-400/20 rounded-xl">
              <input type="checkbox" id="isShare" checked={form.isShareInvestment} onChange={e=>setForm((f:any)=>({...f,isShareInvestment:e.target.checked}))} className="w-4 h-4"/>
              <Label htmlFor="isShare" className="cursor-pointer text-sm">📊 This is a fractional / share-based investment</Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Property Name</Label><Input placeholder="e.g. 1BR Milano, JVC" value={form.name} onChange={e=>setForm((f:any)=>({...f,name:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Location</Label><Input placeholder="e.g. Dubai, UAE" value={form.location} onChange={e=>setForm((f:any)=>({...f,location:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Platform</Label>
                <Select value={form.platform||"_none"} onValueChange={v=>setForm((f:any)=>({...f,platform:v==="_none"?"":v}))}><SelectTrigger className="bg-background border-border"><SelectValue placeholder="Platform"/></SelectTrigger><SelectContent><SelectItem value="_none">None</SelectItem>{realEstatePlatforms.map(p=><SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>Type</Label>
                <Select value={form.type} onValueChange={v=>setForm((f:any)=>({...f,type:v}))}><SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger><SelectContent>{PROP_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>Currency</Label>
                <Select value={form.currency} onValueChange={v=>setForm((f:any)=>({...f,currency:v}))}><SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger><SelectContent>{CURRENCIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={form.status} onValueChange={v=>setForm((f:any)=>({...f,status:v}))}><SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger><SelectContent>{PROP_STATUS.map(s=><SelectItem key={s.value} value={s.value}>{s.icon} {s.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount Invested</Label><Input type="number" value={form.invested} onChange={e=>setForm((f:any)=>({...f,invested:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Current Value</Label><Input type="number" value={form.currentValue} onChange={e=>setForm((f:any)=>({...f,currentValue:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Monthly Rental</Label><Input type="number" value={form.monthlyRental} onChange={e=>setForm((f:any)=>({...f,monthlyRental:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>ROI %</Label><Input type="number" value={form.roi} onChange={e=>setForm((f:any)=>({...f,roi:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Occupancy %</Label><Input type="number" value={form.occupancy} onChange={e=>setForm((f:any)=>({...f,occupancy:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Purchase Date</Label><Input type="date" value={form.purchaseDate} onChange={e=>setForm((f:any)=>({...f,purchaseDate:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Rent Start Date</Label><Input type="date" value={form.rentalStartDate} onChange={e=>setForm((f:any)=>({...f,rentalStartDate:e.target.value}))} className="bg-background border-border"/></div>
            </div>

            {/* Purchase funding */}
            {!editProp && (
              <div className="border border-border rounded-lg p-3 space-y-2">
                <Label className="text-xs font-medium">🏦 Fund Purchase From (optional — deducts from account)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Bank Account</Label>
                    <Select value={form.purchaseAccountId||"_none"} onValueChange={v=>setForm((f:any)=>({...f,purchaseAccountId:v==="_none"?"":v,purchaseCreditCardId:""}))}>
                      <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger>
                      <SelectContent><SelectItem value="_none">None</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — AED {getAccountBalance(a.id).toLocaleString()}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Credit Card</Label>
                    <Select value={form.purchaseCreditCardId||"_none"} onValueChange={v=>setForm((f:any)=>({...f,purchaseCreditCardId:v==="_none"?"":v,purchaseAccountId:""}))}>
                      <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger>
                      <SelectContent><SelectItem value="_none">None</SelectItem>{creditCards.map(c=><SelectItem key={c.id} value={c.id}>{c.name} ···{c.last4}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Sold fields */}
            {form.status==="sold" && (
              <div className="border border-border rounded-lg p-3 space-y-3">
                <Label className="text-xs font-medium">💰 Sale Details</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Sale Date</Label><Input type="date" value={form.saleDate} onChange={e=>setForm((f:any)=>({...f,saleDate:e.target.value}))} className="bg-background border-border"/></div>
                  <div className="space-y-1.5"><Label>Sale Price</Label><Input type="number" value={form.salePrice} onChange={e=>setForm((f:any)=>({...f,salePrice:e.target.value}))} className="bg-background border-border"/></div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Credit sale proceeds to Account</Label>
                  <Select value={form.saleAccountId||"_none"} onValueChange={v=>setForm((f:any)=>({...f,saleAccountId:v==="_none"?"":v}))}>
                    <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None — don't credit"/></SelectTrigger>
                    <SelectContent><SelectItem value="_none">None</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — AED {getAccountBalance(a.id).toLocaleString()}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Share investment fields */}
            {form.isShareInvestment && (
              <div className="border border-amber-400/20 rounded-lg p-3 space-y-3 bg-amber-400/5">
                <Label className="text-xs font-semibold text-amber-400">📊 Share Investment Details</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Investment Date</Label><Input type="date" value={shareForm.date} onChange={e=>setShareForm((f:any)=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
                  <div className="space-y-1.5"><Label className="text-xs">Total Property Value</Label><Input type="number" placeholder="e.g. 1040000" value={shareForm.totalPropertyValue} onChange={e=>setShareForm((f:any)=>({...f,totalPropertyValue:e.target.value}))} className="bg-background border-border"/></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Total Shares</Label><Input type="number" value={shareForm.sharesTotal} onChange={e=>setShareForm((f:any)=>({...f,sharesTotal:e.target.value}))} className="bg-background border-border"/></div>
                  <div className="space-y-1.5"><Label className="text-xs">Shares Purchased</Label><Input type="number" value={shareForm.sharesPurchased} onChange={e=>setShareForm((f:any)=>({...f,sharesPurchased:e.target.value}))} className="bg-background border-border"/></div>
                  <div className="space-y-1.5"><Label className="text-xs">Ownership %</Label><Input type="number" step="0.01" value={shareForm.ownershipPercent} onChange={e=>setShareForm((f:any)=>({...f,ownershipPercent:e.target.value}))} className="bg-background border-border"/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Amount Invested</Label><Input type="number" value={shareForm.amountInvested} onChange={e=>setShareForm((f:any)=>({...f,amountInvested:e.target.value}))} className="bg-background border-border"/></div>
                  <div className="space-y-1.5"><Label className="text-xs">Purchase & Transaction Cost</Label><Input type="number" value={shareForm.purchaseTransactionCost} onChange={e=>setShareForm((f:any)=>({...f,purchaseTransactionCost:e.target.value}))} className="bg-background border-border"/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Annualized Rental Yield %</Label><Input type="number" step="0.01" value={shareForm.annualizedRentalYield} onChange={e=>setShareForm((f:any)=>({...f,annualizedRentalYield:e.target.value}))} className="bg-background border-border"/></div>
                  <div className="space-y-1.5"><Label className="text-xs">Annualized ROI %</Label><Input type="number" step="0.01" value={shareForm.annualizedROI} onChange={e=>setShareForm((f:any)=>({...f,annualizedROI:e.target.value}))} className="bg-background border-border"/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Next Payment Date</Label><Input type="date" value={shareForm.nextPaymentDate} onChange={e=>setShareForm((f:any)=>({...f,nextPaymentDate:e.target.value}))} className="bg-background border-border"/></div>
                  <div className="space-y-1.5"><Label className="text-xs">Reference Code</Label><Input placeholder="e.g. 246722Hvyv9WpM" value={shareForm.referenceCode} onChange={e=>setShareForm((f:any)=>({...f,referenceCode:e.target.value}))} className="bg-background border-border font-mono"/></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Fund from Account</Label>
                    <Select value={shareForm.fromAccountId||"_none"} onValueChange={v=>setShareForm((f:any)=>({...f,fromAccountId:v==="_none"?"":v,fromCreditCardId:""}))}>
                      <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger>
                      <SelectContent><SelectItem value="_none">None</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — AED {getAccountBalance(a.id).toLocaleString()}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Fund from Credit Card</Label>
                    <Select value={shareForm.fromCreditCardId||"_none"} onValueChange={v=>setShareForm((f:any)=>({...f,fromCreditCardId:v==="_none"?"":v,fromAccountId:""}))}>
                      <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger>
                      <SelectContent><SelectItem value="_none">None</SelectItem>{creditCards.map(c=><SelectItem key={c.id} value={c.id}>{c.name} ···{c.last4}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Govt Fees</Label><Input type="number" value={form.govFees} onChange={e=>setForm((f:any)=>({...f,govFees:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Transaction Fees</Label><Input type="number" value={form.transactionFees} onChange={e=>setForm((f:any)=>({...f,transactionFees:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>Auto-receive rent to account</Label>
              <Select value={form.rentalAccountId||"_none"} onValueChange={v=>setForm((f:any)=>({...f,rentalAccountId:v==="_none"?"":v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Hold balance in property"/></SelectTrigger>
                <SelectContent><SelectItem value="_none">Hold balance in property</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — AED {getAccountBalance(a.id).toLocaleString()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Color</Label>
              <div className="flex gap-2">{COLORS.map(c=><button key={c} onClick={()=>setForm((f:any)=>({...f,color:c}))} className="w-7 h-7 rounded-full border-2" style={{backgroundColor:c,borderColor:form.color===c?"white":"transparent"}}/>)}</div>
            </div>
            {form.notes!==undefined && <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e=>setForm((f:any)=>({...f,notes:e.target.value}))} rows={2} className="bg-background border-border"/></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setPropOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.name}>{editProp?"Save Changes":"Add Property"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record/Edit Rental Income */}
      <Dialog open={!!rentalPropId} onOpenChange={()=>{setRentalPropId(null);setEditRentalId(null);}}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>{editRentalId?"Edit":"Record"} Rental Income</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount ({properties.find(p=>p.id===rentalPropId)?.currency||"AED"})</Label><Input type="number" value={rentalForm.amount} onChange={e=>setRentalForm(f=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={rentalForm.date} onChange={e=>setRentalForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>Note</Label><Input value={rentalForm.note} onChange={e=>setRentalForm(f=>({...f,note:e.target.value}))} className="bg-background border-border"/></div>
            <div className="space-y-1.5"><Label>Transfer to Account (optional)</Label>
              <Select value={rentalForm.transferToAccountId||"_none"} onValueChange={v=>setRentalForm(f=>({...f,transferToAccountId:v==="_none"?"":v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Hold in property"/></SelectTrigger>
                <SelectContent><SelectItem value="_none">Hold in property</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — AED {getAccountBalance(a.id).toLocaleString()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {rentalForm.transferToAccountId && <div className="p-2 bg-primary/10 rounded-lg text-xs text-primary">Rental income will be credited to {accounts.find(a=>a.id===rentalForm.transferToAccountId)?.name}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>{setRentalPropId(null);setEditRentalId(null);}}>Cancel</Button>
            <Button onClick={handleSaveRental} disabled={!rentalForm.amount}>{editRentalId?"Save Changes":"Record Income"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record/Edit Cost */}
      <Dialog open={!!costPropId} onOpenChange={()=>{setCostPropId(null);setEditCostId(null);}}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>{editCostId?"Edit":"Record"} Property Cost</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Category</Label>
              <Select value={costForm.category} onValueChange={v=>setCostForm((f:any)=>({...f,category:v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                <SelectContent>{COST_CATS.map(c=><SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Description</Label><Input value={costForm.description} onChange={e=>setCostForm((f:any)=>({...f,description:e.target.value}))} placeholder="e.g. AC repair" className="bg-background border-border"/></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount</Label><Input type="number" value={costForm.amount} onChange={e=>setCostForm((f:any)=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={costForm.date} onChange={e=>setCostForm((f:any)=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {COST_PAY.map(m=>(
                  <button key={m.v} onClick={()=>setCostForm((f:any)=>({...f,paymentMethod:m.v,accountId:"",creditCardId:""}))} className={`py-2 px-3 rounded-lg text-xs border transition-all ${costForm.paymentMethod===m.v?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground hover:bg-secondary"}`}>{m.l}</button>
                ))}
              </div>
            </div>
            {costForm.paymentMethod==="bank_account" && (
              <Select value={costForm.accountId||"_none"} onValueChange={v=>setCostForm((f:any)=>({...f,accountId:v==="_none"?"":v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select account"/></SelectTrigger>
                <SelectContent><SelectItem value="_none">Don't deduct</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — AED {getAccountBalance(a.id).toLocaleString()}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {costForm.paymentMethod==="credit_card" && (
              <Select value={costForm.creditCardId||"_none"} onValueChange={v=>setCostForm((f:any)=>({...f,creditCardId:v==="_none"?"":v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select card"/></SelectTrigger>
                <SelectContent><SelectItem value="_none">Select card</SelectItem>{creditCards.map(c=><SelectItem key={c.id} value={c.id}>{c.name} ···{c.last4}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>{setCostPropId(null);setEditCostId(null);}}>Cancel</Button>
            <Button onClick={handleSaveCost} disabled={!costForm.amount}>{editCostId?"Save Changes":"Record Cost"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Balance */}
      <Dialog open={!!transferPropId} onOpenChange={()=>setTransferPropId(null)}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Transfer Rental Balance to Account</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="p-2 bg-secondary/50 rounded-lg text-xs text-muted-foreground">
              Available: {properties.find(p=>p.id===transferPropId)?.currency||"AED"} {(properties.find(p=>p.id===transferPropId)?.rentalPendingBalance||0).toLocaleString()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount</Label><Input type="number" value={transferForm.amount} onChange={e=>setTransferForm(f=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={transferForm.date} onChange={e=>setTransferForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <Select value={transferForm.accountId||"_none"} onValueChange={v=>setTransferForm(f=>({...f,accountId:v==="_none"?"":v}))}>
              <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select account"/></SelectTrigger>
              <SelectContent><SelectItem value="_none">Select account</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — AED {getAccountBalance(a.id).toLocaleString()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setTransferPropId(null)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={!transferForm.amount||!transferForm.accountId}>Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Platform Manager */}
      <Dialog open={platMgrOpen} onOpenChange={setPlatMgrOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Manage Platforms</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <Input value={newPlat} onChange={e=>setNewPlat(e.target.value)} placeholder="Platform name" className="bg-background border-border flex-1"/>
              <Button size="sm" onClick={()=>{if(newPlat.trim()){addRealEstatePlatform(newPlat.trim());setNewPlat("");}}}><Plus className="w-4 h-4"/></Button>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {realEstatePlatforms.map(p=>(
                <div key={p} className="flex items-center gap-2 bg-secondary/50 rounded-md px-3 py-2 group">
                  {editPlat?.old===p ? (
                    <><Input value={editPlat.val} onChange={e=>setEditPlat({old:p,val:e.target.value})} className="bg-background border-border h-7 text-xs flex-1"/>
                    <button onClick={()=>{updateRealEstatePlatform(p,editPlat.val);setEditPlat(null);}} className="text-primary text-xs font-medium">Save</button>
                    <button onClick={()=>setEditPlat(null)} className="text-muted-foreground text-xs">✕</button></>
                  ) : (
                    <><span className="text-sm flex-1">{p}</span>
                    <button onClick={()=>setEditPlat({old:p,val:p})} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>deleteRealEstatePlatform(p)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5"/></button></>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter><Button onClick={()=>setPlatMgrOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
