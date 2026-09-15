"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  authenticatedFetch,
  API_ENDPOINTS,
  UPLOAD_TIMEOUT_MS,
  safeJson,
} from "../../utils/api";
import { useToast } from "../../components/ui/Toast";
import { useUser } from "../../components/UserProvider";
import { Skeleton, SkeletonStatus } from "../../components/ui/Skeleton";
import SectionRail from "../../components/admin/editor/SectionRail";
import GroupEditor from "../../components/admin/editor/GroupEditor";
import PagePreview from "../../components/admin/editor/PagePreview";
import { useProducts } from "../../components/admin/editor/useProducts";
import {
  GROUPS,
  GroupKey,
  HeroUploadTarget,
  sectionOf,
  uploadTargetId,
} from "../../components/admin/editor/editorTypes";
import {
  DEFAULT_HOME_BLOCKS,
  HeroContent,
  HomeBlock,
  HOME_BLOCK_LABELS,
  HomeBlockKey,
  normalizeHomeConfig,
} from "../../utils/homeConfig";

interface SiteAsset {
  key: string;
  url: string;
  label?: string;
}

/** Asset keys this editor owns, so a removed slide takes its file with it. */
const SLIDE_PREFIX = "hero_slide_";
const LOGO_PREFIX = "home_store_logo_";

