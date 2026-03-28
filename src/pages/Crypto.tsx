import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Bitcoin, Coins, Edit2, Settings, Pencil } from "lucide-react";
import { useDB, CryptoTx } from "@/lib/database";
import { SearchFilter, EMPTY_FILTER, SearchFilterState } from "@/components/ui/search-filter";

const COMMON_CRYPTOS = [
  {name:"Bitcoin",symbol:"BTC",color:"#F7931A"},{name:"Ethereum",symbol:"ETH",color:"#627EEA"},
  {name:"Solana",symbol:"SOL",color:"#9945FF"},{name:"Cardano",symbol:"ADA",color:"#0033AD"},
  {name:"Polygon",symbol:"MATIC",color:"#8247E5"},{name:"Binance Coin",symbol:"BNB",color:"#F3BA2F"},
  {name:"Ripple",symbol:"XRP",color:"#00AAE4"},{name:"Dogecoin",symbol:"DOGE",color:"#C2A633"},
  {name:"Pepe",symbol:"PEPE",color:"#4CAF50"},{name:"USDT",symbol:"USDT",color:"#26A17B"},
];

export default function Crypto() {
  const { cryptoHoldings, addCryptoHolding, addCryptoTx, updateCryptoTx, deleteCryptoTx, deleteCryptoHolding, accounts, creditCards, cryptoExchanges, addCryptoExchange, updateCryptoExchange, deleteCryptoExchange, addTransaction } = useDB();
  const [exMgrOpen, setExMgrOpen] = useState(false);
  const [newEx, setNewEx] = useState("");
  const [editEx, setEditEx] = useState<{old:string,val:string}|null>(null);
  const [expanded, setExpanded] = useState<string|null>(null);
  const [holdingOpen, setHoldingOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [customHolding, setCustomHolding] = useState({name:"",symbol:"",color:"#F7931A"});
  const [txDialogHoldingId, setTxDialogHoldingId] = useState("");
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<CryptoTx|null>(null);
  const [filter, setFilter] = useState<SearchFilterState>(EMPTY_FILTER);

  const emptyTx = {date:new Date().toISOString().slice(0,10), type:"buy" as "buy"|"sell", quantity:"", priceAed:"", exchange:"", fromAccountId:"", notes:""};
  const [txForm, setTxForm] = useState(emptyTx);

  const openTxDialog = (holdingId: string, tx?: CryptoTx) => {
    setTxDialogHoldingId(holdingId);
    if (tx) {
      setEditingTx(tx);
      setTxForm({date:tx.date, type:tx.type, quantity:String(tx.quantity), priceAed:String(tx.priceAed), exchange:tx.exchange, fromAccountId:tx.fromAccountId||"", notes:tx.notes||""});
    } else {
      setEditingTx(null);
      setTxForm(emptyTx);
    }
    setTxDialogOpen(true);
  };

  const handleAddHolding = () => {
    const preset = COMMON_CRYPTOS.find(c=>c.symbol===selectedPreset);
    const name = preset?.name || customHolding.name;
    const symbol = preset?.symbol || customHolding.symbol;
    const color = preset?.color || customHolding.color;
    if (!name || !symbol) return;
    addCryptoHolding({name, symbol, color});
    setHoldingOpen(false); setSelectedPreset(""); setCustomHolding({name:"",symbol:"",color:"#F7931A"});
  };

  const handleSaveTx = () => {
    const qty = parseFloat(txForm.quantity);
    const price = parseFloat(txForm.priceAed);
    if (!qty || !price || !txForm.exchange || !txDialogHoldingId) return;
    const txData: Omit<CryptoTx,"id"> = {date:txForm.date, type:txForm.type, quantity:qty, priceAed:price, exchange:txForm.exchange, fromAccountId:txForm.fromAccountId||undefined, notes:txForm.notes||undefined};
    if (editingTx) {
      updateCryptoTx(txDialogHoldingId, editingTx.id, txData);
    } else {
      addCryptoTx(txDialogHoldingId, txData);
      // BUY: deduct from account
      if (txForm.type === "buy" && txForm.fromAccountId) {
        const holding = cryptoHoldings.find(h => h.id === txDialogHoldingId);
        addTransaction({ name:`Crypto Buy: ${holding?.symbol||""}`, amount:-(qty*price), type:"expense", category:"Crypto", accountId:txForm.fromAccountId, date:txForm.date, notes:`Bought ${qty} ${holding?.symbol} @ AED ${price}` });
      }
      // SELL: credit to account
      if (txForm.type === "sell" && txForm.fromAccountId) {
        const holding = cryptoHoldings.find(h => h.id === txDialogHoldingId);
        addTransaction({ name:`Crypto Sell: ${holding?.symbol||""}`, amount:qty*price, type:"income", category:"Crypto", accountId:txForm.fromAccountId, date:txForm.date, notes:`Sold ${qty} ${holding?.symbol} @ AED ${price}` });
      }
    }
    setTxDialogOpen(false);
  };

  // FIXED: Correct P&L calculation
  // Portfolio value = netQty * lastPrice (current market value)
  // Total invested = sum of all BUY costs - sum of all SELL proceeds (net cost basis)
  // P&L = Portfolio value - Net invested
  const portfolioStats = useMemo(() => {
    let totalInvested = 0;
    let totalSellProceeds = 0;
    let portfolioValue = 0;

    cryptoHoldings.forEach(h => {
      const buys = h.transactions.filter(t=>t.type==="buy");
      const sells = h.transactions.filter(t=>t.type==="sell");
      const netQty = buys.reduce((s,t)=>s+t.quantity,0) - sells.reduce((s,t)=>s+t.quantity,0);
      const lastPrice = h.transactions.length>0 ? h.transactions[h.transactions.length-1].priceAed : 0;
      const buyCost = buys.reduce((s,t)=>s+(t.quantity*t.priceAed),0);
      const sellProceeds = sells.reduce((s,t)=>s+(t.quantity*t.priceAed),0);
      totalInvested += buyCost;
      totalSellProceeds += sellProceeds;
      portfolioValue += Math.max(0, netQty) * lastPrice;
    });

    const netCostBasis = totalInvested - totalSellProceeds;
    const totalPL = portfolioValue - netCostBasis;
    return { portfolioValue, totalInvested: netCostBasis, totalPL };
  }, [cryptoHoldings]);

  const filteredHoldings = useMemo(() => {
    if (!filter.query) return cryptoHoldings;
    const q = filter.query.toLowerCase();
    return cryptoHoldings.filter(h => h.name.toLowerCase().includes(q) || h.symbol.toLowerCase().includes(q));
  }, [cryptoHoldings, filter]);

  return (
    <div className="space-y-6">
      <PageHeader title="Crypto Portfolio" subtitle={`${cryptoHoldings.length} holdings`}
        action={<><Button variant="outline" className="gap-2 h-9" onClick={()=>setExMgrOpen(true)}><Settings className="w-3.5 h-3.5"/>Exchanges</Button><Button className="gap-2" onClick={()=>setHoldingOpen(true)}><Plus className="w-4 h-4"/>Add Holding</Button></>} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <StatCard title="Portfolio Value"   value={`AED ${portfolioStats.portfolioValue.toFixed(2)}`}  icon={Bitcoin}/>
        <StatCard title="Net Cost Basis"    value={`AED ${portfolioStats.totalInvested.toFixed(2)}`}   icon={Coins}/>
        <StatCard title="Total P&L"         value={`AED ${portfolioStats.totalPL>=0?"+":""}${portfolioStats.totalPL.toFixed(2)}`} icon={TrendingUp} changeType={portfolioStats.totalPL>=0?"up":"down"} change={portfolioStats.totalInvested>0?`${((portfolioStats.totalPL/Math.abs(portfolioStats.totalInvested))*100).toFixed(1)}%`:""}/>
      </div>

      <SearchFilter value={filter} onChange={setFilter} placeholder="Search holdings…" />

      <div className="space-y-4">
        {cryptoHoldings.length===0 && <div className="p-8 text-center text-muted-foreground glass-card text-sm">No crypto holdings yet.</div>}
        {filteredHoldings.map((h,i) => {
          const buys  = h.transactions.filter(t=>t.type==="buy");
          const sells = h.transactions.filter(t=>t.type==="sell");
          const netQty = buys.reduce((s,t)=>s+t.quantity,0) - sells.reduce((s,t)=>s+t.quantity,0);
          const avgBuy = buys.length>0 ? buys.reduce((s,t)=>s+t.quantity*t.priceAed,0)/buys.reduce((s,t)=>s+t.quantity,0) : 0;
          const lastPrice = h.transactions.length>0 ? h.transactions[h.transactions.length-1].priceAed : 0;
          const curVal = Math.max(0,netQty)*lastPrice;
          // Correct P&L: curVal - (total buy cost - sell proceeds)
          const buyCost = buys.reduce((s,t)=>s+(t.quantity*t.priceAed),0);
          const sellProceeds = sells.reduce((s,t)=>s+(t.quantity*t.priceAed),0);
          const netCost = buyCost - sellProceeds;
          const pl = curVal - netCost;
          const isExp = expanded===h.id;
          return (
            <motion.div key={h.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}} className="glass-card overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{backgroundColor:`${h.color}25`}}>
                      <span className="text-sm font-bold" style={{color:h.color}}>{h.symbol.slice(0,3)}</span>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-foreground">{h.name} ({h.symbol})</p>
                      <p className="text-xs text-muted-foreground">{netQty.toFixed(6)} {h.symbol} · Avg buy AED {avgBuy.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-base font-semibold text-foreground">AED {curVal.toFixed(2)}</p>
                      <p className={`text-xs flex items-center justify-end gap-1 ${pl>=0?"text-primary":"text-destructive"}`}>
                        {pl>=0?<TrendingUp className="w-3 h-3"/>:<TrendingDown className="w-3 h-3"/>}
                        {pl>=0?"+":""}AED {pl.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={()=>openTxDialog(h.id)}>
                        <Plus className="w-3 h-3"/>Tx
                      </Button>
                      <button onClick={()=>deleteCryptoHolding(h.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                </div>
                <button onClick={()=>setExpanded(isExp?null:h.id)} className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors pt-1">
                  <span>Transactions ({h.transactions.length})</span>
                  {isExp?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}
                </button>
                <AnimatePresence>
                  {isExp && (
                    <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                      <div className="border-t border-border pt-3 mt-2 space-y-1 max-h-52 overflow-y-auto">
                        {h.transactions.length===0 && <p className="text-xs text-center text-muted-foreground py-2">No transactions yet.</p>}
                        {h.transactions.map(tx=>(
                          <div key={tx.id} className="grid grid-cols-6 gap-2 text-xs py-1.5 items-center group">
                            <span className={`font-bold ${tx.type==="buy"?"text-primary":"text-destructive"}`}>{tx.type.toUpperCase()}</span>
                            <span className="text-foreground">{tx.quantity} {h.symbol}</span>
                            <span className="text-foreground">AED {tx.priceAed.toLocaleString()}</span>
                            <span className="text-muted-foreground">{tx.exchange}</span>
                            <span className="text-muted-foreground">{tx.date}</span>
                            <span className="flex justify-end gap-1">
                              <button onClick={()=>openTxDialog(h.id,tx)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-0.5"><Edit2 className="w-3 h-3"/></button>
                              <button onClick={()=>deleteCryptoTx(h.id,tx.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5"><Trash2 className="w-3 h-3"/></button>
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

      {/* Add Holding Dialog */}
      <Dialog open={holdingOpen} onOpenChange={setHoldingOpen}>
        <DialogContent className="w-full sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>Add Crypto Holding</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Quick select</Label>
              <div className="grid grid-cols-5 gap-2">
                {COMMON_CRYPTOS.map(c=>(
                  <button key={c.symbol} onClick={()=>setSelectedPreset(c.symbol===selectedPreset?"":c.symbol)}
                    className={`p-2 rounded-lg text-xs font-medium border transition-all ${selectedPreset===c.symbol?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground hover:bg-secondary"}`}>
                    <div className="w-4 h-4 rounded-full mx-auto mb-1" style={{backgroundColor:c.color}}/>
                    {c.symbol}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">— or add custom —</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Name</Label><Input placeholder="e.g. Bitcoin" value={customHolding.name} onChange={e=>setCustomHolding(f=>({...f,name:e.target.value}))} disabled={!!selectedPreset} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Symbol</Label><Input placeholder="e.g. BTC" value={customHolding.symbol} onChange={e=>setCustomHolding(f=>({...f,symbol:e.target.value.toUpperCase()}))} disabled={!!selectedPreset} className="bg-background border-border"/></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setHoldingOpen(false)}>Cancel</Button>
            <Button onClick={handleAddHolding} disabled={!selectedPreset&&(!customHolding.name||!customHolding.symbol)}>Add Holding</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Dialog */}
      <Dialog open={txDialogOpen} onOpenChange={v=>{if(!v)setTxDialogOpen(false);}}>
        <DialogContent className="w-full sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>{editingTx?"Edit":"Add"} Crypto Transaction</DialogTitle></DialogHeader>
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
              <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" step="any" placeholder="0.001" value={txForm.quantity} onChange={e=>setTxForm(f=>({...f,quantity:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Price per unit (AED)</Label><Input type="number" placeholder="0" value={txForm.priceAed} onChange={e=>setTxForm(f=>({...f,priceAed:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Exchange</Label>
                <Select value={txForm.exchange} onValueChange={v=>setTxForm(f=>({...f,exchange:v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select…"/></SelectTrigger>
                  <SelectContent>{cryptoExchanges.map(e=><SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{txForm.type==="buy"?"From Account (deduct)":"Credit to Account"}</Label>
                <Select value={txForm.fromAccountId||"_none"} onValueChange={v=>setTxForm(f=>({...f,fromAccountId:v==="_none"?"":v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="None"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input placeholder="e.g. DCA purchase" value={txForm.notes} onChange={e=>setTxForm(f=>({...f,notes:e.target.value}))} className="bg-background border-border"/></div>
            {txForm.quantity && txForm.priceAed && (
              <div className={`rounded-lg p-3 text-xs text-center font-medium ${txForm.type==="buy"?"bg-destructive/10 text-destructive":"bg-primary/10 text-primary"}`}>
                Total: AED {(parseFloat(txForm.quantity)*parseFloat(txForm.priceAed)).toLocaleString()} — {txForm.type==="buy"?"will be deducted from account":"will be credited to account"}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setTxDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTx} disabled={!txForm.quantity||!txForm.priceAed||!txForm.exchange}>
              {editingTx?"Save Changes":"Add Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exchange Manager */}
      <Dialog open={exMgrOpen} onOpenChange={setExMgrOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Manage Exchanges</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <Input value={newEx} onChange={e=>setNewEx(e.target.value)} placeholder="Exchange name" className="bg-background border-border flex-1"/>
              <Button size="sm" onClick={()=>{if(newEx.trim()){addCryptoExchange(newEx.trim());setNewEx("");}}}><Plus className="w-4 h-4"/></Button>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {cryptoExchanges.map(ex=>(
                <div key={ex} className="flex items-center gap-2 bg-secondary/50 rounded-md px-3 py-2 group">
                  {editEx?.old===ex ? (
                    <>
                      <Input value={editEx.val} onChange={e=>setEditEx({old:ex,val:e.target.value})} className="bg-background border-border h-7 text-xs flex-1"/>
                      <button onClick={()=>{updateCryptoExchange(ex,editEx.val);setEditEx(null);}} className="text-primary text-xs font-medium">Save</button>
                      <button onClick={()=>setEditEx(null)} className="text-muted-foreground text-xs">✕</button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm flex-1">{ex}</span>
                      <button onClick={()=>setEditEx({old:ex,val:ex})} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>deleteCryptoExchange(ex)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5"/></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter><Button onClick={()=>setExMgrOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
