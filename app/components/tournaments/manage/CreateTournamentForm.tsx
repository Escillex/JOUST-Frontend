"use client";
import { useState, useEffect } from "react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../../utils/api";
import { TournamentFormatModel, Game } from "../../../tournaments/types";
import { byeWarningFor } from "../OddFieldStartModal";
import ImageUpload from "../../ui/ImageUpload";
import { useImageUpload } from "../../../utils/useImageUpload";

const inputCls = "w-full h-10 bg-background border border-white/20 px-3 text-sm text-white focus:outline-none focus:border-primary transition-colors rounded appearance-none placeholder:text-white/20";
const labelCls = "text-xs font-semibold text-[#888888] block mb-1";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Today as `YYYY-MM-DD` in the organizer's own timezone. `toISOString()` would
 *  give the UTC day, which is yesterday for most of the evening east of UTC. */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** The current local time as `HH:MM`. A date with no time is stored as
 *  midnight and reads back as "12:00 AM", which is a claim nobody made — so a
 *  tournament whose sign-ups open immediately starts at the moment it is made. */
function nowLocalTime(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

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
  onSuccess: (message: string) => void;
  /** Creation failed. Separate from `onSuccess` because the page used to tell
   *  the two apart by looking for the word "Error" in the message. */
  onError: (message: string) => void;
  onDiscard: () => void;
}

