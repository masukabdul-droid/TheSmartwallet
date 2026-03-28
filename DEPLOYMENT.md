# 🚀 Smart Wallet — Deployment Guide

## Step 1: Set Up Supabase Database

1. Go to your Supabase project: https://ngcieqpfvjwfmmudiuqe.supabase.co
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the file `supabase-schema.sql` from this project folder
5. Copy the entire contents and paste into the SQL Editor
6. Click **Run** (green button)
7. You should see "Success. No rows returned" — all 25 tables are created ✅

## Step 2: Configure Supabase Auth Settings

1. In Supabase, go to **Authentication → Settings**
2. Under **Email Auth**, make sure it's enabled
3. Optional: Set **Site URL** to your Vercel URL (after deploying)
4. Optional: Disable "Confirm email" for easier testing (Authentication → Settings → toggle off)

## Step 3: Push Code to GitHub

```bash
cd smart-wallet-companion-main

# Install dependencies (includes @supabase/supabase-js)
npm install

# Test it builds correctly
npm run build

# Push to GitHub
git init
git add .
git commit -m "feat: Supabase cloud sync migration v10"
git remote add origin https://github.com/masukabdul-droid/Smart-wallet.git
git push -u origin main
```

## Step 4: Deploy to Vercel

1. Go to https://vercel.com and log in
2. Click **Add New → Project**
3. Click **Import Git Repository**
4. Select your `Smart-wallet` repository
5. Vercel will auto-detect it as a Vite project
6. Click **Deploy** — no environment variables needed (credentials are in the code)
7. Wait ~2 minutes for build to complete
8. Your app is live! 🎉

## Step 5: Update Supabase Auth Redirect URL

1. Copy your Vercel URL (e.g. `https://smart-wallet-xyz.vercel.app`)
2. In Supabase → Authentication → Settings
3. Set **Site URL** to your Vercel URL
4. Add your Vercel URL to **Redirect URLs**

---

## How Multi-Device Sync Works

- Users register with email + password
- Data is stored in Supabase (cloud database) — NOT localStorage
- Any device, any browser: just log in and all data appears instantly
- Row Level Security ensures each user sees ONLY their own data
- 15+ users supported — Supabase free tier handles thousands

## Data Backup

Your data is safely in Supabase. To export a copy:
- Go to Deleted Items page → Export Data button
- Or in Supabase → Table Editor → any table → export as CSV

---

## Troubleshooting

**"Failed to fetch" error** — Check that Supabase project is active (not paused)

**"Invalid API key"** — The anon key in `src/lib/supabase.ts` must match your project

**Login not working** — Check Supabase Auth → Users to see if account was created

**Data not loading** — Open browser console, look for Supabase errors

**Email confirmation required** — In Supabase Auth → Settings, toggle off "Confirm email"
