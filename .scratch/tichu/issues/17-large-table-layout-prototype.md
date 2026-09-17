# 17 How does a Table with 5 to 12 Seats look on a phone?

Type: prototype
Status: resolved
Blocked by: 11, 16
Map: ../map.md

## Question

Build a throwaway prototype of the Table screen for a Grand Seigneur Layout in portrait: up to eleven other Seats with card counts and hierarchy rank, the current Trick, own Hand, and the forced Exchange step. Decide whether the four-Seat screen generalises or a second screen is needed.

## Answer

Prototype: three variants in one HTML file, captured on branch `prototype/large-table` (`.scratch/tichu/prototypes/large-table.html`). Pavel reacted 2026-09-17.

**Verdict: variant A, the oval ring.** The four-Seat ring generalises: all other Seats sit on an oval above the Trick, each with card backs, count, Bot marker, turn marker and a hierarchy badge (gold for rank 1, red for the last rank); Participants who are out stay in place, dimmed. Same Trick area, single-row Hand and full-width buttons as the four-Seat Table. No second screen is needed.

- **Forced Exchange (give)**: the engine picks the best cards; the UI highlights them in the Hand and offers one confirm button naming the recipient and their title. Confirmed as confirm-only.
- **Return step**: the received cards join the Hand; the Player selects any N and confirms. Confirmed.
- Known limit: at twelve Seats the oval labels get tight; abbreviate nicknames and drop card backs to a count before shrinking the Trick.
- Rejected: B (hierarchy ladder, hides play order) and C (play-order arc plus hierarchy strip, too dense).
