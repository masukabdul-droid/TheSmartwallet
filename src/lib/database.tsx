import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { sbGetAll, sbUpsert, sbDelete, sbGetSingleton, sbUpsertSingleton, sbAddToTrash } from "./supabase-db";

// ─── Types ───────────────────────────────────────────────────────────────────


export interface Account {
  id: string; name: string;
  type: "savings" | "current" | "investment" | "cash" | "foreign";
  bank: string; currency: string;
  openingBalance: number; // base/tweak only
  color: string; isActive: boolean;
}

export interface Transaction {
  id: string; name: string; amount: number;
  type: "income" | "expense" | "transfer";
  category: string;
  accountId: string; date: string; notes?: string;
  isCreditCard?: boolean; creditCardId?: string;
  companyId?: string; loyaltyProgramId?: string; loyaltyPoints?: number;
  discountCardId?: string; discountAmount?: number;
  transferToAccountId?: string; transferFromAccountId?: string;
}

type GlobalTransaction = {
  id: string;
  name: string;
  amount: number;
  date: string;
  type: "income" | "expense" | "transfer";
  category: string;
  accountId?: string;
  cardId?: string;
  notes?: string;
  source: string;
};

export interface Budget {
  id: string; category: string; budget: number; spent: number;
  color: string; iconName: string;
  period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "annually" | "fixed_year" | "fixed";
  startDate?: string; endDate?: string;
  rolloverAction?: "save" | "extra_savings" | "discard";
  rolloverSavingsId?: string;
}

export type GoalRuleType = "one_shot" | "set_forget" | "pay_yourself_first" | "spend_save" | "spend_less" | "target_day";

export interface GoalRule {
  id: string; type: GoalRuleType; isActive: boolean;
  amount?: number; percent?: number;
  frequency?: "daily" | "weekly" | "monthly" | "yearly";
  targetDate?: string; targetAmount?: number;
  budgetCategory?: string; budgetLimit?: number;
  triggerAccountId?: string;
  spendCardId?: string; spendPerSwipe?: number;
}

export interface GoalInterest {
  enabled: boolean;
  type: "percentage" | "fixed_amount";
  rate: number; // percent or fixed AED
  frequency: "monthly" | "yearly";
}

export interface Goal {
  id: string; name: string; targetAmount: number; currentAmount: number;
  monthlyContribution: number; linkedAccountId?: string;
  startDate: string; targetDate: string; color: string;
  medium?: "account" | "physical" | "other"; mediumLabel?: string;
  rules?: GoalRule[];
  interest?: GoalInterest;
  transactions: GoalTransaction[];
}

export interface GoalTransaction {
  id: string; date: string; amount: number; note: string;
  type?: "deposit" | "withdraw" | "interest" | "rule";
  fromAccountId?: string; toAccountId?: string;
  fromTransferId?: string; sourceType?: "account" | "transfer" | "manual" | "rule";
}

export interface SavingsGoal {
  id: string; name: string;
  type: "regular" | "national_bond" | "ifarmer" | "wegro" | "biniyog" | "other";
  target: number; current: number; monthly: number; color: string;
  platform?: string; currency?: string;
  profitType?: "daily" | "percentage" | "monthly_fixed" | "quarterly" | "yearly" | "fixed_year" | "moving_roi" | "fixed_roi" | "average_roi" | "not_guaranteed";
  roiType?: "percentage" | "fixed_amount"; // for daily: whether rate is % or fixed AED
  interestRate?: number; startDate?: string; maturityDate?: string; notes?: string;
  transactions: SavingsTransaction[];
}

export interface SavingsTransaction {
  id: string; date: string; amount: number; note: string;
  type: "deposit" | "withdrawal" | "profit";
  fromAccountId?: string; fromTransferId?: string;
  toAccountId?: string; toCreditCardId?: string;
  fees?: number; misc?: number;
}

export interface FixedDeposit {
  id: string; bank: string; amount: number; rate: number;
  tenure: string; maturity: string; currency: string;
  linkedAccountId?: string; // where matured money goes
  notes?: string; reminderDays?: number; // days before maturity to remind
  accountId?: string; // account funds came from
}

export interface CardCashbackRule {
  category: string; rate: number; description?: string;
  maxMonthly?: number; tierType?: "flat" | "tiered"; minSpend?: number;
}

export interface CreditCard {
  id: string; name: string; issuer: string; last4: string;
  limit: number; balance: number; minPayment: number;
  dueDate: string; statementDate: string; color: string;
  cashbackType: string; cashbackRules?: CardCashbackRule[];
  cashbackBalance?: number;
  loyaltyProgramId?: string;
  transactions: CardTransaction[];
  repayments: CardRepayment[];
}

export interface CardTransaction {
  id: string; date: string; description: string; amount: number;
  category: string; isInstallment?: boolean; installmentMonths?: number;
  installmentFee?: number; installmentInterestRate?: number;
  installmentLoanId?: string; // links to Loan in loans[]
  loyaltyPoints?: number; pointsRedeemed?: number;
  companyId?: string; loyaltyProgramId?: string; discountCardId?: string; discountAmount?: number;
  earnLoyaltyProgramId?: string; // earn points while purchasing
}

export interface CardRepayment {
  id: string; cardId: string; date: string; amount: number;
  method: "bank_account" | "cash" | "other_card" | "cashback" | "loyalty_points" | "cheque" | "standing_order";
  sourceAccountId?: string; sourceCardId?: string; notes?: string;
}

export interface Company {
  id: string; name: string; category: string; color: string;
  loyaltyProgramId?: string; // linked loyalty/rewards program
  discountCardIds?: string[]; // discount cards that apply here
  website?: string; logo?: string;
}

export interface DiscountCard {
  id: string; name: string; provider: string; color: string;
  type: "government" | "corporate" | "membership" | "other";
  discountType: "percentage" | "fixed" | "tiered";
  defaultDiscount: number; // default % or AED
  maxDiscount?: number; // cap
  applicableCategories?: string[];
  expiryDate?: string; cardNumber?: string;
  rules?: DiscountRule[];
}

export interface DiscountRule {
  id: string; description: string;
  minAmount?: number; maxAmount?: number;
  discountPercent?: number; discountFixed?: number;
  category?: string; companyId?: string;
  dayOfWeek?: number[]; // 0=Sun...6=Sat
}

export interface LoyaltyProgram {
  id: string; name: string; provider: string; pointsBalance: number;
  pointsValue: number; // AED per point
  currency: string; color: string; expiryDate?: string;
  autoDetect?: boolean; // auto-add points on matching transactions
  earnRate?: number; // points per AED by default
  transactions: LoyaltyTx[];
}

export interface LoyaltyTx {
  id: string; date: string; points: number; type: "earned" | "redeemed" | "expired" | "transferred";
  description: string; linkedTxId?: string; redeemMethod?: "cashback" | "purchase" | "miles" | "account_credit";
  redeemValue?: number;
}

export type AppRuleCategory = "cashback" | "loyalty" | "budget" | "autopay" | "discount" | "transfer" | "custom";

export interface AppRule {
  id: string; name: string; description: string;
  category: AppRuleCategory; isActive: boolean;
  trigger: string; // e.g. "on_cc_transaction", "on_account_debit"
  conditions: string; // JSON-stringified conditions
  actions: string; // JSON-stringified actions
  createdAt: string; notes?: string;
}

export interface RecurringBill {
  id: string; name: string; category: string; amount: number; currency: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  dueDate: string; status: "paid" | "pending" | "overdue";
  autoPay: boolean; iconName: string; color: string;
  accountId?: string; creditCardId?: string; paymentMethod?: string;
  notes?: string;
  paymentHistory?: RecurringPaymentRecord[];
}

export interface Loan {
  id: string; name: string;
  type: "car" | "personal" | "home" | "credit_card_emi" | "other";
  lender: string; totalAmount: number; paidAmount: number; remainingBalance: number;
  emiAmount: number; interestRate: number; tenure: number; monthsPaid: number;
  nextDueDate: string; color: string; notes?: string; transactions: LoanTransaction[];
  autoPayAccountId?: string; autoPayCardId?: string; autoPayEnabled?: boolean;
}

export interface LoanTransaction {
  id: string; date: string; amount: number; type: "payment" | "adjustment"; note: string;
  paymentMethod?: "bank_account" | "cash" | "credit_card" | "standing_order" | "cheque" | "online" | "other";
  accountId?: string; creditCardId?: string;
}

export interface Transfer {
  id: string; date: string; fromAccountId: string; toAccountId: string;
  amountSent: number; amountReceived: number;
  currencyFrom: string; currencyTo: string; fxRate?: number; fee: number; notes?: string;
  transferMode?: string; // e.g. "SWIFT", "Local Bank", "Cash", etc.
  toCreditCardId?: string; // optional: destination is a CC instead of account
}

export interface MoneyLender {
  id: string; name: string; phone?: string; email?: string; notes?: string;
  color: string;
  records: LendRecord[];
}

export interface LendRecord {
  id: string; type: "lent" | "borrowed";
  amount: number; currency: string;
  description: string; issueDate: string;
  dueDate?: string;
  returnSchedule?: "one_time" | "daily" | "weekly" | "monthly" | "yearly";
  linkedAccountId?: string; // account funds came from or go to
  interestType?: "none" | "percentage" | "fixed";
  interestRate?: number; interestFixed?: number;
  status: "active" | "partially_paid" | "settled" | "waived";
  payments: LendPayment[];
}

export interface LendPayment {
  id: string; date: string; amount: number; note?: string;
  linkedAccountId?: string; isInterest?: boolean;
}

export interface CryptoHolding {
  id: string; name: string; symbol: string; color: string; transactions: CryptoTx[];
}

export interface CryptoTx {
  id: string; date: string; type: "buy" | "sell";
  quantity: number; priceAed: number; exchange: string; notes?: string; fromAccountId?: string;
}

export interface MetalHolding {
  id: string; name: string; unit: string; color: string; transactions: MetalTx[];
}

export interface MetalTx {
  id: string; date: string; type: "buy" | "sell";
  quantity: number; pricePerUnit: number; totalAed: number;
  platform: string; notes?: string; fromAccountId?: string;
}

export interface Property {
  id: string; platform: string; name: string; location: string;
  invested: number; currentValue: number; roi: number; monthlyRental: number;
  occupancy: number; type: string; color: string; currency: string;
  purchaseDate: string; notes?: string; rentalHistory: RentalEntry[];
  status: "owned" | "rented_out" | "leased" | "sold" | "vacant" | "closed";
  rentalStartDate?: string; saleDate?: string; salePrice?: number;
  maintenanceCosts: PropertyCost[];
  govFees?: number; transactionFees?: number;
  rentalAccountId?: string; rentalPendingBalance?: number;
  purchaseAccountId?: string; purchaseCreditCardId?: string;
  saleAccountId?: string;
  autoRentEnabled?: boolean; autoRentAccountId?: string; autoRentCreditCardId?: string;
  autoMaintenanceEnabled?: boolean; autoMaintenanceAccountId?: string; autoMaintenanceCreditCardId?: string;
  isShareInvestment?: boolean; shareDetails?: PropertyShare;
}

export interface PropertyCost {
  id: string; date: string; amount: number;
  category: "maintenance" | "government" | "transaction" | "insurance" | "other";
  description: string;
  paymentMethod?: "bank_account" | "credit_card" | "cash" | "other";
  accountId?: string; creditCardId?: string;
}

export interface RentalEntry { id: string; date: string; amount: number; note: string; transferredToAccountId?: string; }

export interface RecurringPaymentRecord {
  id: string; date: string; amount: number;
  method: string; accountId?: string; cardId?: string; note?: string;
}

export interface PropertyShare {
  id: string; date: string; totalPropertyValue: number;
  sharesTotal: number; sharesPurchased: number;
  ownershipPercent: number; amountInvested: number;
  purchaseTransactionCost?: number; referenceCode?: string;
  annualizedRentalYield?: number; annualizedROI?: number;
  currency: string; nextPaymentDate?: string;
  lastPaymentReceived?: number; totalRentalReceived?: number;
  fromAccountId?: string; fromCreditCardId?: string;
}

export interface Business {
  id: string; name: string; type: string;
  status: "active" | "completed" | "paused" | "archived";
  startDate: string; endDate?: string; color: string; notes?: string;
  transactions: BusinessTx[];
  partners?: BusinessPartner[];
  profitTransfers?: ProfitTransfer[];
}

export interface BusinessPartner {
  id: string; name: string; sharePercent: number; investment: number; joinDate: string;
  // Extended optional details
  email?: string; phone?: string; role?: string; address?: string;
  // Partner virtual account
  partnerAccountBalance: number; // running balance of their credited share
  partnerAccountTxs: PartnerAccountTx[];
}

export interface PartnerAccountTx {
  id: string; date: string; amount: number; type: "credit" | "debit" | "reinvest";
  description: string; toAccountId?: string;
}

export interface ProfitTransfer {
  id: string; date: string; amount: number; toAccountId: string; partnerId?: string; notes?: string;
}

export interface BusinessTx {
  id: string; date: string; description: string; amount: number;
  category: "revenue" | "expense"; accountId?: string; creditCardId?: string;
  partnerInvestmentId?: string;
}

export interface CashEntry {
  id: string; date: string; description: string; amount: number;
  type: "in" | "out"; category: string;
  linkedAccountId?: string; linkedTransferId?: string;
  toAccountId?: string; toCreditCardId?: string;
}



// ─── New Investment Types ─────────────────────────────────────────────────────

export type InvestmentType = "mutual_fund" | "etf" | "index_fund" | "bond";

export interface InvestmentHolding {
  id: string;
  type: InvestmentType;
  name: string;
  ticker?: string;           // ETF/Index Fund ticker e.g. "SPY"
  isin?: string;             // Bond ISIN
  color: string;
  currency: string;
  // Bond-specific
  issuer?: string;
  couponRate?: number;       // annual % e.g. 5.5
  maturityDate?: string;
  couponFrequency?: "monthly" | "quarterly" | "semi_annual" | "annual";
  faceValue?: number;        // per bond
  // Fund-specific
  expenseRatio?: number;     // annual % TER
  indexTracked?: string;     // e.g. "S&P 500"
  nav?: number;              // latest NAV price
  navDate?: string;
  transactions: InvestmentTx[];
}

