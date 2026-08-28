"use client";
import { useState, useEffect } from "react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../../utils/api";
import { TournamentFormatModel, TournamentTemplate, Game } from "../../../tournaments/types";
import ImageUpload from "../../ui/ImageUpload";
import { useImageUpload } from "../../../utils/useImageUpload";

const inputCls = "w-full h-10 bg-background border border-white/20 px-3 text-sm text-white focus:outline-none focus:border-primary transition-colors rounded appearance-none placeholder:text-white/20";
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
  const [activeStep, setActiveStep] = useState<"IDENTITY" | "RULES" | "SCHEDULE">("IDENTITY");

  // IDENTITY
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState("SINGLE_ELIMINATION");
  const [maxPlayers, setMaxPlayers] = useState(16);
  const [formats, setFormats] = useState<TournamentFormatModel[]>([]);
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [selectedFormatId, setSelectedFormatId] = useState("");

  // GAME — chosen on the tournament, independent of the format. The format may
  // pre-fill it, but the tournament's choice wins (todo.md §5). Defaults to the
  // built-in "General" so every tournament always has a game.
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestMsg, setRequestMsg] = useState<string | null>(null);

  // RULES
  const [bestOf, setBestOf] = useState(1);
  const [allowDraw, setAllowDraw] = useState(false);
  // Inherited from the chosen format preset, overridable per tournament.
  const [seedingMode, setSeedingMode] = useState<"RANDOM" | "MANUAL">("RANDOM");
  const [prizePool, setPrizePool] = useState<number | "">("");
  const [swissRounds, setSwissRounds] = useState(3);
  const [swissPointsWin, setSwissPointsWin] = useState(3);
  const [swissPointsDraw, setSwissPointsDraw] = useState(1);
  const [swissPointsLoss, setSwissPointsLoss] = useState(0);
  const [topCutSize, setTopCutSize] = useState(8);

  // Placement points (awarded globally at tournament completion)
  const [placementChampion, setPlacementChampion] = useState(10);
  const [placement2nd, setPlacement2nd] = useState(7);
  const [placement3rd, setPlacement3rd] = useState(5);
  const [placementTopCut, setPlacementTopCut] = useState(3);
  const [placementParticipation, setPlacementParticipation] = useState(1);

  // SCHEDULE
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
      const [formatsRes, tournamentsRes, gamesRes] = await Promise.all([
        authenticatedFetch(API_ENDPOINTS.PRESETS.BASE),
        authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.BASE),
        authenticatedFetch(API_ENDPOINTS.GAMES.BASE),
      ]);

      if (formatsRes.ok) {
        const data = await safeJson(formatsRes);
        setFormats(data ?? []);
      }
      if (tournamentsRes.ok) {
        const data = await safeJson(tournamentsRes);
        setExistingNames(data?.map((t: any) => t.name) ?? []);
      }
      if (gamesRes.ok) {
        const data: Game[] = (await safeJson(gamesRes)) ?? [];
        setGames(data);
        // Default the selection to "General" (isBuiltin) so a tournament always
        // has a game even if the organizer never touches the field.
        const general = data.find((g) => g.isBuiltin) ?? data[0];
        if (general) setSelectedGameId((prev) => prev || general.id);
      }
    };
    loadInitialData();
  }, []);

  const applyFormat = (fmt: TournamentFormatModel) => {
    setSelectedFormatId(fmt.id);
    // The preset may carry a default game; pre-fill it. The organizer can still
    // change the game — the tournament's choice is what gets saved (todo.md §5).
    if (fmt.gameId) setSelectedGameId(fmt.gameId);
    const raw = (fmt.config ?? {}) as Record<string, any>;
    // HYBRID presets nest the scoring rules under phase1 (mirrors backend resolveConfig)
    const c = raw.phase1 ?? raw;
    setFormat(fmt.system);
    setBestOf(c.bestOf ?? 1);
    setAllowDraw(c.allowDraw ?? false);
    // Read from the raw root first, not the phase1 alias: how the field is drawn
    // is a property of the event, not of a HYBRID preset's Swiss phase.
    setSeedingMode((raw.seedingMode ?? c.seedingMode) === "MANUAL" ? "MANUAL" : "RANDOM");
    setPointsThreshold(c.pointsThreshold ?? 0);
    setStartingHp(c.startingHp ?? 0);
    if (fmt.system === "SWISS" || fmt.system === "HYBRID") {
      setSwissRounds(c.swissRounds ?? 3);
      setSwissPointsWin(c.swissPointsForWin ?? 3);
      setSwissPointsDraw(c.swissPointsForDraw ?? 1);
      setSwissPointsLoss(c.swissPointsForLoss ?? 0);
    }
    setTopCutSize(raw.phase2?.topCutSize ?? 8);
    setPlacementChampion(c.placementPointsChampion ?? 10);
    setPlacement2nd(c.placementPoints2nd ?? 7);
    setPlacement3rd(c.placementPoints3rd ?? 5);
    setPlacementTopCut(c.placementPointsTopCut ?? 3);
    setPlacementParticipation(c.placementPointsParticipation ?? 1);
  };

  // Draws are cleared for systems that cannot survive them. HYBRID is included
  // in the permitted set because its phase 1 IS Swiss, where draws are the
  // standard mechanic; the phase-2 top cut never offers the control (see
  // canOfferDraw in utils/formatConfig.ts).
  useEffect(() => {
    if (format !== "SWISS" && format !== "ROUND_ROBIN" && format !== "HYBRID") {
      setAllowDraw(false);
    }
  }, [format]);

  const isIdentityValid = !!(name && !nameError && selectedFormatId && maxPlayers >= 2 && !isValidatingName);
  const isRulesValid = !!(bestOf >= 1);
  const isScheduleValid = !!(startNow || date);
  const allStepsVisited = visitedSteps.size >= 3;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (activeStep !== "SCHEDULE" || isSubmitting || !allStepsVisited || showSuccess) return;

    setIsSubmitting(true);
    const finalDate = date ? (startTime ? `${date}T${startTime}` : `${date}T00:00:00`) : null;

    // Full rules snapshot — stored as the tournament's own config override
    const rules: Record<string, any> = {
      bestOf,
      allowDraw,
      pointsThreshold,
      startingHp,
      placementPointsChampion: placementChampion,
      placementPoints2nd: placement2nd,
      placementPoints3rd: placement3rd,
      placementPointsTopCut: placementTopCut,
      placementPointsParticipation: placementParticipation,
    };
    if (format === "SWISS" || format === "HYBRID") {
      rules.swissRounds = swissRounds;
      rules.swissPointsForWin = swissPointsWin;
      rules.swissPointsForDraw = swissPointsDraw;
      rules.swissPointsForLoss = swissPointsLoss;
    }
    // seedingMode lives at the config root, never inside a phase, because the
    // backend resolves it from the root first (see format-config.helper.ts).
    const config =
      format === "HYBRID"
        ? { seedingMode, phase1: rules, phase2: { topCutSize } }
        : { ...rules, seedingMode };

    const body = {
      name,
      description: description || undefined,
      formatId: selectedFormatId,
      gameId: selectedGameId || undefined,
      maxPlayers: Number(maxPlayers),
      prizePool: prizePool === "" ? null : Number(prizePool),
      venue,
      date: finalDate,
      isPrivate,
      startNow,
      // createdById is set server-side from the auth token (F3) — not sent from here.
      config,
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

  // Organizers cannot create games (admin-owned catalog); they request one. The
  // tournament still runs under General meanwhile (todo.md §5).
  const handleRequestGame = async () => {
    const trimmed = requestName.trim();
    if (!trimmed || requesting) return;
    setRequesting(true);
    setRequestMsg(null);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.GAMES.REQUEST, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        setRequestMsg(`Requested "${trimmed}". An admin will add it; this tournament can run under General until then.`);
        setRequestName("");
        setRequestOpen(false);
      } else {
        const data = await safeJson(res);
        setRequestMsg(data?.message || "Could not send the request.");
      }
    } catch {
      setRequestMsg("Connection failed. Try again.");
    } finally {
      setRequesting(false);
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
            <option value="" disabled className="bg-background">Select a format...</option>
            {formats.map(fmt => (
              <option key={fmt.id} value={fmt.id} className="bg-background">
                {fmt.name}{fmt.game?.name ? ` · ${fmt.game.name}` : ""}
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
                  ? "bg-primary/10 border-primary" 
                  : "bg-background border-white/10 hover:border-white/30"
              }`}
            >
              <div className="flex flex-col">
                <span className={`text-sm font-semibold ${selectedFormatId === fmt.id ? "text-primary" : "text-white"}`}>{fmt.name}</span>
                <span className="text-xs text-[#888888] mt-1">{fmt.game?.name ? `Default game: ${fmt.game.name}` : "Pick a game next"}</span>
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
            <Field label="Game">
              <select
                value={selectedGameId}
                onChange={(e) => setSelectedGameId(e.target.value)}
                className={inputCls}
              >
                {games.map((g) => (
                  <option key={g.id} value={g.id} className="bg-background">
                    {g.name}{g.isBuiltin ? " (default)" : ""}
                  </option>
                ))}
              </select>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => { setRequestOpen((o) => !o); setRequestMsg(null); }}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Can&apos;t find your game? Request it
                </button>
              </div>
              {requestOpen && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={requestName}
                    onChange={(e) => setRequestName(e.target.value)}
                    placeholder="Game name to request"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={handleRequestGame}
                    disabled={requesting || !requestName.trim()}
                    className="px-4 h-10 shrink-0 bg-primary text-black text-xs font-semibold rounded hover:brightness-90 transition-colors disabled:opacity-50"
                  >
                    {requesting ? "Sending..." : "Request"}
                  </button>
                </div>
              )}
              {requestMsg && (
                <p className="mt-2 text-[11px] text-[#888888] leading-relaxed">{requestMsg}</p>
              )}
              <p className="mt-2 text-[11px] text-[#888888] leading-relaxed">
                Determines which game leaderboard results count toward. Defaults to General.
              </p>
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
        <span className="px-2 py-1 bg-background text-[#888888] text-xs font-semibold rounded capitalize">
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
                  className="w-4 h-4 cursor-pointer accent-primary" 
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
                  className="w-4 h-4 cursor-pointer accent-primary" 
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
            {(format === "SWISS" || format === "ROUND_ROBIN" || format === "HYBRID") && (
              <Field label={format === "HYBRID" ? "Allow Draws (Swiss phase)" : "Allow Draws"}>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAllowDraw(false)}
                    className={`flex-1 h-10 text-xs font-semibold transition-colors rounded border ${
                      !allowDraw ? "bg-primary/10 border-primary text-primary" : "bg-background border-white/20 text-[#888888] hover:text-white"
                    }`}
                  >
                    Force Win
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowDraw(true)}
                    className={`flex-1 h-10 text-xs font-semibold transition-colors rounded border ${
                      allowDraw ? "bg-primary/10 border-primary text-primary" : "bg-background border-white/20 text-[#888888] hover:text-white"
                    }`}
                  >
                    Permit Draws
                  </button>
                </div>
                {allowDraw && (bestOf > 1 || pointsThreshold > 0) && (
                  /* The backend refuses a winnerless submit for a series or a
                     threshold-scored match, so with these settings the Draw
                     control never appears during scoring. Said plainly here
                     rather than leaving the organizer to discover a setting
                     that does nothing. */
                  <p className="mt-2 text-[11px] text-[#FFB020] leading-relaxed">
                    Draws will not be offered while this format uses{" "}
                    {bestOf > 1 ? "a best-of series" : "point-threshold scoring"}.
                    Set Best Of to 1{pointsThreshold > 0 ? " and clear the points threshold" : ""} to make them available.
                  </p>
                )}
                {format === "HYBRID" && (
                  <p className="mt-2 text-[11px] text-[#888888] leading-relaxed">
                    Applies to the Swiss phase only. The top cut is single
                    elimination, where a match must produce a winner.
                  </p>
                )}
              </Field>
            )}
            <Field label="Seeding">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSeedingMode("RANDOM")}
                  className={`flex-1 h-10 text-xs font-semibold transition-colors rounded border ${
                    seedingMode === "RANDOM" ? "bg-primary/10 border-primary text-primary" : "bg-background border-white/20 text-[#888888] hover:text-white"
                  }`}
                >
                  Random Draw
                </button>
                <button
                  type="button"
                  onClick={() => setSeedingMode("MANUAL")}
                  className={`flex-1 h-10 text-xs font-semibold transition-colors rounded border ${
                    seedingMode === "MANUAL" ? "bg-primary/10 border-primary text-primary" : "bg-background border-white/20 text-[#888888] hover:text-white"
                  }`}
                >
                  Manual Seeding
                </button>
              </div>
              <p className="mt-2 text-[11px] text-[#888888] leading-relaxed">
                {seedingMode === "RANDOM"
                  ? "The field is drawn at random when the tournament starts. Any seed order set on the roster is ignored."
                  : "The bracket follows the seed order you arrange on the roster. Unseeded entrants are placed last."}
              </p>
            </Field>
          </div>
        </div>
      </div>

      {(format === "SWISS" || format === "HYBRID") && (
        <div className="pt-6 border-t border-white/10">
          <h4 className="text-xs font-semibold text-[#888888] mb-4">
            {format === "HYBRID" ? "Swiss Phase Configuration" : "Swiss System Configuration"}
          </h4>
          <div className={`grid grid-cols-2 gap-4 ${format === "HYBRID" ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
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
            {format === "HYBRID" && (
              <Field label="Top Cut Size">
                <input type="number" value={topCutSize} onChange={e => setTopCutSize(Math.max(2, Number(e.target.value)))} min={2} className={inputCls} />
              </Field>
            )}
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

  const renderSchedule = () => (
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
            onClick={() => setActiveStep(activeStep === "SCHEDULE" ? "RULES" : "IDENTITY")}
            className="flex-1 md:flex-none px-6 py-2.5 bg-background text-white font-semibold text-sm rounded hover:bg-white/10 transition-colors"
          >
            Back
          </button>
        )}
        
        {activeStep !== "SCHEDULE" ? (
          <button 
            type="button" 
            onClick={() => setActiveStep(activeStep === "IDENTITY" ? "RULES" : "SCHEDULE")}
            disabled={(activeStep === "IDENTITY" && !isIdentityValid) || (activeStep === "RULES" && !isRulesValid)}
            className="flex-1 md:flex-none px-8 py-2.5 bg-primary text-black font-semibold text-sm rounded hover:brightness-90 transition-colors disabled:opacity-50 disabled:grayscale"
          >
            Proceed
          </button>
        ) : (
          <div className="flex flex-col md:items-end w-full md:w-auto">
            <button 
              type="button" 
              onClick={handleSubmit}
              disabled={!isIdentityValid || !isRulesValid || !isScheduleValid || uploading || !allStepsVisited}
              className="w-full md:w-auto px-8 py-2.5 bg-primary text-black font-semibold text-sm rounded hover:brightness-90 transition-colors disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
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
    { id: "SCHEDULE", label: "03. Schedule", valid: isScheduleValid }
  ] as const;

  if (showSuccess) {
    return (
      <div className="bg-[#000000] border border-white/20 p-12 rounded flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-primary/10 text-primary border border-primary/20 rounded-full flex items-center justify-center mb-6">
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
        <div className="flex bg-background border border-white/20 rounded overflow-hidden">
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStep(step.id as any)}
              className={`flex-1 py-3 text-xs font-semibold text-center border-r border-white/10 last:border-0 transition-colors ${
                activeStep === step.id ? "bg-primary/10 text-primary border-b-2 border-b-[#52B946]" : "text-[#888888] hover:bg-white/5"
              }`}
            >
              {step.label.split(". ")[1]}
            </button>
          ))}
        </div>
        
        <div className="bg-[#000000] border border-white/20 p-4 rounded">
          {activeStep === "IDENTITY" && renderIdentity()}
          {activeStep === "RULES" && renderRules()}
          {activeStep === "SCHEDULE" && renderSchedule()}
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
                activeStep === step.id ? "bg-background border border-white/20" : "hover:bg-background/50 border border-transparent"
              }`}
            >
              <div className={`w-3 h-3 rounded-full border transition-colors ${
                step.valid && activeStep !== step.id ? "bg-primary border-primary" :
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
          {activeStep === "SCHEDULE" && renderSchedule()}
          {renderActions()}
        </div>
      </div>
    </>
  );
}
