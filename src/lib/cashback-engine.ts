// Cashback calculation engine for different credit card formulas

export type MerchantCategory = 
  | "international_dining" | "local_dining" | "international_other" | "local_general"
  | "govt_payments" | "utilities" | "education" | "charity" | "fuel" | "rentals" | "telecom"
  | "shopping" | "groceries" | "entertainment" | "travel" | "health" | "other";

export interface Transaction {
  date: string;
  postingDate: string;
  description: string;
  amount: number;
  category?: MerchantCategory;
  reference?: string;
}

export interface CashbackResult {
  transaction: Transaction;
  cashbackRate: number;
  cashbackAmount: number;
  tier?: string;
}

// Auto-categorize based on merchant description
export function autoCategorizeMerchant(description: string): MerchantCategory {
  const desc = description.toLowerCase();
  
  // Dining
  if (/restaurant|rest |cafe|coffee|starbucks|mcdonald|kfc|burger|pizza|sushi|shawarma|manhal rest|dining/i.test(desc)) return "local_dining";
  
  // Utilities
  if (/dewa|electricity|water|fewa|sewa|federal electric/i.test(desc)) return "utilities";
  if (/du |etisalat|virgin mobile|apple pay.*du/i.test(desc)) return "telecom";
  
  // Fuel
  if (/emarat|enoc|adnoc|fuel|petrol|salik/i.test(desc)) return "fuel";
  
  // Groceries / Shopping
  if (/carrefour|lulu|spinneys|choithram|union coop|amazon grocery|marketsajman|emarats market/i.test(desc)) return "groceries";
  if (/amazon|noon|namshi|shein|zara|h&m|nike|adidas/i.test(desc)) return "shopping";
  
  // Health
  if (/hospital|clinic|pharmacy|medical|ibn sina|aster|nmc/i.test(desc)) return "health";
  
  // Govt
  if (/rta|dha|mohre|amer|govt|government|ministry/i.test(desc)) return "govt_payments";
  
  // Education
  if (/school|university|college|tuition|education/i.test(desc)) return "education";
  
  // Rent
  if (/rent|landlord|ejari/i.test(desc)) return "rentals";
  
  // Charity
  if (/charity|donation|zakat|sadaqah/i.test(desc)) return "charity";
  
  // Travel
  if (/airline|flight|hotel|booking|airbnb|emirates|flydubai/i.test(desc)) return "travel";
  
  // Tobacco / general
  if (/tobacco|tabacco/i.test(desc)) return "local_general";
  
  return "other";
}

// ─── MASHREQ NEO CREDIT CARD ───
export function calculateMashreqCashback(transactions: Transaction[]): CashbackResult[] {
  return transactions.map(tx => {
    const cat = tx.category || autoCategorizeMerchant(tx.description);
    let rate = 0;
    let tier = "";

    const lowCategories: MerchantCategory[] = ["govt_payments", "utilities", "education", "charity", "fuel", "rentals", "telecom"];

    if (cat === "international_dining" || cat === "local_dining") {
      rate = 5;
      tier = "5% Dining";
    } else if (cat === "international_other") {
      rate = 1;
      tier = "1% International";
    } else if (lowCategories.includes(cat)) {
      rate = 0.33;
      tier = "0.33% Govt/Utilities/Fuel";
    } else {
      rate = 1;
      tier = "1% Local Spend";
    }

    return {
      transaction: tx,
      cashbackRate: rate,
      cashbackAmount: Math.abs(tx.amount) * (rate / 100),
      tier,
    };
  });
}

// ─── LIV CREDIT CARD (Tiered by monthly spend) ───
const LIV_LOW_CATEGORIES: MerchantCategory[] = ["govt_payments", "utilities", "education", "charity", "fuel", "rentals", "telecom"];
const LIV_MAX_CAP = 750;

