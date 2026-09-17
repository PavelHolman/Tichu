# 16 How is the Grand Seigneur Variant modelled on the kernel?

Type: grilling
Status: resolved
Blocked by: 05, 15
Map: ../map.md

## Question

Decide the Grand Seigneur Variant against the kernel and Variant seams fixed in the rules engine ticket: its Layout for 5 to 12 Seats, Deck construction per Participant count, the kernel options it switches on, its Match-level state (the hierarchy), Round setup and forced Exchange, Round end, and Match end. Confirm the kernel needs nothing beyond the two options already named; if it does, record the kernel change. Verify with concrete scenarios (two Dragons in one Trick, a four-suit Bomb versus two pairs of the same rank).

## Answer

Resolved by grilling with Pavel, 2026-09-17. Rules: [research/grand-seigneur-rules.md](../research/grand-seigneur-rules.md).

- **Layout**: 5 to 12 Seats, Teams of one. Initial Seat order is join order; afterwards Seats are renumbered from the hierarchy, preserving the printed play order (Great Lord, then Wretch, then Pauper, and so on).
- **Deck**: one Deck minus the Dog (55 cards); from seven Participants the Table default is two Decks minus both Dogs and the second Mah Jong (109 cards), one Deck still allowed.
- **Kernel options switched on**: four-suit Bombs; a later identical Dragon beats the earlier one. Kernel additions already recorded on the engine ticket: finishing-order events and a Variant-skippable Dragon Gift.
- **Match state**: the hierarchy (ranks 1..n) from the previous Round's finishing order. Rank names are a per-Layout table owned by the UI; the engine uses ranks.
- **Round setup**: deal one card at a time from the Wretch so the lowest Seats hold the extra cards. Forced Exchange: rank n-k+1 gives rank k its k-best cards for k = 1..3 with amounts 3/2/1 (2/1/0 at five); "best" is the total order Dragon, Phoenix, Mah Jong, then Ace down to 2; the giver chooses among equal-rank cards. Recipients return any cards **sighted**, after seeing what they received (Pavel's decision, overriding the research's literal reading).
- **Play**: the Mah Jong holder leads every Round. Trick ends when all other Participants still holding cards have Passed. No Calls, no Dragon Gift, no scoring. Identical singles, identical Bombs and Phoenix-on-Phoenix never beat each other; a Dragon pair is not a Combination; four equal cards with a repeated suit are not a legal Play.
- **Match end**: open-ended; the creator closes the Table (Pavel's decision). No fixed-Rounds setting.
- The remaining research defaults (A-1 to A-18) are adopted as written except A-7 and A-16 above.
