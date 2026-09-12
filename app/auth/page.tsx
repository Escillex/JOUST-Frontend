"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { API_ENDPOINTS, API_URL, safeJson } from "../utils/api";
import FadeIn, { StaggerContainer } from "../components/FadeIn";
import Footer from "../components/Footer";

import { useUser } from "../components/UserProvider";
import GoogleButton from "../components/auth/GoogleButton";

export default function AuthPage() {
  const router = useRouter();
  const { refreshUser } = useUser();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [showSignupSuccess, setShowSignupSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  // Sign-in is two steps now. `challenge` is the short-lived token the server
  // hands back after the password: it proves that step and nothing else, so it
  // is held in state and never stored as a session.
  const [challenge, setChallenge] = useState<string | null>(null);
  const [challengeKind, setChallengeKind] = useState<"signin" | "verify">("signin");
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [usingRecovery, setUsingRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  // Google sign-in is offered only when this deployment has switched it on and
  // given it a Client ID (Admin → Settings). Absent, the page is unchanged.
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}${API_ENDPOINTS.AUTH.PROVIDERS}`, { credentials: "include" })
      .then(safeJson)
      .then((p) => { if (alive && p?.google?.enabled && p.google.clientId) setGoogleClientId(p.google.clientId); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  /** Google already did its own second-factor check, so a verified Google
   *  credential yields a session directly — no emailed code. */
  const signInWithGoogle = async (credential: string) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}${API_ENDPOINTS.AUTH.GOOGLE}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credential }),
      });
      const data = await safeJson(response);
      if (!response.ok) {
        setMessage(`Error: ${data?.message || "Google sign-in failed."}`);
        return;
      }
      if (data?.token) localStorage.setItem("token", data.token);
      await refreshUser();
      setMessage(data?.created ? "Success: Account created with Google" : "Success: Signed in with Google");
      setTimeout(() => router.push("/home"), 600);
    } catch {
      setMessage("Error: Failed to connect to server");
    } finally {
      setBusy(false);
    }
  };

  // Mirrors USERNAME_PATTERN in server/src/auth/dto/auth.dto.ts. Sign-IN is not
  // checked against it on purpose: the identifier there may be an email, or one
  // of the accounts that predates the rule and still has a space in its name.
  const usernameRule = /^[A-Za-z0-9._-]+$/;
  const signupNameError =
    mode === "signup" && identifier.length > 0 && !usernameRule.test(identifier)
      ? identifier.includes(" ")
        ? "Usernames cannot contain spaces."
        : "Use letters, numbers, dots, underscores or hyphens only."
      : "";

  /** Step two: submit the emailed code. On a first-time verification the server
   *  also returns recovery codes, which are shown once and never again. */
  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !challenge) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ challenge, code, rememberDevice }),
      });
      const data = await safeJson(response);
      if (!response.ok) {
        setMessage(`Error: ${data?.message || "That code did not work."}`);
        return;
      }
      if (data?.token) localStorage.setItem("token", data.token);
      if (data?.recoveryCodes?.length) {
        // Held on screen until acknowledged: this is the only time they exist
        // in plaintext, and they are the way back in if the inbox dies.
        setRecoveryCodes(data.recoveryCodes);
        await refreshUser();
        return;
      }
      await refreshUser();
      setMessage("Success: Signed in");
      setTimeout(() => router.push("/home"), 600);
    } catch {
      setMessage("Error: Failed to connect to server");
    } finally {
      setBusy(false);
    }
  };

  const submitRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !challenge) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/auth/2fa/recovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ challenge, recoveryCode }),
      });
      const data = await safeJson(response);
      if (!response.ok) {
        setMessage(`Error: ${data?.message || "That recovery code is not valid."}`);
        return;
      }
      if (data?.token) localStorage.setItem("token", data.token);
      await refreshUser();
      setMessage("Success: Signed in");
      setTimeout(() => router.push("/home"), 600);
    } catch {
      setMessage("Error: Failed to connect to server");
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    if (busy || !challenge) return;
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/auth/2fa/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ challenge }),
      });
      const data = await safeJson(response);
      setMessage(response.ok ? "A new code is on its way." : `Error: ${data?.message || "Could not resend."}`);
    } finally {
      setBusy(false);
    }
  };

  /** Abandon the half-finished attempt and go back to the password form. */
  const cancelChallenge = () => {
    setChallenge(null);
    setCode("");
    setRecoveryCode("");
    setUsingRecovery(false);
    setMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (signupNameError) {
      setMessage(`Error: ${signupNameError}`);
      return;
    }

    const endpoint = mode === "login" ? API_ENDPOINTS.AUTH.SIGNIN : API_ENDPOINTS.AUTH.SIGNUP;

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          mode === "signup"
            ? { identifier, email, password, ...(displayName.trim() ? { displayName: displayName.trim() } : {}) }
            : { identifier, password },
        ),
      });

      const data = await safeJson(response);

      if (response.ok) {
        // A challenge means the password was right but the account still owes a
        // second factor (or a first-time address verification). No session yet.
        if (data?.challenge) {
          setChallenge(data.challenge);
          setChallengeKind(data.verificationRequired ? "verify" : "signin");
          setCode("");
          setMessage(
            data.emailSent === false
              ? `Error: ${data.emailError || "We could not send the code. Try again shortly."}`
              : "",
          );
          return;
        }
        if (mode === "login") {
          setMessage("Success: Signed in");
          if (data?.token) {
            localStorage.setItem("token", data.token);
            await refreshUser();
          }
          setTimeout(() => router.push("/home"), 800);
        } else {
          setShowSignupSuccess(true);
          setTimeout(() => {
            setShowSignupSuccess(false);
            setMode("login");
            setMessage("");
          }, 4000);
        }
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

      <main className="min-h-screen flex items-center justify-center p-6 z-10 py-12">
        <StaggerContainer className="w-full max-w-[540px] relative">
          {/* Structural Ghost Frame */}
          <div className="absolute inset-0 border-4 border-white/5 translate-x-3 translate-y-3 -z-10" />

          <FadeIn>
            <div className="bg-component-background border-4 border-white p-8 md:p-10 relative shadow-[16px_16px_0px_0px_rgba(82,185,70,0.1)] overflow-hidden min-h-[500px] flex flex-col justify-center">
              {showSignupSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center text-center space-y-8"
                >
                  <div className="w-20 h-20 border-4 border-white/10 border-t-primary rounded-full animate-spin" />
                  <div className="space-y-4">
                    <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-[0.2em]">Registration<br/>Successful</h2>
                    <p className="text-xs md:text-sm text-white/50 uppercase tracking-widest leading-relaxed">
                      Please hold while we finish setting up your account.<br/>
                      You will be redirected to sign in momentarily.
                    </p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => { setShowSignupSuccess(false); setMode("login"); setMessage(""); }} 
                    className="mt-4 text-[10px] font-black uppercase tracking-widest text-primary hover:text-white transition-colors underline"
                  >
                    Click here if you aren't redirected automatically
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full"
                >
                  {/* Header - Compact */}
                  <div className="flex justify-center mb-10">
                    <Image
                      src="/hpluslogo.png"
                      alt="Logo"
                      width={180}
                      height={70}
                      className="w-40 md:w-52 brightness-125"
                      priority
                    />
                  </div>

                  {/* Mode Switcher - Compact */}
                  <div className="flex mb-10 border-b-4 border-component-border">
                    <button
                      onClick={() => setMode("login")}
                      className={`flex-1 py-3 font-black text-sm uppercase tracking-[0.3em] transition-all relative ${
                        mode === "login" ? "text-primary" : "text-white/20 hover:text-white"
                      }`}
                    >
                      Sign In
                      {mode === "login" && (
                        <motion.div layoutId="authUnderline" className="absolute bottom-[-4px] left-0 w-full h-1 bg-primary" />
                      )}
                    </button>
                    <button
                      onClick={() => setMode("signup")}
                      className={`flex-1 py-3 font-black text-sm uppercase tracking-[0.3em] transition-all relative ${
                        mode === "signup" ? "text-primary" : "text-white/20 hover:text-white"
                      }`}
                    >
                      Sign Up
                      {mode === "signup" && (
                        <motion.div layoutId="authUnderline" className="absolute bottom-[-4px] left-0 w-full h-1 bg-primary" />
                      )}
                    </button>
                  </div>

              {/* One-time recovery codes. Shown after the first verification and
                  never again, so the flow stops here until acknowledged. */}
              {recoveryCodes && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-primary font-poppins">
                      Save your recovery codes
                    </h3>
                    <p className="text-xs text-white/50 mt-2 leading-relaxed">
                      Each code works once, in place of an emailed code. They are the only way
                      into your account if you lose access to your email. This is the one time
                      they are shown.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-4 border-white/10 p-4 font-mono text-sm text-white">
                    {recoveryCodes.map((rc) => (
                      <span key={rc}>{rc}</span>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(recoveryCodes.join("\n"))}
                      className="flex-1 h-12 border-4 border-white text-white font-black text-xs uppercase tracking-widest hover:border-primary hover:text-primary transition-colors"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/home")}
                      className="flex-1 h-12 bg-primary text-black font-black text-xs uppercase tracking-widest hover:brightness-90 transition-all"
                    >
                      I have saved them
                    </button>
                  </div>
                </div>
              )}

              {/* Step two: the emailed code. */}
              {!recoveryCodes && challenge && (
                <form onSubmit={usingRecovery ? submitRecovery : submitCode} className="space-y-6">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-white font-poppins">
                      {challengeKind === "verify" ? "Verify your email" : "Check your email"}
                    </h3>
                    <p className="text-xs text-white/50 mt-2 leading-relaxed">
                      {usingRecovery
                        ? "Enter one of the recovery codes you saved."
                        : challengeKind === "verify"
                          ? "We sent a 6-digit code to confirm your address. It expires in 15 minutes."
                          : "We sent a 6-digit code to your email. It expires in 10 minutes."}
                    </p>
                  </div>

                  {usingRecovery ? (
                    <input
                      type="text"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                      placeholder="XXXXX-XXXXX"
                      autoFocus
                      className="w-full h-14 bg-transparent border-4 border-white px-6 text-base text-white font-mono placeholder:text-white/10 focus:outline-none focus:border-primary transition-all"
                      required
                    />
                  ) : (
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      autoFocus
                      className="w-full h-16 bg-transparent border-4 border-white px-6 text-3xl tracking-[0.5em] text-center text-white font-mono placeholder:text-white/10 focus:outline-none focus:border-primary transition-all"
                      required
                    />
                  )}

                  {!usingRecovery && (
                    <label className="flex items-center gap-3 text-xs text-white/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberDevice}
                        onChange={(e) => setRememberDevice(e.target.checked)}
                        className="w-4 h-4 accent-[#52B946]"
                      />
                      Remember this browser for 30 days
                    </label>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full h-14 bg-primary text-black font-black text-sm uppercase tracking-[0.3em] hover:brightness-90 transition-all disabled:opacity-50"
                  >
                    {busy ? "Checking…" : "Continue"}
                  </button>

                  <div className="flex items-center justify-between text-[11px]">
                    <button type="button" onClick={cancelChallenge} className="text-white/40 hover:text-white transition-colors">
                      ← Back
                    </button>
                    <div className="flex gap-4">
                      {!usingRecovery && (
                        <button type="button" onClick={resendCode} disabled={busy} className="text-primary hover:underline disabled:opacity-40">
                          Resend code
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setUsingRecovery(!usingRecovery); setMessage(""); }}
                        className="text-white/40 hover:text-white transition-colors"
                      >
                        {usingRecovery ? "Use emailed code" : "Use a recovery code"}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {!recoveryCodes && !challenge && (
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="relative">
                  <span className="absolute -top-2.5 left-5 bg-component-background px-2 text-[10px] font-black text-primary uppercase tracking-widest z-20">
                    {mode === "signup" ? "Handle" : "Email or Username"}
                  </span>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={mode === "signup" ? "paul" : "Enter your email or username"}
                    aria-invalid={!!signupNameError}
                    className={`w-full h-14 bg-transparent border-4 px-6 text-base text-white placeholder:text-white/10 focus:outline-none transition-all font-poppins ${
                      signupNameError ? "border-[#FF4D4D] focus:border-[#FF4D4D]" : "border-white focus:border-primary"
                    }`}
                    required
                  />
                  {mode === "signup" && (
                    <p className={`mt-2 text-[11px] ${signupNameError ? "text-[#FF4D4D]" : "text-white/30"}`}>
                      {signupNameError || "Your @handle. Letters, numbers, dots, underscores and hyphens — no spaces."}
                    </p>
                  )}
                </div>

                {mode === "signup" && (
                  <div className="relative">
                    <span className="absolute -top-2.5 left-5 bg-component-background px-2 text-[10px] font-black text-primary uppercase tracking-widest z-20">
                      Display Name
                    </span>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Paul Scholes"
                      maxLength={50}
                      className="w-full h-14 bg-transparent border-4 border-white px-6 text-base text-white placeholder:text-white/10 focus:outline-none focus:border-primary transition-all font-poppins"
                    />
                    <p className="mt-2 text-[11px] text-white/30">
                      Optional. How your name appears to others — spaces are fine here.
                      Your @handle above is what people use to find you.
                    </p>
                  </div>
                )}

                {mode === "signup" && (
                  <div className="relative">
                    <span className="absolute -top-2.5 left-5 bg-component-background px-2 text-[10px] font-black text-primary uppercase tracking-widest z-20">
                      Email
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full h-14 bg-transparent border-4 border-white px-6 text-base text-white placeholder:text-white/10 focus:outline-none focus:border-primary transition-all font-poppins"
                      required
                    />
                    <p className="mt-2 text-[11px] text-white/30">
                      We send a code here to confirm it, and again whenever you sign in from a new browser.
                    </p>
                  </div>
                )}

                <div className="relative">
                  <span className="absolute -top-2.5 left-5 bg-component-background px-2 text-[10px] font-black text-primary uppercase tracking-widest z-20">
                    Password
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-14 bg-transparent border-4 border-white px-6 text-base text-white placeholder:text-white/10 focus:outline-none focus:border-primary transition-all font-poppins"
                    required
                  />
                </div>

                <AnimatePresence mode="wait">
                  {message && (
                    <motion.div 
                      key="message"
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-4 text-[10px] font-black uppercase tracking-widest border-l-4 ${
                        message.startsWith("Error") 
                          ? "border-red-500 bg-red-500/5 text-red-500" 
                          : "border-primary bg-primary/5 text-primary"
                      }`}
                    >
                      {message}
                      {message.includes("successfully signed up") && (
                        <div className="mt-2">
                          <button 
                            type="button" 
                            onClick={() => { setMode("login"); setMessage(""); }} 
                            className="underline text-white/50 hover:text-primary transition-colors cursor-pointer capitalize"
                          >
                            (Click this link if you aren't redirected)
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  className="w-full h-16 bg-primary text-black font-black text-base uppercase tracking-widest flex items-center justify-between px-8 hover:translate-x-1 transition-transform duration-300"
                >
                  <span>{mode === "login" ? "Sign In" : "Sign Up"}</span>
                  <span>→</span>
                </button>
              </form>
              )}

              {!recoveryCodes && !challenge && googleClientId && (
                <div className="mt-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-widest font-poppins">or</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <GoogleButton
                    clientId={googleClientId}
                    onCredential={signInWithGoogle}
                    text={mode === "signup" ? "signup_with" : "continue_with"}
                  />
                </div>
              )}

              <div className="mt-10 flex justify-center">
                <Link 
                  href="/" 
                  className="text-[9px] font-black text-white/40 hover:text-primary uppercase tracking-widest transition-colors font-poppins"
                >
                  ← BACK TO HOME
                </Link>
              </div>
            </motion.div>
            )}
            </div>
          </FadeIn>
        </StaggerContainer>
      </main>

      <Footer />
    </div>
  );
}