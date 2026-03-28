-- ============================================================
-- SMART WALLET COMPANION — SUPABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ACCOUNTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TRANSACTIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BUDGETS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── GOALS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SAVINGS GOALS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── FIXED DEPOSITS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixed_deposits (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CREDIT CARDS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_cards (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── COMPANIES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DISCOUNT CARDS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discount_cards (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DISCOUNT USAGES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discount_usages (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LOYALTY PROGRAMS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── APP RULES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_rules (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RECURRING BILLS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_bills (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LOANS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TRANSFERS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TRANSFER MODES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transfer_modes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modes JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

-- ─── MONEY LENDERS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS money_lenders (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CRYPTO HOLDINGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crypto_holdings (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CRYPTO EXCHANGES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crypto_exchanges (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exchanges JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

-- ─── METAL HOLDINGS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metal_holdings (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── METAL PLATFORMS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metal_platforms (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platforms JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

-- ─── PROPERTIES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BUSINESSES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CASH ENTRIES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_entries (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── USER PROFILES (display name, color, avatar) ─────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  color TEXT DEFAULT 'hsl(160,84%,39%)',
  avatar TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TRASH ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trash (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY — every user sees ONLY their own data
-- ============================================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_lenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE metal_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE metal_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trash ENABLE ROW LEVEL SECURITY;

-- Helper: create all 4 RLS policies for a table
-- SELECT
CREATE POLICY "users_select_own" ON accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON accounts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON transactions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON budgets FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON goals FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON savings_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON savings_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON savings_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON savings_goals FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON fixed_deposits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON fixed_deposits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON fixed_deposits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON fixed_deposits FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON credit_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON credit_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON credit_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON credit_cards FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON companies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON companies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON companies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON companies FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON discount_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON discount_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON discount_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON discount_cards FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON discount_usages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON discount_usages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON discount_usages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON discount_usages FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON loyalty_programs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON loyalty_programs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON loyalty_programs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON loyalty_programs FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON app_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON app_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON app_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON app_rules FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON recurring_bills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON recurring_bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON recurring_bills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON recurring_bills FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON loans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON loans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON loans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON loans FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON transfers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON transfers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON transfers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON transfers FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON transfer_modes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON transfer_modes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON transfer_modes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON transfer_modes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON money_lenders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON money_lenders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON money_lenders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON money_lenders FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON crypto_holdings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON crypto_holdings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON crypto_holdings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON crypto_holdings FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON crypto_exchanges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON crypto_exchanges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON crypto_exchanges FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON crypto_exchanges FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON metal_holdings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON metal_holdings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON metal_holdings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON metal_holdings FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON metal_platforms FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON metal_platforms FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON metal_platforms FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON metal_platforms FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON properties FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON properties FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON properties FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON properties FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON businesses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON businesses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON businesses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON businesses FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON cash_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON cash_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON cash_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON cash_entries FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON user_profiles FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON trash FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON trash FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON trash FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON trash FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- DONE! All 25 tables created with full RLS.
-- ============================================================

-- ============================================================
-- INVESTMENT HOLDINGS TABLE (added for Mutual Funds, ETFs, Index Funds, Bonds)
-- ============================================================
CREATE TABLE IF NOT EXISTS investment_holdings (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

ALTER TABLE investment_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON investment_holdings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON investment_holdings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON investment_holdings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own" ON investment_holdings FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- DONE: investment_holdings table added (Table #26)
-- ============================================================
