"use client";
import ImageUpload from "../ui/ImageUpload";
import GameIcon from "../ui/GameIcon";
import { API_ENDPOINTS } from "../../utils/api";
import { useImageUpload } from "../../utils/useImageUpload";
import { Game } from "../../tournaments/types";

/**
 * The 1:1 icon for one game in the catalog.
 *
 * The crop happens here rather than only on the server so the admin chooses
 * which part of a wide logo survives — the server's centre-crop would decide
 * that for them, and a logo with its name off to one side would lose it.
 */
export default function GameIconField({
  game,
  onChanged,
}: {
  game: Pick<Game, "id" | "name" | "iconUrl">;
  onChanged: () => void | Promise<void>;
}) {
  const { upload, remove, uploading, error } = useImageUpload();

  return (
    <div className="flex flex-col gap-1.5 w-20 shrink-0">
      <ImageUpload
        currentUrl={game.iconUrl}
        aspectRatio="aspect-square"
        label={game.iconUrl ? "REPLACE" : "ADD ICON"}
        uploading={uploading}
        compact
        placeholder={<GameIcon game={game} size="tile" />}
        onUpload={async (file) => {
          const url = await upload(API_ENDPOINTS.IMAGES.UPLOAD_GAME_ICON(game.id), file);
          if (url) await onChanged();
        }}
        onDelete={
          game.iconUrl
            ? async () => {
                const ok = await remove(API_ENDPOINTS.IMAGES.DELETE_GAME_ICON(game.id));
                if (ok) await onChanged();
              }
            : undefined
        }
      />
      {error && <p className="text-[10px] text-red-500 leading-tight">{error}</p>}
    </div>
  );
}
