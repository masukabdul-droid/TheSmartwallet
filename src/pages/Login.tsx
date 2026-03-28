import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Eye, EyeOff, UserPlus, LogIn, Shield, KeyRound } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Login() {
  const { login, register, resetPassword } = useAuth();
  const [mode, setMode] = useState<"login"|"register"|"forgot">("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(""); setSuccess(""); setLoading(true);
    if (mode === "login") {
      if (!email.trim()) { setError("Email required"); setLoading(false); return; }
      const res = await login(email, password);
      if (!res.success) setError(res.error || "Invalid email or password");
    } else if (mode === "register") {
      if (!email.trim()) { setError("Email required"); setLoading(false); return; }
      if (password.length < 6) { setError("Password must be at least 6 characters"); setLoading(false); return; }
      if (password !== confirmPassword) { setError("Passwords don't match"); setLoading(false); return; }
      const res = await register(email, displayName, password);
      if (!res.success) setError(res.error || "Registration failed");
      else setSuccess("Account created! Check your email to confirm if required.");
    } else if (mode === "forgot") {
      if (!email.trim()) { setError("Email required"); setLoading(false); return; }
      const res = await resetPassword(email);
      if (!res.success) setError(res.error || "Failed to send reset email");
      else setSuccess("Password reset email sent! Check your inbox.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-primary"/>
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">Smart Wallet</h1>
          <p className="text-muted-foreground text-sm mt-1">Your personal finance companion</p>
        </div>

        <div className="glass-card p-8 space-y-5">
          {mode !== "forgot" && (
            <div className="flex rounded-lg overflow-hidden border border-border">
              <button onClick={()=>{setMode("login");setError("");setSuccess("");}} className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${mode==="login"?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>
                <LogIn className="w-4 h-4"/>Sign In
              </button>
              <button onClick={()=>{setMode("register");setError("");setSuccess("");}} className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${mode==="register"?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>
                <UserPlus className="w-4 h-4"/>Create Account
              </button>
            </div>
          )}

          {mode === "forgot" && (
            <div className="text-center">
              <KeyRound className="w-8 h-8 text-primary mx-auto mb-2"/>
              <p className="font-semibold text-foreground">Reset Password</p>
              <p className="text-xs text-muted-foreground">Enter your email to receive a reset link</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} className="bg-background border-border" autoComplete="email"/>
          </div>

          <AnimatePresence>
            {mode === "register" && (
              <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="space-y-1.5 overflow-hidden">
                <Label>Display Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input placeholder="e.g. Ahmed Al-Rashid" value={displayName} onChange={e=>setDisplayName(e.target.value)} className="bg-background border-border"/>
              </motion.div>
            )}
          </AnimatePresence>

          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label>Password</Label>
              <div className="relative">
                <Input type={showPw?"text":"password"} placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} className="bg-background border-border pr-10" autoComplete={mode==="login"?"current-password":"new-password"}/>
                <button onClick={()=>setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                </button>
              </div>
            </div>
          )}

          <AnimatePresence>
            {mode === "register" && (
              <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="space-y-1.5 overflow-hidden">
                <Label>Confirm Password</Label>
                <Input type={showPw?"text":"password"} placeholder="••••••••" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} className="bg-background border-border" autoComplete="new-password"/>
              </motion.div>
            )}
          </AnimatePresence>

          {error && <motion.p initial={{opacity:0}} animate={{opacity:1}} className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">{error}</motion.p>}
          {success && <motion.p initial={{opacity:0}} animate={{opacity:1}} className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">{success}</motion.p>}

          <Button onClick={handleSubmit} disabled={loading} className="w-full gap-2">
            {mode==="login"?<LogIn className="w-4 h-4"/>:mode==="register"?<UserPlus className="w-4 h-4"/>:<KeyRound className="w-4 h-4"/>}
            {loading?"Processing...":(mode==="login"?"Sign In":mode==="register"?"Create Account":"Send Reset Link")}
          </Button>

          {mode === "login" && (
            <button onClick={()=>{setMode("forgot");setError("");setSuccess("");}} className="w-full text-xs text-muted-foreground hover:text-primary transition-colors text-center">
              Forgot your password?
            </button>
          )}
          {mode === "forgot" && (
            <button onClick={()=>{setMode("login");setError("");setSuccess("");}} className="w-full text-xs text-muted-foreground hover:text-primary transition-colors text-center">
              ← Back to Sign In
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-muted-foreground">
          <Shield className="w-3.5 h-3.5"/>
          Secured by Supabase · Multi-device sync enabled
        </div>
      </motion.div>
    </div>
  );
}
