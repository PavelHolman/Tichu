# 04 What is the canonical rule set, and which edge cases must the engine decide?

Type: research
Status: resolved
Blocked by: 
Map: ../map.md

## Question

From the official Fata Morgana rules (and the widely used online rule references only where the official text is silent), write down the canonical rules of four-player Tichu in glossary terms: deal and Grand Tichu window, Exchange, Mah Jong lead and Wish enforcement, Dog, Phoenix as single and as wildcard, Dragon and Dragon Gift, Bombs out of turn, Call timing and scoring, one-two finish, end of Round scoring including hand transfer. List every edge case where rule sets disagree or the text is ambiguous, so the engine grilling can decide each one. Also list the documented Tichu variants with one line each. Deliverable: `.scratch/tichu/research/tichu-rules-reference.md`.

## Answer

Canonical rules and edge cases are written down with citations: [research/tichu-rules-reference.md](../research/tichu-rules-reference.md).

- **Sources**: the Fata Morgana English leaflet and FAQ, the 2022 German Fata Morgana/Abacus booklet, the official German FAQ, the Spielhilfe card, and the Rio Grande rules. Every rule statement cites at least one.
- **Part 1**: 80 engine-ready rule statements (R1.1 to R14.4) covering deck, the 8+6 deal and Grand Tichu window, Exchange, Wish enforcement (in-turn only; Bombs, straights and Phoenix-as-filler bind; the Phoenix never *is* the wished rank), Dog, Phoenix (1½ when led, never beats the Dragon, never in a Bomb), Dragon Gift (none when bombed, still gifted on the last Trick), Bombs, Calls, one-two finish, transfers, points, 1000 target.
- **Primary-only findings worth remembering**: a Passer may re-enter a Trick; Bombs are allowed after three Passes before collection; a straight flush may never be played as a plain straight; 3-3-3-3 plus Phoenix is not a full house; Abacus adds a 200-point penalty for an unhonoured Wish.
- **Part 2**: 59 edge cases, each with Official / Practice / Recommendation. The official text is silent on 13 (Dog versus pending Wish, Dragon Gift when both opponents are out, out-of-turn Bomb window, Tichu after Passing, exact tie at 1000, and others). Implementations diverge from the publisher on 5 (Board Game Arena's Phoenix-Wish wording, Brettspielwelt's old Bomb-during-Wish handling, simultaneous Grand Tichu online versus the FAQ's turn-order procedure, a wrong "keep the Dragon trick" claim on German Wikipedia, tie handling).
- **Part 3 variants**: official ones are Trichu (3 players), Tientsin (6, two teams of three), Grand Seigneur (5 to 12), plus the Tichu Booster expansion and Swiss tournament formats. "Tichu Pokerface", "Weekend", "Kagemusha", "Uno" and "Tichu ohne Wunsch" were not found anywhere. 2- and 5-player, Chaos-Tichu, chained triples, Mega Tichu and Brettspielwelt round or tournament modes exist only in secondary sources and are marked UNVERIFIED.
- **Access limits**: Pagat's Tichu page returned 404 and BoardGameGeek 403, so those appear only via snippets and are marked UNVERIFIED.

Handed to the rules engine grilling (05): Wish-subset computation, Dog versus Wish, out-of-turn Bomb window design, Grand Tichu ordering, tie and fixed-Rounds Match modes, explicit Phoenix rank in a Play, automatic Dragon Gift.
