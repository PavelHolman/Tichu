# Grand Seigneur rules (canonical text, engine-ready statements, ambiguities)

Resolves issue `../issues/15-grand-seigneur-rules.md`. Written 2026-09-17.
Terms follow `CONTEXT.md`: Table, Seat, Team, Participant, Variant, Layout, Deck, Match, Round, Hand, Trick, Play, Combination, Pass, Bomb, Call, Exchange, Wish, Dragon Gift, Mah Jong, Dog, Phoenix, Dragon. The kernel/Variant split is the one in `../issues/05-rules-engine-model.md` §"Answer".

## Sources

Primary (publisher text). All three carry the same Grand Seigneur section; FM-EN and RGG are translations of FM-DE. Each was downloaded and text-extracted in this session (`pypdf`), so the quotations below are verbatim from the PDFs.

- **[FM-EN]** Fata Morgana, "Tichu - game rules", English leaflet, §"Grand Seigneur (5-12 players)" (page 8-9 of the PDF). <https://fatamorgana.ch/media/pages/fatamorgana/tichu/english-rules/ee9126a1b5-1703236359/tichu_e.pdf>
- **[FM-DE]** Fata Morgana / Abacusspiele, German booklet "Tichu Nanjing, Trichu, Tichu Tientsin, Grandseigneur", 11. Auflage 2022, §"GRANDSEIGNEUR (5-12 SpielerInnen)" with sub-headings "Ich muss draussen bleiben", "Die Sitzordnung", "Die Initialrunde", "Die soziale Ungerechtigkeit", "Spielziel", "Das Spiel mit zwei Kartensätzen" and footnotes 11-13. <https://fatamorgana.ch/media/pages/fatamorgana/tichu/350c249415-1652447731/ti_regel21blech.pdf>
- **[RGG]** Rio Grande Games, English rules, §"GRAND SEIGNEUR (5-12 PLAYERS)". <https://www.riograndegames.com/wp-content/uploads/2013/02/Tichu-Rules.pdf>
- **[FM-FAQ]** Fata Morgana official FAQ. Fetched; it contains **nothing** about Grand Seigneur, Karrierepoker, two decks, a second Dragon or four-suit Bombs. <https://fatamorgana.ch/fatamorgana/tichu/faq>
- **[ABACUS]** Abacusspiele two-page rules sheet. Fetched; it does **not** contain the Grand Seigneur section at all. <https://abacusspiele.de/wp-content/uploads/2021/01/Tichu_Regel.pdf>
- Base-game paragraphs of FM-EN / FM-DE that Grand Seigneur inherits (deal, direction of play, Trick end, lead passing, Round end, Mah Jong/Wish, Phoenix, Dragon, Bombs) are cited as [FM-EN base §…] / [FM-DE base §…]; the standard rules themselves are in `tichu-rules-reference.md` Part 1.

Secondary (used only in Part 2 for the comparison the ticket asks for; anything sourced only from these is **UNVERIFIED**):

- **[PAGAT]** John McLeod, "President" rules page. <https://www.pagat.com/climbing/president.html>
- **[WP-CP]** English Wikipedia, "Career Poker". <https://en.wikipedia.org/wiki/Career_Poker>
- **[LUDO]** ludorium.at product description of Hexagames "Karriere Poker" (page returned ECONNRESET twice; only the search-engine snippet was read). <http://www.ludorium.at/SPIELE/hexagames/karriere_poker_d2.htm>
- The Karriere Poker rulebook PDF at spiele4us.de is image-only (no text layer) and was not OCR'd; the German Wikipedia article "Karrierepoker" is a 404. No first-party Career Poker rules text was readable in this session.

Quotation policy: the official section is short, so the load-bearing sentences are quoted verbatim (German where the German is more precise); everything else is paraphrased.

---

## Part 1 - Engine-ready rule statements

Numbering GS-x. Each statement ends with its source. "Silent" items are cross-referenced to Part 2.

### 1.1 Layout and Seats

