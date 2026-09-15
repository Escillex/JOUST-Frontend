"use client";

import { useEffect, useMemo, useState } from "react";
import ImageUpload from "../../ui/ImageUpload";
import Toggle from "../../ui/Toggle";
import AddImageButton from "./AddImageButton";
import Filmstrip from "./Filmstrip";
import { HeroContent, HeroSlideContent, HeroStoreButtonContent } from "../../../utils/homeConfig";
import { GroupKey, HeroUploadTarget, inputCls, labelCls } from "./editorTypes";
import { BLANK_PRODUCT, NewProductDraft, StoreProduct, useProducts } from "./useProducts";

const TAGLINE_MAX = 400;
const NEW_PRODUCT = "new";

interface Props {
  group: GroupKey;
  hero: HeroContent;
  onHeroChange: (next: HeroContent) => void;
  /** Marquee heading of the store / tournaments section. */
  label: string;
  onLabelChange: (next: string) => void;
  slideIndex: number;
  onSlideIndex: (index: number) => void;
  buttonIndex: number;
  onButtonIndex: (index: number) => void;
  onUpload: (file: File, target: HeroUploadTarget) => void;
  onRemoveSlide: (index: number) => void;
  busyTarget: string | null;
  store: ReturnType<typeof useProducts>;
  productId: string;
  onProductId: (id: string) => void;
}

export default function GroupEditor(props: Props) {
  switch (props.group) {
    case "hero:tagline":
      return <TaglineEditor {...props} />;
    case "hero:slides":
      return <SlidesEditor {...props} />;
    case "hero:buttons":
      return <ButtonsEditor {...props} />;
    case "shop:products":
      return <ProductsEditor {...props} />;
    default:
      return <HeadingEditor {...props} />;
  }
}

// ─── Hero: tagline ───────────────────────────────────────────────

function TaglineEditor({ hero, onHeroChange }: Props) {
  const description = hero.description ?? "";
  return (
    <div className="max-w-2xl space-y-2">
      <div className="flex items-baseline justify-between">
        <label className={labelCls} htmlFor="hero-description">
          Tagline
        </label>
        <span className="text-[10px] text-white/55">
          {description.length}/{TAGLINE_MAX}
        </span>
      </div>
      <textarea
        id="hero-description"
        value={description}
        maxLength={TAGLINE_MAX}
        onChange={e => onHeroChange({ ...hero, description: e.target.value })}
        rows={4}
        className={`${inputCls} resize-y leading-relaxed`}
        placeholder="The sentence under the logo on the opening screen."
      />
      <p className="text-[11px] text-white/55">
        Shown in large type beside the logo, above the storefront buttons.
      </p>
    </div>
  );
}

// ─── Hero: slides ────────────────────────────────────────────────

function SlidesEditor({
  hero,
  onHeroChange,
  slideIndex,
  onSlideIndex,
  onUpload,
  onRemoveSlide,
  busyTarget,
}: Props) {
  const slides: HeroSlideContent[] = hero.slides ?? [];
  const current = slides[slideIndex];

  const patch = (p: Partial<HeroSlideContent>) =>
    onHeroChange({
      ...hero,
      slides: slides.map((s, i) => (i === slideIndex ? { ...s, ...p } : s)),
    });

  const reorder = (from: number, to: number) => {
    const next = [...slides];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onHeroChange({ ...hero, slides: next });
    onSlideIndex(to);
  };

  return (
    <div className="space-y-6">
      <Filmstrip
        items={slides.map((s, i) => ({
          id: `${s.image}-${i}`,
          imageUrl: s.image,
          caption: s.title || undefined,
        }))}
        activeIndex={slideIndex}
        onSelect={onSlideIndex}
        onDelete={onRemoveSlide}
        onReorder={reorder}
        tileClass="w-[148px] h-[84px]"
        busy={!!busyTarget}
        emptyHint="No slides yet. Until one is added the opening screen shows the placeholder image, which is deliberately obvious — visitors can tell the site is unfinished."
        addSlot={
          <AddImageButton
            label="Add"
            aspectRatio={16 / 9}
            busy={busyTarget === "slide:new"}
            onPicked={file => onUpload(file, { kind: "slide" })}
            className="w-full h-full flex flex-col items-center justify-center gap-1 border-2 border-dashed border-white/25 text-[10px] font-black uppercase tracking-widest text-white/60 hover:border-primary hover:text-primary transition-colors disabled:opacity-40"
          />
        }
      />

      {current ? (
        <div className="border-t border-white/20 pt-6 grid gap-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className={labelCls}>Slide {slideIndex + 1} image</p>
            <ImageUpload
              currentUrl={current.image}
              onUpload={file => onUpload(file, { kind: "slide", index: slideIndex })}
              uploading={busyTarget === `slide:${slideIndex}`}
              aspectRatio="aspect-video"
              cropAspectRatio={16 / 9}
              label="Replace image"
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelCls}>Heading</label>
              <input
                className={inputCls}
                value={current.title ?? ""}
                maxLength={80}
                onChange={e => patch({ title: e.target.value })}
                placeholder="MASTER YOUR CRAFT"
              />
              <p className="mt-1 text-[11px] text-white/55">
                Names the slide here; the page itself shows the tagline, not this.
              </p>
            </div>
            <div>
              <label className={labelCls}>Side label</label>
              <input
                className={inputCls}
                value={current.photoDesc ?? ""}
                maxLength={80}
                onChange={e => patch({ photoDesc: e.target.value })}
                placeholder="COLLECTORS EDITION — SERIES 01"
              />
              <p className="mt-1 text-[11px] text-white/55">
                The rotated caption down the right-hand edge of the hero.
              </p>
            </div>
            <button
              onClick={() => onRemoveSlide(slideIndex)}
              className="text-[11px] font-black uppercase tracking-widest text-red-500/80 hover:text-red-500 transition-colors"
            >
              Remove this slide
            </button>
          </div>
        </div>
      ) : (
        slides.length > 0 && (
          <p className="text-[11px] text-white/60">Pick a slide above to edit it.</p>
        )
      )}
    </div>
  );
}