export default function HomePageEditor() {
  const router = useRouter();
  const { toast } = useToast();

  // Access control: this editor changes the public site, so only
  // admins may open it. Before this check, anyone who knew the URL
  // could load the page (the backend still rejected their saves, but
  // the page itself should not render at all).
  const { user, loading: userLoading } = useUser();
  const isAdminUser = !!user?.roles?.includes("ADMIN");
  useEffect(() => {
    if (!userLoading && !isAdminUser) router.push("/");
  }, [userLoading, isAdminUser, router]);

  const [blocks, setBlocks] = useState<HomeBlock[]>(DEFAULT_HOME_BLOCKS);
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [assets, setAssets] = useState<SiteAsset[]>([]);
  const [activeGroup, setActiveGroup] = useState<GroupKey>("hero:tagline");
  const [slideIndex, setSlideIndex] = useState(0);
  const [buttonIndex, setButtonIndex] = useState(0);
  const [productId, setProductId] = useState("new");
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [busyTarget, setBusyTarget] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  // Below lg the rail is a drawer: a fixed 260px column on a 390px screen
  // leaves ~130px to edit in, which is not an editor.
  const [railOpen, setRailOpen] = useState(false);

  const refreshPreview = useCallback(() => setReloadKey(k => k + 1), []);
  const store = useProducts(refreshPreview);

  // ─── Loading ───────────────────────────────────────────────────

  const applyBlocks = useCallback((next: HomeBlock[]) => {
    setBlocks(next);
    setDrafts(Object.fromEntries(next.map(b => [b.key, { ...b.content }])));
  }, []);

  const fetchAssets = useCallback(async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.IMAGES.LIST_ASSETS);
    if (res.ok) {
      const data = await safeJson(res);
      if (Array.isArray(data)) setAssets(data);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.HOME.CONFIG);
    if (res.ok) applyBlocks(normalizeHomeConfig(await safeJson(res)));
    else toast("Could not load the home page configuration", "error");
  }, [applyBlocks, toast]);

  useEffect(() => {
    Promise.all([fetchConfig(), fetchAssets()]).finally(() => setLoading(false));
  }, [fetchConfig, fetchAssets]);

  // ─── Saving ────────────────────────────────────────────────────

  const saveBlock = useCallback(
    async (key: string, body: { visible?: boolean; content?: Record<string, unknown> }) => {
      setSavingKey(key);
      try {
        const res = await authenticatedFetch(API_ENDPOINTS.HOME.BLOCK(key), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await safeJson(res);
          toast(err?.message || "Could not save this section", "error");
          return false;
        }
        const saved = (await safeJson(res)) as HomeBlock;
        // The server whitelists and trims what it stores, so the editor adopts
        // what came back rather than what it sent — otherwise the fields would
        // show text the public page does not have.
        setBlocks(prev => prev.map(b => (b.key === key ? { ...b, ...saved } : b)));
        setDrafts(prev => ({ ...prev, [key]: { ...saved.content } }));
        refreshPreview();
        return true;
      } finally {
        setSavingKey(null);
      }
    },
    [refreshPreview, toast],
  );

  const handleReorder = async (keys: string[]) => {
    const previous = blocks;
    // Optimistic: dragging must feel immediate on a venue connection.
    setBlocks(keys.map((k, i) => ({ ...previous.find(b => b.key === k)!, order: i })));
    const res = await authenticatedFetch(API_ENDPOINTS.HOME.REORDER, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys }),
    });
    if (res.ok) {
      applyBlocks(normalizeHomeConfig(await safeJson(res)));
      refreshPreview();
    } else {
      setBlocks(previous);
      toast("Could not save the new order", "error");
    }
  };

  // ─── Images ────────────────────────────────────────────────────

  const nextAssetKey = (prefix: string) => {
    const used = new Set(assets.map(a => a.key));
    let n = 1;
    while (used.has(`${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  };

  const assetKeyForUrl = (url?: string | null) =>
    url ? assets.find(a => a.url === url)?.key : undefined;

  const uploadAsset = async (key: string, file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await authenticatedFetch(API_ENDPOINTS.IMAGES.UPSERT_ASSET(key), {
      method: "POST",
      body: formData,
      // Hero images are the largest uploads in the app; the default request
      // timeout would abort them on a slow link.
      timeoutMs: UPLOAD_TIMEOUT_MS,
    });
    if (!res.ok) {
      toast("The image could not be uploaded", "error");
      return null;
    }
    const saved = await safeJson(res);
    await fetchAssets();
    return saved?.url ?? null;
  };

  const heroDraft = (drafts.hero ?? {}) as HeroContent;

  const handleHeroUpload = async (file: File, target: HeroUploadTarget) => {
    setBusyTarget(uploadTargetId(target));
    try {
      const slides = heroDraft.slides ?? [];
      const buttons = heroDraft.storeButtons ?? [];

      if (target.kind === "slide") {
        const existingKey =
          target.index !== undefined ? assetKeyForUrl(slides[target.index]?.image) : undefined;
        const url = await uploadAsset(existingKey ?? nextAssetKey(SLIDE_PREFIX), file);
        if (!url) return;

        const nextSlides =
          target.index === undefined
            ? [...slides, { image: url, title: "", photoDesc: "" }]
            : slides.map((s, i) => (i === target.index ? { ...s, image: url } : s));
        // Saved at once: an uploaded file that is not referenced anywhere is
        // just litter on disk, and the admin has clearly committed to it.
        const ok = await saveBlock("hero", { content: { ...heroDraft, slides: nextSlides } });
        if (ok && target.index === undefined) setSlideIndex(nextSlides.length - 1);
      } else {
        const existingKey = assetKeyForUrl(buttons[target.index]?.iconUrl);
        const url = await uploadAsset(existingKey ?? nextAssetKey(LOGO_PREFIX), file);
        if (!url) return;
        const nextButtons = buttons.map((b, i) =>
          i === target.index ? { ...b, iconUrl: url } : b,
        );
        await saveBlock("hero", { content: { ...heroDraft, storeButtons: nextButtons } });
      }
    } finally {
      setBusyTarget(null);
    }
  };

  const handleRemoveSlide = async (index: number) => {
    const slides = heroDraft.slides ?? [];
    const removed = slides[index];
    const ok = await saveBlock("hero", {
      content: { ...heroDraft, slides: slides.filter((_, i) => i !== index) },
    });
    if (!ok) return;
    setSlideIndex(i => Math.max(0, i >= index ? i - 1 : i));

    // Only files this editor uploaded are deleted, and only once the slide no
    // longer references them — a shared image would otherwise vanish from a
    // section that still uses it.
    const key = assetKeyForUrl(removed?.image);
    const stillUsed = (heroDraft.storeButtons ?? []).some(b => b.iconUrl === removed?.image);
    if (key?.startsWith(SLIDE_PREFIX) && !stillUsed) {
      await authenticatedFetch(API_ENDPOINTS.IMAGES.DELETE_ASSET(key), { method: "DELETE" });
      await fetchAssets();
    }
    toast("Slide removed", "success");
  };

  // ─── Derived ───────────────────────────────────────────────────

  const sectionKey = sectionOf(activeGroup);
  const section = blocks.find(b => b.key === sectionKey);
  const sectionDraft = drafts[sectionKey] ?? {};
  const dirty = useMemo(
    () => JSON.stringify(sectionDraft) !== JSON.stringify(section?.content ?? {}),
    [sectionDraft, section],
  );
  // Products save themselves, one row at a time; there is nothing pending for
  // the section-level button to write.
  const savesWithSection = activeGroup !== "shop:products";

  const counts: Record<string, number> = {
    "hero:slides": (heroDraft.slides ?? []).length,
    "hero:buttons": (heroDraft.storeButtons ?? []).length,
    "shop:products": store.products.length,
  };

  const groupMeta = GROUPS[sectionKey]?.find(g => g.key === activeGroup);

  const selectGroup = (group: GroupKey) => {
    setActiveGroup(group);
    setRailOpen(false);
    if (group === "shop:products" && store.products.length && productId === "new") {
      setProductId(store.products[0].id);
    }
  };

  // Render nothing for non-admins while the redirect above happens. Note this
  // is deliberately split from the userLoading case below: blanking the screen
  // is right for someone who is being redirected away, but wrong for an admin
  // whose identity check is merely still in flight — they would see nothing at
  // all on a slow connection.
  if (!userLoading && !isAdminUser) return null;

  const header = (
    <header className="h-14 border-b border-white/20 flex items-center justify-between px-6 bg-[#101010] z-50 flex-shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/admin")}
          className="text-[11px] font-black text-white/65 hover:text-primary uppercase tracking-widest transition-colors"
        >
          ← ADMIN
        </button>
        <div className="h-4 w-px bg-white/10" />
        <h1 className="text-[13px] font-black uppercase tracking-[0.2em]">HOME PAGE EDITOR</h1>
      </div>
      <div className="flex items-center gap-4">
        <p className="hidden md:block text-[10px] font-black uppercase tracking-[0.3em] text-white/55">
          Changes are public as soon as they are saved
        </p>
        <button
          onClick={() => setShowPreview(v => !v)}
          className={`hidden xl:block px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-colors ${
            showPreview ? "bg-primary text-black" : "text-white/65 hover:text-white border border-white/20"
          }`}
        >
          Preview
        </button>
      </div>
    </header>
  );

  // Keeps the header — and with it the "← ADMIN" way out — on screen while the
  // identity check or the editor content loads, rather than a blank page or a
  // full-screen spinner.
  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-[#242424] text-white flex flex-col overflow-hidden">
        <SkeletonStatus label="Loading editor" />
        {header}
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#242424] text-white flex flex-col overflow-hidden">
      {header}

      <div className="flex-1 flex overflow-hidden relative">
        {/* ── Rail: every section and its parts, one click away ── */}
        {/* Backdrop for the drawer; never rendered on a wide screen. */}
        {railOpen && (
          <button
            aria-label="Close the section list"
            onClick={() => setRailOpen(false)}
            className="lg:hidden absolute inset-0 z-30 bg-black/70"
          />
        )}

        <div
          className={`${
            railOpen ? "flex" : "hidden"
          } lg:flex flex-col w-[260px] flex-shrink-0 border-r border-white/20 overflow-y-auto custom-scrollbar bg-[#171717] absolute lg:static inset-y-0 left-0 z-40 lg:z-auto`}
        >
          <SectionRail
            blocks={blocks}
            activeGroup={activeGroup}
            onSelectGroup={selectGroup}
            onToggleVisible={(key, visible) => saveBlock(key, { visible })}
            onReorder={handleReorder}
            busyKey={savingKey}
            counts={counts}
          />
        </div>

        {/* ── The part being edited ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#242424]">
          <div className="h-14 flex items-center justify-between px-6 border-b border-white/20 flex-shrink-0 bg-[#1C1C1C]">
            <button
              onClick={() => setRailOpen(true)}
              aria-label="Open the section list"
              className="lg:hidden mr-3 flex-shrink-0 w-9 h-9 flex items-center justify-center border border-white/25 text-white/70 hover:text-white hover:border-white/50 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-[13px] font-black uppercase tracking-[0.2em] text-white truncate">
                {HOME_BLOCK_LABELS[sectionKey as HomeBlockKey]?.title ?? sectionKey}
                <span className="text-white/55"> / </span>
                {groupMeta?.title ?? ""}
              </h2>
              <p className="text-[11px] text-white/65 truncate">
                {section?.visible ? groupMeta?.hint : "This section is hidden from the public page"}
              </p>
            </div>
            {savesWithSection && (
              <button
                onClick={() => saveBlock(sectionKey, { content: sectionDraft })}
                disabled={!dirty || savingKey === sectionKey}
                className="px-5 py-2 bg-primary text-black text-[11px] font-black uppercase tracking-[0.2em] hover:brightness-110 transition-colors disabled:opacity-45 disabled:cursor-not-allowed flex-shrink-0"
              >
                {savingKey === sectionKey ? "Saving..." : dirty ? "Save changes" : "Saved"}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <GroupEditor
              group={activeGroup}
              hero={heroDraft}
              onHeroChange={next =>
                setDrafts(prev => ({ ...prev, hero: next as Record<string, unknown> }))
              }
              label={(sectionDraft.label as string) ?? ""}
              onLabelChange={next =>
                setDrafts(prev => ({ ...prev, [sectionKey]: { ...sectionDraft, label: next } }))
              }
              slideIndex={slideIndex}
              onSlideIndex={setSlideIndex}
              buttonIndex={buttonIndex}
              onButtonIndex={setButtonIndex}
              onUpload={handleHeroUpload}
              onRemoveSlide={handleRemoveSlide}
              busyTarget={busyTarget}
              store={store}
              productId={productId}
              onProductId={setProductId}
            />
          </div>
        </div>

        {/* ── The real page, not a copy of it ── */}
        {showPreview && (
          <div className="hidden xl:flex w-[420px] flex-shrink-0 border-l border-white/20">
            <div className="w-full h-full">
              <PagePreview reloadKey={reloadKey} onReload={refreshPreview} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
