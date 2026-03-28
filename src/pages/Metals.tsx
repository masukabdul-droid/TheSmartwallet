import { SearchFilter, EMPTY_FILTER, matchesFilter, SearchFilterState } from "@/components/ui/search-filter";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Edit2, Settings, Pencil } from "lucide-react";
import { useDB, MetalTx } from "@/lib/database";

const COMMON_METALS = [
  {name:"Gold",unit:"gram",color:"#FFD700"},{name:"Silver",unit:"gram",color:"#C0C0C0"},
  {name:"Platinum",unit:"gram",color:"#E5E4E2"},{name:"Palladium",unit:"gram",color:"#CED0DD"},
  {name:"Copper",unit:"kg",color:"#B87333"},{name:"Iron",unit:"kg",color:"#A8A9AD"},
];


const EMPTY_TX = { date: new Date().toISOString().slice(0,10), type:"buy" as "buy"|"sell", quantity:"", pricePerUnit:"", platform:"", fromAccountId:"", payMethod:"none" as "account"|"creditcard"|"none", notes:"" };

export default function Metals() {
  const { metalHoldings, addMetalHolding, addMetalTx, updateMetalTx, deleteMetalTx, deleteMetalHolding, accounts, creditCards, metalPlatforms, addMetalPlatform, updateMetalPlatform, deleteMetalPlatform, getAccountBalance } = useDB();
  const [filter, setFilter] = useState<SearchFilterState>(EMPTY_FILTER);
  const [platMgrOpen, setPlatMgrOpen] = useState(false);
  const [newPlat, setNewPlat] = useState("");
  const [editPlat, setEditPlat] = useState<{old:string,val:string}|null>(null);
  const [expanded, setExpanded] = useState<string|null>(null);
  const [holdingOpen, setHoldingOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [customHolding, setCustomHolding] = useState({name:"",unit:"gram",color:"#FFD700"});
  
  // TX dialog
  const [txDialogHoldingId, setTxDialogHoldingId] = useState("");
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<MetalTx|null>(null);
  const [txForm, setTxForm] = useState(EMPTY_TX);

  const openTxDialog = (holdingId: string, tx?: MetalTx) => {
    setTxDialogHoldingId(holdingId);
    if (tx) {
      setEditingTx(tx);
      setTxForm({ date:tx.date, type:tx.type, quantity:String(tx.quantity), pricePerUnit:String(tx.pricePerUnit), platform:tx.platform, fromAccountId:tx.fromAccountId||"", notes:tx.notes||"" });
    } else {
      setEditingTx(null);
      setTxForm(EMPTY_TX);
    }
    setTxDialogOpen(true);
  };

  const handleAddHolding = () => {
    const preset = COMMON_METALS.find(m=>m.name===selectedPreset);
    const name = preset?.name || customHolding.name;
    const unit = preset?.unit || customHolding.unit;
    const color = preset?.color || customHolding.color;
    if (!name) return;
    addMetalHolding({name, unit, color});
    setHoldingOpen(false); setSelectedPreset(""); setCustomHolding({name:"",unit:"gram",color:"#FFD700"});
  };

  const handleSaveTx = () => {
    const qty = parseFloat(txForm.quantity);
    const price = parseFloat(txForm.pricePerUnit);
    if (!qty || !price || !txForm.platform || !txDialogHoldingId) return;
    const fromAccountId = txForm.fromAccountId || undefined;
    const txData = { date:txForm.date, type:txForm.type, quantity:qty, pricePerUnit:price, totalAed:qty*price, platform:txForm.platform, fromAccountId, notes:txForm.notes };
    if (editingTx) {
      updateMetalTx(txDialogHoldingId, editingTx.id, txData);
    } else {
      addMetalTx(txDialogHoldingId, txData);
    }
    setTxDialogOpen(false);
  };

  const totalValue = metalHoldings.reduce((sum,h) => {
    const net = h.transactions.filter(t=>t.type==="buy").reduce((s,t)=>s+t.quantity,0) - h.transactions.filter(t=>t.type==="sell").reduce((s,t)=>s+t.quantity,0);
    const last = h.transactions.length > 0 ? h.transactions[h.transactions.length-1].pricePerUnit : 0;
    return sum + net*last;
  }, 0);
  const totalInvested = metalHoldings.flatMap(h=>h.transactions.filter(t=>t.type==="buy")).reduce((s,t)=>s+t.totalAed,0);

  return (
    <div className="space-y-6">
      <PageHeader title="Metals Portfolio" subtitle="Gold, Silver & precious metals"
        action={<><Button variant="outline" className="gap-2 h-9" onClick={()=>setPlatMgrOpen(true)}><Settings className="w-3.5 h-3.5"/>Platforms</Button><Button className="gap-2" onClick={()=>setHoldingOpen(true)}><Plus className="w-4 h-4"/>Add Metal</Button></>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <StatCard title="Portfolio Value" value={`AED ${totalValue.toFixed(2)}`} icon={TrendingUp} />
        <StatCard title="Total Invested" value={`AED ${totalInvested.toFixed(2)}`} icon={TrendingUp} />
        <StatCard title="P&L" value={`AED ${(totalValue-totalInvested)>=0?"+":""}${(totalValue-totalInvested).toFixed(2)}`} icon={TrendingUp} changeType={totalValue>=totalInvested?"up":"down"} />
      </div>

      <SearchFilter value={filter} onChange={setFilter} placeholder="Search metals…" />
      <div className="space-y-4">
        {metalHoldings.length === 0 && <div className="p-8 text-center text-muted-foreground glass-card text-sm">No metal holdings. Add your first!</div>}
        {metalHoldings.map((h,i) => {
          const buys = h.transactions.filter(t=>t.type==="buy");
          const sells = h.transactions.filter(t=>t.type==="sell");
          const netQty = buys.reduce((s,t)=>s+t.quantity,0) - sells.reduce((s,t)=>s+t.quantity,0);
          const avgPrice = buys.length>0 ? buys.reduce((s,t)=>s+t.totalAed,0)/buys.reduce((s,t)=>s+t.quantity,0) : 0;
          const lastPrice = h.transactions.length>0 ? h.transactions[h.transactions.length-1].pricePerUnit : 0;
          const curVal = netQty*lastPrice;
          const inv = buys.reduce((s,t)=>s+t.totalAed,0);
          const pl = curVal-inv;
          const isExp = expanded===h.id;
          return (
            <motion.div key={h.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}} className="glass-card overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center border-2" style={{backgroundColor:`${h.color}30`,borderColor:h.color}}>
                      <span className="text-xs font-bold" style={{color:h.color}}>{h.name.slice(0,2).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-foreground">{h.name}</p>
                      <p className="text-xs text-muted-foreground">{netQty.toFixed(4)} {h.unit} · Avg AED {avgPrice.toFixed(2)}/{h.unit}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-base font-semibold text-foreground">AED {curVal.toFixed(2)}</p>
                      <p className={`text-xs ${pl>=0?"text-primary":"text-destructive"}`}>{pl>=0?"+":""}AED {pl.toFixed(2)}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={()=>openTxDialog(h.id)}><Plus className="w-3 h-3"/>Tx</Button>
                      <button onClick={()=>deleteMetalHolding(h.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                </div>
                <button onClick={()=>setExpanded(isExp?null:h.id)} className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <span>Transactions ({h.transactions.length})</span>
                  {isExp?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}
                </button>
                <AnimatePresence>
                  {isExp && (
                    <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                      <div className="border-t border-border pt-3 mt-2 space-y-1">
                        {h.transactions.length===0 && <p className="text-xs text-center text-muted-foreground py-2">No transactions.</p>}
                        {h.transactions.map(tx => (
                          <div key={tx.id} className="grid grid-cols-6 gap-2 text-xs py-1.5 items-center group">
                            <span className={`font-bold ${tx.type==="buy"?"text-primary":"text-destructive"}`}>{tx.type.toUpperCase()}</span>
                            <span>{tx.quantity} {h.unit}</span>
                            <span>AED {tx.pricePerUnit.toLocaleString()}</span>
                            <span className="text-muted-foreground">{tx.platform}</span>
                            <span className="text-muted-foreground">{tx.date}</span>
                            <span className="flex justify-end gap-1">
                              <button onClick={()=>openTxDialog(h.id,tx)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-0.5 transition-opacity"><Edit2 className="w-3 h-3"/></button>
                              <button onClick={()=>deleteMetalTx(h.id,tx.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5 transition-opacity"><Trash2 className="w-3 h-3"/></button>
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Add Holding */}
      <Dialog open={holdingOpen} onOpenChange={setHoldingOpen}>
        <DialogContent className="w-full sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>Add Metal Holding</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-2">
              {COMMON_METALS.map(m=>(
                <button key={m.name} onClick={()=>setSelectedPreset(m.name===selectedPreset?"":m.name)}
                  className={`p-2 rounded-lg text-xs border transition-all ${selectedPreset===m.name?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground hover:bg-secondary"}`}>
                  <div className="w-5 h-5 rounded-full mx-auto mb-1 border" style={{backgroundColor:m.color}}/>
                  {m.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-center text-muted-foreground">— or custom —</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Metal Name</Label><Input placeholder="e.g. Titanium" value={customHolding.name} onChange={e=>setCustomHolding(f=>({...f,name:e.target.value}))} disabled={!!selectedPreset} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Unit</Label><Input placeholder="gram / kg / oz" value={customHolding.unit} onChange={e=>setCustomHolding(f=>({...f,unit:e.target.value}))} disabled={!!selectedPreset} className="bg-background border-border"/></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setHoldingOpen(false)}>Cancel</Button>
            <Button onClick={handleAddHolding} disabled={!selectedPreset&&!customHolding.name}>Add Metal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit TX Dialog */}
      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
        <DialogContent className="w-full sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>{editingTx?"Edit":"Add"} Metal Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={txForm.type} onValueChange={v=>setTxForm(f=>({...f,type:v as "buy"|"sell"}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="buy">Buy</SelectItem><SelectItem value="sell">Sell</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={txForm.date} onChange={e=>setTxForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" step="any" value={txForm.quantity} onChange={e=>setTxForm(f=>({...f,quantity:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Price/unit (AED)</Label><Input type="number" value={txForm.pricePerUnit} onChange={e=>setTxForm(f=>({...f,pricePerUnit:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Platform</Label>
                <Select value={txForm.platform} onValueChange={v=>setTxForm(f=>({...f,platform:v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select…"/></SelectTrigger>
                  <SelectContent>{metalPlatforms.map(p=><SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>From Account (opt.)</Label>
                <Select value={txForm.fromAccountId||"_none"} onValueChange={v=>setTxForm(f=>({...f,fromAccountId:v==="_none"?"":v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger>
                  <SelectContent><SelectItem value="_none">None</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input placeholder="e.g. 24K bar" value={txForm.notes} onChange={e=>setTxForm(f=>({...f,notes:e.target.value}))} className="bg-background border-border"/></div>
            {txForm.quantity&&txForm.pricePerUnit&&(
              <div className="bg-secondary/50 rounded-lg p-3 text-xs text-center font-medium">Total: AED {(parseFloat(txForm.quantity)*parseFloat(txForm.pricePerUnit)).toLocaleString()}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setTxDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTx} disabled={!txForm.quantity||!txForm.pricePerUnit||!txForm.platform}>{editingTx?"Save Changes":"Add Transaction"}</Button>
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
              <Button size="sm" onClick={()=>{if(newPlat.trim()){addMetalPlatform(newPlat.trim());setNewPlat("");}}}><Plus className="w-4 h-4"/></Button>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {metalPlatforms.map(p=>(
                <div key={p} className="flex items-center gap-2 bg-secondary/50 rounded-md px-3 py-2 group">
                  {editPlat?.old===p ? (
                    <>
                      <Input value={editPlat.val} onChange={e=>setEditPlat({old:p,val:e.target.value})} className="bg-background border-border h-7 text-xs flex-1"/>
                      <button onClick={()=>{updateMetalPlatform(p,editPlat.val);setEditPlat(null);}} className="text-primary text-xs font-medium">Save</button>
                      <button onClick={()=>setEditPlat(null)} className="text-muted-foreground text-xs">✕</button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm flex-1">{p}</span>
                      <button onClick={()=>setEditPlat({old:p,val:p})} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>deleteMetalPlatform(p)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5"/></button>
                    </>
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