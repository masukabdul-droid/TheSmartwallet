import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Wallet, TrendingUp, CreditCard, Target, Percent, Calendar, TrendingDown,
  ArrowUpRight, ArrowDownRight, Building2, Bitcoin
} from "lucide-react";
import { StatCard, PageHeader, SectionHeader } from "@/components/ui/stat-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { useDB } from "@/lib/database";

const PERIODS = [
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "last_3", label: "Last 3 Months" },
  { id: "last_6", label: "Last 6 Months" },
  { id: "this_year", label: "This Year" },
  { id: "all", label: "All Time" },
  { id: "custom", label: "Custom Range" },
];

function getPeriodRange(period: string, customFrom?: string, customTo?: string): { start: Date; end: Date } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (period === "this_month") return { start: new Date(y, m, 1), end: now };
  if (period === "last_month") return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0) };
  if (period === "last_3") return { start: new Date(y, m - 2, 1), end: now };
  if (period === "last_6") return { start: new Date(y, m - 5, 1), end: now };
  if (period === "this_year") return { start: new Date(y, 0, 1), end: now };
  if (period === "custom" && customFrom && customTo) return { start: new Date(customFrom), end: new Date(customTo+"T23:59:59") };
  return { start: new Date(2000, 0, 1), end: now };
}

const CAT_COLORS: Record<string, string> = {
  Housing: "hsl(160, 84%, 39%)", "Food & Dining": "hsl(200, 80%, 50%)", Food: "hsl(200, 80%, 50%)",
  Transport: "hsl(280, 70%, 60%)", Shopping: "hsl(40, 90%, 55%)", Utilities: "hsl(0, 72%, 51%)",
  Groceries: "hsl(120, 60%, 40%)", Telecom: "hsl(220, 70%, 55%)", Other: "hsl(215,15%,55%)",
};

const TT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs shadow-xl">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: AED {Number(p.value ?? 0).toLocaleString()}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { accounts, transactions, creditCards, loans, savingsGoals, goals, cryptoHoldings, properties, budgets, getAccountBalance, investmentHoldings } = useDB();
  const [period, setPeriod] = useState("this_month");
  const [acctFilter, setAcctFilter] = useState("all");
  const [customFrom, setCustomFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10); });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0,10));

  const { start, end } = getPeriodRange(period, customFrom, customTo);

  const filteredTxs = useMemo(() => transactions.filter(t => {
    const d = new Date(t.date);
    if (d < start || d > end) return false;
    if (acctFilter !== "all" && t.accountId !== acctFilter) return false;
    return true;
  }), [transactions, start, end, acctFilter]);

  const income = filteredTxs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = filteredTxs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const depositedInPeriod =
  goals.reduce((s, g) => s + g.transactions
    .filter(t => { const d = new Date(t.date); return t.amount > 0 && d >= start && d <= end; })
    .reduce((ss, t) => ss + t.amount, 0), 0)
  + savingsGoals.reduce((s, g) => s + (g.transactions || [])
    .filter(t => { const d = new Date(t.date); return t.amount > 0 && d >= start && d <= end; })
    .reduce((ss, t) => ss + t.amount, 0), 0);