export default function CreateTournamentForm({ onSuccess, onError, onDiscard }: Props) {
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
  // pre-fill it, but the tournament's choice wins (todo.md §5). Required: there
  // is no fallback game, so an empty catalog blocks creation until an admin adds
  // one (the backend rejects with NO_GAMES_CONFIGURED / NO_GAME_SELECTED).
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoaded, setGamesLoaded] = useState(false);
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
  const [prizePool, setPrizePool] = useState("");
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
  // Defaults to today rather than empty. `Tournament.date` is nullable and the
  // API accepts a tournament without one, so this is a default and not a rule —
  // but leaving it blank is now a choice the organizer can see themselves make,
  // where before it was what you got for leaving "Open now" alone.
  const [date, setDate] = useState(todayLocal);
  const [startTime, setStartTime] = useState(nowLocalTime);
  const [startNow, setStartNow] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [visitedSteps, setVisitedSteps] = useState<Set<string>>(new Set(["IDENTITY"]));
  const [nameError, setNameError] = useState<string | null>(null);
  /** A name already in use is legal — `Tournament.name` is not unique and the
   *  API accepts it — so a clash is said out loud and never blocks. Blocking it
   *  meant a club could not run the same weekly event twice, and every finished
   *  tournament burned its own title for good. */
  const [nameClash, setNameClash] = useState(false);
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
      setNameClash(false);
      return;
    }
    setIsValidatingName(true);
    const timer = setTimeout(() => {
      const normalizedName = name.trim().toLowerCase();
      setNameClash(existingNames.some(n => n.toLowerCase() === normalizedName));

      // The same two limits the API enforces, worded the way it words them.
      if (name.trim().length < 3) {
        setNameError("Needs at least 3 characters");
      } else if (name.length > 60) {
        setNameError("Keep it to 60 characters or fewer");
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
        // No default is pre-selected. The organizer names the game deliberately;
        // auto-filling one would put results on a leaderboard nobody chose.
        setGamesLoaded(true);
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

  // The catalog is empty until an admin adds a game, and a tournament cannot be
  // created without one — surface that on the first step rather than letting the
  // organizer fill in three steps and hit a 400 at the end.
  const noGamesConfigured = gamesLoaded && games.length === 0;
  // Same helper the start-time modal uses, so the advice given at creation and
  // the warning given at start can never contradict each other.
  const capacityWarning = byeWarningFor(format, Number(maxPlayers));
  // Mirrors CreateTournamentDto: 2–128 players, 3–60 character name, 500
  // character description. Enforced here so a form filled to the last step
  // cannot be refused by the API for something visible on the first one.
  const MAX_PLAYERS_CAP = 128;
  const DESCRIPTION_CAP = 500;
  const isIdentityValid = !!(
    name && !nameError && selectedFormatId && selectedGameId &&
    maxPlayers >= 2 && maxPlayers <= MAX_PLAYERS_CAP &&
    description.length <= DESCRIPTION_CAP && !isValidatingName
  );
  const isRulesValid = !!(bestOf >= 1);
  // Nothing on this step can be invalid: every field on it is optional to the
  // API. It stays as a named value so the step model reads the same as the others.
  const isScheduleValid = true;
  const allStepsVisited = visitedSteps.size >= 3;

  /** What is stopping this step, named. A disabled button with no reason was
   *  its own puzzle — the blocker is often a field further up the page. */
  const blockers: string[] = [];
  if (activeStep === "IDENTITY") {
    if (!selectedFormatId) blockers.push("choose a format");
    if (!name) blockers.push("name the tournament");
    else if (nameError) blockers.push(nameError.toLowerCase());
    if (!selectedGameId) blockers.push("choose a game");
    if (!(maxPlayers >= 2)) blockers.push("allow at least 2 players");
    else if (maxPlayers > MAX_PLAYERS_CAP) blockers.push(`keep players to ${MAX_PLAYERS_CAP} or fewer`);
    if (description.length > DESCRIPTION_CAP) blockers.push("shorten the description");
  }

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [bannerWarning, setBannerWarning] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (activeStep !== "SCHEDULE" || isSubmitting || !allStepsVisited || showSuccess) return;

    setIsSubmitting(true);
    // Sent as a real instant, not a naive "2026-09-17T10:28" string: the server
    // read those as UTC, so a tournament created at 10:28 in Manila came back as
    // 10:28Z and rendered as 18:28 to the organizer who typed it. A date-time
    // form without an offset parses as LOCAL in JS, so this converts correctly —
    // the time part must always be present, because a bare date parses as UTC.
    const finalDate = date ? new Date(`${date}T${startTime || "00:00"}`).toISOString() : null;

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
      prizePool: prizePool.trim() || null,
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
          // The tournament exists either way, so a rejected image is reported
          // rather than swallowed behind a "created successfully".
          const ok = await upload(API_ENDPOINTS.IMAGES.UPLOAD_BANNER(tournamentId), bannerFile);
          if (!ok) setBannerWarning(true);
        }

        setShowSuccess(true);
        // Long enough to register, not a countdown. It was two seconds spent
        // watching a tick before being dropped on a list.
        setTimeout(() => {
          onSuccess(tournamentId);
        }, 700);
      } else {
        const data = await safeJson(res);
        onError(data?.message || "The tournament could not be created.");
      }
    } catch {
      onError("Could not reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Organizers cannot create games (admin-owned catalog); they request one. With
  // no fallback game, the tournament waits until an admin creates it (todo.md §5).
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
        setRequestMsg(`Requested "${trimmed}". An administrator has to add it to the catalog before a tournament can be created for it.`);
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
        <h3 className="text-sm font-semibold text-white border-b border-white/10 pb-2">Format</h3>
        
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
        {formats.length === 0 ? (
          /* The same dead end the game catalogue explains: an organizer cannot
             create a format, so saying "select one" when there are none to
             select leaves them with nothing to do and no reason why. */
          <div className="flex items-center justify-center border border-dashed border-[#FF4D4D]/40 rounded px-6 py-5">
            <span className="text-[11px] text-[#FF4D4D] leading-relaxed text-center">
              No formats have been set up yet. An administrator creates these in
              Admin → Formats; a tournament cannot be created without one.
            </span>
          </div>
        ) : !selectedFormatId ? (
          <div className="hidden sm:flex h-24 items-center justify-center border border-dashed border-white/20 rounded">
            <span className="text-sm text-[#888888]">Choose a format to continue</span>
          </div>
        ) : null}
      </div>

      {selectedFormatId && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white border-b border-white/10 pb-2">About the tournament</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Field label="Name" required>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Pro League Season 1" 
                  maxLength={60}
                  className={`${inputCls} ${nameError ? "border-[#FF4D4D]" : ""}`} 
                  required 
                />
              </Field>
              {nameError && <span className="text-xs text-[#FF4D4D]">{nameError}</span>}
              {!nameError && nameClash && (
                <span className="text-xs text-[#F5A623]">
                  Another tournament already has this name. That is allowed — it just makes them
                  harder to tell apart in lists.
                </span>
              )}
            </div>
            <Field label="Player limit" required>
              <input
                type="number"
                value={maxPlayers}
                onChange={e => setMaxPlayers(Number(e.target.value))}
                min={2}
                max={MAX_PLAYERS_CAP}
                step={1}
                className={`${inputCls} ${maxPlayers > MAX_PLAYERS_CAP || maxPlayers < 2 ? "border-[#FF4D4D]" : ""}`}
                required
              />
              {(maxPlayers > MAX_PLAYERS_CAP || maxPlayers < 2) && (
                <p className="mt-2 text-[11px] text-[#FF4D4D]">
                  Between 2 and {MAX_PLAYERS_CAP} players.
                </p>
              )}
              {/* A capacity note, not a blocker: this is the cap, and the field
                  that actually turns up decides the real pairing. It says what
                  happens if the tournament fills exactly, using the same helper
                  the start-time warning uses so the two can't disagree. */}
              {capacityWarning && (
                <p className="mt-2 text-[11px] text-[#F5A623] leading-relaxed">
                  {capacityWarning.kind === "EVERY_ROUND"
                    ? `An odd capacity: filled exactly, one player sits out every round with a bye.`
                    : `Not a full bracket: filled exactly, ${capacityWarning.byes} ${capacityWarning.byes === 1 ? "player gets" : "players get"} a first-round bye. ${capacityWarning.bracketSize} would fill it.`}
                </p>
              )}
            </Field>
          </div>
          <div className="pt-2">
            <Field label="Game" required>
              <select
                value={selectedGameId}
                onChange={(e) => setSelectedGameId(e.target.value)}
                className={inputCls}
                disabled={noGamesConfigured}
                required
              >
                <option value="" className="bg-background">
                  {noGamesConfigured ? "No games available" : "Select a game"}
                </option>
                {games.map((g) => (
                  <option key={g.id} value={g.id} className="bg-background">
                    {g.name}
                  </option>
                ))}
              </select>
              {noGamesConfigured && (
                <p className="mt-2 text-[11px] text-[#FF4D4D] leading-relaxed">
                  No games have been set up yet. An administrator must add a game to the catalog
                  before a tournament can be created. Request one below.
                </p>
              )}
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
                Determines which game leaderboard results count toward. Required — there is no
                general-purpose fallback.
              </p>
            </Field>
          </div>
          <div className="pt-2">
            <Field label="Description">
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Optional details — rules, what to bring, how to find the venue" 
                maxLength={DESCRIPTION_CAP}
                className={`${inputCls} h-24 py-3 resize-none`} 
              />
              {description.length > DESCRIPTION_CAP - 100 && (
                <p className="mt-1 text-[11px] text-[#888888] text-right tabular-nums">
                  {description.length} / {DESCRIPTION_CAP}
                </p>
              )}
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
        <h3 className="text-sm font-semibold text-white">How matches are won</h3>
        <span className="px-2 py-1 bg-background text-[#888888] text-xs font-semibold rounded capitalize">
          {format.replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-[#888888]">How a game is scored</h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={pointsThreshold > 0} 
                  onChange={e => setPointsThreshold(e.target.checked ? 3 : 0)} 
                  className="w-4 h-4 cursor-pointer accent-primary" 
                />
                <span className="text-sm text-white">Win at a points total</span>
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
                <span className="text-sm text-white">Track hit points</span>
              </label>
              {startingHp > 0 && (
                <input type="number" value={startingHp} onChange={e => setStartingHp(Math.max(1, Number(e.target.value)))} min={1} className={inputCls} />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-[#888888]">Match length and draw</h4>
          <div className="space-y-4">
            <Field label="Best of">
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
                    Must have a winner
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowDraw(true)}
                    className={`flex-1 h-10 text-xs font-semibold transition-colors rounded border ${
                      allowDraw ? "bg-primary/10 border-primary text-primary" : "bg-background border-white/20 text-[#888888] hover:text-white"
                    }`}
                  >
                    Draws allowed
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
                  Random draw
                </button>
                <button
                  type="button"
                  onClick={() => setSeedingMode("MANUAL")}
                  className={`flex-1 h-10 text-xs font-semibold transition-colors rounded border ${
                    seedingMode === "MANUAL" ? "bg-primary/10 border-primary text-primary" : "bg-background border-white/20 text-[#888888] hover:text-white"
                  }`}
                >
                  Manual seeding
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
            {format === "HYBRID" ? "Swiss phase" : "Swiss rounds and points"}
          </h4>
          <div className={`grid grid-cols-2 gap-4 ${format === "HYBRID" ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
            <Field label="Rounds">
              <input type="number" value={swissRounds} onChange={e => setSwissRounds(Math.max(1, Number(e.target.value)))} min={1} max={20} className={inputCls} />
            </Field>
            <Field label="Points / Win">
              <input type="number" value={swissPointsWin} onChange={e => setSwissPointsWin(Math.max(0, Number(e.target.value)))} min={0} className={inputCls} />
            </Field>
            <Field label="Points / Draw">
              <input type="number" value={swissPointsDraw} onChange={e => setSwissPointsDraw(Math.max(0, Number(e.target.value)))} min={0} className={inputCls} />
            </Field>
            <Field label="Points / Loss">
              <input type="number" value={swissPointsLoss} onChange={e => setSwissPointsLoss(Math.max(0, Number(e.target.value)))} min={0} className={inputCls} />
            </Field>
            {format === "HYBRID" && (
              <Field label="Top cut size">
                <input type="number" value={topCutSize} onChange={e => setTopCutSize(Math.max(2, Number(e.target.value)))} min={2} className={inputCls} />
              </Field>
            )}
          </div>
        </div>
      )}

      {/* Placement Points */}
      <div className="pt-6 border-t border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-semibold text-[#888888]">Points for finishing</h4>
          <span className="text-[10px] text-[#888888]/60 uppercase tracking-wider">Added to the game leaderboard when the tournament ends</span>
        </div>
        <div className={`grid gap-4 ${format === "HYBRID" ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-4"}`}>
          <Field label="Champion">
            <input type="number" value={placementChampion} onChange={e => setPlacementChampion(Math.max(0, Number(e.target.value)))} min={0} className={inputCls} />
          </Field>
          <Field label="Runner-up">
            <input type="number" value={placement2nd} onChange={e => setPlacement2nd(Math.max(0, Number(e.target.value)))} min={0} className={inputCls} />
          </Field>
          <Field label="Third">
            <input type="number" value={placement3rd} onChange={e => setPlacement3rd(Math.max(0, Number(e.target.value)))} min={0} className={inputCls} />
          </Field>
          {format === "HYBRID" && (
            <Field label="Top Cut">
              <input type="number" value={placementTopCut} onChange={e => setPlacementTopCut(Math.max(0, Number(e.target.value)))} min={0} className={inputCls} />
            </Field>
          )}
          <Field label="Participation">
            <input type="number" value={placementParticipation} onChange={e => setPlacementParticipation(Math.max(0, Number(e.target.value)))} min={0} className={inputCls} />
          </Field>
        </div>
      </div>
    </div>
  );

  const renderSchedule = () => (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white border-b border-white/10 pb-2">When and who can see it</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Venue">
          <input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="Physical / Online" className={inputCls} />
        </Field>
        <Field label="Prize">
          <input type="text" maxLength={120} value={prizePool} onChange={e => setPrizePool(e.target.value)} placeholder="Trophy, ₱2,000, booster box…" className={inputCls} />
        </Field>
        {/* Two questions, asked separately (agreed 2026-09-17, option 1A). The
            sign-up switch used to hide the date fields outright, so the default
            path — "Open now" — produced a tournament with no date at all, on a
            step called Schedule. They are different columns: one is the status,
            the other is when the thing is played. */}
        <Field label="Date">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          {!date && (
            <p className="mt-2 text-[11px] text-[#F5A623] leading-relaxed">
              Without a date this tournament shows no date anywhere — not on its page, and not on
              the browse list.
            </p>
          )}
        </Field>
        <Field label="Start time">
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} disabled={!date} className={`${inputCls} disabled:opacity-40`} />
          {date && !startTime && (
            <p className="mt-2 text-[11px] text-[#F5A623] leading-relaxed">
              With no time this reads as midnight wherever the date is shown.
            </p>
          )}
        </Field>
        <Field label="Sign-ups">
          <select
            value={startNow ? "IMMEDIATE" : "SCHEDULED"}
            onChange={e => {
              const immediate = e.target.value === "IMMEDIATE";
              setStartNow(immediate);
              // Only fills a gap — an organizer who typed a time keeps it.
              if (immediate && !startTime) setStartTime(nowLocalTime());
            }}
            className={inputCls}
          >
            <option value="IMMEDIATE">Open now</option>
            <option value="SCHEDULED">Not open yet</option>
          </select>
          <p className="mt-2 text-[11px] text-[#888888] leading-relaxed">
            {startNow
              ? "People can enter as soon as it is created, and it starts at the time above."
              : "Nobody can enter until you open sign-ups from the tournament's settings."}
          </p>
        </Field>
        <Field label="Who can find it">
          <select value={isPrivate ? "PRIVATE" : "PUBLIC"} onChange={e => setIsPrivate(e.target.value === "PRIVATE")} className={inputCls}>
            <option value="PUBLIC">Listed publicly</option>
            <option value="PRIVATE">Unlisted — link only</option>
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
        Discard
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
          <div className="flex flex-col md:items-end flex-1 md:flex-none">
            <button 
              type="button" 
              onClick={() => setActiveStep(activeStep === "IDENTITY" ? "RULES" : "SCHEDULE")}
              disabled={(activeStep === "IDENTITY" && !isIdentityValid) || (activeStep === "RULES" && !isRulesValid)}
              className="w-full md:w-auto px-8 py-2.5 bg-primary text-black font-semibold text-sm rounded hover:brightness-90 transition-colors disabled:opacity-50 disabled:grayscale"
            >
              Next
            </button>
            {blockers.length > 0 && (
              <span className="text-xs text-[#F5A623] mt-1.5 text-center w-full md:text-right">
                First: {blockers.join(" · ")}
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col md:items-end w-full md:w-auto">
            <button 
              type="button" 
              onClick={handleSubmit}
              disabled={!isIdentityValid || !isRulesValid || !isScheduleValid || uploading || !allStepsVisited}
              className="w-full md:w-auto px-8 py-2.5 bg-primary text-black font-semibold text-sm rounded hover:brightness-90 transition-colors disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
            >
              {uploading || isSubmitting ? "Creating…" : "Create tournament"}
            </button>
            {(blockers.length > 0 || !allStepsVisited || !isIdentityValid) && (
              <span className="text-xs text-[#F5A623] mt-1.5 text-center w-full md:text-right">
                {blockers.length > 0
                  ? `First: ${blockers.join(" · ")}`
                  : !isIdentityValid
                    ? "Something on Details still needs fixing"
                    : "Look through Rules before creating"}
              </span>
            )}
          </div>
        )}
       </div>
    </div>
  );

  // `done` means seen and free of errors — not `isRulesValid`, which is
  // `bestOf >= 1`, and `isScheduleValid`, which is true by default: both dots
  // were green before the organizer had ever opened those steps.
  const steps = [
    { id: "IDENTITY", label: "01. Details", done: visitedSteps.has("IDENTITY") && isIdentityValid, error: !!nameError },
    { id: "RULES", label: "02. Rules", done: visitedSteps.has("RULES"), error: false },
    { id: "SCHEDULE", label: "03. Schedule", done: visitedSteps.has("SCHEDULE"), error: false }
  ] as const;

  if (showSuccess) {
    return (
      <div className="bg-[#000000] border border-white/20 p-12 rounded flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-primary/10 text-primary border border-primary/20 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Tournament created</h2>
        <p className="text-sm text-[#888888]">Opening it so you can add players…</p>
        {bannerWarning && (
          <p className="mt-4 text-[11px] text-[#F5A623] max-w-sm leading-relaxed">
            The banner image was not saved. You can upload it again from the tournament&apos;s
            settings.
          </p>
        )}
      </div>
    );
  }

  const body = (
    <>
      {activeStep === "IDENTITY" && renderIdentity()}
      {activeStep === "RULES" && renderRules()}
      {activeStep === "SCHEDULE" && renderSchedule()}
      {renderActions()}
    </>
  );

  const dot = (step: (typeof steps)[number]) =>
    step.error
      ? "bg-[#FF4D4D] border-[#FF4D4D]"
      : activeStep === step.id
        ? "bg-white border-white"
        : step.done
          ? "bg-primary border-primary"
          : "border-[#888888]";

  // One copy of the form, one navigation per device. The whole form used to be
  // rendered twice — once inside a phone branch and once inside a desktop one —
  // so every input, the banner uploader and the step navigation sat in the DOM
  // in duplicate. Only the three navigation buttons are duplicated now.
  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-8">
      <div className="flex md:hidden bg-background border border-white/20 rounded overflow-hidden">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => setActiveStep(step.id)}
            aria-current={activeStep === step.id ? "step" : undefined}
            className={`flex-1 py-3 text-xs font-semibold text-center border-r border-white/10 last:border-0 transition-colors ${
              activeStep === step.id ? "bg-primary/10 text-primary border-b-2 border-b-[#52B946]" : "text-[#888888] hover:bg-white/5"
            }`}
          >
            {step.label.split(". ")[1]}
            {step.error && <span aria-hidden className="text-[#FF4D4D]"> !</span>}
          </button>
        ))}
      </div>

      <aside className="hidden md:block w-48 shrink-0 space-y-2">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => setActiveStep(step.id)}
            aria-current={activeStep === step.id ? "step" : undefined}
            className={`w-full flex items-center gap-3 p-3 rounded text-left transition-colors ${
              activeStep === step.id ? "bg-background border border-white/20" : "hover:bg-background/50 border border-transparent"
            }`}
          >
            <div className={`w-3 h-3 rounded-full border transition-colors ${dot(step)}`} />
            <span className={`text-sm font-semibold transition-colors ${
              activeStep === step.id ? "text-white" : "text-[#888888]"
            }`}>
              {step.label}
            </span>
          </button>
        ))}
      </aside>

      <div className="flex-1 bg-[#000000] border border-white/20 p-4 md:p-8 rounded min-w-0">{body}</div>
    </div>
  );
}
