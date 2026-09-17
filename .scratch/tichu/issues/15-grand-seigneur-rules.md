# 15 What are the canonical Grand Seigneur rules and where are they ambiguous?

Type: research
Status: resolved
Blocked by: 
Map: ../map.md

## Question

From the Fata Morgana English and German rules (the same primary sources as the Tichu rules reference), write the Grand Seigneur variant as engine-ready statements in glossary terms: Seat range and Layout (individual play, Teams of one), Deck per Participant count including the two-deck rules (removed second Mah Jong, second Dragon beats the first, four-suit Bombs), removed Dog, no Calls, the Seat hierarchy from finishing order and the unequal forced Exchange, Round end, what if anything is scored, and how a Match ends. List every point where the text is silent or where Career Poker or President-style implementations differ. Deliverable: `.scratch/tichu/research/grand-seigneur-rules.md`.

## Answer

Rules with citations: [research/grand-seigneur-rules.md](../research/grand-seigneur-rules.md). Sources: the Fata Morgana English PDF, the 2022 German booklet, and the Rio Grande rules. The official FAQ and the Abacus sheet say nothing about Grand Seigneur.

- **37 engine-ready rule statements**: 5 to 12 Seats as Teams of one; Deck of 55 (one Deck minus the Dog) or 109 (two Decks minus both Dogs and the second Mah Jong, recommended from seven Participants); a second Dragon beats the first; four-of-a-kind Bombs need four suits; no Calls; nothing scored.
- **Hierarchy**: Great Lord, Lord, Squire, Burgher, Pauper, Wretch, derived from finishing order. Forced Exchange: Wretch gives 3 to Great Lord, Pauper 2 to Lord, Burgher 1 to Squire (one fewer each at five Participants); special cards are forced in the order Dragon, Phoenix, Mah Jong; recipients return any cards simultaneously.
- The Mah Jong holder leads every Round, not the Great Lord. A Round ends when one Participant still holds cards. No Match end is defined by the rules.
- **Derived finding**: base Tichu plays to the right while the hierarchy is seated to the left, so play order runs Great Lord, Wretch, Pauper, and so on. The English PDF mistranslates the Wretch's side; the German and Rio Grande texts agree on right.
- **18 silences or ambiguities** with options and a default each: uneven Hands, Exchange pairing above six, whether the Mah Jong counts as a best card, blind versus sighted return, identical singles, Bombs and Phoenixes, a Dragon pair, Dragon Gift, Match length, rank names.
- Career Poker and President comparisons come from secondary sources only and are marked UNVERIFIED.
- **Kernel impact**: only the two options already reserved (four-suit Bombs, later Dragon wins). Everything else is Variant-level. Two additions the kernel must make: emit the full finishing order of a Round, and let a Variant drop the Dragon Gift when it does not score.
- **Glossary gap**: Match was defined by target score, which Grand Seigneur lacks. Fixed in CONTEXT.md: a Match ends as its Variant defines.
