/** Round-number encoding for brackets. Plan 9.17.
 *
 *  The backend packs three brackets into one integer column (see
 *  `initDoubleElimination` in `server/src/Formats/formats.service.ts`):
 *
 *    1 .. k        winners bracket / a single-elimination bracket
 *    101 .. 100+n  losers bracket   (created as `100 + r`, so it starts at 101)
 *    200           grand final
 *
 *  That was an undocumented shared contract with the numbers inlined at eight
 *  call sites, and the frontend applied it **inconsistently**: `EliminationLayout`
 *  split on `< 100` / `>= 100` while the desktop and mobile views split on
 *  `< 101` / `>= 101`. Both happen to be correct only because round 100 is never
 *  generated — the first losers round is 101. The moment anything emitted a 100
 *  the two halves of the UI would disagree about which bracket it belonged to.
 *
 *  Named here once so the boundary is stated rather than remembered.
 */

/** Losers-bracket rounds are stored as this offset plus the round index. */
export const LOSERS_ROUND_OFFSET = 100;

/** The first losers-bracket round number (`100 + 1`). */
export const FIRST_LOSERS_ROUND = LOSERS_ROUND_OFFSET + 1;

/** The grand final sits above every bracket round. */
export const GRAND_FINAL_ROUND = 200;

export function isWinnersRound(roundNumber: number): boolean {
  return roundNumber < FIRST_LOSERS_ROUND;
}

export function isLosersRound(roundNumber: number): boolean {
  return roundNumber >= FIRST_LOSERS_ROUND && roundNumber < GRAND_FINAL_ROUND;
}

export function isGrandFinal(roundNumber: number): boolean {
  return roundNumber >= GRAND_FINAL_ROUND;
}

/** The losers-bracket round as an organizer counts it: 101 reads as "1". */
export function losersRoundIndex(roundNumber: number): number {
  return roundNumber - LOSERS_ROUND_OFFSET;
}
