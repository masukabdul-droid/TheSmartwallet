import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Plus, Trash2, Edit2, CheckCircle2, XCircle, Zap, ArrowRightLeft, CreditCard, Star, Tag, Settings, DollarSign } from "lucide-react";
import { useDB, AppRule, AppRuleCategory } from "@/lib/database";

const RULE_CATEGORIES: { value: AppRuleCategory; label: string; icon: string; desc: string }[] = [
  { value: "cashback", label: "Cashback", icon: "💳", desc: "Rules around cashback earning & redemption" },
  { value: "loyalty", label: "Loyalty & Points", icon: "⭐", desc: "Rules for loyalty point earning & redemption" },
  { value: "budget", label: "Budget", icon: "📊", desc: "Budget limit alerts, rollover logic" },
  { value: "autopay", label: "Auto-Pay", icon: "🔄", desc: "Automatic payment rules & scheduling" },
  { value: "discount", label: "Discount", icon: "🏷️", desc: "Discount card & program application rules" },
  { value: "transfer", label: "Transfer", icon: "↔️", desc: "Auto-transfer rules between accounts" },
  { value: "custom", label: "Custom", icon: "⚙️", desc: "Your own custom rules" },
];

const TRIGGERS = [
  "on_any_transaction",
  "on_cc_transaction",
  "on_account_debit",
  "on_account_credit",
  "on_salary_received",
  "on_recurring_bill_due",
  "on_loan_payment_due",
  "on_goal_deposit",
  "on_savings_deposit",
  "on_budget_threshold",
  "on_fd_maturity",
  "on_loyalty_points_threshold",
  "manual",
];

const EMPTY_RULE: Omit<AppRule,"id"|"createdAt"> = {
  name: "", description: "", category: "custom", isActive: true,
  trigger: "on_any_transaction", conditions: "", actions: "", notes: ""
};

const CAT_COLORS: Record<AppRuleCategory,string> = {
  cashback: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  loyalty: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  budget: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  autopay: "bg-green-500/20 text-green-400 border-green-500/30",
  discount: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  transfer: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  custom: "bg-secondary text-muted-foreground border-border",
};

