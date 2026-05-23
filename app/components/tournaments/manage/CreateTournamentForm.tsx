"use client";
import { useState, useEffect } from "react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../../utils/api";
import { TournamentFormatModel, TournamentTemplate } from "../../../tournaments/types";
import ImageUpload from "../../ui/ImageUpload";
import { useImageUpload } from "../../../utils/useImageUpload";

const inputCls = "w-full h-10 bg-[#1B1B1B] border border-white/20 px-3 text-sm text-white focus:outline-none focus:border-[#52B946] transition-colors rounded appearance-none placeholder:text-white/20";
const labelCls = "text-xs font-semibold text-[#888888] block mb-1";

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className={labelCls} style={{ marginBottom: 0 }}>{label}</label>
        {required && <span className="text-[10px] font-semibold text-[#FF4D4D]">Required</span>}
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
  const [activeStep, setActiveStep] = useState<"IDENTITY" | "RULES" | "DEPLOYMENT">("IDENTITY");

  // IDENTITY
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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

  // Placement points (awarded globally at tournament completion)
  const [placementChampion, setPlacementChampion] = useState(10);
  const [placement2nd, setPlacement2nd] = useState(7);
  const [placement3rd, setPlacement3rd] = useState(5);
  const [placementTopCut, setPlacementTopCut] = useState(3);
  const [placementParticipation, setPlacementParticipation] = useState(1);

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

  // FULL RULE ENGINE
  const [pointsThreshold, setPointsThreshold] = useState(0);
  const [startingHp, setStartingHp] = useState(0);
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
        setNameError("Identifier too short (min 3)");
      } else if (name.length > 60) {
        setNameError("Identifier too long (max 60)");
      } else if (isDuplicate) {
        setNameError("Identifier already registered");
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
    setPointsThreshold(c.pointsThreshold ?? 0);
    setStartingHp(c.startingHp ?? 0);
    if (fmt.system === "SWISS") {
      setSwissRounds(c.swissRounds ?? 3);
      setSwissPointsWin(c.swissPointsForWin ?? 3);
      setSwissPointsDraw(c.swissPointsForDraw ?? 1);
      setSwissPointsLoss(c.swissPointsForLoss ?? 0);
    }
    setPlacementChampion(c.placementPointsChampion ?? 10);
    setPlacement2nd(c.placementPoints2nd ?? 7);
    setPlacement3rd(c.placementPoints3rd ?? 5);
    setPlacementTopCut(c.placementPointsTopCut ?? 3);
    setPlacementParticipation(c.placementPointsParticipation ?? 1);
  };

  useEffect(() => {
    if (format !== "SWISS" && format !== "ROUND_ROBIN") {
      setAllowDraw(false);
    }
  }, [format]);

  const isIdentityValid = !!(name && !nameError && selectedFormatId && maxPlayers >= 2 && !isValidatingName);
  const isRulesValid = !!(bestOf >= 1);
  const isDeploymentValid = !!(startNow || date);
  const allStepsVisited = visitedSteps.size >= 3;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (activeStep !== "DEPLOYMENT" || isSubmitting || !allStepsVisited || showSuccess) return;

    setIsSubmitting(true);
    const finalDate = date ? (startTime ? `${date}T${startTime}` : `${date}T00:00:00`) : null;

    const body = {
      name, 
      description: description || undefined,
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

  const renderIdentity = () => (
    <div className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-white border-b border-white/10 pb-2">Format Selection</h3>
        
        {/* Mobile Dropdown */}
        <div className="sm:hidden">
          <select 
            className={inputCls}
            value={selectedFormatId}
            onChange={(e) => {
              const fmt = formats.find(f => f.id === e.target.value);
              if (fmt) applyFormat(fmt);
            }}
          >
            <option value="" disabled className="bg-[#1B1B1B]">Select a format...</option>
            {formats.map(fmt => (
              <option key={fmt.id} value={fmt.id} className="bg-[#1B1B1B]">
                {fmt.name} ({fmt.gameName || "General"})
              </option>
            ))}
          </select>
        </div>

        {/* Desktop Grid */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {formats.map((fmt) => (
            <button
              key={fmt.id}
              type="button"
              onClick={() => applyFormat(fmt)}
              className={`p-4 border transition-colors rounded text-left ${
                selectedFormatId === fmt.id 
                  ? "bg-[#52B946]/10 border-[#52B946]" 
                  : "bg-[#1B1B1B] border-white/10 hover:border-white/30"
              }`}
            >
              <div className="flex flex-col">
                <span className={`text-sm font-semibold ${selectedFormatId === fmt.id ? "text-[#52B946]" : "text-white"}`}>{fmt.name}</span>
                <span className="text-xs text-[#888888] mt-1">{fmt.gameName || "General"}</span>
              </div>
            </button>
          ))}
        </div>
        {!selectedFormatId && (
          <div className="hidden sm:flex h-24 items-center justify-center border border-dashed border-white/20 rounded">
            <span className="text-sm text-[#888888]">Select a format to continue</span>
          </div>
        )}
      </div>

      {selectedFormatId && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white border-b border-white/10 pb-2">Event Specification</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Field label="Tournament Title" required>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Pro League Season 1" 
                  className={`${inputCls} ${nameError ? "border-[#FF4D4D]" : ""}`} 
                  required 
                />
              </Field>
              {nameError && <span className="text-xs text-[#FF4D4D]">{nameError}</span>}
            </div>
            <Field label="Maximum Participants" required>
              <input type="number" value={maxPlayers} onChange={e => setMaxPlayers(Number(e.target.value))} className={inputCls} required />
            </Field>
          </div>
          <div className="pt-2">
            <Field label="Description">
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Optional tournament details or lore" 
                className={`${inputCls} h-24 py-3 resize-none`} 
              />
            </Field>
          </div>
          <div className="pt-2">
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
                label="Select Banner Image"
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );

  const renderRules = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <h3 className="text-sm font-semibold text-white">Match &amp; Scoring Rules</h3>
        <span className="px-2 py-1 bg-[#1B1B1B] text-[#888888] text-xs font-semibold rounded capitalize">
          {format.replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-[#888888]">Scoring Parameters</h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={pointsThreshold > 0} 
                  onChange={e => setPointsThreshold(e.target.checked ? 1 : 0)} 
                  className="w-4 h-4 cursor-pointer accent-[#52B946]" 
                />
                <span className="text-sm text-white">Enable Victory Threshold</span>
              </label>
              {pointsThreshold > 0 && (
                <input type="number" value={pointsThreshold} onChange={e => setPointsThreshold(Math.max(1, Number(e.target.value)))} min={1} className={inputCls} />
              )}
            </div>
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={startingHp > 0} 
                  onChange={e => setStartingHp(e.target.checked ? 100 : 0)} 
                  className="w-4 h-4 cursor-pointer accent-[#52B946]" 
                />
                <span className="text-sm text-white">HP-Based Match System</span>
              </label>
              {startingHp > 0 && (
                <input type="number" value={startingHp} onChange={e => setStartingHp(Math.max(1, Number(e.target.value)))} min={1} className={inputCls} />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-[#888888]">Match Structure</h4>
          <div className="space-y-4">
            <Field label="Best Of">
              <input 
                type="number" 
                value={bestOf} 
                onChange={e => {
                  const val = Number(e.target.value);
                  if (val < 1) setBestOf(1);
                  else if (val % 2 === 0) setBestOf(val + 1);
                  else setBestOf(val);
                }} 
                min={1} 
                step={2}
                className={inputCls} 
              />
            </Field>
            {(format === "SWISS" || format === "ROUND_ROBIN") && (
              <Field label="Allow Draws">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAllowDraw(false)}
                    className={`flex-1 h-10 text-xs font-semibold transition-colors rounded border ${
                      !allowDraw ? "bg-[#52B946]/10 border-[#52B946] text-[#52B946]" : "bg-[#1B1B1B] border-white/20 text-[#888888] hover:text-white"
                    }`}
                  >
                    Force Win
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowDraw(true)}
                    className={`flex-1 h-10 text-xs font-semibold transition-colors rounded border ${
                      allowDraw ? "bg-[#52B946]/10 border-[#52B946] text-[#52B946]" : "bg-[#1B1B1B] border-white/20 text-[#888888] hover:text-white"
                    }`}
                  >
                    Permit Draws
                  </button>
                </div>
              </Field>
            )}
          </div>
        </div>
      </div>

      {format === "SWISS" && (
        <div className="pt-6 border-t border-white/10">
          <h4 className="text-xs font-semibold text-[#888888] mb-4">Swiss System Configuration</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Scheduled Rounds">
              <input type="number" value={swissRounds} onChange={e => setSwissRounds(Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Points / Win">
              <input type="number" value={swissPointsWin} onChange={e => setSwissPointsWin(Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Points / Draw">
              <input type="number" value={swissPointsDraw} onChange={e => setSwissPointsDraw(Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Points / Loss">
              <input type="number" value={swissPointsLoss} onChange={e => setSwissPointsLoss(Number(e.target.value))} className={inputCls} />
            </Field>
          </div>
        </div>
      )}

      {/* Placement Points */}
      <div className="pt-6 border-t border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-semibold text-[#888888]">Placement Points</h4>
          <span className="text-[10px] text-[#888888]/60 uppercase tracking-wider">Awarded at tournament completion</span>
        </div>
        <div className={`grid gap-4 ${format === "HYBRID" ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-4"}`}>
          <Field label="Champion">
            <input type="number" value={placementChampion} onChange={e => setPlacementChampion(Number(e.target.value))} min={0} className={inputCls} />
          </Field>
          <Field label="1st Runner-Up">
            <input type="number" value={placement2nd} onChange={e => setPlacement2nd(Number(e.target.value))} min={0} className={inputCls} />
          </Field>
          <Field label="2nd Runner-Up">
            <input type="number" value={placement3rd} onChange={e => setPlacement3rd(Number(e.target.value))} min={0} className={inputCls} />
          </Field>
          {format === "HYBRID" && (
            <Field label="Top Cut">
              <input type="number" value={placementTopCut} onChange={e => setPlacementTopCut(Number(e.target.value))} min={0} className={inputCls} />
            </Field>
          )}
          <Field label="Participation">
            <input type="number" value={placementParticipation} onChange={e => setPlacementParticipation(Number(e.target.value))} min={0} className={inputCls} />
          </Field>
        </div>
      </div>
    </div>
  );

  const renderDeployment = () => (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white border-b border-white/10 pb-2">Schedule & Accessibility</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Venue">
          <input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="Physical / Online" className={inputCls} />
        </Field>
        <Field label="Activation Mode">
          <select value={startNow ? "IMMEDIATE" : "SCHEDULED"} onChange={e => setStartNow(e.target.value === "IMMEDIATE")} className={inputCls}>
            <option value="SCHEDULED">Scheduled Release</option>
            <option value="IMMEDIATE">Instant Activation</option>
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
            <option value="PUBLIC">Public Access</option>
            <option value="PRIVATE">Private Invite</option>
          </select>
        </Field>
      </div>
    </div>
  );

  const renderActions = () => (
    <div className="pt-6 mt-6 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/10">
      <button 
        type="button" 
        onClick={onDiscard} 
        className="w-full md:w-auto px-4 py-2 text-sm font-semibold text-[#888888] hover:text-[#FF4D4D] transition-colors order-2 md:order-1"
      >
        Discard Changes
      </button>
      
      <div className="flex w-full md:w-auto gap-2 order-1 md:order-2">
        {activeStep !== "IDENTITY" && (
          <button 
            type="button" 
            onClick={() => setActiveStep(activeStep === "DEPLOYMENT" ? "RULES" : "IDENTITY")}
            className="flex-1 md:flex-none px-6 py-2.5 bg-[#1B1B1B] text-white font-semibold text-sm rounded hover:bg-white/10 transition-colors"
          >
            Back
          </button>
        )}
        
        {activeStep !== "DEPLOYMENT" ? (
          <button 
            type="button" 
            onClick={() => setActiveStep(activeStep === "IDENTITY" ? "RULES" : "DEPLOYMENT")}
            disabled={(activeStep === "IDENTITY" && !isIdentityValid) || (activeStep === "RULES" && !isRulesValid)}
            className="flex-1 md:flex-none px-8 py-2.5 bg-[#52B946] text-black font-semibold text-sm rounded hover:brightness-90 transition-colors disabled:opacity-50 disabled:grayscale"
          >
            Proceed
          </button>
        ) : (
          <div className="flex flex-col md:items-end w-full md:w-auto">
            <button 
              type="button" 
              onClick={handleSubmit}
              disabled={!isIdentityValid || !isRulesValid || !isDeploymentValid || uploading || !allStepsVisited}
              className="w-full md:w-auto px-8 py-2.5 bg-[#52B946] text-black font-semibold text-sm rounded hover:brightness-90 transition-colors disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
            >
              {uploading || isSubmitting ? "Finalizing..." : "Create Tournament"}
            </button>
            {!allStepsVisited && (
              <span className="text-xs text-[#FFCC00] mt-1 text-center w-full md:text-right">Review all sections first</span>
            )}
          </div>
        )}
       </div>
    </div>
  );

  const steps = [
    { id: "IDENTITY", label: "01. Identity", valid: isIdentityValid },
    { id: "RULES", label: "02. Rules", valid: isRulesValid },
    { id: "DEPLOYMENT", label: "03. Schedule", valid: isDeploymentValid }
  ] as const;

  if (showSuccess) {
    return (
      <div className="bg-[#000000] border border-white/20 p-12 rounded flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-[#52B946]/10 text-[#52B946] border border-[#52B946]/20 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Tournament Initiated</h2>
        <p className="text-sm text-[#888888]">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <>
      {/* MOBILE VIEW */}
      <div className="md:hidden space-y-4">
        <div className="flex bg-[#1B1B1B] border border-white/20 rounded overflow-hidden">
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStep(step.id as any)}
              className={`flex-1 py-3 text-xs font-semibold text-center border-r border-white/10 last:border-0 transition-colors ${
                activeStep === step.id ? "bg-[#52B946]/10 text-[#52B946] border-b-2 border-b-[#52B946]" : "text-[#888888] hover:bg-white/5"
              }`}
            >
              {step.label.split(". ")[1]}
            </button>
          ))}
        </div>
        
        <div className="bg-[#000000] border border-white/20 p-4 rounded">
          {activeStep === "IDENTITY" && renderIdentity()}
          {activeStep === "RULES" && renderRules()}
          {activeStep === "DEPLOYMENT" && renderDeployment()}
          {renderActions()}
        </div>
      </div>

      {/* DESKTOP VIEW */}
      <div className="hidden md:flex gap-8">
        <aside className="w-48 shrink-0 space-y-2">
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStep(step.id as any)}
              className={`w-full flex items-center gap-3 p-3 rounded text-left transition-colors ${
                activeStep === step.id ? "bg-[#1B1B1B] border border-white/20" : "hover:bg-[#1B1B1B]/50 border border-transparent"
              }`}
            >
              <div className={`w-3 h-3 rounded-full border transition-colors ${
                step.valid && activeStep !== step.id ? "bg-[#52B946] border-[#52B946]" :
                activeStep === step.id ? "bg-white border-white" : "border-[#888888]"
              }`} />
              <div className="flex flex-col">
                <span className={`text-sm font-semibold transition-colors ${
                  activeStep === step.id ? "text-white" : "text-[#888888]"
                }`}>
                  {step.label}
                </span>
              </div>
            </button>
          ))}
        </aside>

        <div className="flex-1 bg-[#000000] border border-white/20 p-8 rounded min-w-0">
          {activeStep === "IDENTITY" && renderIdentity()}
          {activeStep === "RULES" && renderRules()}
          {activeStep === "DEPLOYMENT" && renderDeployment()}
          {renderActions()}
        </div>
      </div>
    </>
  );
}
