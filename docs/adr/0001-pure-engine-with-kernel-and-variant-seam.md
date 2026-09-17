---
status: accepted
---

# Pure command-in, events-out engine with a kernel-versus-Variant seam

The rules engine is a pure module: a command produces either a typed rule error or domain events, state is the fold of events, and `legalPlays` is the single source of legality for UI and Bots. It is parametrised by Layout (Seat count and Team partition) from day one, and split into a kernel (Deck, Combinations, Tricks, Wish, special cards) and Variants (Layout, Deck choice, deal, Exchange, scoring, Match state), because Grand Seigneur and later Trichu and Tientsin change Seat counts and Team shapes, and retrofitting "opposite Seat" out of every rule would be far more expensive than carrying a Layout value now.

## Considered options

Hardcoding four Seats and two Teams for the MVP was rejected for the reason above. A mutable state machine with validation methods was rejected because the event log, replay for future search Bots, and property tests all fall out of the fold-of-events shape for free.
