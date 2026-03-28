import { SearchFilter, EMPTY_FILTER, matchesFilter, SearchFilterState } from "@/components/ui/search-filter";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, ShoppingCart, Home, Car, Utensils, Zap, Plane, Heart, Dumbbell, DollarSign, Calendar, PiggyBank, ArrowRight } from "lucide-react";
import { useDB } from "@/lib/database";

const ICON_MAP: Record<string, any> = { Home, Utensils, Car, ShoppingCart, Zap, Plane, Heart, Dumbbell, DollarSign };
const ICON_OPTIONS = ["Home", "Utensils", "Car", "ShoppingCart", "Zap", "Plane", "Heart", "Dumbbell", "DollarSign"];
const COLOR_OPTIONS = [
  "hsl(160, 84%, 39%)", "hsl(200, 80%, 50%)", "hsl(280, 70%, 60%)",
  "hsl(40, 90%, 55%)", "hsl(0, 72%, 51%)", "hsl(180, 60%, 45%)",
  "hsl(330, 70%, 55%)", "hsl(260, 60%, 55%)", "hsl(25, 90%, 55%)",
];
const BUDGET_PERIODS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "yearly", label: "Yearly" },
  { id: "fixed", label: "Fixed (One-Time)" },
];

function getPeriodLabel(p: string) { return BUDGET_PERIODS.find(x=>x.id===p)?.label || p; }