export function calculateLivCashback(transactions: Transaction[]): { results: CashbackResult[]; totalSpend: number; tierRate: number; cappedAt: boolean } {
  const totalSpend = transactions.reduce((s, t) => s + Math.abs(t.amount), 0);
  
  let tierRate = 0.75;
  let tierLabel = "AED 0-4999 @ 0.75%";
  if (totalSpend >= 10000) {
    tierRate = 2.5;
    tierLabel = "AED 10,000+ @ 2.5%";
  } else if (totalSpend >= 5000) {
    tierRate = 1.5;
    tierLabel = "AED 5,000-9,999 @ 1.5%";
  }

  let runningCashback = 0;
  let cappedAt = false;

  const results = transactions.map(tx => {
    const cat = tx.category || autoCategorizeMerchant(tx.description);
    const isLow = LIV_LOW_CATEGORIES.includes(cat);
    const rate = isLow ? 0.1 : tierRate;
    let cashbackAmount = Math.abs(tx.amount) * (rate / 100);
    
    if (runningCashback + cashbackAmount > LIV_MAX_CAP) {
      cashbackAmount = Math.max(0, LIV_MAX_CAP - runningCashback);
      cappedAt = true;
    }
    runningCashback += cashbackAmount;

    return {
      transaction: tx,
      cashbackRate: rate,
      cashbackAmount,
      tier: isLow ? "0.1% Low Category" : tierLabel,
    };
  });

  return { results, totalSpend, tierRate, cappedAt };
}

// ─── TABBY PLUS ───
export function calculateTabbyPlusCashback(transactions: Transaction[]): CashbackResult[] {
  const selectedShoppingCategories: MerchantCategory[] = ["shopping", "entertainment"];
  
  return transactions.map(tx => {
    const cat = tx.category || autoCategorizeMerchant(tx.description);
    const isSelected = selectedShoppingCategories.includes(cat);
    
    return {
      transaction: tx,
      cashbackRate: isSelected ? 5 : 0,
      cashbackAmount: isSelected ? Math.abs(tx.amount) * 0.05 : 0,
      tier: isSelected ? "5% Selected Shopping" : "No cashback",
    };
  });
}

// ─── Statement Parsers ───

export function parseLivStatement(raw: string): Transaction[] {
  const transactions: Transaction[] = [];
  // Format: DD/MM/YYYY DD/MM/YYYY DESCRIPTION AMOUNT
  const regex = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    const [, txDate, postDate, desc, amount] = match;
    transactions.push({
      date: txDate,
      postingDate: postDate,
      description: desc.trim(),
      amount: -parseFloat(amount.replace(/,/g, "")),
      category: autoCategorizeMerchant(desc),
    });
  }
  return transactions;
}

export function parseMashreqStatement(raw: string): Transaction[] {
  const transactions: Transaction[] = [];
  // Format: DD/MM DD/MM DESCRIPTION REFERENCE AMOUNT
  const regex = /(\d{2}\/\d{2})\s+(\d{2}\/\d{2})\s+(.+?)\s+(\d{11,})\s+([\d,]+\.\d{2})/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    const [, txDate, postDate, desc, ref, amount] = match;
    transactions.push({
      date: txDate,
      postingDate: postDate,
      description: desc.trim(),
      amount: -parseFloat(amount.replace(/,/g, "")),
      reference: ref,
      category: autoCategorizeMerchant(desc),
    });
  }
  return transactions;
}

export function parseSonaliStatement(raw: string): Transaction[] {
  const transactions: Transaction[] = [];
  // Simplified parser for Sonali format
  const lines = raw.split("\n").filter(l => l.trim());
  for (const line of lines) {
    const match = line.match(/(\d{2}-\d{2}-\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*([\d,]+\.\d{2})?\s*([\d,]+\.\d{2})?/);
    if (match) {
      const [, date, desc, amt1, amt2, balance] = match;
      const debit = amt2 ? parseFloat(amt1.replace(/,/g, "")) : 0;
      const credit = amt2 ? parseFloat(amt2.replace(/,/g, "")) : parseFloat(amt1.replace(/,/g, ""));
      transactions.push({
        date,
        postingDate: date,
        description: desc.trim(),
        amount: credit > 0 ? credit : -debit,
        category: "other",
      });
    }
  }
  return transactions;
}
