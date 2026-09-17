# 05 How is the rules engine modelled?

Type: grilling
Status: resolved
Blocked by: 04
Map: ../map.md

## Question

Decide the rules engine: the phase state machine of a Round (deal, Grand Tichu window, Exchange, Tricks, scoring), the representation of cards, Hands, Combinations and Plays, how legal Plays are enumerated (Bots need this), how the Wish and Bombs out of turn are enforced, and every edge case the rules reference left open. Decide the extension seam a future variant would use, without building any variant. Engine is pure and deterministic given a seed, expressed with Effect, and property-testable. Record resolved terms in CONTEXT.md.

## Answer

Resolved by grilling with Pavel, 2026-09-17. Rules reference: [research/tichu-rules-reference.md](../research/tichu-rules-reference.md).

**Engine shape**
- Pure module: a command in (`Play`, `Pass`, `Call`, `Exchange`, `DragonGift`, ...), a typed rule error or a list of domain events out; state is the fold of events. One enumerator, `legalPlays(state, seat)`, is the single source of legality for UI and Bots.
- Deterministic: the deal event records the actual Hands, never just a seed. The shuffle uses an injected Effect `Random` service.
- Expressed with Effect; property-tested with the built-in arbitraries.

**Kernel versus Variant** (the extension seam)
- **Kernel** (shared by every Variant): the Deck and card identity (rank, suit, copy index, so two decks are distinguishable), Combination classification and comparison, Trick mechanics (lead, beat, Pass, Bomb ordering), Wish enforcement, special-card behaviour. The kernel plays one Round given a setup and knows nothing about Matches.
- **Kernel options**, only what Grand Seigneur demonstrably needs: whether a four-of-a-kind Bomb requires four distinct suits, and whether an identical Dragon played later beats the earlier one. The Dog is absent from a Deck rather than toggled.
- **Variant** owns: the Layout, the Deck, deal procedure and Call windows, Exchange procedure, Round-end condition, transfers, scoring, and the Match-level state carried between Rounds (standard Tichu: two Team totals; Grand Seigneur: the Seat hierarchy). Standard Tichu is the only Variant built in this effort.
- The engine is parametrised by **Layout** from day one: Seat count and Team partition are values; turn order, "next Seat still holding cards", partner lookup and per-Team scoring are written against them. Individual play is Teams of one. No non-standard Variant is built here.

**Rule decisions for standard Tichu**
- Out-of-turn Bombs: first-come, server order breaks ties; a Bomb is legal any time before the next Play is registered. The Trick is collected on the closing Pass, a documented deviation from "Bomb after three Passes". Bombs are commands legal in any phase with an open Trick, so an explicit Bomb window can become a Match option later.
- Grand Tichu: simultaneous and private after eight cards. Sequential official procedure is fog.
- Phoenix: every Play names the rank the Phoenix stands for; the engine validates, never infers. Clients default to the highest legal reading.
- Wish: rides on the Mah Jong's Play with a "no Wish" choice. If any legal Play contains a natural card of the wished rank, the Participant is restricted to that subset and may not Pass. The Dog is a lead like any other, so it is forbidden while a lawful lead containing the wished rank exists.
- Dragon Gift: a separate command after the Trick closes, blocking the next lead. Automatic when both opponents are out (the choice cannot affect the score); prompted otherwise.
- Match settings: target score (default 1000) and tie rule (play on until untied). Fixed-Rounds and the Abacus Wish penalty are fog.
- Adopted from the reference: a Trick ends when every Participant still holding cards, other than the last to Play, has Passed; a Passer may re-enter; Tichu may be Called any time before the Participant's first Play, not mid-Exchange; the Exchange is atomic (three cards from each, then reveal); at most one irrevocable Call per Participant per Round; no Bomb on the Dog, no Bomb led out of turn, no Bomb window on the Round-ending Play; no floor on negative totals; play order is Seat 0 upward and the UI decides the drawn direction.

**Ripples**: the Table takes its Seat count and Team shape from the chosen Variant's Layout (lobby ticket 12, bot interface ticket 09). Grand Seigneur graduates from fog into research ticket 15, grilling ticket 16 and a large-Table prototype ticket 17.

Glossary updated in `CONTEXT.md`: Seat, Team, Variant, Layout, Deck, Round.

**Amendment (from the Grand Seigneur rules research, same day)**: the kernel also emits the full finishing order of a Round as events, and treats the Dragon Gift as a Variant-enabled step so a non-scoring Variant can omit it. No further kernel options were needed.
