"use client";

import { useState } from "react";
import { API_ENDPOINTS } from "../../utils/api";
import { GamePlayed } from "../../tournaments/types";
import ProfileSection from "../profile/ProfileSection";
import { formStyles } from "../profile/formStyles";
import { errorText, send } from "./account";
import { SettingsIcons } from "./icons";
import GamesPicker from "../profile/GamesPicker";

/** The games you say you play. Shown on your profile, and tournaments for them
 *  come first when you browse. Saved on every toggle — there is nothing to get
 *  wrong and nothing to lose, so a Save button would only add a step. */
export default function GamesSection({
  games,
  onSaved,
}: {
  games: GamePlayed[] | undefined;
  onSaved: () => void | Promise<void>;
}) {
  const [picked, setPicked] = useState<string[]>((games ?? []).map((g) => g.id));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const save = async (next: string[]) => {
    const previous = picked;
    setPicked(next);
    setBusy(true);
    setMessage(null);
    const { ok, data } = await send(API_ENDPOINTS.AUTH.ME, { gameIds: next }, "PATCH");
    setBusy(false);
    if (ok) {
      setMessage({ text: "Saved.", ok: true });
      await onSaved();
    } else {
      // Put the switch back where it was rather than showing a state the server
      // did not accept.
      setPicked(previous);
      setMessage({ text: errorText(data, "Could not save."), ok: false });
    }
  };

  return (
    <ProfileSection title="Games I play" icon={SettingsIcons.dice}>
      <div className={`${formStyles.card} flex flex-col gap-4`}>
        <p className={formStyles.help}>
          Shown on your profile. Tournaments for these games come first when you browse.
        </p>

        <GamesPicker value={picked} onChange={save} variant="rows" disabled={busy} />

        {message ? (
          <p className={message.ok ? formStyles.ok : formStyles.error} role="status">
            {message.text}
          </p>
        ) : (
          <p className={formStyles.help}>Saved automatically.</p>
        )}
      </div>
    </ProfileSection>
  );
}