// ─── Hero: storefront buttons ────────────────────────────────────

function ButtonsEditor({
  hero,
  onHeroChange,
  buttonIndex,
  onButtonIndex,
  onUpload,
  busyTarget,
}: Props) {
  const buttons: HeroStoreButtonContent[] = hero.storeButtons ?? [];
  const current = buttons[buttonIndex];

  const patch = (p: Partial<HeroStoreButtonContent>) =>
    onHeroChange({
      ...hero,
      storeButtons: buttons.map((b, i) => (i === buttonIndex ? { ...b, ...p } : b)),
    });

  const remove = (index: number) => {
    onHeroChange({ ...hero, storeButtons: buttons.filter((_, i) => i !== index) });
    onButtonIndex(Math.max(0, index - 1));
  };

  const reorder = (from: number, to: number) => {
    const next = [...buttons];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onHeroChange({ ...hero, storeButtons: next });
    onButtonIndex(to);
  };

  const hostOf = (href?: string) => {
    if (!href) return "No link";
    try {
      return new URL(href, "https://example.com").host || href;
    } catch {
      return href;
    }
  };

  return (
    <div className="space-y-6">
      <Filmstrip
        items={buttons.map((b, i) => ({
          id: `btn-${i}`,
          imageUrl: b.iconUrl,
          caption: b.text || hostOf(b.href),
        }))}
        activeIndex={buttonIndex}
        onSelect={onButtonIndex}
        onDelete={remove}
        onReorder={reorder}
        tileClass="w-[136px] h-[84px]"
        contain
        busy={!!busyTarget}
        emptyHint="No storefront buttons. The hero shows none until one is added."
        addSlot={
          <button
            onClick={() => {
              onHeroChange({
                ...hero,
                storeButtons: [...buttons, { text: "", href: "", color: "#FFFFFF", iconScale: 1 }],
              });
              onButtonIndex(buttons.length);
            }}
            className="w-full h-full flex flex-col items-center justify-center gap-1 border-2 border-dashed border-white/25 text-[10px] font-black uppercase tracking-widest text-white/60 hover:border-primary hover:text-primary transition-colors"
          >
            <span className="text-sm leading-none">+</span>
            Add
          </button>
        }
      />

      {current && (
        <div className="border-t border-white/20 pt-6 grid gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className={labelCls}>Logo</p>
            <ImageUpload
              currentUrl={current.iconUrl ?? undefined}
              onUpload={file => onUpload(file, { kind: "logo", index: buttonIndex })}
              uploading={busyTarget === `logo:${buttonIndex}`}
              aspectRatio="aspect-[5/2]"
              cropAspectRatio={5 / 2}
              label="Upload logo"
            />
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1">
                <label className={labelCls}>Background</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(current.color ?? "") ? current.color : "#FFFFFF"}
                    onChange={e => patch({ color: e.target.value })}
                    className="h-8 w-10 bg-black border border-white/20 cursor-pointer"
                    aria-label="Button background colour"
                  />
                  <input
                    className={inputCls}
                    value={current.color ?? ""}
                    onChange={e => patch({ color: e.target.value })}
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>
              <div className="w-24">
                <label className={labelCls}>Logo size</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="2"
                  className={inputCls}
                  value={current.iconScale ?? 1}
                  onChange={e => patch({ iconScale: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelCls}>Label</label>
              <input
                className={inputCls}
                value={current.text ?? ""}
                maxLength={40}
                onChange={e => patch({ text: e.target.value })}
                placeholder="Leave empty to show the logo alone"
              />
            </div>
            <div>
              <label className={labelCls}>Link</label>
              <input
                className={inputCls}
                value={current.href ?? ""}
                onChange={e => patch({ href: e.target.value })}
                placeholder="https://shopee.ph/…"
              />
              <p className="mt-1 text-[11px] text-white/55">
                A full https link, or a path on this site. A button with no link is
                dropped when the section is saved.
              </p>
            </div>
            <button
              onClick={() => remove(buttonIndex)}
              className="text-[11px] font-black uppercase tracking-widest text-red-500/80 hover:text-red-500 transition-colors"
            >
              Remove this button
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Store / tournaments: marquee heading ────────────────────────

function HeadingEditor({ group, label, onLabelChange }: Props) {
  const isShop = group.startsWith("shop");
  return (
    <div className="max-w-xl space-y-2">
      <label className={labelCls} htmlFor="section-label">
        Marquee heading
      </label>
      <input
        id="section-label"
        className={inputCls}
        maxLength={40}
        value={label}
        onChange={e => onLabelChange(e.target.value)}
        placeholder={isShop ? "STORE" : "TOURNAMENTS"}
      />
      <p className="text-[11px] text-white/55 leading-relaxed">
        The scrolling band above this section.
        {!isShop &&
          " The events below it come from the tournaments the platform is running — open, upcoming and live ones appear automatically."}
      </p>
    </div>
  );
}

// ─── Store: products ─────────────────────────────────────────────

function ProductsEditor({ store, productId, onProductId }: Props) {
  const { products, busyId, saving, create, update, remove, uploadImage, removeImage } = store;
  const selected = products.find(p => p.id === productId);
  const isNew = productId === NEW_PRODUCT || (!selected && products.length === 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <div className="space-y-2">
        <button
          onClick={() => onProductId(NEW_PRODUCT)}
          className={`w-full h-10 px-3 flex items-center gap-2 border border-dashed text-[11px] font-black uppercase tracking-widest transition-colors ${
            isNew
              ? "border-primary text-primary"
              : "border-white/25 text-white/60 hover:border-primary hover:text-primary"
          }`}
        >
          <span className="text-sm leading-none">+</span> New product
        </button>

        <div className="max-h-[520px] overflow-y-auto custom-scrollbar space-y-1 pr-1">
          {products.map(product => (
            <button
              key={product.id}
              onClick={() => onProductId(product.id)}
              className={`w-full flex items-center gap-3 h-14 px-2 border text-left transition-colors ${
                product.id === productId
                  ? "border-primary bg-primary/5"
                  : "border-white/25 bg-[#121212] hover:border-white/60"
              } ${product.isVisible ? "" : "opacity-50"}`}
            >
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.imageUrl}
                  alt=""
                  className="w-8 h-10 object-cover flex-shrink-0 border border-white/20"
                />
              ) : (
                <span className="w-8 h-10 flex-shrink-0 border border-dashed border-white/25" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-black text-white truncate">
                  {product.name || "Untitled"}
                </span>
                <span className="block text-[10px] text-white/65 uppercase tracking-[0.15em] truncate">
                  {product.category || "Uncategorised"}
                </span>
              </span>
              <span className="text-[12px] font-black text-primary flex-shrink-0">
                {product.price}
              </span>
            </button>
          ))}
        </div>

        {products.length === 0 && (
          <p className="text-[11px] text-white/60 leading-relaxed">
            No products yet. The store section shows an empty state until one is added.
          </p>
        )}
      </div>

      {isNew ? (
        <NewProductForm
          saving={saving}
          onCreate={async (draft, file) => {
            const id = await create(draft, file);
            if (id) onProductId(id);
          }}
        />
      ) : selected ? (
        <ProductForm
          key={selected.id}
          product={selected}
          busy={busyId === selected.id || saving}
          onSave={patch => update(selected.id, patch)}
          onDelete={async () => {
            const ok = await remove(selected.id);
            if (ok) onProductId(NEW_PRODUCT);
          }}
          onUploadImage={file => uploadImage(selected.id, file)}
          onRemoveImage={() => removeImage(selected.id)}
        />
      ) : (
        <p className="text-[11px] text-white/60">Pick a product to edit it.</p>
      )}
    </div>
  );
}

function ProductForm({
  product,
  busy,
  onSave,
  onDelete,
  onUploadImage,
  onRemoveImage,
}: {
  product: StoreProduct;
  busy: boolean;
  onSave: (patch: Partial<StoreProduct>) => void;
  onDelete: () => void;
  onUploadImage: (file: File) => void;
  onRemoveImage: () => void;
}) {
  // No effect resyncs this draft: the parent renders ProductForm with
  // key={product.id}, so picking another product mounts a fresh form.
  const [draft, setDraft] = useState({
    name: product.name,
    price: product.price,
    category: product.category ?? "",
    description: product.description ?? "",
    link: product.link ?? "",
  });

  const dirty = useMemo(
    () =>
      draft.name !== product.name ||
      draft.price !== product.price ||
      draft.category !== (product.category ?? "") ||
      draft.description !== (product.description ?? "") ||
      draft.link !== (product.link ?? ""),
    [draft, product],
  );

  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] items-start">
      <div className="space-y-2">
        <p className={labelCls}>Picture</p>
        <ImageUpload
          currentUrl={product.imageUrl ?? undefined}
          onUpload={onUploadImage}
          onDelete={product.imageUrl ? onRemoveImage : undefined}
          uploading={busy}
          aspectRatio="aspect-[4/5]"
          cropAspectRatio={4 / 5}
          label="Update picture"
        />
      </div>

      <div className="space-y-4">
        <div>
          <label className={labelCls}>Product name</label>
          <input
            className={inputCls}
            value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Price</label>
            <input
              className={inputCls}
              value={draft.price}
              onChange={e => setDraft(d => ({ ...d, price: e.target.value }))}
              placeholder="₱1,299"
            />
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <input
              className={inputCls}
              value={draft.category}
              onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
              placeholder="APPAREL"
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input
            className={inputCls}
            value={draft.description}
            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
            placeholder="One line under the name."
          />
        </div>
        <div>
          <label className={labelCls}>External link</label>
          <input
            className={inputCls}
            value={draft.link}
            onChange={e => setDraft(d => ({ ...d, link: e.target.value }))}
            placeholder="https://..."
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => onSave(draft)}
            disabled={!dirty || busy}
            className="px-5 py-2 bg-primary text-black text-[11px] font-black uppercase tracking-[0.2em] hover:brightness-110 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
          >
            {busy ? "Saving..." : dirty ? "Save product" : "Saved"}
          </button>
          <Toggle
            size="md"
            checked={product.isVisible}
            onChange={value => onSave({ isVisible: value })}
            disabled={busy}
            label={product.isVisible ? "Shown" : "Hidden"}
            ariaLabel={`${product.isVisible ? "Hide" : "Show"} ${product.name || "this product"}`}
            title={
              product.isVisible
                ? "Shown in the store carousel"
                : "Hidden from the store carousel"
            }
          />
          <button
            onClick={onDelete}
            disabled={busy}
            className="ml-auto text-[11px] font-black uppercase tracking-widest text-red-500/80 hover:text-red-500 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function NewProductForm({
  saving,
  onCreate,
}: {
  saving: boolean;
  onCreate: (draft: NewProductDraft, file: File | null) => void;
}) {
  const [draft, setDraft] = useState<NewProductDraft>({ ...BLANK_PRODUCT });
  const [file, setFile] = useState<File | null>(null);

  // One object URL per picked file, released when it changes or the form closes.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] items-start">
      <div className="space-y-2">
        <p className={labelCls}>Picture</p>
        <ImageUpload
          currentUrl={preview}
          onUpload={setFile}
          onDelete={() => setFile(null)}
          aspectRatio="aspect-[4/5]"
          cropAspectRatio={4 / 5}
          label={file ? "Picture chosen" : "Choose picture"}
        />
      </div>

      <div className="space-y-4">
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/65">
          New product
        </p>
        <div>
          <label className={labelCls}>Product name *</label>
          <input
            className={inputCls}
            value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            placeholder="e.g. Hobby+ Cap"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Price *</label>
            <input
              className={inputCls}
              value={draft.price}
              onChange={e => setDraft(d => ({ ...d, price: e.target.value }))}
              placeholder="₱899"
            />
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <input
              className={inputCls}
              value={draft.category}
              onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
              placeholder="GEAR"
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input
            className={inputCls}
            value={draft.description}
            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
          />
        </div>
        <div>
          <label className={labelCls}>External link</label>
          <input
            className={inputCls}
            value={draft.link}
            onChange={e => setDraft(d => ({ ...d, link: e.target.value }))}
            placeholder="https://..."
          />
        </div>
        <button
          onClick={() => onCreate(draft, file)}
          disabled={saving || !draft.name || !draft.price}
          className="px-5 py-2 border border-primary text-primary text-[11px] font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-black transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {saving ? "Creating..." : "Create product"}
        </button>
      </div>
    </div>
  );
}