- GS-1 Grand Seigneur is played by **5 to 12 Participants**. [FM-EN §title "Grand Seigneur (5-12 players)"; FM-DE §title "GRANDSEIGNEUR (5-12 SpielerInnen)"]
- GS-2 It is **not a partnership game**: "Grand Seigneur is not a partnership game, but rather a wrangle between individualists in a hierarchical system." → Layout = n Seats, n Teams of one. [FM-EN; FM-DE "Grandseigneur ist kein Partnerspiel, vielmehr ein Gerangel unter Individualisten in einem hierarchisch geprägten System."]
- GS-3 The number of hierarchy places equals the number of Participants: "The number of places corresponds to the number taking part." [FM-EN §seating; FM-DE "Die Zahl der Plätze entspricht der Zahl der MitspielerInnen."]

### 1.2 Deck

- GS-4 The **Dog is removed** in every case (it is a partner card and there are no partners): "Dogs not Admitted - yes, being a partnercard the Hound is utterly unusable." RGG makes the mechanical instruction explicit: "As there are no partners, dogs are not allowed in the game. Before beginning, remove all Hounds from the deck(s)." [FM-EN; FM-DE "der Hund als Partnerkarte ist in Grandseigneur unbrauchbar"; RGG]
- GS-5 **One Deck** (56 - Dog = **55 cards**) for 5-6 Participants; the text does not restrict one Deck to any count, it only *recommends* two for seven or more. [derived from GS-4 and GS-6]
- GS-6 **Two Decks are recommended from 7 Participants**: "The use of two packs is recommended when 7 or more play Grand Seigneur." "Recommended", not mandatory, in all three texts. [FM-EN; FM-DE "ist für Grandseigneur-Runden ab sieben SpielerInnen zu empfehlen"; RGG "We recommend the use of two decks … with 7 or more players"]
- GS-7 With two Decks, remove from the **second** Deck the Dog and the **Mah Jong**: "The Hound and Mah Jong must be removed from the second pack." (RGG: remove all Hounds from both, plus the Mah Jong from the second.) → two-Deck card set = 2 × 56 - 2 Dogs - 1 Mah Jong = **109 cards**: 2 Dragons, 2 Phoenixes, 1 Mah Jong, 104 suited cards (each suited card twice). [FM-EN; FM-DE "Aus dem zweiten Kartensatz sind Hund und Mah Jong zu entfernen."; RGG]
- GS-8 Two-Deck extra rule A: "**the second Dragon played beats the first**" (RGG: "In a trick, the second Dragon played beats the first."). This is the only stated exception to the base rule that a Play must be of *higher* value to beat. [FM-EN "Extra rules"; FM-DE "Regelergänzungen: der zweite gespielte Drache schlägt den ersten"; RGG]
- GS-9 Two-Deck extra rule B: "**only four cards of equal rank in different suits count as a 4-bomb**" → a four-of-a-kind Bomb requires four distinct suits; four equal-rank cards containing a duplicated suit (e.g. two Jade 8s) are not a Bomb (and are just a quad? see Part 2 A-9). [FM-EN; FM-DE "als Vierblatt-Bomben gelten nur vier Karten gleichen Werts verschiedener Familien"; RGG]
- GS-10 No other duplicate-card rule exists in the official text. In particular nothing is said about identical singles, identical pairs/triples, two Phoenixes, or two identical Bombs (Part 2 A-7..A-11).

### 1.3 No Calls, no counting

- GS-11 **No Calls**: "No one will announce 'tichu!'". There is no Grand Tichu either, since there is no 8-card Call window (the deal is a plain full deal, GS-20). [FM-EN; FM-DE "Keiner wird ein 'Tichu' ansagen"]
- GS-12 **No card points, no counting**: "No one bothers about points … no one will lovingly gather up his trick and count - just away with the cards! Tricks are taken only for the paltry right to lead." → Tricks are collected only to determine the next leader; card values are irrelevant; there is no end-of-Round transfer of Hand/Tricks. [FM-EN; FM-DE "Niemand schert sich um Punkte … Gestochen wird nur des schnöden Ausspielrechts wegen."]

### 1.4 Hierarchy: names, derivation, seating