const savingsRate = income > 0
  ? Math.round(((income - expenses) / income) * 100)
  : depositedInPeriod > 0 && expenses > 0
  ? Math.round((depositedInPeriod / (depositedInPeriod + expenses)) * 100)
  : depositedInPeriod > 0
  ? 100
  : 0;

  const totalBankBalance = accounts.reduce((s, a) => a.currency === "AED" ? s + getAccountBalance(a.id) : s, 0);
  const totalCCDebt = creditCards.reduce((s, c) => s + c.balance, 0);
  const totalLoanDebt = loans.reduce((s, l) => s + l.remainingBalance, 0);
  const totalSavings = savingsGoals.reduce((s, g) => s + g.current, 0)
  + goals.reduce((s, g) => s + g.currentAmount, 0);
  const cryptoValue = cryptoHoldings.reduce((sum, h) => {
    const net = h.transactions.filter(t => t.type === "buy").reduce((s, t) => s + t.quantity, 0) - h.transactions.filter(t => t.type === "sell").reduce((s, t) => s + t.quantity, 0);
    const last = h.transactions.length > 0 ? h.transactions[h.transactions.length - 1].priceAed : 0;
    return sum + net * last;
  }, 0);
  const realEstateValue = properties.reduce((s, p) => s + p.currentValue, 0);
  const investmentValue = investmentHoldings.reduce((sum, h) => {
    const buys = h.transactions.filter(t => t.type === "buy");
    const sells = h.transactions.filter(t => t.type === "sell");
    const netUnits = buys.reduce((s,t) => s + (t.units||0), 0) - sells.reduce((s,t) => s + (t.units||0), 0);
    const latestNav = h.nav || (h.transactions.length ? h.transactions[h.transactions.length-1].pricePerUnit || 0 : 0);
    return sum + Math.max(0, netUnits) * latestNav;
  }, 0);
  const netWorth = totalBankBalance + totalSavings + cryptoValue + realEstateValue + investmentValue - totalCCDebt - totalLoanDebt;
  const fiProjection = income > expenses ? Math.ceil((expenses * 12 * 25 - Math.max(netWorth, 0)) / ((income - expenses) * 12)) : 99;

  const spendByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTxs.filter(t => t.type === "expense").forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, value]) => ({
      name, value, color: CAT_COLORS[name] || "hsl(215,15%,55%)",
    }));
  }, [filteredTxs]);

  const monthlyTrend = useMemo(() => {
    const map: Record<string, { Income: number; Expenses: number }> = {};
    transactions.forEach(t => {
      const mo = t.date.slice(0, 7);
      if (!map[mo]) map[mo] = { Income: 0, Expenses: 0 };
      if (t.type === "income") map[mo].Income += t.amount;
      else map[mo].Expenses += t.amount;
    });
    return Object.entries(map).sort().slice(-6).map(([mo, v]) => ({
      month: new Date(mo + "-01").toLocaleString("en", { month: "short" }),
      ...v,
    }));
  }, [transactions]);

  const recentTxs = useMemo(() => [...filteredTxs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8), [filteredTxs]);

  const ccUtil = creditCards.reduce((s, c) => s + c.limit, 0) > 0
    ? Math.round((totalCCDebt / creditCards.reduce((s, c) => s + c.limit, 0)) * 100) : 0;
  const totalGoalTarget = goals.reduce((s, g) => s + g.targetAmount, 0)
  + savingsGoals.reduce((s, g) => s + g.target, 0);

const totalGoalCurrent = goals.reduce((s, g) => s + g.currentAmount, 0)
  + savingsGoals.reduce((s, g) => s + g.current, 0);

