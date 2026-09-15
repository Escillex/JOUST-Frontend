"use client";

import { DragDropProvider, PointerSensor, DragEndEvent } from "@dnd-kit/react";
import { useSortable, isSortable } from "@dnd-kit/react/sortable";
import { HomeBlock, HOME_BLOCK_LABELS, HomeBlockKey } from "../../../utils/homeConfig";
import Toggle from "../../ui/Toggle";
import { GROUPS, GroupKey, sectionOf } from "./editorTypes";

interface Props {
  blocks: HomeBlock[];
  activeGroup: GroupKey;
  onSelectGroup: (group: GroupKey) => void;
  onToggleVisible: (key: string, visible: boolean) => void;
  /** New top-to-bottom order, as keys. */
  onReorder: (keys: string[]) => void;
  /** Key currently being written, so the row can show it. */
  busyKey: string | null;
  /** How many items each countable part holds, shown beside its name. */
  counts: Record<string, number>;
}

interface RowProps extends Omit<Props, "blocks" | "onReorder"> {
  block: HomeBlock;
  index: number;
}

function SectionRow({
  block,
  index,
  activeGroup,
  onSelectGroup,
  onToggleVisible,
  busyKey,
  counts,
}: RowProps) {
  const { ref, handleRef, isDragging } = useSortable({ id: block.key, index });
  const meta = HOME_BLOCK_LABELS[block.key as HomeBlockKey];
  const groups = GROUPS[block.key] ?? [];
  const active = sectionOf(activeGroup) === block.key;

  return (
    <div ref={ref} className="space-y-px">
      <div
        className={`border transition-colors ${
          isDragging ? "border-primary bg-white/5" : active ? "border-primary bg-white/[0.06]" : "border-white/20 bg-[#101010]"
        } ${block.visible ? "" : "opacity-60"}`}
      >
        <div className="flex items-center gap-2 h-11 px-2">
          <button
            ref={handleRef}
            className="cursor-grab active:cursor-grabbing text-white/45 hover:text-white transition-colors px-1"
            aria-label={`Reorder ${meta?.title ?? block.key}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" />
              <circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" />
              <circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" />
            </svg>
          </button>

          <button
            onClick={() => onSelectGroup(groups[0].key)}
            className="flex-1 text-left min-w-0"
          >
            <span className="text-[12px] font-black uppercase tracking-[0.15em] text-white truncate block">
              {meta?.title ?? block.key}
            </span>
          </button>

          <Toggle
            checked={block.visible}
            onChange={value => onToggleVisible(block.key, value)}
            disabled={busyKey === block.key}
            ariaLabel={`${block.visible ? "Hide" : "Show"} ${meta?.title ?? block.key}`}
            title={
              block.visible
                ? "Shown on the public page"
                : "Hidden from the public page"
            }
          />
        </div>

        <div className="pb-1">
          {groups.map(g => {
            const count = counts[g.key];
            const on = activeGroup === g.key;
            return (
              <button
                key={g.key}
                onClick={() => onSelectGroup(g.key)}
                aria-label={`${meta?.title ?? block.key} ${g.title}`}
                aria-current={on}
                className={`w-full h-8 pl-8 pr-3 flex items-center justify-between text-left transition-colors ${
                  on ? "bg-primary/10 text-primary" : "text-white/70 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <span className="text-[11px] font-black uppercase tracking-[0.1em] truncate">
                  {g.title}
                </span>
                {count !== undefined && (
                  <span className={`text-[10px] font-black ${on ? "text-primary" : "text-white/55"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * The page's sections and their parts, two levels deep. Dragging a section
 * writes the new page order straight away — an order that only exists in the
 * browser is the kind of gap this editor was rebuilt to remove.
 */
export default function SectionRail({ blocks, onReorder, ...rowProps }: Props) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { source } = event.operation;
    // The list reorders itself live while a row is dragged, so at drop time the
    // row under the pointer is usually the dragged row — comparing source and
    // target ids here silently threw away every drag. Read the row's own index.
    if (event.canceled || !source || !isSortable(source)) return;

    const from = source.initialIndex;
    const to = source.index;
    if (from === to) return;

    const keys = blocks.map(b => b.key);
    keys.splice(to, 0, keys.splice(from, 1)[0]);
    onReorder(keys);
  };

  return (
    <div className="p-4 space-y-3">
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/60">
        Page sections
      </p>
      <DragDropProvider sensors={[PointerSensor]} onDragEnd={handleDragEnd}>
        <div className="space-y-2">
          {blocks.map((block, index) => (
            <SectionRow key={block.key} block={block} index={index} {...rowProps} />
          ))}
        </div>
      </DragDropProvider>
      <p className="text-[10px] text-white/55 leading-relaxed">
        Drag a section to reorder the page. Hiding one removes it from the public
        page at once; its contents are kept.
      </p>
    </div>
  );
}
