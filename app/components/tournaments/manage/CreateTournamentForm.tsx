"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../../utils/api";
import { TournamentFormatModel, TournamentTemplate } from "../../../tournaments/types";
import ImageUpload from "../../ui/ImageUpload";
import { useImageUpload } from "../../../utils/useImageUpload";

const inputCls = "w-full h-11 bg-[#1B1B1B] border border-white/10 px-4 text-sm text-white focus:outline-none focus:border-primary transition-all rounded-[4px] appearance-none placeholder:text-white/10";

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between ml-0.5">
        <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest">{label}</label>
        {required && <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em] opacity-50">(REQUIRED)</span>}
      </div>
      {children}
    </div>
  );
}

interface Props {
  userId: string;
  userRoles?: string[];
  onSuccess: (message: string) => void;
  onDiscard: () => void;
}

export default function CreateTournamentForm({ userId, userRoles = [], onSuccess, onDiscard }: Props) {
  const isAdmin = userRoles.includes("ADMIN");
  const [activeStep, setActiveStep] = useState<"IDENTITY" | "RULES" | "DEPLOYMENT">("IDENTITY");

  // IDENTITY
  const [name, setName] = useState("");
  const [format, setFormat] = useState("SINGLE_ELIMINATION");
  const [maxPlayers, setMaxPlayers] = useState(16);
  const [formats, setFormats] = useState<TournamentFormatModel[]>([]);
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [selectedFormatId, setSelectedFormatId] = useState("");

  // RULES
  const [bestOf, setBestOf] = useState(1);
  const [allowDraw, setAllowDraw] = useState(false);
  const [prizePool, setPrizePool] = useState<number | "">("");
  const [swissRounds, setSwissRounds] = useState(3);
  const [swissPointsWin, setSwissPointsWin] = useState(3);
  const [swissPointsDraw, setSwissPointsDraw] = useState(1);
  const [swissPointsLoss, setSwissPointsLoss] = useState(0);

  // DEPLOYMENT
  const [venue, setVenue] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [startNow, setStartNow] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [visitedSteps, setVisitedSteps] = useState<Set<string>>(new Set(["IDENTITY"]));
  const [nameError, setNameError] = useState<string | null>(null);
  const [isValidatingName, setIsValidatingName] = useState(false);

  // IMAGE HANDLING
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const { upload, uploading } = useImageUpload();

  // FULL RULE ENGINE STATE
  const [templates, setTemplates] = useState<TournamentTemplate[]>([]);
  const [winsToAdvance, setWinsToAdvance] = useState(1);
  const [sessionsCount, setSessionsCount] = useState(1);
  const [pointsPerSession, setPointsPerSession] = useState(0);
  const [pointsThreshold, setPointsThreshold] = useState(0);
  const [tieBreakerOrder, setTieBreakerOrder] = useState<string[]>([]);
  const [progressionType, setProgressionType] = useState("");
  const [gameName, setGameName] = useState("");

  useEffect(() => {
    setVisitedSteps(prev => new Set(prev).add(activeStep));
  }, [activeStep]);

  useEffect(() => {
    if (!name) {
      setNameError(null);
      return;
    }

    setIsValidatingName(true);
    const timer = setTimeout(() => {
      const normalizedName = name.trim().toLowerCase();
      const isDuplicate = existingNames.some(n => n.toLowerCase() === normalizedName);

      if (name.length < 3) {
        setNameError("IDENTIFIER TOO SHORT (MIN 3 CHARS)");
      } else if (name.length > 60) {
        setNameError("IDENTIFIER TOO LONG (MAX 60 CHARS)");
      } else if (isDuplicate) {
        setNameError("IDENTIFIER ALREADY REGISTERED");
      } else {
        setNameError(null);
      }
      setIsValidatingName(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [name, existingNames]);

  useEffect(() => {
    const loadInitialData = async () => {
      const [formatsRes, tournamentsRes] = await Promise.all([
        authenticatedFetch(API_ENDPOINTS.PRESETS.BASE),
        authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.BASE),
      ]);
 
      if (formatsRes.ok) {
        const data = await safeJson(formatsRes);
        setFormats(data ?? []);
      }
      if (tournamentsRes.ok) {
        const data = await safeJson(tournamentsRes);
        setExistingNames(data?.map((t: any) => t.name) ?? []);
      }
    };
    loadInitialData();
  }, []);

  const applyFormat = (fmt: TournamentFormatModel) => {
    setSelectedFormatId(fmt.id);
    setGameName(fmt.gameName || "");
    const c = fmt.config;
    setFormat(fmt.system);
    setBestOf(c.bestOf ?? 1);
    setAllowDraw(c.allowDraw ?? false);
    setWinsToAdvance(c.winsToAdvance ?? 1);
    setSessionsCount(c.sessionsCount ?? 1);
    setPointsPerSession(c.pointsPerSession ?? 0);
    setPointsThreshold(c.pointsThreshold ?? 0);
    if (fmt.system === "SWISS") {
      setSwissRounds(c.swissRounds ?? 3);
      setSwissPointsWin(c.swissPointsForWin ?? 3);
      setSwissPointsDraw(c.swissPointsForDraw ?? 1);
      setSwissPointsLoss(c.swissPointsForLoss ?? 0);
    }
  };


  // Validation Checkers
  const isIdentityValid = !!(name && !nameError && selectedFormatId && maxPlayers >= 2 && !isValidatingName);
  const isRulesValid = !!(bestOf >= 1);
  const isDeploymentValid = !!(startNow || date);
  const allStepsVisited = visitedSteps.size >= 3;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Safety: prevent submission unless on the final step, already submitting, or haven't seen all steps
    if (activeStep !== "DEPLOYMENT" || isSubmitting || !allStepsVisited || showSuccess) return;

    setIsSubmitting(true);
    const finalDate = date ? (startTime ? `${date}T${startTime}` : `${date}T00:00:00`) : null;

    const body = {
      name, 
      formatId: selectedFormatId, 
      maxPlayers: Number(maxPlayers),
      prizePool: prizePool === "" ? null : Number(prizePool),
      venue, 
      date: finalDate, 
      isPrivate, 
      startNow,
      createdById: userId,
    };

    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.CREATE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await safeJson(res);
        const tournamentId = data.id;

        if (bannerFile && tournamentId) {
          await upload(API_ENDPOINTS.IMAGES.UPLOAD_BANNER(tournamentId), bannerFile);
        }

        // SHOW SUCCESS ANIMATION
        setShowSuccess(true);
        setTimeout(() => {
          onSuccess("Tournament Created Successfully");
        }, 2000);
      } else {
        const data = await safeJson(res);
        onSuccess(`Error: ${data?.message || "Failed to create"}`);
      }
    } catch (err) {
      onSuccess("Error: Connection failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { 
      id: "IDENTITY", 
      label: "01. IDENTITY", 
      // Only validated if valid AND we've moved past it
      valid: isIdentityValid && (activeStep === "RULES" || activeStep === "DEPLOYMENT")
    },
    { 
      id: "RULES", 
      label: "02. RULES", 
      // Only validated if valid AND we've moved past it
      valid: isRulesValid && activeStep === "DEPLOYMENT"
    },
    { 
      id: "DEPLOYMENT", 
      label: "03. SCHEDULE", 
      // Validated if we are on it and it's valid
      valid: isDeploymentValid && activeStep === "DEPLOYMENT"
    },
  ] as const;

  return (
    <div className="flex gap-24 min-h-[600px] -ml-2">
      {/* AUTHENTIC PROCESS SIDEBAR */}
      <aside className="w-48 flex flex-col pt-4 shrink-0">
        <div className="relative flex flex-col gap-16">
          {/* Connecting Track */}
          <div className="absolute left-[7px] top-2 bottom-2 w-[1px] bg-white/5" />
          
          {steps.map((step) => {
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className="group relative flex items-start gap-6 text-left transition-all"
              >
                {/* Dot Indicator */}
                <div className={`mt-1.5 w-4 h-4 rounded-full border-2 z-10 transition-all duration-500 shadow-lg ${
                  step.valid 
                    ? "bg-primary border-primary shadow-primary/20 scale-110" 
                    : activeStep === step.id
                      ? "bg-white border-white shadow-white/20 scale-110"
                      : "bg-[#1B1B1B] border-white/10"
                }`} />

                <div className="flex flex-col gap-1">
                  <span className={`text-[8px] font-black tracking-[0.4em] transition-all ${
                    step.valid ? "text-primary" : "text-white/20"
                  }`}>
                    {step.valid ? "VALIDATED" : "PENDING"}
                  </span>
                  <span className={`text-xs font-bold uppercase tracking-widest transition-all ${
                    activeStep === step.id ? "text-white" : "text-white/40 group-hover:text-white/60"
                  }`}>
                    {step.label.split(". ")[1]}
                  </span>
                </div>

                {/* Active Highlight Glow */}
                {activeStep === step.id && (
                  <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-24 h-24 bg-primary/5 rounded-full blur-3xl -z-10" />
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* CONFIGURATION AREA */}
      <div className="flex-1 flex flex-col gap-8 min-w-0">
        {/* Main Operational Block */}
        <div className="flex-1 bg-[#1B1B1B]/40 border border-white/5 p-12 rounded-[4px] relative overflow-hidden flex flex-col">
          {/* Technical Corner Greebles */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-white/10" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-white/10" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-white/10" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-white/10" />

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
            <div className="flex-1">
              <AnimatePresence mode="wait">
                {showSuccess ? (
                  <motion.div 
                    key="success"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 z-50 bg-[#1B1B1B] flex flex-col items-center justify-center text-center p-12"
                  >
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", damping: 15 }}
                      className="relative"
                    >
                      <div className="w-24 h-24 border-4 border-primary rounded-full flex items-center justify-center mb-8 relative">
                        <motion.div 
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          className="text-primary text-4xl font-black"
                        >
                          ✓
                        </motion.div>
                        <div className="absolute inset-0 rounded-full border-4 border-primary animate-ping opacity-20" />
                      </div>
                    </motion.div>
                    
                    <h2 className="text-2xl font-black text-white uppercase tracking-[0.4em] mb-4">Tournament Initiated</h2>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-[0.6em] animate-pulse">Syncing with deployment nodes...</p>
                    
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      <motion.div 
                        initial={{ top: "-100%" }}
                        animate={{ top: "100%" }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        className="absolute left-0 right-0 h-[2px] bg-primary/20 shadow-[0_0_15px_rgba(82,185,70,0.5)]"
                      />
                    </div>
                  </motion.div>
                ) : activeStep === "IDENTITY" && (
                  <motion.section 
                    key="identity"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-12"
                  >
                    {/* Row 1: Select Format Template */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <h3 className="text-[11px] font-bold text-white uppercase tracking-widest">Tournament Format Selection</h3>
                        <div className="h-[1px] flex-1 bg-white/5" />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {formats.map((fmt) => (
                          <button
                            key={fmt.id}
                            type="button"
                            onClick={() => applyFormat(fmt)}
                            className={`p-6 border transition-all rounded-[4px] text-left relative overflow-hidden group ${
                              selectedFormatId === fmt.id 
                                ? "bg-primary/10 border-primary shadow-lg shadow-primary/5" 
                                : "bg-[#1B1B1B]/40 border-white/5 hover:border-white/10"
                            }`}
                          >
                            <div className="flex flex-col gap-1">
                              <span className={`text-[10px] font-black uppercase tracking-tighter ${
                                selectedFormatId === fmt.id ? "text-primary" : "text-white"
                              }`}>{fmt.name}</span>
                              <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest">{fmt.gameName || "GENERAL"}</span>
                            </div>
                            
                            {selectedFormatId === fmt.id && (
                              <div className="absolute top-0 right-0 p-2">
                                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
 
                    {!selectedFormatId ? (
                      <div className="h-48 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-[4px]">
                        <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] animate-pulse text-center">
                          Select a base format configuration<br/>to continue initialization sequence
                        </div>
                      </div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-12 animate-in fade-in duration-700"
                      >
                         <div className="space-y-6">
                            <div className="flex items-center gap-4">
                              <h3 className="text-[11px] font-bold text-white uppercase tracking-widest">Event Specification</h3>
                              <div className="h-[1px] flex-1 bg-white/5" />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <Field label="Tournament Title" required>
                                  <input 
                                    type="text" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    placeholder="PRO LEAGUE SEASON 1" 
                                    className={`${inputCls} ${nameError ? "border-red-500/50" : ""}`} 
                                    required 
                                  />
                                </Field>
                                <AnimatePresence>
                                  {nameError && (
                                    <motion.div 
                                      key="name-error"
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="text-[9px] font-black text-red-500 uppercase tracking-widest pl-1"
                                    >
                                      {nameError}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                              <Field label="Maximum Participants" required>
                                <input type="number" value={maxPlayers} onChange={e => setMaxPlayers(Number(e.target.value))} className={inputCls} required />
                              </Field>
                             </div>

                             <div className="pt-6 border-t border-white/5">
                               <Field label="Tournament Banner">
                                 <ImageUpload 
                                   currentUrl={bannerPreview} 
                                   onUpload={async (file) => {
                                     setBannerFile(file);
                                     setBannerPreview(URL.createObjectURL(file));
                                   }}
                                   onDelete={() => {
                                     setBannerFile(null);
                                     setBannerPreview(null);
                                   }}
                                   uploading={uploading}
                                   aspectRatio="aspect-[21/9]"
                                   label="SELECT BANNER IMAGE"
                                 />
                               </Field>
                             </div>
                          </div>
                        </motion.div>
                     )}
                   </motion.section>
                 )}

              {activeStep === "RULES" && (
                <motion.section
                  key="rules"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <h3 className="text-[11px] font-bold text-white uppercase tracking-widest">Match &amp; Scoring Rules</h3>
                      <div className="h-[1px] flex-1 bg-white/5" />
                    </div>
                    
                    {/* Template Selector — available to all */}
                    <div className="flex items-center gap-3">
                      <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Active System:</span>
                      <div className="bg-white/5 border border-white/10 text-[9px] font-black text-primary uppercase px-4 py-2 rounded-[4px] tracking-widest">
                        {format.replace(/_/g, " ")}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                    <div className="space-y-6">
                      <div className="text-[9px] font-black text-white/10 uppercase tracking-[0.2em] mb-2">Match Structure</div>
                      <div className="grid grid-cols-1 gap-6">
                        <Field label="Series Format (Best of X)">
                          <input type="number" value={bestOf} onChange={e => setBestOf(Number(e.target.value))} min={1} className={inputCls} />
                        </Field>
                        <Field label="Wins Required to Advance">
                          <input type="number" value={winsToAdvance} onChange={e => setWinsToAdvance(Number(e.target.value))} min={1} className={inputCls} />
                        </Field>
                        <Field label="Allow Draws">
                          <select value={allowDraw ? "YES" : "NO"} onChange={e => setAllowDraw(e.target.value === "YES")} className={inputCls}>
                            <option value="NO" className="bg-[#1B1B1B] text-white">NO (FORCE WIN)</option>
                            <option value="YES" className="bg-[#1B1B1B] text-white">YES (PERMIT DRAW)</option>
                          </select>
                        </Field>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="text-[9px] font-black text-white/10 uppercase tracking-[0.2em] mb-2">Scoring Parameters</div>
                      <div className="grid grid-cols-1 gap-6">
                        <Field label="Sessions per Match">
                          <input type="number" value={sessionsCount} onChange={e => setSessionsCount(Number(e.target.value))} min={1} className={inputCls} />
                        </Field>
                        <Field label="Points per Session">
                          <input type="number" value={pointsPerSession} onChange={e => setPointsPerSession(Number(e.target.value))} min={0} className={inputCls} />
                        </Field>
                        <Field label="Victory Threshold">
                          <input type="number" value={pointsThreshold} onChange={e => setPointsThreshold(Number(e.target.value))} min={0} className={inputCls} />
                        </Field>
                      </div>
                    </div>
                  </div>

                  {format === "SWISS" && (
                    <div className="pt-8 border-t border-white/5 animate-in slide-in-from-bottom-2 duration-500">
                      <div className="text-[9px] font-black text-primary/40 uppercase tracking-[0.2em] mb-6">Swiss System Configuration</div>
                      <div className="grid grid-cols-4 gap-6">
                        <Field label="Scheduled Rounds">
                          <input type="number" value={swissRounds} onChange={e => setSwissRounds(Number(e.target.value))} className={inputCls} />
                        </Field>
                        <Field label="Points per Win">
                          <input type="number" value={swissPointsWin} onChange={e => setSwissPointsWin(Number(e.target.value))} className={inputCls} />
                        </Field>
                        <Field label="Points per Draw">
                          <input type="number" value={swissPointsDraw} onChange={e => setSwissPointsDraw(Number(e.target.value))} className={inputCls} />
                        </Field>
                        <Field label="Points per Loss">
                          <input type="number" value={swissPointsLoss} onChange={e => setSwissPointsLoss(Number(e.target.value))} className={inputCls} />
                        </Field>
                      </div>
                    </div>
                  )}

                  {/* Save Preset removed - moved to dedicated Admin page */}
                </motion.section>
              )}

              {activeStep === "DEPLOYMENT" && (
                <motion.section 
                  key="deployment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-4">
                    <h3 className="text-[11px] font-bold text-white uppercase tracking-widest">Schedule & Accessibility</h3>
                    <div className="h-[1px] flex-1 bg-white/5" />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <Field label="Venue">
                      <input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="Physical / Online" className={inputCls} />
                    </Field>
                    <Field label="Activation Mode">
                      <select value={startNow ? "IMMEDIATE" : "SCHEDULED"} onChange={e => setStartNow(e.target.value === "IMMEDIATE")} className={inputCls}>
                        <option value="SCHEDULED" className="bg-[#1B1B1B] text-white">Scheduled Release</option>
                        <option value="IMMEDIATE" className="bg-[#1B1B1B] text-white">Instant Activation</option>
                      </select>
                    </Field>
                    {!startNow && (
                      <>
                        <Field label="Date">
                          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
                        </Field>
                        <Field label="Time">
                          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputCls} />
                        </Field>
                      </>
                    )}
                    <Field label="Privacy Level">
                      <select value={isPrivate ? "PRIVATE" : "PUBLIC"} onChange={e => setIsPrivate(e.target.value === "PRIVATE")} className={inputCls}>
                        <option value="PUBLIC" className="bg-[#1B1B1B]">Public Access</option>
                        <option value="PRIVATE" className="bg-[#1B1B1B]">Private Invite</option>
                      </select>
                    </Field>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>

          {/* STEPPER ACTIONS */}
          <div className="pt-10 flex items-center justify-between border-t border-white/5">
            <button 
              type="button" 
              onClick={onDiscard} 
              className="text-[10px] font-black text-white/20 hover:text-white uppercase tracking-[0.3em] transition-all"
            >
              Discard Changes
            </button>
            
            <div className="flex gap-4">
              {activeStep !== "IDENTITY" && (
                <button 
                  type="button" 
                  onClick={() => {
                    if (activeStep === "DEPLOYMENT") {
                      setActiveStep("RULES");
                    } else {
                      setActiveStep("IDENTITY");
                    }
                  }}
                  className="px-8 py-3 bg-white/5 text-white/40 font-bold text-[10px] uppercase tracking-widest rounded-[4px] hover:bg-white/10"
                >
                  Back
                </button>
              )}
              
              {activeStep !== "DEPLOYMENT" ? (
                <button 
                  type="button" 
                  onClick={() => {
                    const nextStep = activeStep === "IDENTITY" ? "RULES" : "DEPLOYMENT";
                    setActiveStep(nextStep);
                  }}
                  disabled={
                    (activeStep === "IDENTITY" && !isIdentityValid) ||
                    (activeStep === "RULES" && !isRulesValid)
                  }
                  className="group relative px-10 py-3 bg-primary text-black font-black text-[10px] uppercase tracking-widest rounded-[4px] hover:brightness-110 transition-all disabled:opacity-20 disabled:grayscale overflow-hidden"
                >
                  <motion.span 
                    initial={false}
                    animate={{ x: 0 }}
                    whileTap={{ x: 5 }}
                    className="relative z-10"
                  >
                    Proceed
                  </motion.span>
                  <motion.div 
                    className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" 
                  />
                </button>
              ) : (
                <div className="flex flex-col items-end gap-3">
                  {!allStepsVisited && (
                    <span className="text-[9px] font-black text-white/20 uppercase tracking-widest animate-pulse">
                      Review all sections to finalize
                    </span>
                  )}
                  <button 
                    type="submit" 
                    disabled={!isIdentityValid || !isRulesValid || !isDeploymentValid || uploading || !allStepsVisited}
                    className="px-10 py-3 bg-primary text-black font-black text-[10px] uppercase tracking-widest rounded-[4px] hover:brightness-110 transition-all disabled:opacity-20 disabled:grayscale flex items-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <div className="w-3 h-3 border-2 border-black/30 border-t-black animate-spin rounded-full" />
                        FINALIZING...
                      </>
                    ) : "Create Tournament"}
                  </button>
                </div>
              )}
             </div>
           </div>
         </form>
       </div>
     </div>
  </div>
  );
}
