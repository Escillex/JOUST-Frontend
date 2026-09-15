"use client";

import { ReactNode } from "react";
import { DragDropProvider, PointerSensor, DragEndEvent } from "@dnd-kit/react";
import { useSortable, isSortable } from "@dnd-kit/react/sortable";
import { resolveImageUrl } from "../../../utils/api";

export interface FilmstripItem {
  id: string;
  imageUrl?: string | null;
  /** Second line on the tile — a heading, a link, whatever names it. */
  caption?: string;
}

interface Props {
  items: FilmstripItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onDelete: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  /** Tile-shaped control that appends a new item. */
  addSlot: ReactNode;
  /** Tile size, e.g. "w-[148px] h-[84px]" — 16:9 for slides, wider for logos. */
  tileClass: string;
  /** Shown in place of the strip when there is nothing yet. */
  emptyHint: string;
  /** True while a write is in flight; the delete buttons stand down. */
  busy?: boolean;
  /** Logos sit inside the tile rather than filling it. */
  contain?: boolean;
}

interface TileProps extends Omit<Props, "items" | "onReorder" | "addSlot" | "emptyHint"> {
  item: FilmstripItem;
  index: number;
}

function Tile({ item, index, activeIndex, onSelect, onDelete, tileClass, busy, contain }: TileProps) {
  const { ref, handleRef, isDragging } = useSortable({ id: item.id, index });
  const active = index === activeIndex;

  return (
    <div ref={ref} className="relative flex-shrink-0 group">
      <button
        ref={handleRef}
        onClick={() => onSelect(index)}
        className={`relative block overflow-hidden border-2 transition-colors cursor-grab active:cursor-grabbing ${tileClass} ${
          isDragging
            ? "border-primary"
            : active
              ? "border-primary shadow-[0_0_20px_rgba(82,185,70,0.25)]"
              : "border-white/20 hover:border-white/60"
        }`}
        aria-label={`Select item ${index + 1}${item.caption ? ` — ${item.caption}` : ""}`}
        aria-current={active}
      >
        {item.imageUrl ? (
          // Raw <img>: these are small, already-sized thumbnails and the source
          // can be a blob: URL mid-upload, which next/image cannot parse.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveImageUrl(item.imageUrl)}
            alt=""
            className={`w-full h-full ${contain ? "object-contain p-2 bg-black" : "object-cover"} ${active ? "" : "opacity-70 group-hover:opacity-95"} transition-opacity`}
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center bg-black text-[10px] font-black uppercase tracking-widest text-white/55">
            No image
          </span>
        )}

        <span
          className={`absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-black leading-none ${
            active ? "bg-primary text-black" : "bg-black/80 text-white/75"
          }`}
        >
          {index + 1}
        </span>

        {item.caption && (
          <span className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-black/80 text-[10px] font-black uppercase tracking-widest text-white/85 truncate text-left">
            {item.caption}
          </span>
        )}
      </button>

      <button
        onClick={() => onDelete(index)}
        disabled={busy}
        aria-label={`Remove item ${index + 1}`}
        title="Remove"
        className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-black border border-white/20 text-white/75 text-[12px] leading-none opacity-0 group-hover:opacity-100 focus:opacity-100 hover:border-red-500/60 hover:text-red-500 transition-colors disabled:opacity-30"
      >
        ×
      </button>
    </div>
  );
}

/**
 * A horizontal strip of thumbnails: pick one, drag it along the strip to
 * reorder, delete it in place. Slides have no names to list, so the picture is
 * the label — and ten of them fit in one row instead of ten crop boxes stacked
 * down the page.
 */
export default function Filmstrip({ items, addSlot, emptyHint, onReorder, ...tileProps }: Props) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { source } = event.operation;
    if (event.canceled || !source || !isSortable(source)) return;
    const from = source.initialIndex;
    const to = source.index;
    if (from !== to) onReorder(from, to);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-2 custom-scrollbar">
        <DragDropProvider sensors={[PointerSensor]} onDragEnd={handleDragEnd}>
          {items.map((item, index) => (
            <Tile key={item.id} item={item} index={index} {...tileProps} />
          ))}
        </DragDropProvider>
        <div className={`flex-shrink-0 ${tileProps.tileClass}`}>{addSlot}</div>
      </div>

      {items.length === 0 ? (
        <p className="text-[11px] text-white/60 leading-relaxed">{emptyHint}</p>
      ) : (
        <p className="text-[10px] text-white/55 uppercase tracking-[0.2em]">
          Click to edit · drag to reorder · × to remove
        </p>
      )}
    </div>
  );
}
