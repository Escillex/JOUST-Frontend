"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { API_ENDPOINTS, API_URL, safeJson } from "../utils/api";
import FadeIn, { StaggerContainer } from "../components/FadeIn";
import Footer from "../components/Footer";

import { useUser } from "../components/UserProvider";

export default function AuthPage() {
  const router = useRouter();
  const { refreshUser } = useUser();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    const endpoint = mode === "login" ? API_ENDPOINTS.AUTH.SIGNIN : API_ENDPOINTS.AUTH.SIGNUP;

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier, password }),
      });

      const data = await safeJson(response);

      if (response.ok) {
        setMessage(`Success: ${mode === "login" ? "Signed in" : "Signed up"}`);
        if (data?.token) {
          localStorage.setItem("token", data.token);
          // Update global auth state before redirecting
          await refreshUser();
        }
        setTimeout(() => router.push("/home"), 800);
      } else {
        setMessage(`Error: ${data?.message || "Authentication failed"}`);
      }
    } catch (error) {
      console.error("Auth error:", error);
      setMessage("Error: Failed to connect to server");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* High-Intensity Sensory Breathing Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div 
          animate={{ opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent"
        />
        <motion.div 
          animate={{ 
            opacity: [0.05, 0.15, 0.05],
            scale: [1, 1.15, 1]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-15%] left-[-15%] w-[80%] h-[80%] bg-primary/20 rounded-full blur-[120px]"
        />
        <motion.div 
          animate={{ 
            opacity: [0.05, 0.15, 0.05],
            scale: [1.15, 1, 1.15]
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-[-15%] right-[-15%] w-[80%] h-[80%] bg-primary/20 rounded-full blur-[120px]"
        />
      </div>

      <main className="flex-grow flex items-center justify-center p-6 z-10 my-12">
        <StaggerContainer className="w-full max-w-[440px] relative">
          {/* Structural Ghost Frame */}
          <div className="absolute inset-0 border-4 border-white/5 translate-x-3 translate-y-3 -z-10" />

          <FadeIn>
            <div className="bg-component-background border-4 border-white p-8 md:p-10 relative shadow-[16px_16px_0px_0px_rgba(82,185,70,0.1)] overflow-hidden">
              {/* Header - Compact */}
              <div className="flex justify-center mb-10">
                <Image
                  src="/hpluslogo.png"
                  alt="Logo"
                  width={160}
                  height={60}
                  className="w-36 md:w-44 brightness-125"
                  priority
                />
              </div>

              {/* Mode Switcher - Compact */}
              <div className="flex mb-10 border-b-4 border-component-border">
                <button
                  onClick={() => setMode("login")}
                  className={`flex-1 py-3 font-black text-xs uppercase tracking-[0.3em] transition-all relative ${
                    mode === "login" ? "text-primary" : "text-white/20 hover:text-white"
                  }`}
                >
                  SIGN_IN
                  {mode === "login" && (
                    <motion.div layoutId="authUnderline" className="absolute bottom-[-4px] left-0 w-full h-1 bg-primary" />
                  )}
                </button>
                <button
                  onClick={() => setMode("signup")}
                  className={`flex-1 py-3 font-black text-xs uppercase tracking-[0.3em] transition-all relative ${
                    mode === "signup" ? "text-primary" : "text-white/20 hover:text-white"
                  }`}
                >
                  SIGN_UP
                  {mode === "signup" && (
                    <motion.div layoutId="authUnderline" className="absolute bottom-[-4px] left-0 w-full h-1 bg-primary" />
                  )}
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="relative">
                  <span className="absolute -top-2.5 left-5 bg-component-background px-2 text-[9px] font-black text-primary uppercase tracking-widest z-20">
                    IDENTIFIER
                  </span>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="USERNAME_OR_EMAIL"
                    className="w-full h-14 bg-transparent border-4 border-white px-6 text-sm text-white placeholder:text-white/5 focus:outline-none focus:border-primary transition-all font-poppins"
                    required
                  />
                </div>

                <div className="relative">
                  <span className="absolute -top-2.5 left-5 bg-component-background px-2 text-[9px] font-black text-primary uppercase tracking-widest z-20">
                    PASSWORD
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-14 bg-transparent border-4 border-white px-6 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-primary transition-all font-poppins"
                    required
                  />
                </div>

                <AnimatePresence mode="wait">
                  {message && (
                    <motion.div 
                      key="message"
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-4 text-[9px] font-black uppercase tracking-widest border-l-4 ${
                        message.startsWith("Error") 
                          ? "border-red-500 bg-red-500/5 text-red-500" 
                          : "border-primary bg-primary/5 text-primary"
                      }`}
                    >
                      {message}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  className="w-full h-16 bg-primary text-black font-black text-sm uppercase tracking-widest flex items-center justify-between px-8 hover:translate-x-1 transition-transform duration-300"
                >
                  <span>{mode === "login" ? "Sign In" : "Sign Up"}</span>
                  <span>→</span>
                </button>
              </form>

              <div className="mt-10 flex justify-center">
                <Link 
                  href="/" 
                  className="text-[9px] font-black text-white/40 hover:text-primary uppercase tracking-widest transition-colors font-poppins"
                >
                  ← BACK TO HOME
                </Link>
              </div>
            </div>
          </FadeIn>
        </StaggerContainer>
      </main>

      <Footer />
    </div>
  );
}