- GS-13 The six named ranks, from top to bottom: EN **Great Lord, Lord, Squire, Burgher, Pauper, Wretch**; DE **Grandseigneur, Seigneur, Maître, Bourgeois, Pauvre, Misérable**. With more than six Participants "obscure forms such as Grand Burgher or Petty Pauper can be added in" (DE: "Porcher und Chevallier"); with fewer, the text is silent on which names drop (Part 2 A-1). Female forms "Wretch (f)" / "Misérable (f)". [FM-EN §seating; FM-DE §"Die Sitzordnung"]
- GS-14 **Derivation from finishing order**: the first Participant to empty their Hand in a Round becomes Great Lord, the second Lord, "and so on"; the last Participant still holding cards ("the tailender", DE "das Schlusslicht") becomes the Wretch. "Whoever gets rid of his cards second becomes the first Lord and so on." "the winner becomes Great Lord (...) the tailender becomes the Wretch." [FM-EN §first round and §second round; FM-DE "Wer seine Karten als Zweiter loswird, wird zum ersten Seigneur, usw." / "der Sieger wird zum Grandseigneur, (...) das Schlusslicht zum Misérable."]
- GS-15 **Seating**: the Great Lord sits at the head; **the Lord on his left**; ranks continue leftwards (Squire third, Burgher fourth, Pauper fifth); the Wretch is last, i.e. **on the Great Lord's right**. [FM-DE "Zu seiner Linken die Nummer 2 der Hierarchie, der Seigneur. Weiter links, auf Platz Nr.3, der Maître … Auf dem letzten Platz – und damit zur Rechten des Grandseigneur … sitzt der Misérable."; RGG "In last place - so at the right of the Great Lord - sits the Wretch"]
  - Translation defect: FM-EN says "at the left of the Great Lord - sits the Wretch"; this contradicts its own sentence "On his left is … the Lord" and both FM-DE and RGG. Treat "right" as canonical.
- GS-16 Participants move to their new places after every Round: "The players then move into the seats to which they are entitled." / "The players take their new-won places - provided that any positions have changed." → Seats are re-assigned by hierarchy at the start of every Round after the first. [FM-EN; FM-DE "Die SpielerInnen nehmen ihre neu errungenen Sitzplätze ein."]
- GS-17 **Play order versus hierarchy**: base Tichu plays **to the right** ("The next player (to the right - the Chinese play to the right…)"; "Play continues to the right"; DE footnote 2 "Zu seiner Rechten … rechtsrum"). Since the hierarchy descends to the *left*, the Seat after the Great Lord in play order is the **Wretch**, then Pauper, Burgher, Squire, Lord. In glossary terms: number Seats from 0 in play order → Seat 0 = Great Lord, Seat 1 = Wretch (rank n), Seat 2 = rank n-1, …, Seat n-1 = Lord (rank 2). Nothing in the Grand Seigneur section changes the direction of play. [FM-EN base §"The next player"; FM-DE base footnote 2; GS-15]
  - The UI may draw the Table clockwise or counter-clockwise (issue 05 decision); what matters is that hierarchy rank k+1 sits on the *opposite* side of rank k from the next Seat in play order.

### 1.5 Round structure

- GS-18 **Initial Round**: "a simple round of tichu, without any pushing of cards or any point values" → no Exchange, no scoring, plain play; its finishing order elects the first hierarchy. Initial seating is arbitrary (silent, Part 2 A-2). [FM-EN §"The first round"; FM-DE §"Die Initialrunde" "eine simple Tichu-Runde ohne Schupfen und Punktewertung"]
- GS-19 **Who shuffles/deals**: the Wretch: "Collecting in the tricks, shuffling, given out the cards before play begins and all other dirty work is the duty of the poorest of the poor - the Wretch." Flavour for a physical table; engine no-op except as a tie-breaker for uneven Hands (GS-21). [FM-EN "PS."; FM-DE "P.S."]
- GS-20 **Deal**: all cards, in one stage (no 8-card Grand Tichu stop, because there are no Calls). The base procedure is inherited: the dealer takes the top card, then every Participant in turn takes one card at a time "until the stock is exhausted". RGG adds "(yes, in this variant, the cards are dealt!)". [FM-EN base §"Before the game starts"; FM-DE base §"Vor Spielbeginn"; RGG]
- GS-21 **Hand sizes** follow from GS-5/GS-7 and GS-20: 55 cards → 11 each at 5, 9 (+1 extra card for one Participant) at 6; 109 cards → 15 r4 at 7, 13 r5 at 8, 12 r1 at 9, 10 r9 at 10, 9 r10 at 11, 9 r1 at 12. The text is silent on uneven Hands (Part 2 A-3); under the literal base procedure the dealer (Wretch) and the next r-1 Seats in play order hold one extra card.
- GS-22 **Exchange (from the second Round on)**, forced and unequal ("The social injustice … appears in the pushing in the second round"):
  - the **Wretch gives the Great Lord his 3 best cards**,
  - the **Pauper gives the Lord his 2 best cards**,
  - the **Burgher gives the Squire his 1 best card**,
  - **with 5 Participants, one card less at every level** (2 / 1 / 0),
  - "including special cards, which rank Dragon, Phoenix, Mah Jong" — DE footnote 12 is stronger: special cards **must** be forced-given, in the order Dragon, Phoenix, Mah Jong ("Auch Spezialkarten müssen – in der Reihenfolge Drache, Phönix, Mah Jong – zwangsgeschupft werden").
  - **the recipients give back the same number of cards, of their own choice** ("useless cards of their choice"; RGG "presumably useless cards"), and they do so **simultaneously** ("Die Beschenkten schupfen gleichzeitig … zurück").
  - Everyone else exchanges nothing.
  [FM-EN §"The social injustice"; FM-DE §"Die soziale Ungerechtigkeit" + footnote 12; RGG]