export interface InvestmentTx {
  id: string;
  date: string;
  type: "buy" | "sell" | "dividend" | "coupon" | "maturity";
  units?: number;            // units/shares/bonds purchased or sold
  pricePerUnit?: number;     // NAV or market price
  totalAmount: number;       // total AED value
  fromAccountId?: string;    // account funds came from (buy) or go to (sell/income)
  toAccountId?: string;      // for sell/dividend/coupon proceeds
  notes?: string;
  fees?: number;
}

export interface SavingsWithdrawal {
  id: string; date: string; amount: number; fees?: number; misc?: number;
  toAccountId?: string; toCreditCardId?: string; note?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// Kept for backward compat during migration — no-op now
export function setCurrentUserId(_uid: string | null) {}

// ─── Trash helper ─────────────────────────────────────────────────────────────
export interface TrashedItem {
  id: string; type: string; label: string; detail: string; deletedAt: string; data: any;
}
// saveToTrash is now called with userId inside DatabaseProvider
export function saveToTrash(_item: TrashedItem) {
  // no-op: trash now handled inside DatabaseProvider with Supabase
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const defaultAccounts: Account[] = [
  { id:"acc1", name:"Mashreq Savings", bank:"Mashreq", type:"savings", currency:"AED", openingBalance:0, color:"hsl(40,90%,55%)", isActive:true },
  { id:"acc2", name:"Mashreq Current", bank:"Mashreq", type:"current", currency:"AED", openingBalance:0, color:"hsl(30,80%,50%)", isActive:true },
  { id:"acc3", name:"LIV Savings", bank:"Emirates NBD", type:"savings", currency:"AED", openingBalance:0, color:"hsl(280,70%,60%)", isActive:true },
  { id:"acc4", name:"Emirates NBD Current", bank:"Emirates NBD", type:"current", currency:"AED", openingBalance:0, color:"hsl(200,80%,50%)", isActive:true },
  { id:"acc5", name:"Sonali Bank", bank:"Sonali Bank", type:"savings", currency:"BDT", openingBalance:0, color:"hsl(160,84%,39%)", isActive:true },
  { id:"acc6", name:"Cash Wallet", bank:"Cash", type:"cash", currency:"AED", openingBalance:0, color:"hsl(120,50%,50%)", isActive:true },
];

const defaultTransactions: Transaction[] = [
  { id:"t1", name:"Salary", amount:12500, type:"income", category:"Income", accountId:"acc1", date:"2025-03-01" },
  { id:"t2", name:"Rent Payment", amount:-2800, type:"expense", category:"Housing", accountId:"acc1", date:"2025-03-01" },
  { id:"t3", name:"Carrefour", amount:-342, type:"expense", category:"Groceries", accountId:"acc2", date:"2025-02-28" },
  { id:"t4", name:"DEWA Bill", amount:-580, type:"expense", category:"Utilities", accountId:"acc2", date:"2025-02-27" },
  { id:"t5", name:"Starbucks", amount:-28, type:"expense", category:"Food", accountId:"acc2", date:"2025-02-27" },
  { id:"t6", name:"Salik Top-up", amount:-200, type:"expense", category:"Transport", accountId:"acc1", date:"2025-02-26" },
  { id:"t7", name:"Freelance Project", amount:3200, type:"income", category:"Freelance", accountId:"acc1", date:"2025-02-25" },
  { id:"t8", name:"Restaurant", amount:-185, type:"expense", category:"Food", accountId:"acc2", date:"2025-02-24" },
];

const defaultBudgets: Budget[] = [
  { id:"b1", category:"Housing", budget:3000, spent:2800, color:"hsl(160,84%,39%)", iconName:"Home", period:"monthly" },
  { id:"b2", category:"Food & Dining", budget:1500, spent:1200, color:"hsl(200,80%,50%)", iconName:"Utensils", period:"monthly" },
  { id:"b3", category:"Transport", budget:800, spent:600, color:"hsl(280,70%,60%)", iconName:"Car", period:"monthly" },
  { id:"b4", category:"Shopping", budget:1000, spent:900, color:"hsl(40,90%,55%)", iconName:"ShoppingCart", period:"monthly" },
  { id:"b5", category:"Utilities", budget:700, spent:580, color:"hsl(0,72%,51%)", iconName:"Zap", period:"monthly" },
];

const defaultGoals: Goal[] = [
  { id:"g1", name:"Emergency Fund", targetAmount:50000, currentAmount:32000, monthlyContribution:3000, startDate:"2024-06-01", targetDate:"2025-12-01", color:"hsl(160,84%,39%)", transactions:[], rules:[] },
  { id:"g2", name:"Vacation Fund", targetAmount:15000, currentAmount:8500, monthlyContribution:1500, startDate:"2024-09-01", targetDate:"2025-06-01", color:"hsl(200,80%,50%)", transactions:[], rules:[] },
  { id:"g3", name:"New Car", targetAmount:40000, currentAmount:18000, monthlyContribution:2500, startDate:"2024-03-01", targetDate:"2025-12-01", color:"hsl(280,70%,60%)", transactions:[], rules:[] },
];

const defaultSavingsGoals: SavingsGoal[] = [
  { id:"sg1", name:"Emergency Fund", type:"regular", target:50000, current:32000, monthly:3000, color:"hsl(160,84%,39%)", profitType:"percentage", interestRate:2.5, transactions:[] },
  { id:"sg2", name:"UAE National Bond", type:"national_bond", target:20000, current:5000, monthly:1000, color:"hsl(40,90%,55%)", platform:"UAE National Bonds", profitType:"not_guaranteed", interestRate:2.5, transactions:[] },
];

const defaultFixedDeposits: FixedDeposit[] = [
  { id:"fd1", bank:"Emirates NBD", amount:100000, rate:5.25, tenure:"12 months", maturity:"2026-01-15", currency:"AED" },
  { id:"fd2", bank:"ADCB", amount:50000, rate:4.75, tenure:"6 months", maturity:"2025-08-20", currency:"AED" },
];

const mashreqRules: CardCashbackRule[] = [
  { category:"Dining", rate:5, description:"All Dining 5%" },
  { category:"Food", rate:5, description:"Food & Dining 5%" },
  { category:"Food & Dining", rate:5, description:"Food & Dining 5%" },
  { category:"Restaurants", rate:5, description:"Restaurants 5%" },
  { category:"Groceries", rate:1, description:"Groceries 1%" },
  { category:"Shopping", rate:1, description:"Shopping 1%" },
  { category:"Government", rate:0.33, description:"Government 0.33%" },
  { category:"Utilities", rate:0.33, description:"Utilities 0.33%" },
  { category:"Education", rate:0.33, description:"Education 0.33%" },
  { category:"Fuel", rate:0.33, description:"Fuel 0.33%" },
  { category:"Telecom", rate:0.33, description:"Telecom 0.33%" },
  { category:"All", rate:1, description:"All other local spends 1%" },
];

const livRules: CardCashbackRule[] = [
  { category:"tier_10000_plus", rate:2.5, description:"AED 10,000+ spend @ 2.5%", tierType:"tiered", minSpend:10000, maxMonthly:750 },
  { category:"tier_5000_9999", rate:1.5, description:"AED 5,000–9,999 @ 1.5%", tierType:"tiered", minSpend:5000, maxMonthly:750 },
  { category:"tier_0_4999", rate:0.75, description:"AED 0–4,999 @ 0.75%", tierType:"tiered", minSpend:0, maxMonthly:750 },
  { category:"low_merchant", rate:0.1, description:"Low merchant 0.1%" },
];

const defaultCreditCards: CreditCard[] = [
  { id:"cc1", name:"Mashreq Neo Visa", issuer:"Mashreq", last4:"4821", limit:50000, balance:12400, minPayment:620, dueDate:"2025-03-25", statementDate:"2025-03-05", color:"from-amber-500 to-orange-600", cashbackType:"mashreq", cashbackRules:mashreqRules, cashbackBalance:0, repayments:[],
    transactions:[
      { id:"cct1", date:"2025-02-15", description:"DEWA Bill Payment", amount:-580, category:"Utilities" },
      { id:"cct2", date:"2025-02-18", description:"Carrefour Ajman", amount:-342, category:"Groceries" },
      { id:"cct3", date:"2025-02-20", description:"Starbucks Dubai Mall", amount:-48, category:"Food" },
      { id:"cct4", date:"2025-02-22", description:"Du Monthly Bill", amount:-346.5, category:"Telecom" },
    ]
  },
  { id:"cc2", name:"LIV Platinum", issuer:"Emirates NBD", last4:"1901", limit:6700, balance:1013, minPayment:100, dueDate:"2026-03-26", statementDate:"2026-03-01", color:"from-violet-500 to-purple-700", cashbackType:"liv_tiered", cashbackRules:livRules, cashbackBalance:0, repayments:[],
    transactions:[
      { id:"cct5", date:"2026-02-22", description:"FEDERAL ELECTRICITY AN DUBAI", amount:-758.21, category:"Utilities" },
      { id:"cct6", date:"2026-02-23", description:"EPPCO SITE 1094 DUBAI", amount:-127.05, category:"Fuel" },
      { id:"cct7", date:"2026-02-23", description:"SMART DUBAI GOVERNMENT", amount:-50, category:"Government" },
      { id:"cct8", date:"2026-02-26", description:"TABBY DUBAI", amount:-77.96, category:"Shopping" },
    ]
  },
];

const defaultCompanies: Company[] = [
  { id:"cmp1", name:"Emirates", category:"Airlines", color:"hsl(220,80%,50%)", loyaltyProgramId:"" },
  { id:"cmp2", name:"Etihad", category:"Airlines", color:"hsl(200,70%,45%)", loyaltyProgramId:"" },
  { id:"cmp3", name:"Carrefour", category:"Groceries", color:"hsl(160,70%,40%)", loyaltyProgramId:"" },
  { id:"cmp4", name:"KFC", category:"Food", color:"hsl(0,80%,50%)", loyaltyProgramId:"" },
  { id:"cmp5", name:"McDonald's", category:"Food", color:"hsl(40,90%,50%)", loyaltyProgramId:"" },
  { id:"cmp6", name:"Starbucks", category:"Coffee", color:"hsl(140,60%,35%)", loyaltyProgramId:"" },
  { id:"cmp7", name:"Amazon", category:"Shopping", color:"hsl(30,90%,50%)", loyaltyProgramId:"" },
  { id:"cmp8", name:"Noon", category:"Shopping", color:"hsl(55,100%,50%)", loyaltyProgramId:"" },
  { id:"cmp9", name:"ADNOC", category:"Fuel", color:"hsl(220,70%,50%)", loyaltyProgramId:"" },
  { id:"cmp10", name:"ENOC", category:"Fuel", color:"hsl(200,80%,45%)", loyaltyProgramId:"" },
  { id:"cmp11", name:"Lulu Hypermarket", category:"Groceries", color:"hsl(0,70%,50%)", loyaltyProgramId:"" },
  { id:"cmp12", name:"Spinneys", category:"Groceries", color:"hsl(100,60%,40%)", loyaltyProgramId:"" },
  { id:"cmp13", name:"Marriott", category:"Hotels", color:"hsl(330,60%,45%)", loyaltyProgramId:"" },
  { id:"cmp14", name:"Hilton", category:"Hotels", color:"hsl(200,80%,40%)", loyaltyProgramId:"" },
  { id:"cmp15", name:"Uber", category:"Transport", color:"hsl(200,10%,20%)", loyaltyProgramId:"" },
  { id:"cmp16", name:"Talabat", category:"Food Delivery", color:"hsl(20,90%,50%)", loyaltyProgramId:"" },
];

const defaultDiscountCards: DiscountCard[] = [
  { id:"dc1", name:"Fazaa", provider:"UAE Federal Authority", type:"government", color:"hsl(220,80%,40%)", discountType:"percentage", defaultDiscount:10, maxDiscount:500, applicableCategories:["Shopping","Food","Entertainment","Health"], rules:[] },
  { id:"dc2", name:"Esaad", provider:"Dubai Police", type:"government", color:"hsl(200,70%,40%)", discountType:"percentage", defaultDiscount:10, maxDiscount:300, applicableCategories:["Shopping","Food","Transport","Health"], rules:[] },
  { id:"dc3", name:"Icare", provider:"Ministry of Interior", type:"government", color:"hsl(260,70%,50%)", discountType:"percentage", defaultDiscount:10, applicableCategories:["Shopping","Food"], rules:[] },
];

const defaultRecurring: RecurringBill[] = [
  { id:"r1", name:"Netflix Premium", category:"Entertainment", amount:65, currency:"AED", frequency:"monthly", dueDate:"2025-03-15", status:"pending", autoPay:true, iconName:"Tv", color:"hsl(0,72%,51%)" },
  { id:"r2", name:"Du Home Internet", category:"Internet", amount:389, currency:"AED", frequency:"monthly", dueDate:"2025-03-05", status:"overdue", autoPay:false, iconName:"Wifi", color:"hsl(280,70%,60%)" },
  { id:"r3", name:"DEWA Electricity", category:"Utilities", amount:580, currency:"AED", frequency:"monthly", dueDate:"2025-03-12", status:"paid", autoPay:false, iconName:"Zap", color:"hsl(40,90%,55%)" },
  { id:"r4", name:"Fitness First", category:"Health", amount:350, currency:"AED", frequency:"monthly", dueDate:"2025-03-20", status:"pending", autoPay:true, iconName:"Dumbbell", color:"hsl(160,84%,39%)" },
  { id:"r5", name:"Car Insurance", category:"Insurance", amount:3200, currency:"AED", frequency:"yearly", dueDate:"2025-06-15", status:"pending", autoPay:false, iconName:"Shield", color:"hsl(220,60%,55%)" },
];

const defaultLoans: Loan[] = [
  { id:"l1", name:"Toyota Camry 2024", type:"car", lender:"Emirates NBD", totalAmount:120000, paidAmount:45000, remainingBalance:75000, emiAmount:2500, interestRate:3.49, tenure:48, monthsPaid:18, nextDueDate:"2025-03-15", color:"hsl(200,80%,50%)", transactions:[] },
  { id:"l2", name:"Personal Loan", type:"personal", lender:"Mashreq Bank", totalAmount:50000, paidAmount:30000, remainingBalance:20000, emiAmount:2083, interestRate:5.99, tenure:24, monthsPaid:14, nextDueDate:"2025-03-10", color:"hsl(280,70%,60%)", transactions:[] },
];

const defaultTransfers: Transfer[] = [
  { id:"tr1", date:"2025-03-01", fromAccountId:"acc1", toAccountId:"acc5", amountSent:5000, amountReceived:371500, currencyFrom:"AED", currencyTo:"BDT", fxRate:74.3, fee:25 },
  { id:"tr2", date:"2025-02-28", fromAccountId:"acc4", toAccountId:"acc3", amountSent:3000, amountReceived:3000, currencyFrom:"AED", currencyTo:"AED", fee:0 },
];

const defaultCrypto: CryptoHolding[] = [
  { id:"cr1", name:"Bitcoin", symbol:"BTC", color:"#F7931A", transactions:[
    { id:"ctx1", date:"2024-09-01", type:"buy", quantity:0.25, priceAed:22000, exchange:"Binance", notes:"DCA" },
    { id:"ctx2", date:"2024-12-15", type:"buy", quantity:0.20, priceAed:24000, exchange:"Binance", notes:"DCA" },
  ]},
  { id:"cr2", name:"Ethereum", symbol:"ETH", color:"#627EEA", transactions:[
    { id:"ctx3", date:"2024-10-01", type:"buy", quantity:4.2, priceAed:1600, exchange:"Kraken" },
  ]},
];

const defaultMetals: MetalHolding[] = [
  { id:"m1", name:"Gold", unit:"gram", color:"#FFD700", transactions:[
    { id:"mtx1", date:"2024-08-01", type:"buy", quantity:50, pricePerUnit:280, totalAed:14000, platform:"Dubai Gold Souk", notes:"24K" },
  ]},
];

const defaultProperties: Property[] = [
  { id:"p1", platform:"SmartCrowd", name:"Al Warqa Villa", location:"Dubai, UAE", invested:15000, currentValue:16800, roi:12, monthlyRental:125, occupancy:95, type:"Residential", color:"hsl(160,84%,39%)", currency:"AED", purchaseDate:"2024-01-15", status:"rented_out", maintenanceCosts:[], rentalPendingBalance:0, rentalHistory:[] },
  { id:"p2", platform:"Stake", name:"Business Bay Office", location:"Dubai, UAE", invested:20000, currentValue:21400, roi:7, monthlyRental:167, occupancy:100, type:"Commercial", color:"hsl(200,80%,50%)", currency:"AED", purchaseDate:"2024-03-01", status:"rented_out", maintenanceCosts:[], rentalPendingBalance:0, rentalHistory:[] },
];

const defaultBusinesses: Business[] = [
  { id:"biz1", name:"E-commerce Store", type:"Online Retail", status:"active", startDate:"2024-12-01", color:"hsl(160,84%,39%)", transactions:[
    { id:"btx1", date:"2024-12-01", description:"Initial Stock", amount:-5000, category:"expense" },
    { id:"btx2", date:"2025-01-01", description:"Revenue Month 1", amount:3200, category:"revenue" },
    { id:"btx3", date:"2025-02-01", description:"Revenue Month 2", amount:4100, category:"revenue" },
  ]},
];

const defaultCashEntries: CashEntry[] = [
  { id:"ce1", date:"2025-03-01", description:"ATM Withdrawal – Mashreq", amount:2000, type:"in", category:"ATM", linkedAccountId:"acc1" },
  { id:"ce2", date:"2025-03-02", description:"Grocery store (cash)", amount:-150, type:"out", category:"Groceries" },
  { id:"ce3", date:"2025-03-05", description:"Cash received", amount:500, type:"in", category:"Other" },
  { id:"ce4", date:"2025-03-06", description:"Laundry", amount:-80, type:"out", category:"Personal" },
];

// ─── Context ─────────────────────────────────────────────────────────────────

interface DB {

  dbLoading: boolean;
  accounts: Account[];
  addAccount: (a: Omit<Account,"id">) => void;
  updateAccount: (id: string, u: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  getAccountBalance: (id: string) => number;

  transactions: Transaction[];
  addTransaction: (t: Omit<Transaction,"id">) => void;
  batchAddTransactions: (txs: Omit<Transaction,"id">[]) => void;
  updateTransaction: (id: string, u: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  budgets: Budget[];
  addBudget: (b: Omit<Budget,"id">) => void;
  updateBudget: (id: string, u: Partial<Budget>) => void;
  updateBudgetSpent: (id: string, spent: number) => void;
  deleteBudget: (id: string) => void;

  goals: Goal[];
  addGoal: (g: Omit<Goal,"id"|"transactions">) => void;
  updateGoal: (id: string, u: Partial<Goal>) => void;
  addGoalTransaction: (goalId: string, tx: Omit<GoalTransaction,"id">) => void;
  withdrawFromGoal: (goalId: string, tx: Omit<GoalTransaction,"id">) => void;
  addGoalInterest: (goalId: string, date: string) => void;
  deleteGoal: (id: string) => void;

  savingsGoals: SavingsGoal[];
  addSavingsGoal: (g: Omit<SavingsGoal,"id"|"transactions">) => void;
  updateSavingsGoal: (id: string, u: Partial<SavingsGoal>) => void;
  addSavingsTx: (id: string, tx: Omit<SavingsTransaction,"id">) => void;
  deleteSavingsGoal: (id: string) => void;

  fixedDeposits: FixedDeposit[];
  addFixedDeposit: (fd: Omit<FixedDeposit,"id">) => void;
  updateFixedDeposit: (id: string, u: Partial<FixedDeposit>) => void;
  moveMaturedFD: (id: string, accountId: string, date: string) => void;
  deleteFixedDeposit: (id: string) => void;

  creditCards: CreditCard[];
  addCreditCard: (c: Omit<CreditCard,"id"|"transactions"|"repayments">) => void;
  updateCreditCard: (id: string, u: Partial<CreditCard>) => void;
  addCardTransaction: (cardId: string, tx: Omit<CardTransaction,"id">) => void;
  updateCardTransaction: (cardId: string, txId: string, u: Partial<CardTransaction>) => void;
  deleteCardTransaction: (cardId: string, txId: string) => void;
  updateCardBalance: (cardId: string, balance: number) => void;
  addCardRepayment: (repayment: Omit<CardRepayment,"id">) => void;
  deleteCardRepayment: (cardId: string, repaymentId: string) => void;
  deleteCreditCard: (id: string) => void;

  companies: Company[];
  addCompany: (c: Omit<Company,"id">) => void;
  updateCompany: (id: string, u: Partial<Company>) => void;
  deleteCompany: (id: string) => void;

  discountCards: DiscountCard[];
  addDiscountCard: (d: Omit<DiscountCard,"id">) => void;
  updateDiscountCard: (id: string, u: Partial<DiscountCard>) => void;
  deleteDiscountCard: (id: string) => void;

  loyaltyPrograms: LoyaltyProgram[];
  addLoyaltyProgram: (p: Omit<LoyaltyProgram,"id"|"transactions">) => void;
  updateLoyaltyProgram: (id: string, u: Partial<LoyaltyProgram>) => void;
  addLoyaltyTx: (programId: string, tx: Omit<LoyaltyTx,"id">) => void;
  deleteLoyaltyProgram: (id: string) => void;

  appRules: AppRule[];
  addAppRule: (r: Omit<AppRule,"id"|"createdAt">) => void;
  updateAppRule: (id: string, u: Partial<AppRule>) => void;
  deleteAppRule: (id: string) => void;

  recurringBills: RecurringBill[];
  addRecurringBill: (b: Omit<RecurringBill,"id">) => void;
  updateBillStatus: (id: string, status: RecurringBill["status"]) => void;
  payRecurringBill: (id: string, method: string, accountId?: string, cardId?: string) => void;
  deleteRecurringPayment: (billId: string, paymentId: string) => void;
  updateRecurringBill: (id: string, u: Partial<RecurringBill>) => void;
  deleteRecurringBill: (id: string) => void;

  loans: Loan[];
  addLoan: (l: Omit<Loan,"id"|"transactions">) => void;
  addLoanPayment: (loanId: string, tx: Omit<LoanTransaction,"id">) => void;
  updateLoanPayment: (loanId: string, txId: string, u: Partial<LoanTransaction>) => void;
  deleteLoanPayment: (loanId: string, txId: string) => void;
  updateLoan: (id: string, u: Partial<Loan>) => void;
  deleteLoan: (id: string) => void;

  transfers: Transfer[];
  addTransfer: (t: Omit<Transfer,"id">) => void;
  updateTransfer: (id: string, u: Partial<Transfer>) => void;
  deleteTransfer: (id: string) => void;
  transferModes: string[];
  addTransferMode: (mode: string) => void;
  updateTransferMode: (old: string, newMode: string) => void;
  deleteTransferMode: (mode: string) => void;

  moneyLenders: MoneyLender[];
  addMoneyLender: (m: Omit<MoneyLender,"id"|"records">) => void;
  updateMoneyLender: (id: string, u: Partial<MoneyLender>) => void;
  addLendRecord: (lenderId: string, r: Omit<LendRecord,"id"|"payments">) => void;
  updateLendRecord: (lenderId: string, recordId: string, u: Partial<LendRecord>) => void;
  deleteLendRecord: (lenderId: string, recordId: string) => void;
  addLendPayment: (lenderId: string, recordId: string, p: Omit<LendPayment,"id">) => void;
  updateLendPayment: (lenderId: string, recordId: string, paymentId: string, u: Partial<LendPayment>) => void;
  deleteLendPayment: (lenderId: string, recordId: string, paymentId: string) => void;
  waiveLendRecord: (lenderId: string, recordId: string) => void;
  deleteMoneyLender: (id: string) => void;

  cryptoHoldings: CryptoHolding[];
  addCryptoHolding: (c: Omit<CryptoHolding,"id"|"transactions">) => void;
  addCryptoTx: (holdingId: string, tx: Omit<CryptoTx,"id">) => void;
  updateCryptoTx: (holdingId: string, txId: string, u: Partial<CryptoTx>) => void;
  deleteCryptoTx: (holdingId: string, txId: string) => void;
  deleteCryptoHolding: (id: string) => void;
  cryptoExchanges: string[];
  addCryptoExchange: (e: string) => void;
  updateCryptoExchange: (old: string, nw: string) => void;
  deleteCryptoExchange: (e: string) => void;

  metalHoldings: MetalHolding[];
  addMetalHolding: (m: Omit<MetalHolding,"id"|"transactions">) => void;
  addMetalTx: (holdingId: string, tx: Omit<MetalTx,"id">) => void;
  updateMetalTx: (holdingId: string, txId: string, u: Partial<MetalTx>) => void;
  deleteMetalTx: (holdingId: string, txId: string) => void;
  deleteMetalHolding: (id: string) => void;
  metalPlatforms: string[];
  addMetalPlatform: (p: string) => void;
  updateMetalPlatform: (old: string, nw: string) => void;
  deleteMetalPlatform: (p: string) => void;

  properties: Property[];
  addProperty: (p: Omit<Property,"id"|"rentalHistory"|"maintenanceCosts">) => void;
  addRentalEntry: (propId: string, e: Omit<RentalEntry,"id">) => void;
  updateRentalEntry: (propId: string, entryId: string, u: Partial<RentalEntry>) => void;
  deleteRentalEntry: (propId: string, entryId: string) => void;
  updateProperty: (id: string, u: Partial<Property>) => void;
  addPropertyCost: (propId: string, cost: Omit<PropertyCost,"id">) => void;
  updatePropertyCost: (propId: string, costId: string, u: Partial<PropertyCost>) => void;
  deletePropertyCost: (propId: string, costId: string) => void;
  transferRentalToAccount: (propId: string, accountId: string, amount: number, date: string) => void;
  deleteProperty: (id: string) => void;
  realEstatePlatforms: string[];
  addRealEstatePlatform: (p: string) => void;
  updateRealEstatePlatform: (old: string, nw: string) => void;
  deleteRealEstatePlatform: (p: string) => void;

  businesses: Business[];
  addBusiness: (b: Omit<Business,"id"|"transactions">) => void;
  addBusinessTx: (bizId: string, tx: Omit<BusinessTx,"id">, deductFromAccount?: boolean) => void;
  updateBusinessTx: (bizId: string, txId: string, u: Partial<BusinessTx>) => void;
  deleteBusinessTx: (bizId: string, txId: string) => void;
  updateBusiness: (id: string, u: Partial<Business>) => void;
  addBusinessPartner: (bizId: string, partner: Omit<BusinessPartner,"id">) => void;
  updateBusinessPartner: (bizId: string, partnerId: string, u: Partial<BusinessPartner>) => void;
  deleteBusinessPartner: (bizId: string, partnerId: string) => void;
  addPartnerAccountTx: (bizId: string, partnerId: string, tx: Omit<PartnerAccountTx,"id">, toAccountId?: string) => void;
  addProfitTransfer: (bizId: string, transfer: Omit<ProfitTransfer,"id">) => void;
  deleteBusiness: (id: string) => void;
  updateGoalProgress: (id: string, amount: number) => void;

  cashEntries: CashEntry[];
  cashOpeningBalance: number;
  addCashEntry: (e: Omit<CashEntry,"id">) => void;
  updateCashEntry: (id: string, u: Partial<CashEntry>) => void;
  deleteCashEntry: (id: string) => void;
  setCashOpeningBalance: (b: number) => void;

  investmentHoldings: InvestmentHolding[];
  addInvestmentHolding: (h: Omit<InvestmentHolding,"id"|"transactions">) => void;
  updateInvestmentHolding: (id: string, u: Partial<InvestmentHolding>) => void;
  addInvestmentTx: (holdingId: string, tx: Omit<InvestmentTx,"id">) => void;
  updateInvestmentTx: (holdingId: string, txId: string, u: Partial<InvestmentTx>) => void;
  deleteInvestmentTx: (holdingId: string, txId: string) => void;
  deleteInvestmentHolding: (id: string) => void;

  withdrawFromSavings: (goalId: string, withdrawal: Omit<SavingsWithdrawal,"id">) => void;
  getGlobalTransactions: () => GlobalTransaction[];
  getGlobalBalance: () => number;
}

const DBContext = createContext<DB | null>(null);

export function DatabaseProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const [loading, setLoading] = useState(true);

  const [accounts, setAccountsRaw] = useState<Account[]>([]);
  const [transactions, setTransactionsRaw] = useState<Transaction[]>([]);
  const [budgets, setBudgetsRaw] = useState<Budget[]>([]);
  const [goals, setGoalsRaw] = useState<Goal[]>([]);
  const [savingsGoals, setSavingsGoalsRaw] = useState<SavingsGoal[]>([]);
  const [fixedDeposits, setFixedDepositsRaw] = useState<FixedDeposit[]>([]);
  const [creditCards, setCreditCardsRaw] = useState<CreditCard[]>([]);
  const [appRules, setAppRulesRaw] = useState<AppRule[]>([]);
  const [recurringBills, setRecurringBillsRaw] = useState<RecurringBill[]>([]);
  const [loans, setLoansRaw] = useState<Loan[]>([]);
  const [transfers, setTransfersRaw] = useState<Transfer[]>([]);
  const [cryptoHoldings, setCryptoHoldingsRaw] = useState<CryptoHolding[]>([]);
  const [metalHoldings, setMetalHoldingsRaw] = useState<MetalHolding[]>([]);
  const [properties, setPropertiesRaw] = useState<Property[]>([]);
  const [businesses, setBusinessesRaw] = useState<Business[]>([]);
  const [cashEntries, setCashEntriesRaw] = useState<CashEntry[]>([]);
  const [cashOpeningBalance, setCashOpeningBalanceRaw] = useState<number>(0);
  const [investmentHoldings, setInvestmentHoldingsRaw] = useState<InvestmentHolding[]>([]);
  const [loyaltyPrograms, setLoyaltyProgramsRaw] = useState<LoyaltyProgram[]>([]);
  const [companies, setCompaniesRaw] = useState<Company[]>([]);
  const [discountCards, setDiscountCardsRaw] = useState<DiscountCard[]>([]);
  const [moneyLenders, setMoneyLendersRaw] = useState<MoneyLender[]>([]);
  const [transferModes, setTransferModesRaw] = useState<string[]>(["Bank Transfer","SWIFT","Western Union","Al Ansari Exchange","Al Fardan Exchange","Wise","Remitly","Cash Deposit","Online Transfer"]);
  const [cryptoExchanges, setCryptoExchangesRaw] = useState<string[]>(["Binance","Kraken","Coinbase","OKX","Bybit","KuCoin","Gate.io","Bitget","Local Exchange","OTC","Other"]);
  const [metalPlatforms, setMetalPlatformsRaw] = useState<string[]>(["Dubai Gold Souk","DMCC","Kitco","BullionVault","Local Jeweler","Bank","ENBD","Other"]);
  const [realEstatePlatforms, setRealEstatePlatformsRaw] = useState<string[]>(["SmartCrowd","Stake","Prypco Blocks","Own","Other"]);

  // ── Supabase sync helpers ───────────────────────────────────────────
  // Each setter also persists to Supabase
  const setAccounts = useCallback((fn: (p: Account[]) => Account[]) => {
    setAccountsRaw(prev => {
      const next = fn(prev);
      next.forEach(item => sbUpsert("accounts", userId, item.id, item));
      return next;
    });
  }, [userId]);
  const setTransactions = useCallback((fn: (p: Transaction[]) => Transaction[]) => {
    setTransactionsRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("transactions", userId, item.id, item)); return next; });
  }, [userId]);
  const setBudgets = useCallback((fn: (p: Budget[]) => Budget[]) => {
    setBudgetsRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("budgets", userId, item.id, item)); return next; });
  }, [userId]);
  const setGoals = useCallback((fn: (p: Goal[]) => Goal[]) => {
    setGoalsRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("goals", userId, item.id, item)); return next; });
  }, [userId]);
  const setSavingsGoals = useCallback((fn: (p: SavingsGoal[]) => SavingsGoal[]) => {
    setSavingsGoalsRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("savings_goals", userId, item.id, item)); return next; });
  }, [userId]);
  const setFixedDeposits = useCallback((fn: (p: FixedDeposit[]) => FixedDeposit[]) => {
    setFixedDepositsRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("fixed_deposits", userId, item.id, item)); return next; });
  }, [userId]);
  const setCreditCards = useCallback((fn: (p: CreditCard[]) => CreditCard[]) => {
    setCreditCardsRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("credit_cards", userId, item.id, item)); return next; });
  }, [userId]);
  const setAppRules = useCallback((fn: (p: AppRule[]) => AppRule[]) => {
    setAppRulesRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("app_rules", userId, item.id, item)); return next; });
  }, [userId]);
  const setRecurringBills = useCallback((fn: (p: RecurringBill[]) => RecurringBill[]) => {
    setRecurringBillsRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("recurring_bills", userId, item.id, item)); return next; });
  }, [userId]);
  const setLoans = useCallback((fn: (p: Loan[]) => Loan[]) => {
    setLoansRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("loans", userId, item.id, item)); return next; });
  }, [userId]);
  const setTransfers = useCallback((fn: (p: Transfer[]) => Transfer[]) => {
    setTransfersRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("transfers", userId, item.id, item)); return next; });
  }, [userId]);
  const setCryptoHoldings = useCallback((fn: (p: CryptoHolding[]) => CryptoHolding[]) => {
    setCryptoHoldingsRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("crypto_holdings", userId, item.id, item)); return next; });
  }, [userId]);
  const setMetalHoldings = useCallback((fn: (p: MetalHolding[]) => MetalHolding[]) => {
    setMetalHoldingsRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("metal_holdings", userId, item.id, item)); return next; });
  }, [userId]);
  const setProperties = useCallback((fn: (p: Property[]) => Property[]) => {
    setPropertiesRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("properties", userId, item.id, item)); return next; });
  }, [userId]);
  const setBusinesses = useCallback((fn: (p: Business[]) => Business[]) => {
    setBusinessesRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("businesses", userId, item.id, item)); return next; });
  }, [userId]);
  const setCashEntries = useCallback((fn: (p: CashEntry[]) => CashEntry[]) => {
    setCashEntriesRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("cash_entries", userId, item.id, item)); return next; });
  }, [userId]);
  const setInvestmentHoldings = useCallback((fn: (p: InvestmentHolding[]) => InvestmentHolding[]) => {
    setInvestmentHoldingsRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("investment_holdings", userId, item.id, item)); return next; });
  }, [userId]);
  const setLoyaltyPrograms = useCallback((fn: (p: LoyaltyProgram[]) => LoyaltyProgram[]) => {
    setLoyaltyProgramsRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("loyalty_programs", userId, item.id, item)); return next; });
  }, [userId]);
  const setCompanies = useCallback((fn: (p: Company[]) => Company[]) => {
    setCompaniesRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("companies", userId, item.id, item)); return next; });
  }, [userId]);
  const setDiscountCards = useCallback((fn: (p: DiscountCard[]) => DiscountCard[]) => {
    setDiscountCardsRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("discount_cards", userId, item.id, item)); return next; });
  }, [userId]);
  const setMoneyLenders = useCallback((fn: (p: MoneyLender[]) => MoneyLender[]) => {
    setMoneyLendersRaw(prev => { const next = fn(prev); next.forEach(item => sbUpsert("money_lenders", userId, item.id, item)); return next; });
  }, [userId]);
  const setTransferModes = useCallback((fn: (p: string[]) => string[]) => {
    setTransferModesRaw(prev => { const next = fn(prev); sbUpsertSingleton("transfer_modes", userId, { modes: next }); return next; });
  }, [userId]);
  const setCryptoExchanges = useCallback((fn: (p: string[]) => string[]) => {
    setCryptoExchangesRaw(prev => { const next = fn(prev); sbUpsertSingleton("crypto_exchanges", userId, { exchanges: next }); return next; });
  }, [userId]);
  const setMetalPlatforms = useCallback((fn: (p: string[]) => string[]) => {
    setMetalPlatformsRaw(prev => { const next = fn(prev); sbUpsertSingleton("metal_platforms", userId, { platforms: next }); return next; });
  }, [userId]);
  const setRealEstatePlatforms = useCallback((fn: (p: string[]) => string[]) => {
    setRealEstatePlatformsRaw(prev => { const next = fn(prev); sbUpsertSingleton("metal_platforms", userId, { platforms: next }); return next; });
  }, [userId]);
  const setCashOpeningBalance = useCallback((val: number | ((p: number) => number)) => {
    setCashOpeningBalanceRaw(prev => {
      const next = typeof val === "function" ? val(prev) : val;
      sbUpsertSingleton("cash_opening_balance", userId, { cash_opening: next });
      return next;
    });
  }, [userId]);

  // saveToTrash with userId
  const saveToTrashSb = useCallback((item: TrashedItem) => {
    sbAddToTrash(userId, item);
  }, [userId]);

  // ── Session cache helpers ───────────────────────────────────────────
  const DB_CACHE_KEY = `swc_db_${userId}`;
  const saveCache = (data: any) => { try { sessionStorage.setItem(DB_CACHE_KEY, JSON.stringify(data)); } catch {} };
  const loadCache = (): any | null => { try { return JSON.parse(sessionStorage.getItem(DB_CACHE_KEY) || "null"); } catch { return null; } };

  // Seed state from cache on first mount — instant, no spinner
  useEffect(() => {
    const cache = loadCache();
    if (cache) {
      if (cache.accounts?.length) setAccountsRaw(cache.accounts);
      if (cache.transactions?.length) setTransactionsRaw(cache.transactions);
      if (cache.budgets?.length) setBudgetsRaw(cache.budgets);
      if (cache.goals?.length) setGoalsRaw(cache.goals.map((g: any) => ({ ...g, transactions: g.transactions || [], rules: g.rules || [] })));
      if (cache.savingsGoals?.length) setSavingsGoalsRaw(cache.savingsGoals.map((g: any) => ({ ...g, transactions: g.transactions || [] })));
      if (cache.fixedDeposits?.length) setFixedDepositsRaw(cache.fixedDeposits);
      if (cache.creditCards?.length) setCreditCardsRaw(cache.creditCards);
      if (cache.appRules?.length) setAppRulesRaw(cache.appRules);
      if (cache.recurringBills?.length) setRecurringBillsRaw(cache.recurringBills);
      if (cache.loans?.length) setLoansRaw(cache.loans);
      if (cache.transfers?.length) setTransfersRaw(cache.transfers);
      if (cache.cryptoHoldings?.length) setCryptoHoldingsRaw(cache.cryptoHoldings);
      if (cache.metalHoldings?.length) setMetalHoldingsRaw(cache.metalHoldings);
      if (cache.properties?.length) setPropertiesRaw(cache.properties);
      if (cache.businesses?.length) setBusinessesRaw(cache.businesses);
      if (cache.cashEntries?.length) setCashEntriesRaw(cache.cashEntries);
      if (cache.loyaltyPrograms?.length) setLoyaltyProgramsRaw(cache.loyaltyPrograms);
      if (cache.companies?.length) setCompaniesRaw(cache.companies);
      if (cache.discountCards?.length) setDiscountCardsRaw(cache.discountCards);
      if (cache.moneyLenders?.length) setMoneyLendersRaw(cache.moneyLenders);
      if (cache.investmentHoldings?.length) setInvestmentHoldingsRaw(cache.investmentHoldings.map((h: any) => ({ ...h, transactions: h.transactions || [] })));
      if (cache.transferModes?.length) setTransferModesRaw(cache.transferModes);
      if (cache.cryptoExchanges?.length) setCryptoExchangesRaw(cache.cryptoExchanges);
      if (cache.metalPlatforms?.length) setMetalPlatformsRaw(cache.metalPlatforms);
      if (cache.cashOpeningBalance != null) setCashOpeningBalanceRaw(cache.cashOpeningBalance);
      setLoading(false); // show cached data immediately
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Initial data load from Supabase (background refresh) ────────────
  useEffect(() => {
    if (!userId) return;
    // Only show spinner if no cache exists
    const cache = loadCache();
    if (!cache) setLoading(true);
    Promise.all([
      sbGetAll<Account>("accounts", userId),
      sbGetAll<Transaction>("transactions", userId),
      sbGetAll<Budget>("budgets", userId),
      sbGetAll<Goal>("goals", userId),
      sbGetAll<SavingsGoal>("savings_goals", userId),
      sbGetAll<FixedDeposit>("fixed_deposits", userId),
      sbGetAll<CreditCard>("credit_cards", userId),
      sbGetAll<AppRule>("app_rules", userId),
      sbGetAll<RecurringBill>("recurring_bills", userId),
      sbGetAll<Loan>("loans", userId),
      sbGetAll<Transfer>("transfers", userId),
      sbGetAll<CryptoHolding>("crypto_holdings", userId),
      sbGetAll<MetalHolding>("metal_holdings", userId),
      sbGetAll<Property>("properties", userId),
      sbGetAll<Business>("businesses", userId),
      sbGetAll<CashEntry>("cash_entries", userId),
      sbGetAll<LoyaltyProgram>("loyalty_programs", userId),
      sbGetAll<Company>("companies", userId),
      sbGetAll<DiscountCard>("discount_cards", userId),
      sbGetAll<MoneyLender>("money_lenders", userId),
      sbGetAll<InvestmentHolding>("investment_holdings", userId),
      sbGetSingleton<{modes:string[]}>("transfer_modes", userId, {modes:["Bank Transfer","SWIFT","Western Union","Al Ansari Exchange","Al Fardan Exchange","Wise","Remitly","Cash Deposit","Online Transfer"]}),
      sbGetSingleton<{exchanges:string[]}>("crypto_exchanges", userId, {exchanges:["Binance","Kraken","Coinbase","OKX","Bybit","KuCoin","Gate.io","Bitget","Local Exchange","OTC","Other"]}),
      sbGetSingleton<{platforms:string[]}>("metal_platforms", userId, {platforms:["Dubai Gold Souk","DMCC","Kitco","BullionVault","Local Jeweler","Bank","ENBD","Other"]}),
      sbGetSingleton<{cash_opening:number}>("cash_opening_balance", userId, {cash_opening:0}),
    ]).then(([
      accts, txns, bdgs, gls, svgs, fds, ccs, rules, bills, lns, trs,
      crypto, metals, props, bizs, cash, loyalty, comps, discounts, lenders,
      invHoldings,
      tmodes, cexchanges, mplatforms, cashOpening
    ]) => {
      setAccountsRaw(accts.length ? accts : []);
      setTransactionsRaw(txns);
      setBudgetsRaw(bdgs);
      setGoalsRaw(gls.map(g => ({ ...g, transactions: Array.isArray(g.transactions) ? g.transactions : [], rules: g.rules || [] })));
      setSavingsGoalsRaw(svgs.map(g => ({ ...g, transactions: Array.isArray(g.transactions) ? g.transactions : [] })));
      setFixedDepositsRaw(fds);
      setCreditCardsRaw(ccs);
      setAppRulesRaw(rules);
      setRecurringBillsRaw(bills);
      setLoansRaw(lns);
      setTransfersRaw(trs);
      setCryptoHoldingsRaw(crypto);
      setMetalHoldingsRaw(metals);
      setPropertiesRaw(props);
      setBusinessesRaw(bizs);
      setCashEntriesRaw(cash);
      setLoyaltyProgramsRaw(loyalty);
      setCompaniesRaw(comps.length ? comps : defaultCompanies);
      setDiscountCardsRaw(discounts.length ? discounts : defaultDiscountCards);
      setMoneyLendersRaw(lenders);
      setInvestmentHoldingsRaw(invHoldings.map((h: any) => ({ ...h, transactions: Array.isArray(h.transactions) ? h.transactions : [] })));
      setTransferModesRaw(tmodes.modes || ["Bank Transfer","SWIFT","Western Union","Al Ansari Exchange","Wise","Remitly","Cash Deposit","Online Transfer"]);
      setCryptoExchangesRaw(cexchanges.exchanges || ["Binance","Kraken","Coinbase","OKX","Bybit","KuCoin"]);
      setMetalPlatformsRaw(mplatforms.platforms || ["Dubai Gold Souk","DMCC","Kitco","BullionVault"]);
      const co = (cashOpening as any).cash_opening || 0;
      setCashOpeningBalanceRaw(co);

      // Ensure cash entries are loaded
      if (cache?.cashEntries?.length) setCashEntriesRaw(cache.cashEntries);

      // Save fresh data to session cache for instant reload next time
      saveCache({
        accounts: accts, transactions: txns, budgets: bdgs, goals: gls,
        savingsGoals: svgs, fixedDeposits: fds, creditCards: ccs, appRules: rules,
        recurringBills: bills, loans: lns, transfers: trs, cryptoHoldings: crypto,
        metalHoldings: metals, properties: props, businesses: bizs, cashEntries: cash,
        loyaltyPrograms: loyalty, companies: comps.length ? comps : defaultCompanies,
        discountCards: discounts.length ? discounts : defaultDiscountCards,
        moneyLenders: lenders,
        investmentHoldings: invHoldings,
        transferModes: tmodes.modes || [],
        cryptoExchanges: cexchanges.exchanges || [],
        metalPlatforms: mplatforms.platforms || [],
        cashOpeningBalance: co,
      });
      setLoading(false);
    }).catch(e => { console.error("DB load error:", e); setLoading(false); });
  }, [userId]);

  // Computed account balance: openingBalance + sum of all transactions
  const getAccountBalance = (id: string): number => {
    const acct = accounts.find(a => a.id === id);
    if (!acct) return 0;
    const txTotal = transactions
      .filter(t => t.accountId === id && t.type !== "transfer")
      .reduce((s, t) => s + t.amount, 0);
    const transferOut = transfers
      .filter(t => t.fromAccountId === id)
      .reduce((s, t) => s + t.amountSent + (t.fee || 0), 0);
    const transferIn = transfers
      .filter(t => t.toAccountId === id)
      .reduce((s, t) => s + t.amountReceived, 0);
    // Calculate total credit card repayments made from this account
   
    // Calculate total cash entries (deposits/withdrawals) for this account
    const cashEntriesTotal = cashEntries.filter(ce => ce.linkedAccountId === id).reduce((sum, ce) => sum + ce.amount, 0);

    return (acct.openingBalance || 0) + txTotal - transferOut + transferIn + cashEntriesTotal;
  };

  const getAccountAvailableBalance = (id: string): number => {
    const currentBalance = getAccountBalance(id);
    // Deduct any pending outgoing transfers that haven't been processed yet
    // Assuming transfers are immediately deducted from available balance upon creation
    const pendingOutgoingTransfers = transfers
      .filter(t => t.fromAccountId === id)
      .reduce((s, t) => s + t.amountSent + (t.fee || 0), 0);

    return currentBalance - pendingOutgoingTransfers;
  };

  const db: DB = {
    dbLoading: loading,
    accounts,
    addAccount: a => setAccounts(p => [...p, { ...a, id: uid() }]),
    updateAccount: (id, u) => setAccounts(p => p.map(a => a.id===id ? { ...a, ...u } : a)),
    deleteAccount: id => {
      const a = accounts.find(a => a.id === id);

      if (a) saveToTrashSb({ id: uid(), type: "account", label: a.name, detail: `${a.bank} · ${a.currency}`, deletedAt: new Date().toISOString(), data: a });
      sbDelete("accounts", id);
      setAccountsRaw(p => p.filter(a => a.id!==id));
    },
    getAccountBalance,

    transactions,
    addTransaction: t => {
      setTransactions(p => [{ ...t, id: uid() }, ...p]);
      // Auto-add loyalty points if company has linked program
    },
    batchAddTransactions: (txs) => {
      const newTxs = txs.map(t => ({ ...t, id: uid() }));
      setTransactions(p => [...newTxs, ...p]);
    },
    updateTransaction: (id, u) => setTransactions(p => p.map(t => t.id===id ? { ...t, ...u } : t)),
    deleteTransaction: id => {
      const tx = transactions.find(t => t.id===id);
      if (tx) saveToTrashSb({ id: uid(), type: "transaction", label: tx.name, detail: `${tx.date} · ${tx.category} · ${tx.amount}`, deletedAt: new Date().toISOString(), data: tx });
      sbDelete("transactions", id);
      setTransactionsRaw(p => p.filter(t => t.id!==id));
    },

    budgets,
    addBudget: b => setBudgets(p => [...p, { ...b, id: uid() }]),
    updateBudget: (id, u) => setBudgets(p => p.map(b => b.id===id ? { ...b, ...u } : b)),
    updateBudgetSpent: (id, spent) => setBudgets(p => p.map(b => b.id===id ? { ...b, spent } : b)),
    deleteBudget: id => { sbDelete("budgets", id); setBudgetsRaw(p => p.filter(b => b.id!==id)); },

    goals,
    addGoal: g => setGoals(p => [...p, { ...g, id: uid(), transactions: [], rules: g.rules || [] }]),
    updateGoal: (id, u) => setGoals(p => p.map(g => g.id===id ? { ...g, ...u } : g)),
    addGoalTransaction: (goalId, tx) => {
      const goal = goals.find(g => g.id === goalId);
      setGoals(p => p.map(g => g.id===goalId ? {
        ...g,
        currentAmount: g.currentAmount + tx.amount,
        transactions: [...(g.transactions||[]), { ...tx, id: uid(), type: tx.type || "deposit" }]
      } : g));
      // Deduct from linked account if specified
      if (tx.fromAccountId) {
        setTransactions(prev => [{ id: uid(), name: `Goal: ${goal?.name}`, amount: -tx.amount, type: "expense" as const, category: "Goals", accountId: tx.fromAccountId!, date: tx.date, notes: tx.note }, ...prev]);
      }
    },
    withdrawFromGoal: (goalId, tx) => {
      setGoals(p => p.map(g => g.id===goalId ? {
        ...g,
        currentAmount: Math.max(0, g.currentAmount - Math.abs(tx.amount)),
        transactions: [...(g.transactions||[]), { ...tx, id: uid(), amount: -Math.abs(tx.amount), type: "withdraw" as const }]
      } : g));
      // Credit to account if specified
      if (tx.toAccountId) {
        setTransactions(prev => [{ id: uid(), name: `Goal Withdrawal`, amount: Math.abs(tx.amount), type: "income" as const, category: "Goals", accountId: tx.toAccountId!, date: tx.date, notes: tx.note }, ...prev]);
      }
    },
    addGoalInterest: (goalId, date) => {
      const goal = goals.find(g => g.id === goalId);
      if (!goal?.interest?.enabled) return;
      let interestAmt = 0;
      if (goal.interest.type === "percentage") {
        interestAmt = goal.currentAmount * (goal.interest.rate / 100) / (goal.interest.frequency === "yearly" ? 12 : 1);
      } else {
        interestAmt = goal.interest.rate;
      }
      setGoals(p => p.map(g => g.id===goalId ? {
        ...g, currentAmount: g.currentAmount + interestAmt,
        transactions: [...(g.transactions||[]), { id: uid(), date, amount: interestAmt, note: `Interest/Profit (${goal.interest!.rate}${goal.interest!.type==="percentage"?"%":" AED"})`, type: "interest" as const, sourceType: "rule" as const }]
      } : g));
    },
    deleteGoal: id => {
      const g = goals.find(g => g.id === id);
      if (g) saveToTrashSb({ id: uid(), type: "goal", label: g.name, detail: `Target: ${g.targetAmount}`, deletedAt: new Date().toISOString(), data: g });
      sbDelete("goals", id);
      setGoalsRaw(p => p.filter(g => g.id!==id));
    },

    savingsGoals,
    addSavingsGoal: g => setSavingsGoals(p => [...p, { ...g, id: uid(), transactions: [] }]),
    updateSavingsGoal: (id, u) => setSavingsGoals(p => p.map(g => g.id===id ? { ...g, ...u } : g)),
    addSavingsTx: (id, tx) => setSavingsGoals(p => p.map(g => g.id===id ? { ...g, current: g.current + tx.amount, transactions: [...(g.transactions||[]), { ...tx, id: uid() }] } : g)),
    deleteSavingsGoal: id => {
      const g = savingsGoals.find(g => g.id === id);
      if (g) saveToTrashSb({ id: uid(), type: "savings", label: g.name, detail: `Current: ${g.current}`, deletedAt: new Date().toISOString(), data: g });
      sbDelete("savings_goals", id);
      setSavingsGoalsRaw(p => p.filter(g => g.id!==id));
    },

    fixedDeposits,
    addFixedDeposit: fd => setFixedDeposits(p => [...p, { ...fd, id: uid() }]),
    updateFixedDeposit: (id, u) => setFixedDeposits(p => p.map(fd => fd.id===id ? { ...fd, ...u } : fd)),
    moveMaturedFD: (id, accountId, date) => {
      const fd = fixedDeposits.find(f => f.id===id);
      if (!fd) return;
      const maturedAmount = fd.amount + (fd.amount * fd.rate / 100 * (parseInt(fd.tenure)||12) / 12);
      setTransactions(prev => [{ id: uid(), name: `FD Matured: ${fd.bank} ${fd.tenure}`, amount: Math.round(maturedAmount), type: "income" as const, category: "Income", accountId, date, notes: `Fixed deposit matured. Principal: ${fd.currency} ${fd.amount}, Rate: ${fd.rate}%, Returns: ${fd.currency} ${Math.round(maturedAmount-fd.amount)}` }, ...prev]);
      setFixedDeposits(p => p.filter(f => f.id!==id));
    },
    deleteFixedDeposit: id => { sbDelete("fixed_deposits", id); setFixedDepositsRaw(p => p.filter(fd => fd.id!==id)); },

    creditCards,
    addCreditCard: c => setCreditCards(p => [...p, { ...c, id: uid(), transactions: [], repayments: [], cashbackBalance: 0 }]),
    updateCreditCard: (id, u) => setCreditCards(p => p.map(c => c.id===id ? { ...c, ...u } : c)),
    addCardTransaction: (cardId, tx) => {
  const loanId = tx.isInstallment ? uid() : undefined;
  const linkedTxId = uid(); // ← NEW: shared ID between both records

  setCreditCards(p => p.map(c => {
    if (c.id !== cardId) return c;
    const newBalance = c.balance + tx.amount;
    let newTx = { ...tx, id: uid(), installmentLoanId: loanId, linkedTransactionId: linkedTxId }; // ← add linkedTransactionId
    // ... rest of your existing loyalty/installment logic unchanged ...
    return { ...c, balance: newBalance, transactions: [newTx, ...c.transactions] };
  }));


  
      // If installment, auto-create a Loan/EMI entry
      if (tx.isInstallment && tx.installmentMonths && loanId) {
        const card = creditCards.find(c => c.id === cardId);
        const totalWithFees = Math.abs(tx.amount) + (tx.installmentFee || 0);
        const emiAmt = totalWithFees / (tx.installmentMonths || 1);
        setLoans(p => [...p, {
          id: loanId,
          name: tx.description,
          type: "credit_card_emi" as const,
          lender: card?.name || "Credit Card",
          totalAmount: totalWithFees,
          paidAmount: 0,
          remainingBalance: totalWithFees,
          emiAmount: Math.round(emiAmt * 100) / 100,
          interestRate: tx.installmentInterestRate || 0,
          tenure: tx.installmentMonths,
          monthsPaid: 0,
          nextDueDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0,10),
          color: card?.color?.includes("from-") ? "hsl(280,70%,60%)" : card?.color || "hsl(280,70%,60%)",
          notes: `CC Installment from ${card?.name} ···${card?.last4}. Fee: AED ${tx.installmentFee||0}`,
          autoPayCardId: cardId,
          transactions: []
        }]);
      }
      // Earn loyalty points if earnLoyaltyProgramId set
      if (tx.earnLoyaltyProgramId && tx.loyaltyPoints && tx.loyaltyPoints > 0) {
        setLoyaltyPrograms(prev => prev.map(lp => lp.id === tx.earnLoyaltyProgramId ? {
          ...lp,
          pointsBalance: lp.pointsBalance + tx.loyaltyPoints!,
          transactions: [...lp.transactions, { id: uid(), date: tx.date, points: tx.loyaltyPoints!, type: "earned" as const, description: `Earned on: ${tx.description}` }]
        } : lp));
      }
    },
    updateCardTransaction: (cardId, txId, u) => setCreditCards(p => p.map(c => {
      if (c.id!==cardId) return c;
      const updated = c.transactions.map(t => t.id===txId ? { ...t, ...u } : t);
      const newBalance = updated.reduce((s,t) => s + t.amount, 0);
      return { ...c, transactions: updated, balance: newBalance };
    })),
    deleteCardTransaction: (cardId, txId) => setCreditCards(p => p.map(c => {
      if (c.id!==cardId) return c;
      const remaining = c.transactions.filter(t => t.id!==txId);
      const newBalance = remaining.reduce((s,t) => s + t.amount, 0);
      return { ...c, transactions: remaining, balance: newBalance };
    })),
    updateCardBalance: (cardId, balance) => setCreditCards(p => p.map(c => c.id===cardId ? { ...c, balance } : c)),
    addCardRepayment: (repayment) => {
      const newId = uid();
      const card = creditCards.find(c => c.id === repayment.cardId);
      setCreditCards(p => p.map(c => {
        if (c.id!==repayment.cardId) return c;
        const newBalance = c.balance + repayment.amount; // repayment reduces debt
        const newRepayments = [...(c.repayments||[]), { ...repayment, id: newId }];
        if (repayment.method === "cashback") {
          return { ...c, balance: newBalance, repayments: newRepayments, cashbackBalance: Math.max(0, (c.cashbackBalance||0) - repayment.amount) };
        }
        return { ...c, balance: newBalance, repayments: newRepayments };
      }));
      if (repayment.sourceAccountId) {
        setTransactions(prev => [{ id: uid(), name: `CC Repayment - ${card?.name||"Card"}`, amount: -repayment.amount, type: "expense" as const, category: "Credit Card Payment", accountId: repayment.sourceAccountId!, date: repayment.date, notes: repayment.notes }, ...prev]);
      }
    },
    deleteCardRepayment: (cardId, repaymentId) => setCreditCards(p => p.map(c => {
      if (c.id!==cardId) return c;
      const rep = (c.repayments||[]).find(r => r.id===repaymentId);
      const remaining = (c.repayments||[]).filter(r => r.id!==repaymentId);
      const newBalance = rep ? c.balance - rep.amount : c.balance;
      return { ...c, repayments: remaining, balance: newBalance };
    })),
    deleteCreditCard: id => {
      const c = creditCards.find(c => c.id === id);
      if (c) saveToTrashSb({ id: uid(), type: "creditcard", label: c.name, detail: `${c.issuer} ···${c.last4}`, deletedAt: new Date().toISOString(), data: c });
      sbDelete("credit_cards", id);
      setCreditCardsRaw(p => p.filter(c => c.id!==id));
    },

    companies,
    addCompany: c => setCompanies(p => [...p, { ...c, id: uid() }]),
    updateCompany: (id, u) => setCompanies(p => p.map(c => c.id===id ? { ...c, ...u } : c)),
    deleteCompany: id => { sbDelete("companies", id); setCompaniesRaw(p => p.filter(c => c.id!==id)); },

    discountCards,
    addDiscountCard: d => setDiscountCards(p => [...p, { ...d, id: uid(), rules: d.rules || [] }]),
    updateDiscountCard: (id, u) => setDiscountCards(p => p.map(d => d.id===id ? { ...d, ...u } : d)),
    deleteDiscountCard: id => { sbDelete("discount_cards", id); setDiscountCardsRaw(p => p.filter(d => d.id!==id)); },

    loyaltyPrograms,
    addLoyaltyProgram: p => setLoyaltyPrograms(prev => [...prev, { ...p, id: uid(), transactions: [] }]),
    updateLoyaltyProgram: (id, u) => setLoyaltyPrograms(p => p.map(lp => lp.id===id ? { ...lp, ...u } : lp)),
    addLoyaltyTx: (programId, tx) => setLoyaltyPrograms(p => p.map(lp => {
      if (lp.id!==programId) return lp;
      const delta = tx.type==="earned" || tx.type==="transferred" ? tx.points : -tx.points;
      return { ...lp, pointsBalance: lp.pointsBalance + delta, transactions: [...lp.transactions, { ...tx, id: uid() }] };
    })),
    deleteLoyaltyProgram: id => {
      const lp = loyaltyPrograms.find(lp => lp.id === id);
      if (lp) saveToTrashSb({ id: uid(), type: "loyalty", label: lp.name, detail: `${lp.pointsBalance} pts`, deletedAt: new Date().toISOString(), data: lp });
      sbDelete("loyalty_programs", id);
      setLoyaltyProgramsRaw(p => p.filter(lp => lp.id!==id));
    },

    appRules,
    addAppRule: r => setAppRules(p => [...p, { ...r, id: uid(), createdAt: new Date().toISOString() }]),
    updateAppRule: (id, u) => setAppRules(p => p.map(ar => ar.id===id ? { ...ar, ...u } : ar)),
    deleteAppRule: id => { sbDelete("app_rules", id); setAppRulesRaw(p => p.filter(ar => ar.id!==id)); },

    recurringBills,
    addRecurringBill: b => setRecurringBills(p => [...p, { ...b, id: uid() }]),
    updateBillStatus: (id, status) => setRecurringBills(p => p.map(b => b.id===id ? { ...b, status } : b)),
    payRecurringBill: (id, method, accountId, cardId) => {
      const bill = recurringBills.find(b => b.id === id);
      if (!bill) return;
      // Compute next due date
      const nextDue = (() => {
        const d = new Date(bill.dueDate);
        if (bill.frequency === "daily") d.setDate(d.getDate() + 1);
        else if (bill.frequency === "weekly") d.setDate(d.getDate() + 7);
        else if (bill.frequency === "monthly") d.setMonth(d.getMonth() + 1);
        else if (bill.frequency === "quarterly") d.setMonth(d.getMonth() + 3);
        else if (bill.frequency === "yearly") d.setFullYear(d.getFullYear() + 1);
        return d.toISOString().slice(0,10);
      })();
      const paymentRecord: RecurringPaymentRecord = { id: uid(), date: new Date().toISOString().slice(0,10), amount: bill.amount, method, accountId, cardId };
      setRecurringBills(p => p.map(b => b.id===id ? { ...b, status: "paid", dueDate: nextDue, paymentHistory: [...(b.paymentHistory||[]), paymentRecord] } : b));
      // Deduct from account
      if (accountId) {
        setTransactions(prev => [{ id: uid(), name: bill.name, amount: -bill.amount, type: "expense" as const, category: bill.category, accountId, date: new Date().toISOString().slice(0,10), notes: "Recurring bill payment" }, ...prev]);
      }
      // Charge to credit card
      if (cardId) {
        setCreditCards(p => p.map(c => c.id===cardId ? { ...c, balance: c.balance - bill.amount, transactions: [{ id: uid(), date: new Date().toISOString().slice(0,10), description: bill.name, amount: -bill.amount, category: bill.category }, ...c.transactions] } : c));
      }
    },
    deleteRecurringPayment: (billId, paymentId) => {
      const bill = recurringBills.find(b => b.id === billId);
      if (!bill) return;
      const payment = (bill.paymentHistory||[]).find(p => p.id === paymentId);
      setRecurringBills(p => p.map(b => b.id===billId ? { ...b, paymentHistory: (b.paymentHistory||[]).filter(p => p.id !== paymentId) } : b));
      // Reverse account deduction
      if (payment?.accountId) {
        setTransactions(prev => [{ id: uid(), name: `Reversal: ${bill.name}`, amount: bill.amount, type: "income" as const, category: bill.category, accountId: payment.accountId!, date: payment.date, notes: "Recurring payment reversed" }, ...prev]);
      }
      // Reverse CC charge
      if (payment?.cardId) {
        setCreditCards(p => p.map(c => c.id===payment.cardId ? { ...c, balance: c.balance + bill.amount } : c));
      }
    },
    updateRecurringBill: (id, u) => setRecurringBills(p => p.map(b => b.id===id ? { ...b, ...u } : b)),
    deleteRecurringBill: id => {
      const b = recurringBills.find(b => b.id === id);
      if (b) saveToTrashSb({ id: uid(), type: "recurring", label: b.name, detail: `${b.amount} ${b.currency} ${b.frequency}`, deletedAt: new Date().toISOString(), data: b });
      sbDelete("recurring_bills", id);
      setRecurringBillsRaw(p => p.filter(b => b.id!==id));
    },

    loans,
    addLoan: l => setLoans(p => [...p, { ...l, id: uid(), transactions: [] }]),
    addLoanPayment: (loanId, tx) => {
      setLoans(p => p.map(l => {
        if (l.id!==loanId) return l;
        const newPaid = l.paidAmount + tx.amount;
        return { ...l, paidAmount: newPaid, remainingBalance: l.totalAmount - newPaid, monthsPaid: l.monthsPaid + 1, transactions: [...l.transactions, { ...tx, id: uid() }] };
      }));
      if (tx.accountId) {
        setTransactions(prev => {
          const loan = loans.find(l => l.id === loanId);
          return [{ id: uid(), name: `EMI: ${loan?.name||"Loan"}`, amount: -tx.amount, type: "expense" as const, category: "Loan Payment", accountId: tx.accountId!, date: tx.date, notes: tx.note }, ...prev];
        });
      }
      if (tx.creditCardId) {
        setCreditCards(p => p.map(c => {
          if (c.id!==tx.creditCardId) return c;
          const loan = loans.find(l => l.id === loanId);
          return { ...c, balance: c.balance - tx.amount, transactions: [{ id: uid(), date: tx.date, description: `EMI: ${loan?.name||"Loan"}`, amount: -tx.amount, category: "Loan Payment" }, ...c.transactions] };
        }));
      }
    },
    updateLoanPayment: (loanId, txId, u) => {
      const loan = loans.find(l => l.id === loanId);
      if (!loan) return;
      const oldTx = loan.transactions.find(t => t.id === txId);
      const newTxs = loan.transactions.map(t => t.id===txId ? { ...t, ...u } : t);
      const newPaid = newTxs.filter(t=>t.type==="payment").reduce((s,t)=>s+t.amount,0);
      setLoans(p => p.map(l => l.id===loanId ? { ...l, transactions: newTxs, paidAmount: newPaid, remainingBalance: l.totalAmount - newPaid } : l));
      // If account changed, reverse old and add new
      if (oldTx?.accountId && u.amount !== undefined) {
        // Find and update the matching expense transaction – simplest: add reversal + new
        const oldAmt = oldTx.amount;
        const newAmt = u.amount ?? oldAmt;
        const diff = newAmt - oldAmt;
        if (diff !== 0) {
          setTransactions(prev => [{ id: uid(), name: `EMI Adjustment: ${loan.name}`, amount: -diff, type: "expense" as const, category: "Loan Payment", accountId: oldTx.accountId!, date: u.date || oldTx.date, notes: "Payment updated" }, ...prev]);
        }
      }
    },
    deleteLoanPayment: (loanId, txId) => {
      const loan = loans.find(l => l.id === loanId);
      if (!loan) return;
      const tx = loan.transactions.find(t => t.id === txId);
      const newTxs = loan.transactions.filter(t => t.id !== txId);
      const newPaid = newTxs.filter(t=>t.type==="payment").reduce((s,t)=>s+t.amount,0);
      setLoans(p => p.map(l => l.id===loanId ? { ...l, transactions: newTxs, paidAmount: newPaid, remainingBalance: l.totalAmount - newPaid, monthsPaid: Math.max(0, l.monthsPaid - 1) } : l));
      // Reverse the account deduction
      if (tx?.accountId) {
        setTransactions(prev => [{ id: uid(), name: `EMI Reversal: ${loan.name}`, amount: tx.amount, type: "income" as const, category: "Loan Payment", accountId: tx.accountId!, date: tx.date, notes: "Payment deleted" }, ...prev]);
      }
      // Reverse the CC charge
      if (tx?.creditCardId) {
        setCreditCards(p => p.map(c => c.id===tx.creditCardId ? { ...c, balance: c.balance + tx.amount } : c));
      }
    },
    updateLoan: (id, u) => setLoans(p => p.map(l => l.id===id ? { ...l, ...u } : l)),
    deleteLoan: id => {
      const l = loans.find(l => l.id === id);
      if (l) saveToTrashSb({ id: uid(), type: "loan", label: l.name, detail: `${l.lender} · Remaining: ${l.remainingBalance}`, deletedAt: new Date().toISOString(), data: l });
      sbDelete("loans", id);
      setLoansRaw(p => p.filter(l => l.id!==id));
    },

    transfers,
    addTransfer: t => {
      setTransfers(p => [{ ...t, id: uid() }, ...p]);
      // If target is a credit card, reduce its balance (repay)
      if (t.toCreditCardId) {
        setCreditCards(p => p.map(c => c.id===t.toCreditCardId ? {
          ...c, balance: c.balance + t.amountReceived,
          repayments: [...(c.repayments||[]), { id: uid(), cardId: t.toCreditCardId!, date: t.date, amount: t.amountReceived, method: "bank_account" as const, sourceAccountId: t.fromAccountId, notes: `Transfer: ${t.notes||""}` }]
        } : c));
        if (t.fromAccountId) {
          setTransactions(prev => [{ id: uid(), name: `CC Payment - Transfer`, amount: -t.amountSent, type: "expense" as const, category: "Credit Card Payment", accountId: t.fromAccountId, date: t.date, notes: t.notes }, ...prev]);
        }
      }
    },
    updateTransfer: (id, u) => setTransfers(p => p.map(t => t.id===id ? { ...t, ...u } : t)),
    deleteTransfer: id => { sbDelete("transfers", id); setTransfersRaw(p => p.filter(t => t.id!==id)); },
    transferModes, addTransferMode: m => setTransferModes(p => [...new Set([...p, m])]),
    updateTransferMode: (old, nw) => setTransferModes(p => p.map(m => m===old ? nw : m)),
    deleteTransferMode: m => setTransferModes(p => p.filter(x => x!==m)),

    moneyLenders,
    addMoneyLender: m => setMoneyLenders(p => [...p, { ...m, id: uid(), records: [] }]),
    updateMoneyLender: (id, u) => setMoneyLenders(p => p.map(m => m.id===id ? { ...m, ...u } : m)),
    addLendRecord: (lenderId, r) => setMoneyLenders(p => p.map(m => {
      if (m.id!==lenderId) return m;
      const newRecord: LendRecord = { ...r, id: uid(), payments: [] };
      // Deduct from or credit account
      if (r.linkedAccountId) {
        const amt = r.type === "lent" ? r.amount : -r.amount;
        setTransactions(prev => [{ id: uid(), name: `${r.type==="lent"?"Lent to":"Borrowed from"} ${m.name}`, amount: r.type==="lent" ? -r.amount : r.amount, type: r.type==="lent" ? "expense" as const : "income" as const, category: "Money Transfer", accountId: r.linkedAccountId!, date: r.issueDate, notes: r.description }, ...prev]);
      }
      return { ...m, records: [...m.records, newRecord] };
    })),
    updateLendRecord: (lenderId, recordId, u) => setMoneyLenders(p => p.map(m => m.id===lenderId ? { ...m, records: m.records.map(r => r.id===recordId ? { ...r, ...u } : r) } : m)),
    addLendPayment: (lenderId, recordId, payment) => {
      const lender = moneyLenders.find(m => m.id === lenderId);
      const record = lender?.records.find(r => r.id === recordId);
      setMoneyLenders(p => p.map(m => {
        if (m.id!==lenderId) return m;
        return { ...m, records: m.records.map(r => {
          if (r.id!==recordId) return r;
          const newPayments = [...r.payments, { ...payment, id: uid() }];
          const totalPaid = newPayments.reduce((s,p) => s+p.amount, 0);
          const newStatus: LendRecord["status"] = totalPaid >= r.amount ? "settled" : totalPaid > 0 ? "partially_paid" : "active";
          return { ...r, payments: newPayments, status: newStatus };
        })};
      }));
      // Credit/debit account if linked
      if (payment.linkedAccountId && record) {
        const isIncoming = record.type === "lent"; // receiving repayment
        setTransactions(prev => [{ id: uid(), name: `Repayment ${isIncoming?"from":"to"} ${lender?.name}`, amount: isIncoming ? payment.amount : -payment.amount, type: isIncoming ? "income" as const : "expense" as const, category: "Money Transfer", accountId: payment.linkedAccountId!, date: payment.date }, ...prev]);
      }
    },
    waiveLendRecord: (lenderId, recordId) => setMoneyLenders(p => p.map(m => m.id===lenderId ? { ...m, records: m.records.map(r => r.id===recordId ? { ...r, status: "waived" } : r) } : m)),
    deleteLendRecord: (lenderId, recordId) => {
      const lender = moneyLenders.find(m => m.id === lenderId);
      const record = lender?.records.find(r => r.id === recordId);
      if (record) {
        // Reverse the account transaction if one was created
        if (record.linkedAccountId) {
          const amt = record.type === "lent" ? record.amount : -record.amount;
          setTransactions(prev => [{ id: uid(), name: `Lend Record Deletion: ${record.description}`, amount: amt, type: record.type==="lent" ? "income" as const : "expense" as const, category: "Money Transfer", accountId: record.linkedAccountId!, date: new Date().toISOString().slice(0,10), notes: "Lend record deleted" }, ...prev]);
        }
        // Also delete associated payments
        setMoneyLenders(p => p.map(m => m.id===lenderId ? { ...m, records: m.records.filter(r => r.id !== recordId) } : m));
      }
    },
    updateLendPayment: (lenderId, recordId, paymentId, u) => {
      const lender = moneyLenders.find(m => m.id === lenderId);
      const record = lender?.records.find(r => r.id === recordId);
      setMoneyLenders(p => p.map(m => {
        if (m.id!==lenderId) return m;
        return { ...m, records: m.records.map(r => {
          if (r.id!==recordId) return r;
          const updatedPayments = r.payments.map(p => p.id===paymentId ? { ...p, ...u } : p);
          const totalPaid = updatedPayments.reduce((s,p) => s+p.amount, 0);
          const newStatus: LendRecord["status"] = totalPaid >= r.amount ? "settled" : totalPaid > 0 ? "partially_paid" : "active";
          return { ...r, payments: updatedPayments, status: newStatus };
        })};
      }));
      // If amount changed, adjust account transaction
      if (record && u.amount !== undefined) {
        const oldPayment = record.payments.find(p => p.id === paymentId);
        if (oldPayment && record.linkedAccountId) {
          const diff = u.amount - oldPayment.amount;
          if (diff !== 0) {
            const isIncoming = record.type === "lent";
            setTransactions(prev => [{ id: uid(), name: `Payment Adjustment: ${lender?.name}`, amount: isIncoming ? diff : -diff, type: isIncoming ? "income" as const : "expense" as const, category: "Money Transfer", accountId: record.linkedAccountId!, date: u.date || oldPayment.date, notes: "Payment updated" }, ...prev]);
          }
        }
      }
    },
    deleteLendPayment: (lenderId, recordId, paymentId) => {
      const lender = moneyLenders.find(m => m.id === lenderId);
      const record = lender?.records.find(r => r.id === recordId);
      const payment = record?.payments.find(p => p.id === paymentId);
      if (payment && record) {
        // Reverse the account transaction
        if (record.linkedAccountId) {
          const isIncoming = record.type === "lent";
          setTransactions(prev => [{ id: uid(), name: `Payment Deletion: ${lender?.name}`, amount: isIncoming ? -payment.amount : payment.amount, type: isIncoming ? "expense" as const : "income" as const, category: "Money Transfer", accountId: record.linkedAccountId!, date: payment.date, notes: "Payment deleted" }, ...prev]);
        }
        // Remove payment and recalc status
        setMoneyLenders(p => p.map(m => {
          if (m.id!==lenderId) return m;
          return { ...m, records: m.records.map(r => {
            if (r.id!==recordId) return r;
            const remainingPayments = r.payments.filter(p => p.id !== paymentId);
            const totalPaid = remainingPayments.reduce((s,p) => s+p.amount, 0);
            const newStatus: LendRecord["status"] = totalPaid >= r.amount ? "settled" : totalPaid > 0 ? "partially_paid" : "active";
            return { ...r, payments: remainingPayments, status: newStatus };
          })};
        }));
      }
    },
    deleteMoneyLender: id => {
      const m = moneyLenders.find(m => m.id === id);
      if (m) saveToTrashSb({ id: uid(), type: "moneylender", label: m.name, detail: `${m.records?.length||0} records`, deletedAt: new Date().toISOString(), data: m });
      sbDelete("money_lenders", id);
      setMoneyLendersRaw(p => p.filter(m => m.id!==id));
    },

    cryptoHoldings,
    addCryptoHolding: c => setCryptoHoldings(p => [...p, { ...c, id: uid(), transactions: [] }]),
    addCryptoTx: (holdingId, tx) => {
      setCryptoHoldings(p => p.map(c => c.id===holdingId ? { ...c, transactions: [...c.transactions, { ...tx, id: uid() }] } : c));
      if (tx.fromAccountId) {
        const holding = cryptoHoldings.find(c => c.id === holdingId);
        const sign = tx.type === "buy" ? -1 : 1;
        setTransactions(prev => [{ id: uid(), name: `${tx.type==="buy"?"Buy":"Sell"} ${holding?.symbol||"Crypto"} @ ${tx.exchange}`, amount: sign * tx.quantity * tx.priceAed, type: tx.type==="buy" ? "expense" as const : "income" as const, category: "Crypto", accountId: tx.fromAccountId!, date: tx.date, notes: tx.notes }, ...prev]);
      }
    },
    updateCryptoTx: (holdingId, txId, u) => setCryptoHoldings(p => p.map(c => c.id===holdingId ? { ...c, transactions: c.transactions.map(t => t.id===txId ? { ...t, ...u } : t) } : c)),
    deleteCryptoTx: (holdingId, txId) => setCryptoHoldings(p => p.map(c => c.id===holdingId ? { ...c, transactions: c.transactions.filter(t => t.id!==txId) } : c)),
    deleteCryptoHolding: id => {
      const c = cryptoHoldings.find(c => c.id === id);
      if (c) saveToTrashSb({ id: uid(), type: "crypto", label: c.symbol, detail: "", deletedAt: new Date().toISOString(), data: c });
      sbDelete("crypto_holdings", id);
      setCryptoHoldingsRaw(p => p.filter(c => c.id!==id));
    },
    cryptoExchanges, addCryptoExchange: e => setCryptoExchanges(p => [...new Set([...p, e])]),
    updateCryptoExchange: (old, nw) => setCryptoExchanges(p => p.map(x => x===old ? nw : x)),
    deleteCryptoExchange: e => setCryptoExchanges(p => p.filter(x => x!==e)),

    metalHoldings,
    addMetalHolding: m => setMetalHoldings(p => [...p, { ...m, id: uid(), transactions: [] }]),
    addMetalTx: (holdingId, tx) => {
      setMetalHoldings(p => p.map(m => m.id===holdingId ? { ...m, transactions: [...m.transactions, { ...tx, id: uid() }] } : m));
      if (tx.fromAccountId) {
        const holding = metalHoldings.find(m => m.id === holdingId);
        const sign = tx.type === "buy" ? -1 : 1;
        setTransactions(prev => [{ id: uid(), name: `${tx.type==="buy"?"Buy":"Sell"} ${holding?.name||"Metal"} @ ${tx.platform}`, amount: sign * tx.totalAed, type: tx.type==="buy" ? "expense" as const : "income" as const, category: "Metals", accountId: tx.fromAccountId!, date: tx.date, notes: tx.notes }, ...prev]);
      }
    },
    updateMetalTx: (holdingId, txId, u) => setMetalHoldings(p => p.map(m => m.id===holdingId ? { ...m, transactions: m.transactions.map(t => t.id===txId ? { ...t, ...u } : t) } : m)),
    deleteMetalTx: (holdingId, txId) => setMetalHoldings(p => p.map(m => m.id===holdingId ? { ...m, transactions: m.transactions.filter(t => t.id!==txId) } : m)),
    deleteMetalHolding: id => { sbDelete("metal_holdings", id); setMetalHoldingsRaw(p => p.filter(m => m.id!==id)); },
    metalPlatforms, addMetalPlatform: p => setMetalPlatforms(prev => [...new Set([...prev, p])]),
    updateMetalPlatform: (old, nw) => setMetalPlatforms(p => p.map(x => x===old ? nw : x)),
    deleteMetalPlatform: p => setMetalPlatforms(prev => prev.filter(x => x!==p)),

    realEstatePlatforms, addRealEstatePlatform: p => setRealEstatePlatforms(prev => [...new Set([...prev, p])]),
    updateRealEstatePlatform: (old, nw) => setRealEstatePlatforms(p => p.map(x => x===old ? nw : x)),
    deleteRealEstatePlatform: p => setRealEstatePlatforms(prev => prev.filter(x => x!==p)),

    properties,
    addProperty: p => {
      setProperties(prev => [...prev, { ...p, id: uid(), rentalHistory: [], maintenanceCosts: [], rentalPendingBalance: 0 }]);
      // Deduct purchase amount from account if linked
      if (p.purchaseAccountId && p.invested > 0) {
        setTransactions(prev => [{ id: uid(), name: `Property Purchase: ${p.name}`, amount: -p.invested, type: "expense" as const, category: "Real Estate", accountId: p.purchaseAccountId!, date: p.purchaseDate || new Date().toISOString().slice(0,10), notes: `Property purchase: ${p.name}, ${p.location}` }, ...prev]);
      }
      // Charge to credit card if linked
      if (p.purchaseCreditCardId && p.invested > 0) {
        setCreditCards(prev => prev.map(c => c.id === p.purchaseCreditCardId ? { ...c, balance: c.balance - p.invested, transactions: [{ id: uid(), date: p.purchaseDate || new Date().toISOString().slice(0,10), description: `Property Purchase: ${p.name}`, amount: -p.invested, category: "Real Estate" }, ...c.transactions] } : c));
      }
    },
    addRentalEntry: (propId, entry) => setProperties(p => p.map(prop => prop.id===propId ? {
      ...prop, rentalHistory: [...prop.rentalHistory, { ...entry, id: uid() }],
      rentalPendingBalance: (prop.rentalPendingBalance||0) + entry.amount
    } : prop)),
    updateRentalEntry: (propId, entryId, u) => setProperties(p => p.map(prop => prop.id===propId ? {
      ...prop, rentalHistory: prop.rentalHistory.map(r => r.id===entryId ? { ...r, ...u } : r)
    } : prop)),
    deleteRentalEntry: (propId, entryId) => setProperties(p => p.map(prop => {
      if (prop.id !== propId) return prop;
      const entry = prop.rentalHistory.find(r => r.id === entryId);
      const newPending = Math.max(0, (prop.rentalPendingBalance||0) - (entry?.amount||0));
      return { ...prop, rentalHistory: prop.rentalHistory.filter(r => r.id !== entryId), rentalPendingBalance: newPending };
    })),
    addPropertyCost: (propId, cost) => {
      setProperties(p => p.map(prop => prop.id===propId ? {
        ...prop, maintenanceCosts: [...(prop.maintenanceCosts||[]), { ...cost, id: uid() }]
      } : prop));
      // Deduct from account if linked
      if (cost.accountId) {
        const prop = properties.find(p => p.id === propId);
        setTransactions(prev => [{ id: uid(), name: `${cost.category}: ${cost.description}`, amount: -cost.amount, type: "expense" as const, category: "Property Cost", accountId: cost.accountId!, date: cost.date, notes: `Property: ${prop?.name}` }, ...prev]);
      }
      // Charge to credit card if linked
      if (cost.creditCardId) {
        const prop = properties.find(p => p.id === propId);
        setCreditCards(prev => prev.map(c => c.id === cost.creditCardId ? { ...c, balance: c.balance - cost.amount, transactions: [{ id: uid(), date: cost.date, description: `${cost.description} - ${prop?.name}`, amount: -cost.amount, category: "Property Cost" }, ...c.transactions] } : c));
      }
    },
    updatePropertyCost: (propId, costId, u) => setProperties(p => p.map(prop => prop.id===propId ? {
      ...prop, maintenanceCosts: (prop.maintenanceCosts||[]).map(c => c.id===costId ? { ...c, ...u } : c)
    } : prop)),
    deletePropertyCost: (propId, costId) => setProperties(p => p.map(prop => prop.id===propId ? {
      ...prop, maintenanceCosts: (prop.maintenanceCosts||[]).filter(c => c.id !== costId)
    } : prop)),
    transferRentalToAccount: (propId, accountId, amount, date) => {
      setProperties(p => p.map(prop => prop.id===propId ? {
        ...prop,
        rentalPendingBalance: Math.max(0, (prop.rentalPendingBalance||0) - amount),
        rentalHistory: [...prop.rentalHistory, { id: uid(), date, amount: 0, note: `Transferred ${amount} to account`, transferredToAccountId: accountId }]
      } : prop));
      setTransactions(prev => [{ id: uid(), name: "Rental Income Transfer", amount, type: "income" as const, category: "Rental Income", accountId, date }, ...prev]);
    },
    updateProperty: (id, u) => {
      const oldProp = properties.find(p => p.id === id);
      setProperties(p => p.map(prop => prop.id===id ? { ...prop, ...u } : prop));
      // If status changed to "sold" and saleAccountId and salePrice are set, credit the account
      if (u.status === "sold" && u.saleAccountId && u.salePrice && oldProp?.status !== "sold") {
        setTransactions(prev => [{ id: uid(), name: `Property Sale: ${oldProp?.name || "Property"}`, amount: u.salePrice!, type: "income" as const, category: "Real Estate", accountId: u.saleAccountId!, date: u.saleDate || new Date().toISOString().slice(0,10), notes: `Sold: ${oldProp?.name}` }, ...prev]);
      }
    },
    deleteProperty: id => {
      const p = properties.find(p => p.id === id);
      if (p) saveToTrashSb({ id: uid(), type: "property", label: p.name, detail: `${p.platform} · ${p.location}`, deletedAt: new Date().toISOString(), data: p });
      sbDelete("properties", id);
      setPropertiesRaw(p => p.filter(prop => prop.id!==id));
    },

    businesses,
    addBusiness: b => setBusinesses(p => [...p, { ...b, id: uid(), transactions: [], partners: [], profitTransfers: [] }]),
    addBusinessTx: (bizId, tx, deductFromAccount = true) => {
      setBusinesses(p => p.map(b => b.id===bizId ? { ...b, transactions: [...b.transactions, { ...tx, id: uid() }] } : b));
      if (deductFromAccount) {
        if (tx.accountId) setTransactions(prev => [{ id: uid(), name: tx.description, amount: tx.amount, type: tx.amount > 0 ? "income" as const : "expense" as const, category: tx.category==="revenue"?"Business Revenue":"Business Expense", accountId: tx.accountId!, date: tx.date }, ...prev]);
        if (tx.creditCardId) setCreditCards(p => p.map(c => c.id===tx.creditCardId ? { ...c, balance: c.balance + tx.amount, transactions: [{ id: uid(), date: tx.date, description: tx.description, amount: tx.amount, category: tx.category }, ...c.transactions] } : c));
      }
    },
    updateBusinessTx: (bizId, txId, u) => setBusinesses(p => p.map(b => b.id===bizId ? { ...b, transactions: b.transactions.map(t => t.id===txId ? { ...t, ...u } : t) } : b)),
    deleteBusinessTx: (bizId, txId) => setBusinesses(p => p.map(b => b.id===bizId ? { ...b, transactions: b.transactions.filter(t => t.id!==txId) } : b)),
    updateBusiness: (id, u) => setBusinesses(p => p.map(b => b.id===id ? { ...b, ...u } : b)),
    addBusinessPartner: (bizId, partner) => setBusinesses(p => p.map(b => b.id===bizId ? { ...b, partners: [...(b.partners||[]), { partnerAccountBalance: 0, partnerAccountTxs: [], ...partner, id: uid() }] } : b)),
    updateBusinessPartner: (bizId, partnerId, u) => setBusinesses(p => p.map(b => b.id===bizId ? { ...b, partners: (b.partners||[]).map(p => p.id===partnerId ? { ...p, ...u } : p) } : b)),
    deleteBusinessPartner: (bizId, partnerId) => setBusinesses(p => p.map(b => b.id===bizId ? { ...b, partners: (b.partners||[]).filter(p => p.id!==partnerId) } : b)),
    addPartnerAccountTx: (bizId, partnerId, tx, toAccountId) => {
      const newTx = { ...tx, id: uid() };
      setBusinesses(p => p.map(b => {
        if (b.id !== bizId) return b;
        const partners = (b.partners||[]).map(p => {
          if (p.id !== partnerId) return p;
          const delta = tx.type === "debit" || tx.type === "reinvest" ? -Math.abs(tx.amount) : Math.abs(tx.amount);
          return { ...p, partnerAccountBalance: (p.partnerAccountBalance||0) + delta, partnerAccountTxs: [...(p.partnerAccountTxs||[]), newTx] };
        });
        return { ...b, partners };
      }));
      // If withdrawing to a real account, add income transaction
      if (toAccountId && (tx.type === "debit")) {
        setTransactions(prev => [{ id: uid(), name: `Partner withdrawal`, amount: Math.abs(tx.amount), type: "income" as const, category: "Business Revenue", accountId: toAccountId, date: tx.date, notes: tx.description }, ...prev]);
      }
    },
    addProfitTransfer: (bizId, transfer) => {
      setBusinesses(p => p.map(b => b.id===bizId ? { ...b, profitTransfers: [...(b.profitTransfers||[]), { ...transfer, id: uid() }] } : b));
      setTransactions(prev => [{ id: uid(), name: "Business Profit Transfer", amount: transfer.amount, type: "income" as const, category: "Business Revenue", accountId: transfer.toAccountId, date: transfer.date, notes: transfer.notes }, ...prev]);
    },
    deleteBusiness: id => {
      const b = businesses.find(b => b.id === id);
      if (b) saveToTrashSb({ id: uid(), type: "business", label: b.name, detail: b.type, deletedAt: new Date().toISOString(), data: b });
      sbDelete("businesses", id);
      setBusinessesRaw(p => p.filter(b => b.id!==id));
    },
    updateGoalProgress: (id, amount) => setGoals(p => p.map(g => g.id===id ? { ...g, currentAmount: amount } : g)),

    cashEntries,
    cashOpeningBalance,
    addCashEntry: e => {
      setCashEntries(p => [...p, { ...e, id: uid() }]);
      // When cash comes IN from a bank account (ATM withdrawal): deduct from the bank account
      if (e.type === "in" && e.linkedAccountId) {
        setTransactions(prev => [{ id: uid(), name: e.description || "Cash Withdrawal", amount: -Math.abs(e.amount), type: "expense" as const, category: "Cash", accountId: e.linkedAccountId!, date: e.date, notes: "Cash tracker: cash in from account" }, ...prev]);
      }
      // When cash goes OUT and is deposited to a bank account: credit that account
      if (e.type === "out" && (e as any).toAccountId) {
        setTransactions(prev => [{ id: uid(), name: e.description || "Cash Deposit", amount: Math.abs(e.amount), type: "income" as const, category: "Cash", accountId: (e as any).toAccountId, date: e.date, notes: "Cash tracker: cash deposited to account" }, ...prev]);
      }
      // When cash goes OUT and is deposited to a CC: credit that CC (repayment)
      if (e.type === "out" && (e as any).toCreditCardId) {
        setCreditCards(p => p.map(c => c.id===(e as any).toCreditCardId ? { ...c, balance: c.balance + Math.abs(e.amount), repayments: [...(c.repayments||[]), { id: uid(), cardId: c.id, date: e.date, amount: Math.abs(e.amount), method: "cash" as const, notes: e.description }] } : c));
      }
    },
    updateCashEntry: (id, u) => setCashEntries(p => p.map(e => e.id===id ? { ...e, ...u } : e)),
    deleteCashEntry: id => { sbDelete("cash_entries", id); setCashEntriesRaw(p => p.filter(e => e.id!==id)); },
    setCashOpeningBalance: b => setCashOpeningBalance(b),

    // ── Investment Holdings ────────────────────────────────────────────
    investmentHoldings,
    addInvestmentHolding: h => setInvestmentHoldings(p => [...p, { ...h, id: uid(), transactions: [] }]),
    updateInvestmentHolding: (id, u) => setInvestmentHoldings(p => p.map(h => h.id===id ? { ...h, ...u } : h)),
    addInvestmentTx: (holdingId, tx) => {
      setInvestmentHoldings(p => p.map(h => {
        if (h.id !== holdingId) return h;
        return { ...h, transactions: [...h.transactions, { ...tx, id: uid() }] };
      }));
      // Deduct from account on buy
      if (tx.type === "buy" && tx.fromAccountId) {
        const holding = investmentHoldings.find(h => h.id === holdingId);
        setTransactions(prev => [...prev, {
          id: uid(), name: `${tx.type === "buy" ? "Buy" : "Sell"}: ${holding?.name || "Investment"}`,
          amount: -(tx.totalAmount + (tx.fees || 0)),
          type: "expense" as const, category: "Investment",
          accountId: tx.fromAccountId!, date: tx.date,
          notes: tx.notes,
        }]);
      }
      // Credit account on sell/dividend/coupon/maturity
      if ((tx.type === "sell" || tx.type === "dividend" || tx.type === "coupon" || tx.type === "maturity") && tx.toAccountId) {
        const holding = investmentHoldings.find(h => h.id === holdingId);
        const catMap: Record<string, string> = { sell: "Investment", dividend: "Dividend", coupon: "Bond Coupon", maturity: "Bond Maturity" };
        setTransactions(prev => [...prev, {
          id: uid(), name: `${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}: ${holding?.name || "Investment"}`,
          amount: tx.totalAmount - (tx.fees || 0),
          type: "income" as const, category: catMap[tx.type] || "Investment",
          accountId: tx.toAccountId!, date: tx.date,
          notes: tx.notes,
        }]);
      }
    },
    updateInvestmentTx: (holdingId, txId, u) => setInvestmentHoldings(p => p.map(h =>
      h.id === holdingId ? { ...h, transactions: h.transactions.map(t => t.id === txId ? { ...t, ...u } : t) } : h
    )),
    deleteInvestmentTx: (holdingId, txId) => setInvestmentHoldings(p => p.map(h =>
      h.id === holdingId ? { ...h, transactions: h.transactions.filter(t => t.id !== txId) } : h
    )),
    deleteInvestmentHolding: id => {
      const h = investmentHoldings.find(h => h.id === id);
      if (h) saveToTrashSb({ id: uid(), type: "investment", label: h.name, detail: h.type, deletedAt: new Date().toISOString(), data: h });
      sbDelete("investment_holdings", id);
      setInvestmentHoldingsRaw(p => p.filter(h => h.id !== id));
    },

    // ── Savings Withdrawal ────────────────────────────────────────────
    withdrawFromSavings: (goalId, withdrawal) => {
      const goal = savingsGoals.find(g => g.id === goalId);
      if (!goal) return;
      const totalDeducted = withdrawal.amount + (withdrawal.fees || 0) + (withdrawal.misc || 0);
      // Deduct from savings goal
      setSavingsGoals(p => p.map(g => g.id === goalId ? {
        ...g,
        current: Math.max(0, g.current - totalDeducted),
        transactions: [...g.transactions, {
          id: uid(), date: withdrawal.date, amount: -totalDeducted,
          note: withdrawal.note || "Withdrawal",
          type: "withdrawal" as const,
          toAccountId: withdrawal.toAccountId,
          toCreditCardId: withdrawal.toCreditCardId,
          fees: withdrawal.fees, misc: withdrawal.misc,
        }],
      } : g));
      // Credit destination account
      if (withdrawal.toAccountId) {
        setTransactions(prev => [...prev, {
          id: uid(), name: `Savings Withdrawal: ${goal.name}`,
          amount: withdrawal.amount,
          type: "income" as const, category: "Savings",
          accountId: withdrawal.toAccountId!, date: withdrawal.date,
          notes: withdrawal.note,
        }]);
      }
      // Or credit to credit card (repayment)
      if (withdrawal.toCreditCardId) {
        setCreditCards(p => p.map(c => c.id === withdrawal.toCreditCardId ? {
          ...c,
          balance: c.balance + withdrawal.amount,
          repayments: [...(c.repayments || []), {
            id: uid(), cardId: withdrawal.toCreditCardId!, date: withdrawal.date,
            amount: withdrawal.amount, method: "cash" as const,
            notes: `Savings withdrawal: ${goal.name}`,
          }],
        } : c));
      }
    },
  





    
   getGlobalTransactions: (): GlobalTransaction[] => {
    const accountTx: GlobalTransaction[] = transactions.map(t => ({
      id: t.id,
      name: t.name,
      amount: t.amount,
      date: t.date,
      type: t.type,
      category: t.category,
      accountId: t.accountId,
      notes: t.notes,
      source: "account"
    }));

    const cardTx: GlobalTransaction[] = creditCards.flatMap(c =>
      c.transactions.map(t => ({
        id: t.id,
        name: t.description || "Card Transaction",
        amount: t.amount,
        date: t.date,
        type: "expense",
        category: t.category,
        cardId: c.id,
        notes: "",
        source: "credit_card"
      }))
    );

    return [...accountTx, ...cardTx].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },

  getGlobalBalance: (): number => {
  // Calculate the total balance of accounts
  const accountBalance = transactions.reduce((total, t) => {
    if (t.type === "income") return total + t.amount;
    if (t.type === "expense") return total - t.amount;
    return total;
  }, 0);

  // Calculate the total balance of credit cards (assuming they have a negative balance if you owe money)
  const cardBalance = creditCards.reduce((total, card) => {
    const cardTransactionSum = card.transactions.reduce((sum, t) => sum + t.amount, 0);
    return total + cardTransactionSum;
  }, 0);

  // Add the savings and loan balances (loans are considered as negative amounts)
  const loanBalance = loans.reduce((total, loan) => {
    const loanTransactionSum = loan.transactions.reduce((sum, t) => sum - t.amount, 0);
    return total + loanTransactionSum;
  }, 0);

  // Add the savings goal balances (savings considered positive)
  const savingsBalance = savingsGoals.reduce((total, goal) => {
    const savingsTransactionSum = goal.transactions.reduce((sum, t) => sum + t.amount, 0);
    return total + savingsTransactionSum;
  }, 0);

  // Return the final balance (sum of all balances)
  return accountBalance + cardBalance + loanBalance + savingsBalance;
},
  
  
  };

  return <DBContext.Provider value={db}>{children}</DBContext.Provider>;




}

export function useDB(): DB {
  const ctx = useContext(DBContext);
  if (!ctx) throw new Error("useDB must be used within DatabaseProvider");
  return ctx;


}