export default function Budgets() {
  const { budgets, addBudget, updateBudget, updateBudgetSpent, deleteBudget, addSavingsGoal, transactions, creditCards } = useDB();
  // Auto-calculate spent from real transactions per budget category
  const computedSpent = useMemo(() => {
    const result: Record<string, number> = {};
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    
    budgets.forEach(b => {
      // Get transactions matching this category
      let txTotal = 0;
      const cats = [b.category.toLowerCase()];
      // Fuzzy match common variations (expanded aliases)
      const catMap: Record<string,string[]> = {
        "food & dining": ["food","dining","food & dining","restaurant","restaurants","cafe","coffee","fast food","takeaway","delivery","kfc","mcdonald","starbucks","subway"],
        "food": ["food","dining","food & dining","restaurant","restaurants","cafe","coffee","fast food","takeaway","kfc","mcdonald"],
        "dining": ["food","dining","food & dining","restaurant","restaurants","cafe","coffee","fast food","takeaway"],
        "groceries": ["groceries","grocery","supermarket","hypermarket","lulu","carrefour","spinneys","waitrose"],
        "transport": ["transport","transportation","uber","taxi","careem","fuel","petrol","salik","toll","metro","bus"],
        "fuel": ["fuel","petrol","gas","enoc","adnoc","eppco","transport"],
        "utilities": ["utilities","dewa","sewa","fewa","addc","electricity","water","utility","gas utility"],
        "shopping": ["shopping","retail","clothes","fashion","electronics","amazon","noon","namshi"],
        "entertainment": ["entertainment","streaming","subscription","movies","cinema","vox","netflix","spotify","disney"],
        "telecom": ["telecom","telecommunications","phone","mobile","internet","wifi","du","etisalat","e&","virgin mobile"],
        "health": ["health","healthcare","medical","pharmacy","hospital","clinic","gym","fitness","dumbbell"],
        "healthcare": ["health","healthcare","medical","pharmacy","hospital","clinic"],
        "education": ["education","school","university","tuition","course","training"],
        "travel": ["travel","airline","airlines","hotel","hotels","airfare","flight","visa","holiday"],
        "insurance": ["insurance","takaful","policy","premium"],
        "government": ["government","fines","rta","municipality","visa fee","emirates id"],
        "housing": ["housing","rent","maintenance","service charge","home"],
      };
      const matchCats = catMap[b.category.toLowerCase()] || [b.category.toLowerCase()];
      
      transactions.filter(t => {
        if (t.amount >= 0) return false; // only expenses
        const txCat = t.category.toLowerCase();
        if (!matchCats.some(mc => txCat.includes(mc) || mc.includes(txCat))) return false;
        // Period filter
        if (b.period === "monthly") return t.date >= monthStart;
        if (b.period === "weekly") { const weekAgo = new Date(now.getTime()-7*24*60*60*1000).toISOString().slice(0,10); return t.date >= weekAgo; }
        if (b.period === "daily") return t.date === now.toISOString().slice(0,10);
        if (b.period === "fixed" || b.period === "fixed_year") return b.startDate ? t.date >= b.startDate : true;
        return true;
      }).forEach(t => txTotal += Math.abs(t.amount));
      
      // Also count CC transactions
      creditCards.forEach(cc => {
        cc.transactions.filter(t => {
          if (t.amount >= 0) return false;
          const txCat = t.category.toLowerCase();
          if (!matchCats.some(mc => txCat.includes(mc) || mc.includes(txCat))) return false;
          if (b.period === "monthly") return t.date >= monthStart;
          return true;
        }).forEach(t => txTotal += Math.abs(t.amount));
      });
      
      result[b.id] = txTotal;
    });
    return result;
  }, [budgets, transactions, creditCards]);

  const [filter, setFilter] = useState<SearchFilterState>(EMPTY_FILTER);
  const [open, setOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<any>(null);
  const [form, setForm] = useState({ category: "", budget: "", spent: "0", color: COLOR_OPTIONS[0], iconName: "DollarSign", period: "monthly", startDate: new Date().toISOString().slice(0,10), endDate: "" });

  const [editSpentId, setEditSpentId] = useState<string | null>(null);
  const [editSpentVal, setEditSpentVal] = useState("");
  const [leftoverDialogId, setLeftoverDialogId] = useState<string|null>(null);
  const [leftoverAction, setLeftoverAction] = useState<"savings"|"rollover">("savings");
  const [filterPeriod, setFilterPeriod] = useState("all");

  const openAdd = () => { setEditBudget(null); setForm({ category:"", budget:"", spent:"0", color:COLOR_OPTIONS[0], iconName:"DollarSign", period:"monthly", startDate:new Date().toISOString().slice(0,10), endDate:"" }); setOpen(true); };
  const openEdit = (b: any) => { setEditBudget(b); setForm({ category:b.category, budget:String(b.budget), spent:String(b.spent), color:b.color, iconName:b.iconName, period:b.period||"monthly", startDate:b.startDate||new Date().toISOString().slice(0,10), endDate:b.endDate||"" }); setOpen(true); };

  const handleSave = () => {
    const budget = parseFloat(form.budget);
    const spent = parseFloat(form.spent) || 0;
    if (!form.category || isNaN(budget) || budget <= 0) return;
    const data = { category: form.category, budget, spent, color: form.color, iconName: form.iconName, period: form.period, startDate: form.startDate, endDate: form.endDate };
    if (editBudget) updateBudget(editBudget.id, data);
    else addBudget(data);
    setOpen(false);
  };

  const handleSaveSpent = (id: string) => {
    const val = parseFloat(editSpentVal);
    if (!isNaN(val) && val >= 0) updateBudgetSpent(id, val);
    setEditSpentId(null);
  };

  const handleLeftover = (budget: any) => {
    const leftover = budget.budget - budget.spent;
    if (leftover <= 0) { setLeftoverDialogId(null); return; }
    if (leftoverAction === "savings") {
      addSavingsGoal({ name: `${budget.category} Leftover`, type: "regular", target: leftover, current: leftover, monthly: 0, color: budget.color });
    }
    // For rollover: could add to next period's starting balance
    setLeftoverDialogId(null);
  };

  const filtered = filterPeriod === "all" ? budgets : budgets.filter(b => (b as any).period === filterPeriod);
  const totalBudget = filtered.reduce((s, b) => s + b.budget, 0);
  const totalSpent = filtered.reduce((s, b) => s + b.spent, 0);
  const totalLeftover = Math.max(0, totalBudget - totalSpent);

  return (
    <div className="space-y-6">
      <PageHeader title="Budgets" subtitle="Spending limits with period tracking"
        action={<Button className="gap-2" onClick={openAdd}><Plus className="w-4 h-4"/>New Budget</Button>} />

      {/* Summary */}
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="glass-card p-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm text-muted-foreground">Total Budget</p>
            <p className="text-3xl font-display font-bold text-foreground">AED {totalBudget.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Spent / Remaining</p>
            <p className="text-xl font-bold text-foreground">AED {totalSpent.toLocaleString()} / <span className={totalLeftover>0?"text-primary":"text-destructive"}>AED {totalLeftover.toLocaleString()}</span></p>
          </div>
        </div>
        <Progress value={totalBudget > 0 ? Math.min((totalSpent/totalBudget)*100, 100) : 0} className="h-2"/>
        <p className="text-xs text-muted-foreground mt-2">{totalBudget > 0 ? Math.round((totalSpent/totalBudget)*100) : 0}% of budget used</p>
      </motion.div>

      {/* Period filter */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-sm text-muted-foreground flex items-center gap-1"><Calendar className="w-4 h-4"/>Period:</span>
        {[{id:"all",label:"All"},...BUDGET_PERIODS].map(p=>(
          <button key={p.id} onClick={()=>setFilterPeriod(p.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${filterPeriod===p.id?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground hover:bg-secondary"}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Budget list */}
      <SearchFilter value={filter} onChange={setFilter} placeholder="Search budgets…" />
      <div className="space-y-3">
        <AnimatePresence>
          {filtered.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm glass-card">No budgets for this period.</div>}
          {filtered.map((budget, i) => {
            const Icon = ICON_MAP[budget.iconName] || DollarSign;
            const pct = budget.budget > 0 ? Math.min(Math.round((budget.spent/budget.budget)*100), 100) : 0;
            const leftover = budget.budget - budget.spent;
            const isOver = leftover < 0;
            return (
              <motion.div key={budget.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{delay:i*0.05}} className="glass-card p-5 group">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{backgroundColor:`${budget.color}20`}}>
                    <Icon className="w-5 h-5" style={{color:budget.color}}/>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground">{budget.category}</p>
                      <Badge variant="outline" className="text-[10px] h-4">{getPeriodLabel((budget as any).period || "monthly")}</Badge>
                      {isOver && <Badge className="text-[10px] h-4 bg-destructive/10 text-destructive border-destructive/20">Over budget!</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">AED {budget.spent.toLocaleString()} of AED {budget.budget.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className={`text-sm font-bold ${isOver?"text-destructive":"text-primary"}`}>{isOver?"-":"+"} AED {Math.abs(leftover).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{isOver?"over":"remaining"}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isOver && leftover > 0 && (
                        <button onClick={()=>{setLeftoverDialogId(budget.id);setLeftoverAction("savings");}} className="text-muted-foreground hover:text-primary p-1" title="Handle leftover">
                          <PiggyBank className="w-3.5 h-3.5"/>
                        </button>
                      )}
                      <button onClick={()=>openEdit(budget)} className="text-muted-foreground hover:text-foreground p-1"><Edit2 className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>deleteBudget(budget.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                </div>
                <Progress value={pct} className="h-2 mb-2" style={{"--progress-color": isOver?"hsl(0,72%,51%)":budget.color} as any}/>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{pct}% used</p>
                  {editSpentId === budget.id ? (
                    <div className="flex items-center gap-2">
                      <Input type="number" value={editSpentVal} onChange={e=>setEditSpentVal(e.target.value)} className="h-7 w-28 text-xs bg-background border-border" autoFocus onKeyDown={e=>{if(e.key==="Enter")handleSaveSpent(budget.id);if(e.key==="Escape")setEditSpentId(null);}}/>
                      <Button size="sm" className="h-7 text-xs" onClick={()=>handleSaveSpent(budget.id)}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={()=>setEditSpentId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <button onClick={()=>{setEditSpentId(budget.id);setEditSpentVal(String(budget.spent));}} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Update spent</button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>{editBudget?"Edit":"New"} Budget</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Category Name</Label><Input placeholder="e.g. Food & Dining" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Budget Amount</Label><Input type="number" placeholder="0" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Period</Label>
                <Select value={form.period} onValueChange={v=>setForm(f=>({...f,period:v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                  <SelectContent>{BUDGET_PERIODS.map(p=><SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Already Spent</Label><Input type="number" value={form.spent} onChange={e=>setForm(f=>({...f,spent:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            {form.period === "fixed" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} className="bg-background border-border"/></div>
                <div className="space-y-1.5"><Label>End Date</Label><Input type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} className="bg-background border-border"/></div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="flex gap-2 flex-wrap">
                {ICON_OPTIONS.map(ico => { const I=ICON_MAP[ico]; return (
                  <button key={ico} onClick={()=>setForm(f=>({...f,iconName:ico}))} className={`p-2 rounded-lg border transition-all ${form.iconName===ico?"border-primary bg-primary/10":"border-border hover:bg-secondary"}`}>
                    <I className="w-4 h-4"/>
                  </button>
                ); })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map(c=>(
                  <button key={c} onClick={()=>setForm(f=>({...f,color:c}))} className={`w-7 h-7 rounded-full border-2 transition-all ${form.color===c?"border-white scale-110":"border-transparent"}`} style={{backgroundColor:c}}/>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.category||!form.budget}>{editBudget?"Save Changes":"Create Budget"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leftover Dialog */}
      <Dialog open={!!leftoverDialogId} onOpenChange={()=>setLeftoverDialogId(null)}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Handle Budget Leftover</DialogTitle></DialogHeader>
          {leftoverDialogId && (() => {
            const b = budgets.find(x=>x.id===leftoverDialogId);
            if (!b) return null;
            const left = b.budget - b.spent;
            return (
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">You have <span className="font-semibold text-primary">AED {left.toLocaleString()}</span> left in your <span className="font-semibold text-foreground">{b.category}</span> budget.</p>
                <div className="flex gap-3">
                  <button onClick={()=>setLeftoverAction("savings")} className={`flex-1 p-3 rounded-xl text-sm border transition-all flex flex-col items-center gap-1 ${leftoverAction==="savings"?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground"}`}>
                    <PiggyBank className="w-5 h-5"/>Save to Goals
                  </button>
                  <button onClick={()=>setLeftoverAction("rollover")} className={`flex-1 p-3 rounded-xl text-sm border transition-all flex flex-col items-center gap-1 ${leftoverAction==="rollover"?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground"}`}>
                    <ArrowRight className="w-5 h-5"/>Roll Over
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{leftoverAction==="savings"?"This will add a new savings goal with the leftover amount.":"This will note the leftover for your records."}</p>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={()=>setLeftoverDialogId(null)}>Cancel</Button>
            <Button onClick={()=>handleLeftover(budgets.find(x=>x.id===leftoverDialogId))}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