- GS-23 "Best" is by rank: the base ordering 2 < 3 < … < 10 < J < Q < K < A, with Dragon > Phoenix > Mah Jong placed above by GS-22's special-card clause. The most defensible total order for the *forced* part is **Dragon > Phoenix > Mah Jong > A > K > … > 2**; whether the Mah Jong outranks an Ace as a "best card" is an interpretation (Part 2 A-5). Ties of equal rank are broken by the giver (silent; Part 2 A-6). [FM-EN; FM-DE footnote 12; FM-EN base "the Mah Jong ranks as a 1"]
- GS-24 **Lead**: the Mah Jong holder leads the first Trick of every Round, including the initial Round and every hierarchy Round: "The Mah Jong begins" / "Der Mah Jong beginnt". Because only one Mah Jong exists even with two Decks (GS-7), the leader is unique. The Great Lord does **not** lead by right. [FM-EN; FM-DE; FM-EN base "its owner opens the game but need not lead the Mah Jong"]
- GS-25 **Trick flow** is the base game's: next Seat in play order may Pass or Play a Combination of the same type and higher value; a Passer may re-enter; the Trick ends when all other Participants (still holding cards) Pass in series; the Trick winner leads, and if the winner has no cards the lead passes to the next Seat in play order holding cards. The base text says "As soon as 3 players in serie pass" / "alle drei Mitspieler in Folge" because it assumes four Participants; for n Seats read "all other Participants still holding cards" (Part 2 A-12). [FM-EN base §"Play continues to the right"; FM-DE base §"Weiter dreht sich das Spiel rechtsrum"]
- GS-26 **Round end**: inherited base rule — the Round "ends immediatly if only one player has cards left in his hand"; that Participant is the Wretch (GS-14). No Hand or Trick transfer follows (GS-12). [FM-EN base §"The round ends"; FM-DE base §"Die Spielrunde endet sofort, wenn nur noch ein einziger Spieler Karten in den Händen hält."; FM-EN GS section "the tailender becomes the Wretch"]
- GS-27 **Round output** = the ordered finishing list (Participant who went out 1st … n-1th, then the holder of the last Hand). This list *is* the next Round's hierarchy and Seat assignment (GS-14, GS-16, GS-17).

### 1.6 Scoring and Match

- GS-28 **Nothing is scored.** "The objective of the game does not exist. It is all for fun." / DE "Spielziel gibt es nicht. Alles just for fun." The only carried state between Rounds is the hierarchy. [FM-EN §"The objective"; FM-DE §"Spielziel"]
- GS-29 **Match end**: none is defined. The Great Lord's privileges include "the desire to continue this lordly game for another round" (DE footnote 13: "auch der Wunsch, eine weitere Runde dieses herrlichen Spiels anzuhängen"); DE adds "Macht korrumpiert. Euer Spielziel wird sich auf natürliche Weise ergeben." → The Match ends when the Table stops; any fixed-Round count or position points is a house rule (Part 2 B-3). [FM-EN; FM-DE]
- GS-30 Glossary tension: `CONTEXT.md` defines Match as "Play at a Table until a Team reaches the target score". Grand Seigneur has no target score, so the definition needs "…or until the Variant's end condition" (do not edit here; flagged for the grilling ticket 16).

### 1.7 Behaviour inherited unchanged (nothing in the Grand Seigneur section alters it)