const goalsProgress = totalGoalTarget > 0
  ? Math.round((totalGoalCurrent / totalGoalTarget) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Complete financial command centre"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={acctFilter} onValueChange={setAcctFilter}>
              <SelectTrigger className="h-8 text-xs w-40 bg-background border-border">
                <SelectValue placeholder="All Accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-8 text-xs w-36 bg-background border-border">
                <Calendar className="w-3 h-3 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {period === "custom" && (
              <div className="flex items-center gap-1.5">
                <Input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} className="h-8 text-xs w-36 bg-background border-border"/>
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} className="h-8 text-xs w-36 bg-background border-border"/>
              </div>
            )}
          </div>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="Net Worth" value={`AED ${(netWorth / 1000).toFixed(0)}k`} icon={Wallet} changeType="up" />
        <StatCard title="Income" value={`AED ${income.toLocaleString(undefined,{maximumFractionDigits:0})}`} icon={TrendingUp} changeType="up" />
        <StatCard title="Expenses" value={`AED ${expenses.toLocaleString(undefined,{maximumFractionDigits:0})}`} icon={TrendingDown} changeType="down" />
        <StatCard title="Savings Rate" value={`${savingsRate}%`} icon={Percent} changeType={savingsRate >= 20 ? "up" : "down"} />
        <StatCard title="CC Debt" value={`AED ${totalCCDebt.toLocaleString(undefined,{maximumFractionDigits:0})}`} icon={CreditCard} changeType={totalCCDebt > 0 ? "down" : "up"} />
        <StatCard title="FI Horizon" value={fiProjection > 0 && fiProjection < 99 ? `${fiProjection}y` : "∞"} icon={Target} subtitle="to financial independence" />
      </div>

      {/* Wealth Snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Bank Balances", value: totalBankBalance, sub: `${accounts.length} accounts`, color: "text-foreground" },
          { label: "Savings & Pools", value: totalSavings, sub: `${savingsGoals.length} savings vehicles`, color: "text-primary" },
          { label: "Investments", value: cryptoValue + realEstateValue, sub: "Crypto + Real Estate", color: "text-foreground" },
          { label: "Total Debt", value: totalCCDebt + totalLoanDebt, sub: "CC + Loans/EMI", color: "text-destructive" },
        ].map(item => (
          <div key={item.label} className="glass-card p-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={`text-xl font-display font-bold mt-1 ${item.color}`}>
              AED {item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <SectionHeader title="Income vs Expenses" subtitle="Last 6 months" />
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,18%)" />
                <XAxis dataKey="month" stroke="hsl(215,15%,55%)" fontSize={11} />
                <YAxis stroke="hsl(215,15%,55%)" fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<TT />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Income" fill="hsl(160,84%,39%)" radius={[3,3,0,0]} />
                <Bar dataKey="Expenses" fill="hsl(0,72%,51%)" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5">
          <SectionHeader title="Spending Breakdown" subtitle={PERIODS.find(p => p.id === period)?.label} />
          {spendByCategory.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-xs text-muted-foreground">No expense data for this period</div>
          ) : (
            <div className="flex gap-3 h-[220px]">
              <div className="w-[170px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={spendByCategory} cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={2} dataKey="value">
                      {spendByCategory.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`AED ${v.toLocaleString()}`, ""]}
                      contentStyle={{ background: "hsl(220,18%,10%)", border: "1px solid hsl(220,14%,22%)", borderRadius: "0.5rem", fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 flex flex-col justify-center space-y-2 overflow-hidden">
                {spendByCategory.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground truncate">{item.name}</span>
                    </div>
                    <span className="font-medium text-foreground whitespace-nowrap">AED {item.value.toLocaleString(undefined,{maximumFractionDigits:0})}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-1.5 flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-destructive">AED {expenses.toLocaleString(undefined,{maximumFractionDigits:0})}</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-5 lg:col-span-2">
          <SectionHeader title="Recent Transactions" subtitle={`${recentTxs.length} shown · ${PERIODS.find(p=>p.id===period)?.label}`} />
          {recentTxs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No transactions for this period</p>
          ) : (
            <div className="space-y-0.5">
              {recentTxs.map(tx => {
                const acct = accounts.find(a => a.id === tx.accountId);
                return (
                  <div key={tx.id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-secondary/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tx.type === "income" ? "bg-primary/10" : "bg-secondary"}`}>
                        {tx.type === "income" ? <ArrowUpRight className="w-4 h-4 text-primary" /> : <ArrowDownRight className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{tx.name}</p>
                        <p className="text-xs text-muted-foreground">{tx.category} · {tx.date.slice(5)}{acct ? ` · ${acct.name}` : ""}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold whitespace-nowrap ml-2 ${tx.type === "income" ? "text-primary" : "text-foreground"}`}>
                      {tx.type === "income" ? "+" : "−"}AED {tx.amount.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-4">
          <div className="glass-card p-5">
            <SectionHeader title="Budget Health" />
            {budgets.length === 0 ? (
              <p className="text-xs text-muted-foreground">No budgets set</p>
            ) : (
              <div className="space-y-3">
                {budgets.slice(0, 4).map(b => {
                  const pct = b.budget > 0 ? Math.round((b.spent / b.budget) * 100) : 0;
                  const status = b.spent > b.budget ? "over" : pct > 80 ? "warn" : "ok";
                  return (
                    <div key={b.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground truncate">{b.category}</span>
                        <span className={status === "over" ? "text-destructive font-medium" : status === "warn" ? "text-warning font-medium" : "text-primary"}>{pct}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: status === "over" ? "hsl(0,72%,51%)" : status === "warn" ? "hsl(40,90%,55%)" : b.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="glass-card p-5">
            <SectionHeader title="Financial Health Score" />
            <div className="space-y-3">
              {[
                { label: "Savings Rate", pct: savingsRate, good: savingsRate >= 20, color: "bg-primary" },
                { label: "CC Utilization", pct: ccUtil, good: ccUtil <= 30, color: ccUtil <= 30 ? "bg-primary" : "bg-warning" },
                { label: "Goals Progress", pct: goalsProgress, good: true, color: "bg-primary" },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className={`font-semibold ${item.good ? "text-primary" : "text-warning"}`}>{item.pct}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(item.pct, 100)}%`, backgroundColor: item.good ? "hsl(120,100%,40%)" : "hsl(40,100%,55%)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
