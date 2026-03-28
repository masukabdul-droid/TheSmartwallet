import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, ArrowLeftRight, CreditCard, PiggyBank,
  Building2, Target, Briefcase, ChevronLeft, ChevronRight,
  Wallet, RefreshCw, FileText, ArrowRightLeft, Banknote, Receipt,
  Bitcoin, Gem, Layers, Gift, Trash2, HandCoins, LogOut, X, Menu, BarChart2
} from "lucide-react";

const navGroups = [
  {
    label: "Overview",
    items: [
      { path: "/", label: "Dashboard", icon: LayoutDashboard },
      { path: "/accounts", label: "Accounts", icon: Wallet },
      { path: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { path: "/converter", label: "Currency Converter", icon: RefreshCw },
    ],
  },
  {
    label: "Payments",
    items: [
      { path: "/credit-cards", label: "Credit Cards", icon: CreditCard },
      { path: "/recurring", label: "Recurring Bills", icon: RefreshCw },
      { path: "/installments", label: "Loans & EMI", icon: Receipt },
      { path: "/transfers", label: "Transfers", icon: ArrowRightLeft },
      { path: "/cash", label: "Cash Tracker", icon: Banknote },
    ],
  },
  {
    label: "Investments",
    items: [
      { path: "/crypto", label: "Crypto", icon: Bitcoin },
      { path: "/investments", label: "Investments", icon: BarChart2 },
      { path: "/metals", label: "Metals", icon: Gem },
      { path: "/real-estate", label: "Real Estate", icon: Building2 },
      { path: "/business", label: "Business", icon: Briefcase },
    ],
  },
  {
    label: "Planning",
    items: [
      { path: "/goals", label: "Goals", icon: Target },
      { path: "/savings", label: "Savings", icon: PiggyBank },
      { path: "/budgets", label: "Budgets", icon: Layers },
      { path: "/loyalty", label: "Loyalty & Rewards", icon: Gift },
      { path: "/money-lenders", label: "Money Lenders", icon: HandCoins },
    ],
  },
  {
    label: "Tools",
    items: [
      { path: "/statement-import", label: "Import Statement", icon: FileText },
      { path: "/trash", label: "Deleted Items", icon: Trash2 },
    ],
  },
];

// ── Shared nav content used by both desktop sidebar and mobile drawer ──
function NavContent({ collapsed, onNavClick }: { collapsed: boolean; onNavClick?: () => void }) {
  const location = useLocation();
  const { currentUser, logout } = useAuth();

  return (
    <>
      <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1"
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onNavClick}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative
                      ${isActive
                        ? "bg-primary/10 text-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }}
                          className="text-sm font-medium whitespace-nowrap overflow-hidden"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-sidebar-border px-2 py-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: `${currentUser?.color || "hsl(160,84%,39%)"}30`, color: currentUser?.color || "hsl(160,84%,39%)" }}
          >
            {(currentUser?.displayName || "U").slice(0, 1).toUpperCase()}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }}
                className="flex-1 overflow-hidden min-w-0"
              >
                <p className="text-xs font-semibold text-foreground truncate">{currentUser?.displayName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{currentUser?.username}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {!collapsed && (
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => logout()}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-destructive transition-colors flex-shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

// ── Desktop sidebar (hidden on mobile) ────────────────────────────────────
export function DesktopSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border z-50 flex flex-col hidden md:flex"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Wallet className="w-4 h-4 text-primary-foreground" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }}
              className="font-display font-bold text-foreground text-lg whitespace-nowrap overflow-hidden"
            >
              Smart Wallet
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <NavContent collapsed={collapsed} />

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mx-2 mb-3 p-2 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors flex items-center justify-center"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </motion.aside>
  );
}

// ── Mobile top bar + slide-in drawer ──────────────────────────────────────
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { currentUser, logout } = useAuth();

  return (
    <>
      {/* Top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Wallet className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-foreground text-base">Smart Wallet</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: `${currentUser?.color || "hsl(160,84%,39%)"}30`, color: currentUser?.color || "hsl(160,84%,39%)" }}
          >
            {(currentUser?.displayName || "U").slice(0, 1).toUpperCase()}
          </div>
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/60 z-50"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Slide-in drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 35 }}
            className="md:hidden fixed left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-sidebar-border z-50 flex flex-col"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <span className="font-display font-bold text-foreground">Smart Wallet</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <NavContent collapsed={false} onNavClick={() => setOpen(false)} />

            {/* Mobile logout */}
            <div className="px-2 pb-4">
              <button
                onClick={() => { logout(); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-destructive transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Default export keeps backward compat ──────────────────────────────────
export default DesktopSidebar;
