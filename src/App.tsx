import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { DatabaseProvider } from "@/lib/database";
import { AuthProvider, useAuth } from "@/lib/auth";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Accounts from "@/pages/Accounts";
import Transactions from "@/pages/Transactions";
import Budgets from "@/pages/Budgets";
import CreditCards from "@/pages/CreditCards";
import Savings from "@/pages/Savings";
import Crypto from "@/pages/Crypto";
import Investments from "@/pages/Investments";
import Metals from "@/pages/Metals";
import RealEstate from "@/pages/RealEstate";
import Business from "@/pages/Business";
import Recurring from "@/pages/Recurring";
import Installments from "@/pages/Installments";
import Transfers from "@/pages/Transfers";
import Goals from "@/pages/Goals";
import CashTracker from "@/pages/CashTracker";
import StatementImport from "@/pages/StatementImport";
import Loyalty from "@/pages/Loyalty";
import MoneyLenders from "@/pages/MoneyLenders";
import Rules from "@/pages/Rules";
import Trash from "@/pages/Trash";
import NotFound from "@/pages/NotFound";

import CurrencyConverter from '@/components/CurrencyConverter';
import Index from "./pages/Index";
import { LogIn } from "lucide-react";

// Add this route:
<Route path="/converter" element={<CurrencyConverter />} />


const queryClient = new QueryClient();

function AppCore() {
  const { currentUser, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="loader">Loading...</div>
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Loading Smart Wallet...</p>
      </div>
    </div>
  );
  if (!currentUser) {
  return <Login />;
}
  return (
    <DatabaseProvider userId={currentUser.id}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/credit-cards" element={<CreditCards />} />
              <Route path="/recurring" element={<Recurring />} />
              <Route path="/installments" element={<Installments />} />
              <Route path="/transfers" element={<Transfers />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/savings" element={<Savings />} />
              <Route path="/cash" element={<CashTracker />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/crypto" element={<Crypto />} />
              <Route path="/investments" element={<Investments />} />
              <Route path="/metals" element={<Metals />} />
              <Route path="/real-estate" element={<RealEstate />} />
              <Route path="/business" element={<Business />} />
              <Route path="/statement-import" element={<StatementImport />} />
              <Route path="/loyalty" element={<Loyalty />} />
              <Route path="/money-lenders" element={<MoneyLenders />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/trash" element={<Trash />} />
              
              <Route path="/converter" element={<CurrencyConverter />}
               />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </DatabaseProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AppCore />
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