export default function Rules() {
  const { appRules, addAppRule, updateAppRule, deleteAppRule } = useDB();
  const [open, setOpen] = useState(false);
  const [editRule, setEditRule] = useState<AppRule|null>(null);
  const [form, setForm] = useState<Omit<AppRule,"id"|"createdAt">>(EMPTY_RULE);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("all");

  const openAdd = () => { setEditRule(null); setForm(EMPTY_RULE); setOpen(true); };
  const openEdit = (r: AppRule) => {
    setEditRule(r);
    setForm({ name:r.name, description:r.description, category:r.category, isActive:r.isActive, trigger:r.trigger, conditions:r.conditions, actions:r.actions, notes:r.notes||"" });
    setOpen(true);
  };
  const handleSave = () => {
    if (!form.name) return;
    if (editRule) updateAppRule(editRule.id, form);
    else addAppRule(form);
    setOpen(false);
  };

  const filtered = appRules.filter(r => {
    if (filterCat !== "all" && r.category !== filterCat) return false;
    if (filterActive === "active" && !r.isActive) return false;
    if (filterActive === "inactive" && r.isActive) return false;
    return true;
  });

  const activeCount = appRules.filter(r=>r.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Rules Master Book" subtitle="Define, manage & automate all your financial rules"
        action={<Button className="gap-2" onClick={openAdd}><Plus className="w-4 h-4"/>New Rule</Button>}/>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Rules" value={appRules.length.toString()} icon={BookOpen}/>
        <StatCard title="Active" value={activeCount.toString()} icon={CheckCircle2} changeType="up"/>
        <StatCard title="Inactive" value={(appRules.length-activeCount).toString()} icon={XCircle}/>
        <StatCard title="Categories" value={new Set(appRules.map(r=>r.category)).size.toString()} icon={Tag}/>
      </div>

      {/* Category summary */}
      <div className="glass-card p-4">
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Rule Categories</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {RULE_CATEGORIES.map(cat => {
            const count = appRules.filter(r=>r.category===cat.value).length;
            return (
              <button key={cat.value} onClick={()=>setFilterCat(filterCat===cat.value?"all":cat.value)}
                className={`text-left p-3 rounded-lg border transition-all ${filterCat===cat.value?"border-primary bg-primary/10":"border-border bg-secondary/30 hover:bg-secondary/60"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{cat.icon}</span>
                  <span className="text-xs font-medium text-foreground">{cat.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{cat.desc}</p>
                <p className="text-xs font-bold mt-1 text-primary">{count} rule{count!==1?"s":""}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select value={filterActive} onChange={e=>setFilterActive(e.target.value)} className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground">
          <option value="all">All Status</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
        {(filterCat!=="all"||filterActive!=="all") && <button onClick={()=>{setFilterCat("all");setFilterActive("all");}} className="text-xs text-muted-foreground hover:text-foreground">Clear filters</button>}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} rule{filtered.length!==1?"s":""}</span>
      </div>

      {/* Rules list */}
      <div className="space-y-3">
        {filtered.length===0 && (
          <div className="glass-card p-12 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3"/>
            <p className="text-muted-foreground">No rules yet</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Create your master rulebook — cashback, auto-pay, loyalty and more.</p>
            <Button className="mt-4 gap-2" onClick={openAdd}><Plus className="w-4 h-4"/>Create First Rule</Button>
          </div>
        )}
        <AnimatePresence>
          {filtered.map((rule,i)=>{
            const cat = RULE_CATEGORIES.find(c=>c.value===rule.category);
            return (
              <motion.div key={rule.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{delay:i*0.04}} className="glass-card p-4">
                <div className="flex items-start gap-3">
                  <div className="text-xl mt-0.5">{cat?.icon||"⚙️"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{rule.name}</p>
                      <Badge className={`text-[10px] border ${CAT_COLORS[rule.category]}`}>{cat?.label}</Badge>
                      {rule.isActive
                        ? <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">Active</Badge>
                        : <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                      }
                    </div>
                    {rule.description && <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>}
                    <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span>🎯 Trigger: <span className="text-foreground font-mono">{rule.trigger}</span></span>
                      {rule.conditions && <span>📋 Conditions: {rule.conditions.slice(0,60)}{rule.conditions.length>60?"...":""}</span>}
                      {rule.actions && <span>⚡ Actions: {rule.actions.slice(0,60)}{rule.actions.length>60?"...":""}</span>}
                      <span className="ml-auto">Created: {rule.createdAt.slice(0,10)}</span>
                    </div>
                    {rule.notes && <p className="text-[10px] text-muted-foreground/70 mt-1 italic">{rule.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch checked={rule.isActive} onCheckedChange={v=>updateAppRule(rule.id,{isActive:v})}/>
                    <button onClick={()=>openEdit(rule)} className="text-muted-foreground hover:text-foreground p-1"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>deleteAppRule(rule.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Add/Edit Rule Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editRule?"Edit":"New"} Rule</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Rule Name</Label>
              <Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Earn Skywards on every CC purchase" className="bg-background border-border"/>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="What does this rule do?" className="bg-background border-border"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v=>setForm(f=>({...f,category:v as AppRuleCategory}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                  <SelectContent>{RULE_CATEGORIES.map(c=><SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Trigger</Label>
                <Select value={form.trigger} onValueChange={v=>setForm(f=>({...f,trigger:v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                  <SelectContent>{TRIGGERS.map(t=><SelectItem key={t} value={t} className="text-xs font-mono">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Conditions <span className="text-muted-foreground text-xs">(optional — describe when to apply)</span></Label>
              <Textarea value={form.conditions} onChange={e=>setForm(f=>({...f,conditions:e.target.value}))} placeholder="e.g. category=Food, amount>100, card=Mashreq Neo&#10;Use natural language or JSON conditions" rows={3} className="bg-background border-border text-xs"/>
            </div>
            <div className="space-y-1.5">
              <Label>Actions <span className="text-muted-foreground text-xs">(what happens when triggered)</span></Label>
              <Textarea value={form.actions} onChange={e=>setForm(f=>({...f,actions:e.target.value}))} placeholder="e.g. earn_points=5/AED, send_alert, deduct_from=account, apply_discount=10%" rows={3} className="bg-background border-border text-xs"/>
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground text-xs">(personal reminder)</span></Label>
              <Input value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="e.g. Check bank app to verify monthly cashback" className="bg-background border-border"/>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Switch checked={form.isActive} onCheckedChange={v=>setForm(f=>({...f,isActive:v}))}/>
              <Label className="text-sm">Active (rule is in effect)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name}>{editRule?"Save Changes":"Create Rule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
