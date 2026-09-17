# 11 How does the Table look and feel during a Trick?

Type: prototype
Status: resolved
Blocked by: 10
Map: ../map.md

## Question

Build a throwaway prototype of the Table screen in portrait: own Hand, the current Trick, the three other Seats with card counts and Calls, whose turn it is, Pass and Play controls, Wish and Dragon Gift prompts. Decide the layout and interaction model.

Note (from the card-art verdict): use variant D from `prototype/card-art`: tinted faces, single overlapping row, corner rank. Fix the two-digit rank clipping.

## Answer

Prototype: three variants in one HTML file, captured on branch `prototype/table-layout` (`.scratch/tichu/prototypes/table-layout.html`, on top of the card-art prototype). Pavel reacted 2026-09-17.

**Verdict: variant A, the ring.** Partner at the top, opponents left and right, each Seat with nickname, card backs, card count, Call badge, Bot marker and a turn marker; the current winning Play large in the centre with a one-line history of the Trick under it; own Hand as the single overlapping row from the card-art verdict; Pass and Play as two full-width buttons under the Hand, disabled when not your turn.

- Prompts (Wish, Dragon Gift) as a sheet above the Hand; reconnecting as a top banner naming the takeover Bot and the grace period. Pavel raised no objection to the sheet style.
- Rejected: B (Seat chips plus vertical timeline) and C (opponent row plus horizontal strip with round action buttons).
- Header shows Round, Trick, both Team scores and the target.