- GS-31 **Combinations**: single, pair, sequence of pairs, triple, full house, straight of ≥5, and the two Bomb types, compared exactly as in the base game. [FM-EN base §"The player on lead may lay"; FM-DE base §"Das Spiel"]
- GS-32 **Wish**: the Mah Jong's Wish applies as in the base game (the Grand Seigneur section never mentions it and the FAQ adds nothing). [FM-EN base §"whoever plays the Mah Jong has a free wish"; FM-FAQ]
- GS-33 **Phoenix**: joker in any Combination (never forming a Bomb), or single at ½ above the previous single (1½ when led); cannot beat the Dragon. Its -25 is irrelevant (GS-12). [FM-DE base §"Der Phönix"; FM-EN base §"The ever-changing Phoenix"]
- GS-34 **Dragon**: highest single, beaten only by a Bomb (or, with two Decks, by the second Dragon, GS-8); cannot be part of a straight. [FM-DE base §"Der Drache"]
- GS-35 **Dragon Gift**: the base rule ("gives the trick … to a player of the opposing team") is not withdrawn, but with no points and no Teams it has no effect on anything (the Dragon's player still leads next, as in the base game). Engine: automatic/no-op (Part 2 A-13). [FM-DE base §"Der Drache"; GS-12]
- GS-36 **Bombs**: straight flush ≥5 and four-of-a-kind (four suits required with two Decks, GS-9); bombs may be played out of turn and led; longer beats shorter, then higher rank. [FM-DE base §"Bomben sind"]
- GS-37 **Dog**: absent from the Deck; no "partner lead" mechanic exists. [GS-4]

---

## Part 2 - Silence, ambiguity, and divergences

### A. Points where the official text is silent or ambiguous

Each item: the gap, the options, a suggested default for the grilling (ticket 16). Sources are the ones above; where nothing is cited, the claim is simply that the official text says nothing.

- **A-1 Rank names for n ≠ 6.** Six names are given; "obscure forms … can be added in" for more, nothing for fewer. Options: (a) keep Great Lord / Lord / Squire at the top and Wretch / Pauper / Burgher at the bottom and fill the middle with generated names; (b) for 5 drop one middle name (which one is unspecified). Default: names are a per-Layout table owned by the Variant/UI; the engine uses ranks 1..n. [FM-EN; FM-DE]
- **A-2 Initial seating and initial dealer.** The initial Round has no hierarchy, so the text gives no seating and no dealer. Options: join order, random. Default: Seat order = join order for the initial Round; Wretch role (dealer) is a no-op.
- **A-3 Uneven Hands.** 55 and 109 are not divisible by most n (GS-21). Options: (a) literal base deal — deal one card at a time starting with the dealer, so the Wretch and the next r-1 Seats in play order hold one card more; (b) remove r cards face-down before dealing (President-style, UNVERIFIED as a Grand Seigneur practice); (c) let the *lowest* r ranks receive the extra card as a further "injustice". The deal event records actual Hands (issue 05), so any option is deterministic. Default: (a), it is the only reading with a primary source ("take one card at a time until the stock is exhausted"). [FM-EN base §"Before the game starts"]
- **A-4 Exchange pairing for n > 6.** The pairs are given by *title* (Wretch→Great Lord, Pauper→Lord, Burgher→Squire). With inserted middle ranks the Burgher/Pauper could be read as "4th/5th from the top" or "3rd/2nd from the bottom". Options: (a) symmetric — rank n-k+1 gives rank k, for k = 1..3, amounts 3/2/1 (with 5 Participants 2/1/0); everyone in the middle keeps their Hand; (b) literal 4th→3rd and 5th→2nd. Reading (a) is the only one that makes the 5-Participant rule ("one card less at each level") coherent, since at 5 the bottom-three pairs collapse onto the top-three. Default: (a). [FM-EN; FM-DE footnote 12]
- **A-5 What "best" means for the Mah Jong.** Footnote 12 says the special cards are forced-given "in the order Dragon, Phoenix, Mah Jong". Options: (a) total order Dragon > Phoenix > Mah Jong > A > … > 2 — the Mah Jong (value 1) is treated as a top card because of its lead-and-Wish power; (b) the ordering only ranks the specials among themselves and the Mah Jong is otherwise the lowest card, i.e. practically never "best". Reading (b) makes the mention of the Mah Jong pointless, so (a) fits the text better, but it is an interpretation. Default: (a), as a Variant-level card ordering. [FM-DE footnote 12; FM-EN]
- **A-6 Ties among equal-rank "best" cards.** With one Deck a 2-Participant tie can only be between suits; with two Decks it can be between identical cards. Suit matters for four-suit Bombs (GS-9) and straight flushes, so which King the Wretch gives is not neutral. Options: (a) giver chooses among cards of the forced rank (the engine validates that the given multiset of ranks equals the top-k ranks of the Hand); (b) engine picks. Default: (a). Note that "best" is computed on the Wretch's *own* Hand only; the giver never sees what comes back first.
- **A-7 Return cards: simultaneous or after seeing.** DE says the recipients push back "gleichzeitig" (simultaneously). Options: (a) blind — recipients choose their discards before seeing the forced cards; (b) sequential — receive first, then discard (the President norm on pagat: "the President gives back in exchange any card which he does not want", UNVERIFIED as to timing). Reading (a) is the literal text and mirrors the base Exchange (cards taken up only after giving). Default: (a), consistent with the atomic Exchange adopted in issue 05.
- **A-8 Identical singles with two Decks.** Only the Dragon is exempted from "higher beats". Options: (a) an identical card never beats (equal is not higher) — the literal base rule; (b) "second beats first" generalised to every identical card. Default: (a); the explicit Dragon exception implies the general rule is "no". [FM-DE base "eine gleiche Kombination höheren Werts"; GS-8]
- **A-9 Identical Combinations and quads with a duplicated suit.** With two Decks, four equal-rank cards with a repeated suit are not a Bomb (GS-9). Are they anything? Options: (a) an illegal Play (no Combination of four equal cards exists outside Bombs); (b) a legal non-Bomb quad type. The base Combination list has no quad, so (a). Two identical Bombs (e.g. two four-suit 8-Bombs): (a) equal does not beat; (b) later beats earlier by analogy with GS-8. Default: (a) for both. [FM-EN base Combination list]
- **A-10 Two Phoenixes.** Silent on: Phoenix single on Phoenix single (8½ then …?); both Phoenixes in one Combination (e.g. a pair of Phoenixes; a full house with two jokers); the Exchange order when a Wretch holds two Phoenixes (both are forced anyway). Options for Phoenix-on-Phoenix: (a) illegal (equal, not higher); (b) the second Phoenix takes ½ above the *underlying* value (8½ → 9, beatable by 10); (c) treat as GS-8-style "second beats first". Default: (a) for Phoenix-on-Phoenix and allow two jokers in one Combination as long as neither forms a Bomb (the base text only forbids a Phoenix Bomb). Two Phoenixes as a *pair* is a stronger question (a pair of jokers is a pair of any rank, up to A-A) — flag for grilling.
- **A-11 A Dragon pair / two Dragons in one Hand.** The base game has one Dragon and only says it "cannot be built into straights". Options: (a) Dragon is single-only (no pair); (b) allow a Dragon pair as the highest pair. Default: (a), the Dragon has no rank and the base text treats it as a single. [FM-DE base §"Der Drache"]
- **A-12 Trick end with n Seats.** The base text says "as soon as 3 players in series pass". Options: (a) all other Participants still holding cards Pass (already adopted for standard Tichu in issue 05, and the DE wording "alle drei Mitspieler" = "all three co-players" reads as "all the others"); (b) literally three consecutive Passes. Default: (a). [FM-DE base §"Sobald aber alle drei Mitspieler in Folge passen"]
- **A-13 Dragon Gift.** No points, no opponents by Team. Options: (a) no Gift command at all (the Trick just disappears); (b) keep the command as an automatic no-op. Default: (a) at the Variant level — the kernel's Dragon Gift step is skipped when the Variant declares no scoring. [GS-12; GS-35]
- **A-14 Wish enforcement across n Seats.** Unchanged in substance; the "next player who has a card of the desired rank and can lawfully play it must play it" rule simply walks more Seats. Nothing new. [FM-EN base §"Mah Jong"]
- **A-15 Going out while the Trick is unresolved.** Base rule applies (lead passes to the next Seat holding cards). With many Seats the finishing order of two Participants who go out in the same Trick is still well-defined by Play order. Nothing new. [FM-EN base §"If this happy player has no cards left"]
- **A-16 Match length.** None. Options for a Table setting: (a) open-ended, stop by vote/host; (b) fixed number of Rounds; (c) President-style position points to a target (UNVERIFIED, see B-3). Default: (a) with (b) as an optional setting; no points.
- **A-17 One Deck with 7+ Participants.** Permitted (two Decks are only "recommended"); Hands become tiny (55/12 = 4 r7). Default: allow, but the Table default switches to two Decks at 7.
- **A-18 Seat rotation direction.** GS-17 derives play order from base "to the right" + hierarchy "to the left". Whether an app should preserve this (the Wretch plays immediately after the Great Lord) or seat the hierarchy in play order (the Lord plays after the Great Lord) is a legitimate design choice; only the former matches the printed table. Default: preserve (a pure Seat-numbering function of the hierarchy), and let the grilling decide if it matters.

### B. Where Career Poker (Hexagames) and President-style implementations differ

All items in this block are from secondary sources and are **UNVERIFIED** against the Career Poker rulebook (image-only PDF, not OCR'd) or any first-party President rules (there is none; President is a folk game).

- **B-1 Deck.** President: one standard 52-card deck, 2 high, no special cards; "a double deck of cards is sometimes used" with many players [PAGAT]. Career Poker (Hexagames 1988, 4-8 players): "a deck with 8 suits of 13 cards each and four wild cards" (104 + 4 = 108 cards) [WP-CP]; the ludorium snippet says "104 Karten (je 8 mal die Werte 1-13), 4 Jokerkarten" [LUDO]. Grand Seigneur instead uses one or two Tichu Decks with the Tichu specials (GS-5..GS-9). Neither comparison game has a Dragon, a Mah Jong or a suit-based Bomb rule, so GS-8/GS-9 have no analogue.
- **B-2 Combinations.** President and Career Poker allow only singles and same-rank sets of equal size, beaten by a higher rank of the same size ("Es dürfen pro Stich nur Karten gleichen Wertes abgelegt werden … wenn ihr Wert höher ist") [PAGAT; LUDO]. Career Poker jokers "function as any rank or count as the highest card when played alone" [WP-CP]. Grand Seigneur keeps the full Tichu Combination set incl. straights, pair sequences, full houses and Bombs (GS-31).
- **B-3 Scoring / Match end.** President has an optional scheme "2 for the President, 1 for the Vice President and nothing for the others" to a target [PAGAT]; Career Poker "continues indefinitely or until predetermined conditions (time limit, hand count, or consecutive Boss wins)" [WP-CP]. Grand Seigneur has none (GS-28/29).
- **B-4 Exchange.** President: Asshole gives his single highest card, President returns any card; a variation exchanges two cards with the top and one card between the Vice-President and second-last [PAGAT]. Career Poker: the Dishwasher's three best cards for the Boss's worst, further exchanges depending on player count [LUDO; WP-CP]. Grand Seigneur: 3/2/1 (2/1/0 at five), forced by rank with the special cards ranked explicitly (GS-22/23). President's "highest card" is the same "best by rank" idea; neither game forces a Mah Jong-like low card upward.
- **B-5 Who leads.** President: the President leads after the first hand (first hand: holder of a specific low card, e.g. 3♣) [PAGAT]. Career Poker: "the player who played the highest cards in the previous round leads the next one" [WP-CP]. Grand Seigneur: the Mah Jong holder leads every Round (GS-24) — the top rank has no lead privilege.
- **B-6 Seating.** President: "the players move seats. The President selects the most comfortable chair…" [PAGAT]; Career Poker: the Boss alone stays seated while the others move around him [LUDO]. Grand Seigneur: everyone moves to the seat their rank entitles them to (GS-16); the printed hierarchy descends to the left while play goes right (GS-17), which no President write-up shares.
- **B-7 Round end.** All three end when one player is left holding cards [PAGAT; GS-26]. Career Poker's "round concludes when all remaining players pass" in [WP-CP] describes a Trick, not a Round.
- **B-8 Equal-rank plays.** Some President variants allow playing an equal card (with a "skip" effect) [PAGAT, variants section — not read in detail, UNVERIFIED]. Grand Seigneur's only equal-beats-equal rule is the second Dragon (GS-8, A-8).

---

## Part 3 - Kernel impact

Using the split from `../issues/05-rules-engine-model.md` §"Answer" (kernel = card identity, Combination classification/comparison, Trick mechanics, Wish, special cards, one Round; kernel *options* only for four-suit Bombs and second-Dragon; Variant = Layout, Deck, deal, Calls, Exchange, Round end, transfers, scoring, Match state).

**Kernel (shared code paths that Grand Seigneur exercises)**

- Card identity with copy index: GS-7 makes every suited card and the Dragon and Phoenix exist twice; the deal event and Hand must distinguish copies (already in the issue 05 design).
- Combination comparison: unchanged (GS-31), but the kernel must decide equal-versus-equal for identical Plays (A-8/A-9): the default "equal never beats" is the base rule and needs no option, only tests with duplicate cards.
- Bomb definition: kernel option `fourOfAKindNeedsFourSuits` (GS-9). With one Deck the option is vacuous. A-9's "quad with duplicate suit is no Combination" falls out of the base classifier if quads are only ever Bombs.
- Dragon comparison: kernel option `laterDragonBeatsEarlier` (GS-8). Interaction to specify: second Dragon beats first; a Bomb beats either; the Phoenix beats neither.
- Phoenix: no new option required if the defaults in A-10 are taken (Phoenix-on-Phoenix illegal as "equal"; two jokers allowed in one Combination; still never a Bomb). If the grilling wants "second Phoenix = ½ above the underlying value", that is a third kernel option — argue against it.
- Wish: unchanged code path, now walking n Seats (A-14). No option.
- Dog absence: the Dog is simply not in the Deck (GS-4/GS-37); no kernel toggle, the Dog lead rule is dead code for this Deck. Confirms the issue 05 decision.
- Trick end rule "all other Participants holding cards have Passed" (A-12) and "lead passes to the next Seat holding cards" (GS-25) are already Layout-parametrised in the kernel; Grand Seigneur only needs them to work for n up to 12 and Teams of one.
- Dragon Gift: the kernel emits the "Trick won with Dragon" event; whether a Gift command follows must be decided by the Variant (A-13). Suggest the kernel takes a flag `dragonGiftRequired` derived from the Variant's "scores Tricks" property rather than a Grand Seigneur-specific switch.
- Round output: the kernel must emit the full **finishing order** (who went out 1st..n-1th plus the last holder), not only "Round over"; standard Tichu needs it too (one-two, tailender), so this is a shared event, not an option.

**Variant layer (Grand Seigneur-specific, no kernel change)**

- Layout: n ∈ 5..12 Seats, n Teams of one (GS-1..3).
- Deck construction: 55 (one Deck minus Dog) or 109 (two Decks minus both Dogs and the second Mah Jong), with the two kernel options switched on when two Decks are used (GS-5..9).
- Deal procedure: single-stage full deal, uneven Hands per A-3, no Call windows (GS-11, GS-20/21).
- Hierarchy = the Match-level state carried between Rounds: an ordered list of Participants; rank names are a display table (A-1); Seat numbering function per GS-17/A-18.
- Exchange procedure: pairs and counts per GS-22/A-4, "best" ordering per GS-23/A-5, tie handling per A-6, simultaneity per A-7; skipped in the initial Round (GS-18).
- Lead: Mah Jong holder (GS-24) — the same rule as standard Tichu, so it may live in the kernel's setup; the Variant only guarantees exactly one Mah Jong is in the Deck.
- Round end: "one Participant holds cards" (GS-26), no transfers, no scoring (GS-12, GS-28); Round result = finishing order → new hierarchy (GS-27).
- Match end: none (GS-29); optional fixed-Round setting per A-16. Requires the Match glossary term to be widened (GS-30).

**Not touched at all**: Calls (GS-11), card point values, Team scoring, one-two, Grand Tichu window, Dog lead — all Variant concerns that Grand Seigneur simply omits.

---

## Summary for the grilling (ticket 16)

Official text is only ~40 lines and identical across FM-EN, FM-DE and RGG. Everything the engine needs beyond those lines (uneven Hands, Exchange pairing above six, "best" for the Mah Jong, blind vs sighted return, identical singles/Combinations/Phoenixes, Dragon pair, Dragon Gift, Match length, rank names) is unspecified and listed in Part 2 A with a suggested default each. Only two kernel options are needed, exactly the two issue 05 already reserved; the rest is Deck construction, an Exchange procedure and a hierarchy carried between Rounds at the Variant level. One translation error (Wretch's side, FM-EN) and one glossary gap (Match without target score) were found.
