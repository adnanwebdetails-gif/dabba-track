"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, Mail, ArrowRight, Loader2, Sparkles } from "lucide-react";

export default function Login() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const endpoint = isSignUp ? "/api/auth/register" : "/api/auth/login";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      if (isSignUp) {
        setMessage("Registration successful! Please login with your new account.");
        setIsSignUp(false);
        setPassword("");
      } else {
        // Logged in successfully, redirect to dashboard
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-card-bg border border-text-ink/10 shadow-2xl rounded-2xl max-w-md w-full p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-terracotta/10 text-terracotta mb-1">
            <Shield className="h-8 w-8 animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-ink font-display flex items-center justify-center gap-1.5">
            Dabba Track <Sparkles className="h-5 w-5 text-mustard fill-mustard" />
          </h1>
          <p className="text-sm text-text-ink/65">
            {isSignUp ? "Create a new portal to manage your deliveries" : "Log in to access your parcel dashboard"}
          </p>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-lg text-xs font-semibold">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-lg text-xs font-semibold">
            {message}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xxs font-bold uppercase tracking-wider text-text-ink/60 block">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4.5 w-4.5 text-text-ink/40" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seller@dabbatrack.com"
                className="w-full pl-10 pr-4 py-2.5 border border-text-ink/15 rounded-md bg-kraft-bg/25 text-text-ink text-sm focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xxs font-bold uppercase tracking-wider text-text-ink/60 block">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-text-ink/40" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 border border-text-ink/15 rounded-md bg-kraft-bg/25 text-text-ink text-sm focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta/90 text-card-bg font-bold py-3 rounded-md transition-all shadow-md disabled:opacity-50 mt-6 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? "Sign Up Now" : "Sign In to Portal"}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Toggle between Login and Signup */}
        <div className="text-center pt-2">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setMessage(null);
            }}
            className="text-xs text-deep-teal hover:underline font-semibold"
          >
            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Register Portal"}
          </button>
        </div>
      </div>
    </div>
  );
}
