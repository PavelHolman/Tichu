# Tichu rules reference (canonical rules, edge cases, variants)

Resolves issue `../issues/04-tichu-rules-reference.md`. Written 2026-09-17.
Terms follow `CONTEXT.md`: Table, Seat, Team, Participant, Match, Round, Hand, Trick, Play, Combination, Pass, Bomb, Call, Exchange, Wish, Dragon Gift, Mah Jong, Dog, Phoenix, Dragon.

## Sources

Primary (publisher text; every rule in Part 1 is traced to at least one of these):

- **[FM-EN]** Fata Morgana, "Tichu - game rules. From the leaflet with Tichu cards", A.G. Smith translation 1992, rev. 1993/2004, with FAQ and 3/6/5-12-player variants. <https://fatamorgana.ch/media/pages/fatamorgana/tichu/english-rules/ee9126a1b5-1703236359/tichu_e.pdf>
- **[FM-DE]** Fata Morgana / Abacusspiele, German rules booklet ("Tichu Nanjing, Trichu, Tichu Tientsin, Grandseigneur"), 11. Auflage 2022, the "Blech" (tin box) edition, linked as "Spielregel" from the publisher's Tichu page. <https://fatamorgana.ch/media/pages/fatamorgana/tichu/350c249415-1652447731/ti_regel21blech.pdf>
- **[FM-FAQ]** Fata Morgana, "Chinesische Buschauffeure im Prüfstand" (official rules FAQ, German). <https://fatamorgana.ch/fatamorgana/tichu/faq>
- **[FM-HILFE]** Fata Morgana, "Spielhilfe" one-page summary card. <https://fatamorgana.ch/media/pages/fatamorgana/tichu/54853262f2-1715760608/spielhilfe.pdf>
- **[ABACUS]** Abacusspiele, German rules sheet (© 1989 Fata Morgana, © 1998 Abacusspiele). Same text as FM-DE plus one extra FAQ item (penalty for an unhonoured Wish). <https://abacusspiele.de/wp-content/uploads/2021/01/Tichu_Regel.pdf>
- **[RGG]** Rio Grande Games, English rules (based on the Smith translation; adds an explicit tie rule and a "clockwise is fine" FAQ). <https://www.riograndegames.com/wp-content/uploads/2013/02/Tichu-Rules.pdf>
- **[URS]** Urs Hostettler (designer), Tichu history page and Booster notes. <https://urs.fatamorgana.ch/Tichu.html>
- **[FM-PAGE]** Fata Morgana Tichu product page (lists rules, Spielhilfe, FAQ, Booster FAQ links). <https://fatamorgana.ch/fatamorgana/tichu>

Secondary (used only in Parts 2 and 3, to document where implementations and reference sites diverge from or extend the official text): see the per-claim URLs there. Anything sourced only from these is marked **UNVERIFIED**.

Note on direction of play: FM-EN/FM-DE/RGG all say play proceeds to the **right** (counter-clockwise); RGG's FAQ says clockwise is fine "just change all the rules to switch the direction" [RGG]. Everything below is written as "next Seat in play order" so the engine can pick either.

---

## Part 1 - Canonical four-player rules (engine-ready statements)

### 1.1 Deck

- R1.1 The deck has 56 cards: four suits (Jade, Swords, Pagodas, Stars) of 13 ranks 2..10, J, Q, K, A (Ace high, 2 low, 10 between 9 and J) plus four special cards: Dragon, Phoenix, Dog ("Hound"), Mah Jong ("Hemp-Sparrow"). [FM-EN §"Tichu Nanking"; FM-DE §"Die Karten"]
- R1.2 Card point values: each K = 10, each 10 = 10, each 5 = 5, Dragon = +25, Phoenix = -25; all other cards 0. Total in the deck = 100. [FM-EN §"Now count"; FM-DE §"Nun zählen"; FM-HILFE]

### 1.2 Seats, Teams, Match

- R2.1 Four Participants; Seats opposite each other form a Team (Seats 0+2, 1+3 in CONTEXT.md terms). [FM-EN; FM-DE §"Die zwei Partner"]
- R2.2 A Match is played in Rounds until the target score is reached (see §1.12). [FM-EN §"The actual object"; RGG §"End of the game"]
- R2.3 Between Rounds, the "winner of the previous round" shuffles; the official text has the deck cut and cards *taken* one at a time starting with the shuffler, round the table, until each holds 14. For an engine this is a random deal of 14 cards each; the shuffler identity does not affect play. [FM-EN §"Before the game starts"; FM-DE §"Vor Spielbeginn"; RGG says first shuffler is chosen freely, later the winner of the previous hand]
- R2.4 UNSPECIFIED in official text: who is "the winner of the previous round" (the first Participant out? the Team that scored more?). Irrelevant to an engine that deals randomly.

### 1.3 Deal in two stages and the Grand Tichu window

- R3.1 The deal is conceptually one card at a time up to 14; the Grand Tichu Call must be made "before taking his ninth card". [FM-EN §"grand tichu"; FM-DE §"Ach ja – Tichu!": "Vor der Aufnahme ihrer neunten Karte"]
- R3.2 The FAQ makes the practical procedure explicit: a Grand Tichu Call is a decision "based on the (maximal 8) cards in hand", i.e. the engine deals 8 cards face-down to each Seat, opens a Grand Tichu window, then deals the remaining 6. Calls on fewer than 8 cards are also allowed. [FM-FAQ "Wann sagt man ein grosses Tichu an?"; FM-EN FAQ "When can I call a Grand Tichu"]
- R3.3 The FAQ states an order for the window: A takes 8th card (may call), C takes 8th (may call), A "seeing that C did not call" may call then takes 9th, C then may call and takes 9th; i.e. Participants decide in turn order with knowledge of earlier decisions, and there is no partner communication. The official text does not say what happens if this order is not followed (typical online play: everyone decides simultaneously, see Part 2, E-GT1). [FM-FAQ; FM-EN FAQ]
- R3.4 Grand Tichu is a Call by an individual Participant; both Participants of a Team may Call (the FAQ discusses the case of both calling "at the same time" and says the later one in turn order may withdraw, tournament ruling). [FM-FAQ "Was ist, wenn 2 Spieler eines Teams gleichzeitig ein grosses Tichu ansagen?"]

### 1.4 Exchange

- R4.1 After all 14 cards are held, each Participant gives exactly one card face-down to each of the other three Participants (so gives 3, receives 3). [FM-EN §"pushing"; FM-DE §"Jetzt wird geschupft"; RGG]
- R4.2 A Participant may only pick up (see) the cards given to them after they have given their own three. [FM-EN; FM-DE: "darf die neuen Karten erst aufnehmen, wer die eigenen drei Karten vergeben hat"]
- R4.3 Tichu Calls are allowed before the Exchange ("A call before the cards are pushed can be useful as a request for partner to hand over his best card"). [FM-EN §"Oh yes - Tichu"; FM-DE]
- R4.4 The FAQ gives the intended sequence of Call windows around the Exchange: (a) after 14 cards, everyone may Call; (b) Exchange; (c) everyone may Call again knowing their new Hand; (d) first lead; (e) Calls remain possible after seeing the lead/Wish, per R12.1 (until one's own first card). A Call *during* the Exchange (after some have given and others not) is not allowed. [FM-FAQ "Darf ich während des Schupfens ein Tichu ansagen?"]
- R4.5 Explicit pre-agreed Exchange conventions with the partner are allowed only if disclosed to the opponents; no communication during the Round beyond the game events themselves. Not enforceable by an engine; noted for completeness. [FM-FAQ "Sind Absprachen erlaubt?"]

### 1.5 Combinations

- R5.1 Legal Combinations to lead: single card; pair; sequence of ≥2 pairs of consecutive ranks ("stairs"); triple; full house (triple + pair); straight of ≥5 consecutive ranks. [FM-EN §"The game is begun"; FM-DE §"Das Spiel"]
- R5.2 A Play on a Trick must be "a similar combination of higher value": same type and same card count; full houses compare by the triple's rank; straights and stairs compare by rank with identical length. Exception: Bombs. [FM-EN; FM-DE]
- R5.3 The Mah Jong counts as rank 1 and may form part of a straight (1,2,3,4,5); it may also be played as a single. [FM-EN §"Mah Jong"; FM-DE 2022: "darf als Einer einzeln ausgespielt oder in geeignete Reihen eingegliedert werden"]
- R5.4 The Dragon may only be played as a single; it "cannot take part in a sequence" (and, being a single rank, no other combination). [FM-EN §"Dragon"; FM-DE; FM-HILFE "Nur Einzelkarte"]
- R5.5 The Dog may only be played as a single lead (see §1.8). [FM-EN §"Hound"]
- R5.6 A full house whose triple and pair have the same rank (3,3,3,3+Phoenix) is not valid: "triple and pair must be different". [FM-FAQ "Ist 3,3,3,3,Phönix ein gültiges Fullhouse?"; FM-EN FAQ]
- R5.7 A straight flush (Bomb) may NOT be played as an ordinary straight. [FM-FAQ "Kann eine Strassenbombe auch zur einfachen Strasse erklärt werden?" - "Nein"; FM-EN FAQ] (Consequence for the engine: a five-plus card same-suit run in a Play is always classified as a Bomb.)
- R5.7a Straights do not wrap: A is high only; A-2-3-4-5 is not a straight (the 1 = Mah Jong precedes the 2; 10-J-Q-K-A is the highest 5-straight). The official text implies this ("the Ace is the highest ... the 2 the lowest"); AARON states it explicitly ("A2345 is not a legal play") [FM-EN; AARON - see Part 2 sources]. Longest possible straight: 1..A = 14 cards.
- R5.8 Suits are irrelevant for ordinary Combinations; only rank matters. [implicit in FM-EN/FM-DE; bombs are the only suit-sensitive Combination]

### 1.6 Trick flow, lead, Passing

- R6.1 The holder of the Mah Jong leads the first Trick of the Round but need not lead the Mah Jong itself. [FM-EN §"Mah Jong"; FM-DE]
- R6.2 Play proceeds in Seat order. The next Participant may Pass or Play a higher Combination of the same type (or a Bomb). [FM-EN; FM-DE]
- R6.3 A Participant who has Passed may re-enter the same Trick later ("Wer gepasst hat, darf ohne weiteres wieder ins Spiel eingreifen"). [FM-DE 2022 §"Das Spiel"; ABACUS] (FM-EN does not state this; FM-DE 2022 and ABACUS do.)
- R6.4 The Trick ends when three Participants Pass in succession after the last Play; the Participant who made the last (highest) Play collects the Trick and leads the next. [FM-EN; FM-DE]
- R6.5 After three consecutive Passes, any Participant may still play a Bomb "before the trick is gathered"; only then is the Trick really over. [FM-EN FAQ "Can the Hound be bombed?"; FM-DE 2022 §"Bomben"; FM-FAQ]
- R6.6 If the Trick winner has no cards left (is out), the lead passes to the next Seat in play order, skipping Seats that are out. [FM-EN §"If this happy player has no cards left"; FM-DE fn. 3]
- R6.7 Participants who are out are skipped in turn order; the three-Pass rule is unchanged in the official text. UNSPECIFIED: whether "three passes" means three *other* Participants or any three Passes when fewer than four remain; all implementations treat it as "all remaining opponents have passed" (see Part 2, E-TR1).

### 1.7 Mah Jong and Wish

- R7.1 When a Participant plays the Mah Jong (single or inside a straight), they "have a free wish": they may name a rank 2..A (not a special card). The official text says "is allowed to wish" ("darf sich ... wünschen") - the Wish is optional. [FM-EN; FM-DE]
- R7.2 Enforcement: "The next player who has a card of the desired rank and can lawfully play it must play it (possibly in a bomb!)"; RGG adds "or rarely in a sequence". A Participant who does not hold the rank, or holds it but cannot lawfully play it, may Play anything legal or Pass. The Wish stays in force until someone fulfils it. [FM-EN; FM-DE; RGG]
- R7.3 The FAQ interprets "can lawfully play it" broadly: the obligation includes playing it inside a Bomb or inside a straight of the required length, including a straight that needs the Phoenix to be completed ("z.B. auch als Bombe oder wenn er mit dem Phönix eine passende Strasse zusammenstellen kann"). I.e. if ANY legal Play by that Participant (matching the current Trick type, or any Bomb) contains a natural card of the wished rank, they must make one such Play. [FM-FAQ "Muss der Phönix gespielt werden ..."; FM-EN FAQ "Do I have to use the Phoenix to fullfill a wish?"]
- R7.4 The Phoenix is NOT a card of the wished rank: a Participant who does not hold a natural card of the wished rank is never obliged by the Wish, even if their Phoenix could stand in for it. [FM-FAQ; FM-EN FAQ]
- R7.5 The Wish must be honoured only in a Participant's ordinary turn, not when playing a Bomb out of turn. A Participant may deliberately Bomb out of turn (with a Bomb that does not satisfy the Wish) to avoid honouring the Wish at that moment; but if they then win the Trick and lead, they must honour the Wish on the lead if they can (the FAQ example: holding 3..K straight + K-bomb with an 8 wished, player bombs with KKKK out of turn, then must lead the straight containing the 8). [FM-FAQ "Wann muss ein Mah-Jong-Wunsch erfüllt werden?" and the "kniffliges Beispiel"; FM-EN FAQ]
- R7.6 The Wish also binds on a *lead*: when the Participant to act is leading a new Trick and holds the wished rank, they must lead a Combination containing it (the FAQ example says "muss dabei den Wunsch erfüllen" when leading after winning with a Bomb). [FM-FAQ]
- R7.7 If a card of the wished rank sits inside a Bomb, the Participant may wait until their regular turn and hope the Wish is fulfilled by then; but in their regular turn, if the only way to play the rank is the Bomb, they must play the Bomb (the FAQ: "Wenn nun ... SpielerD eine Strassenbombe mit einer 8 hätte. Der müsste dann nämlich die Königs-Bombe abstechen!"). [FM-FAQ]
- R7.8 Penalty for an unhonoured Wish (irregularity rule, not needed by an engine that enforces R7.2-R7.7): ABACUS FAQ item: if a player wrongly failed to honour the Wish, the opponents are credited 200 points as for a one-two, and any Calls are added/subtracted. [ABACUS §"Häufige Fragen", last item] Not in FM-EN/FM-DE 2022.

### 1.8 Dog

- R8.1 The Dog has no trick-taking power and can only be played as a single card when leading a Trick. [FM-EN §"Hound"; FM-DE]
- R8.2 Playing the Dog transfers the right to lead immediately to the partner; if the partner is already out, the lead passes to the next Seat in play order *after the partner* (skipping further if that Seat is also out). [FM-EN "If partner has already gone out, it passes to his right"; RGG "the lead passes to the partner's right"; ABACUS "erbt der Spieler zu dessen Rechten"] The German Blech booklet's wording "zu seiner Rechten" (fn. 3) is grammatically ambiguous (Dog player's right or partner's right), but the FAQ resolves it: the lead can come back to the Dog player himself, which is only possible under the partner's-right reading. [FM-FAQ "Kann der Hund das Ausspielrecht auch an mich selbst zurückgeben?" - "Ja"] See Part 2, E-G1.
- R8.3 The Dog cannot be Bombed: "Zeigt sich der Hund, ist der Wechsel schon vollzogen. Keine Zeit für Bomben." Bombs beat Combinations, never the *right to lead*. [FM-FAQ first two items; FM-DE 2022 FAQ; FM-EN FAQ]
- R8.4 The Dog Play is not a Trick that anyone wins; it carries no points (0) and the official text does not say who "collects" it. Engine: discard it to the Dog player's Trick pile or nowhere - either way 0 points. UNSPECIFIED but scoring-neutral.
- R8.5 Interaction with a pending Wish: the official text does not say whether a Participant who holds the wished rank may lead the Dog instead of honouring the Wish. See Part 2, E-W6.

### 1.9 Phoenix

- R9.1 Wildcard: in any Combination the Phoenix may replace any normal card of rank 2..A (never a special card, never the Mah Jong's 1). It can never make a Bomb ("cannot make up a bomb"); FM-HILFE: "Bomben: Ohne Phönix". [FM-EN; FM-DE; FM-HILFE]
- R9.2 As a single, its value is half a rank above the card it is played on (on an 8 it is 8½, beatable by 9 or higher). It can beat an Ace (A½) but NOT the Dragon. [FM-EN; FM-DE]
- R9.3 When led as a single, the Phoenix counts as 1½. [FM-EN "If led, the Phoenix is count as 1.5"; FM-DE "Angespielt hat der Phönix den Wert 1½"] (Consequence: a led Phoenix is beaten by any 2 or higher; the Mah Jong (1) cannot beat it.)
- R9.4 Phoenix in an ambiguous position (e.g. A,A,Phoenix,9,9 - is it AAA+99 or AA+999?): the Participant playing it declares which value it takes; if they forget, the higher interpretation applies. [FM-FAQ "Was ist mit Phönixen in zweideutiger Position?"] Engine: require the client to disambiguate, or default to the interpretation most favourable to the player (the higher one).
- R9.5 The Phoenix is worth -25 points to whoever holds it in their Tricks at scoring. [R1.2]
- R9.6 A Phoenix cannot be played on the Dragon as a single (R9.2). Played on a single Mah Jong it is 1½; played on a Dog is impossible (the Dog is never on a Trick). There is only one Phoenix, so "Phoenix on Phoenix" cannot occur. Ambiguous Phoenix placement inside a Combination: see R9.4 / Part 2, E-P3.

### 1.10 Dragon and Dragon Gift

- R10.1 The Dragon is the highest single card; as a single it beats an Ace and an A½ (Phoenix on Ace) and can only be beaten by a Bomb. It cannot be part of any multi-card Combination. [FM-EN; FM-DE; FM-HILFE]
- R10.2 If the Dragon wins the Trick, the Dragon's owner must give that Trick (including the Dragon's +25 and any other points in it) to an opponent of their choice - the Dragon Gift. The Dragon player still leads the next Trick. [FM-EN; FM-DE; FM-FAQ "spielt aber zum nächsten Stich selbst aus"]
- R10.3 If a Bomb beats the Dragon, the Bomb owner wins the Trick and keeps it; no Dragon Gift ("Bombenbesitzer ... behalten den Stich ... sogar wenn sie ihren eigenen Drachen abbomben"). [FM-FAQ "Muss der Drache auch einen gebombten Drachenstich verschenken?"; FM-EN FAQ; FM-DE FAQ]
- R10.4 The last Trick of the Round (closed when the third Participant plays their last card) is collected normally and, if won by the Dragon, is still given away. [FM-FAQ; FM-EN FAQ; FM-DE FAQ]
- R10.5 Dragon Gift when only one opponent is still in: the official text says "an opponent of its holder's choice" and never restricts to opponents still holding cards; a Participant who is out still has a Trick pile and can receive the gift. UNSPECIFIED whether the engine must still ask when both opponents are out (R10.4 shows the situation can arise only if the Dragon player is 3rd out or the Dragon is played after both opponents are out). See Part 2, E-D1.

### 1.11 Bombs

- R11.1 A Bomb is (a) four cards of the same rank, or (b) a run of at least five consecutive ranks in one suit (straight flush). The Phoenix may not be part of a Bomb; the Mah Jong (rank 1) is not a suited card so cannot be part of a straight flush. [FM-EN; FM-DE; FM-HILFE]
- R11.2 Bombs beat any single or Combination. Ordering among Bombs: first by number of cards (more cards wins, so any straight flush ≥5 beats any four-of-a-kind), then by rank (highest card of the run; rank of the quad). [FM-EN "(1) by the number of cards and (2) by the rank of the cards"; FM-DE "Reihenbomben schlagen also Vierblätter"] A Bomb may be played on a Bomb. [RGG]
- R11.3 Bombs may be played at any time, including out of turn, to beat whatever is on the table. They may not beat the *right to lead*, i.e. an empty table (nothing on the Trick yet) or the Dog. [FM-FAQ items 1-2; FM-DE 2022 FAQ]
- R11.4 A Bomb may be *led* to an empty Trick by the Participant whose lead it is. [FM-EN "A player can even lead a bomb"; FM-DE "Wer unbedingt will, darf eine Bombe vorspielen"]
- R11.5 A Participant may Bomb their own Play ("You are allowed to bomb your own trick"), but other players' Bombs have priority; in live play one leads, waits a moment, then Bombs. [FM-FAQ "Kann ich mein eigenes Ausspiel bomben?"; FM-EN FAQ]
- R11.6 Priority when several want to act: Bombs take precedence over ordinary Plays; simultaneous Bombs are resolved in play order starting after the last Play; after a Bomb, the Seat after the bomber has priority for the next Bomb. Waiting to see what is played and then claiming a "simultaneous" Bomb is not allowed. The canonical sequence: after each Play, every Participant in play order gets a Bomb opportunity (B, C, D, A), then the next Participant in turn makes an ordinary Play or Pass, and so on. [FM-FAQ "Was ist, wenn mehrere Spieler gleichzeitig ..."; FM-EN FAQ] Engine implication: the official model is "each Play opens a bomb window for everyone before the next regular turn"; an online engine must decide how to time that window (Part 2, E-B4).
- R11.7 A Bomb played out of turn does not need to honour the Wish (R7.5).
- R11.8 A Bomb may still be played after three Passes, before the Trick is collected (R6.5).

### 1.12 Calls: Tichu and Grand Tichu

- R12.1 Tichu ("small tichu"): any Participant may Call until they play their first card of the Round. If the caller is the first to go out, their Team gets +100; otherwise -100. [FM-EN; FM-DE]
- R12.2 Grand Tichu: may be Called before taking the ninth card (R3.1-R3.3), worth +200 / -200 under the same condition (the caller personally must be first out). [FM-EN; FM-DE]
- R12.3 Calls are individual: a partner going out first does not satisfy the Call - it fails ("If his partner goes out first, the team loses the 100 points"). Calls may not be discussed or arranged with the partner. [FM-EN; RGG "the tichant himself must go out first"]
- R12.4 Call points are scored independently of, and in addition to, the normal card-point / one-two scoring; they do not affect it. [FM-EN "scored independently of, and in addition to"; FM-DE "beeinflussen diese nicht"]
- R12.5 Both Participants of a Team may Call (Tichu and/or Grand Tichu); the FAQ treats two simultaneous Grand Tichus in one Team as a real (if rare) case, so it is legal; only one of them can succeed. [FM-FAQ] A Participant cannot Call both Tichu and Grand Tichu (the text gives no meaning to stacking; Grand Tichu is called before the small-Tichu window ends, and no source allows upgrading). UNSPECIFIED whether a Grand Tichu caller may additionally Call small Tichu; no source allows it and it would be pointless.
- R12.6 A Call is irrevocable in the printed rules; the FAQ's "may withdraw" is a tournament-arbiter concession for simultaneous partner Grand Tichus only. [FM-FAQ]
- R12.7 "Until he plays his first card" - UNSPECIFIED whether a Participant who has only *Passed* so far may still Call; the literal text permits it (a Pass plays no card). Also UNSPECIFIED whether the Call is allowed after a Dog lead by the partner etc. See Part 2, E-C1.

### 1.13 End of Round

- R13.1 The Round ends immediately when only one Participant still holds cards (three are out), or immediately when both Participants of one Team are out first and second (one-two / "Doppelsieg"). [FM-EN "The round ends immediately if only one player has cards left"; RGG §"Scoring a round": on a double victory "the round ends immediately"; FM-DE]
- R13.2 On the normal ending, the last Participant ("tailender") hands their remaining Hand to the *opposing Team* (those cards' points go to the opponents) and their collected Tricks to the *winner of the Round* (the Participant who went out first). [FM-EN; FM-DE §"Zur Wertung"; FM-HILFE "Letzter: Handkarten->Gegner, Stiche->Erster"]
- R13.3 Then each Team sums the card points (R1.2) in its Tricks; the two Team totals sum to 100 (may be negative for one Team because of the Phoenix, e.g. -25 / 125). [FM-EN; FM-DE]
- R13.4 One-two: if both Participants of a Team go out first and second, card counting is skipped and that Team scores 200, the other 0. [FM-EN; FM-DE "so ist die Zählung geschenkt: Die beiden schreiben ihrem Konto 200 Punkte gut"]
- R13.5 Round score for a Team = card points (or 200 / 0 on a one-two) + sum of its Participants' Call results (+100/-100 Tichu, +200/-200 Grand Tichu). [R12.4; ABACUS FAQ "Eventuell angesagte Tichus werden addiert bzw. abgezogen"]
- R13.6 The last Trick of the Round (closed by the third Participant's last card) is collected normally; if won by the Dragon it is still gifted (R10.4). An unresolved Trick on the table when the third Participant goes out is thus awarded to its winner (the last Participant to Play, since no further Play is possible). [FM-FAQ; FM-EN FAQ] UNSPECIFIED: whether the last remaining Participant could still Bomb that final Play before it is collected (the text says the trick "is ended immediately"). See Part 2, E-E2.

### 1.14 Target score and ties

- R14.1 Target: 1000 points. The Team that reaches (or exceeds) 1000 at the end of a Round wins the Match. [FM-EN "The actual object of the game is to score 1000 points"; RGG]
- R14.2 If both Teams reach 1000 in the same Round, the Team with more points wins. [FM-EN; FM-DE "gewinnt, wer insgesamt mehr Punkte geschafft hat"]
- R14.3 If both reach 1000 with the *same* total: FM-EN/FM-DE are silent; RGG adds "In case of a tie, the game continues until a team has 1000 or more at the end of a round and there is no tie." [RGG §"End of the game"] Engine: adopt RGG (play on). See Part 2, E-S1.
- R14.4 The target is checked only at the end of a Round, never mid-Round. [RGG "at the end of a round"; FM-EN "in the same round"]

---

## Part 2 - Edge cases: where the official text is silent/ambiguous, or implementations diverge

Legend: **Official** = what FM-EN / FM-DE / FM-FAQ / RGG say. **Practice** = what accessible secondary sources and online implementations do. **Recommendation** = the option best supported by the official text (or, failing that, majority practice); the engine grilling (issue 05) makes the final call. Secondary sources used here:

- **[BSW]** BrettspielWelt Tichu guide. <https://www.brettspielwelt.de/Hilfe/Anleitungen/Tichu/>
- **[BGA-HELP]** Board Game Arena "Gamehelptichu". <https://en.doc.boardgamearena.com/Gamehelptichu>
- **[BGA-TIPS]** Board Game Arena "Tips_tichu". <https://en.doc.boardgamearena.com/Tips_tichu>
- **[AARON]** Aaron Fuegi, "English Tichu Rules" (the widely copied English rewrite, used by gamecabinet.com/tabletopia). <https://scv.bu.edu/~aarondf/Games/Tichu/Tichu.html>
- **[WP-EN]** <https://en.wikipedia.org/wiki/Tichu> · **[WP-DE]** <https://de.wikipedia.org/wiki/Tichu>
- **[UBG-FAQ]** UltraBoardGames FAQ (a reproduction of the RGG FAQ). <https://www.ultraboardgames.com/tichu/faq.php>
- **[SPIELEN]** spielen.de forum "Tichu: Bomben jederzeit?" (answers by Lukas Merlach, a co-developer named in [URS]). <https://www.spielen.de/forum/viewtopic.php?t=65138>
- **[T1-HAUS]** tichu.one forum "Hausregeln Tichu". <https://forum.tichu.one/threads/hausregeln-tichu.147/>
- Pagat.com's Tichu page could not be fetched (HTTP 404 at both `/partnership/tichu.html` and `/climbing/tichu.html` on 2026-09-17); BoardGameGeek threads return HTTP 403 to fetches. Neither is cited below except by title where a search snippet was the only evidence (marked UNVERIFIED).

### Wish

- **E-W1 Wish when only the Phoenix could satisfy it.** Official: the Phoenix is "not a card of the desired rank"; a Participant with no natural card of the wished rank is never obliged, even holding the Phoenix [FM-FAQ; FM-EN FAQ]. Practice: BSW and AARON agree; BGA-HELP's wording "if a player can fulfill a wish (even if it requires the Phoenix), they must" is ambiguous and could be read as forcing a Phoenix substitution. Recommendation: official - Phoenix never counts as the wished rank; it only matters when it *completes* a Combination that contains a natural wished card (E-W3).
- **E-W2 Wish with a Bomb obligation.** Official: in the Participant's regular turn, if a Bomb is the only legal Play containing the wished rank, the Bomb must be played ("possibly in a bomb!") [FM-EN; FM-DE; FM-FAQ example: a straight-flush Bomb containing the wished 8 must be played over the K-quad]. Before the regular turn, the Participant may Bomb out of turn with a Bomb that does not satisfy the Wish, and may wait hoping the Wish is fulfilled by someone else [FM-FAQ]. Practice: BSW: "If only a bomb satisfies it legally, that bomb must be played" but also "You can place a bomb without the desired card, even if you could fulfill the wish, but the wish remains" - BSW does not distinguish in-turn from out-of-turn Bombs, and SPIELEN records that BSW originally blocked all Bombs while a Wish was pending, then (2007) changed to allow Bombs in the "Zwischenphase" between two regular turns after Fata Morgana clarified; Merlach in the same thread confirms the official reading: a Bomb may be thrown in the window before one's turn, but "a wish must still be fulfilled if you have the right to play". A BGA forum report (<https://forum.boardgamearena.com/viewtopic.php?t=20226>, reported by the sweep, UNVERIFIED) describes the opposite bug: the Wish still enforced after a straight-flush Bomb. Recommendation: official - the Wish binds only regular-turn Plays; an engine that models the Bomb window (E-B2) gets this for free.
- **E-W3 Wish inside a multi-card Combination (must a Participant break a pair/straight to honour it?).** Official: the obligation is "has a card of the desired rank and can lawfully play it", and the FAQ/RGG extend "lawfully" to any legal Combination of the current type that contains the rank, including a straight completed with the Phoenix [FM-FAQ; RGG "or rarely in a sequence"]. So on a pair Trick, a Participant holding 8-8 must play the pair when 8 is wished; on a straight Trick they must play a higher straight that contains an 8 if one exists in their Hand; on a single Trick a lone 8 must be played even if it breaks a straight they were keeping. Practice: BSW "the first player who can legally fulfil him must" - same; WP-EN "Each player who can fulfill the Wished card must play it, if possible". AARON gives the canonical Phoenix example: with a 7 wished and 5-6-7-8 + Phoenix in Hand on a straight Trick, "you DO have to play on the trick by making the Phoenix a 4 or a 9, allowing you to play your 'natural' 7" [AARON]. WP-DE: the card must be played "selbst wenn er sein Blatt dadurch schwächt". No source relaxes this. Recommendation: engine computes the set of legal Plays; if any contains a natural card of the wished rank, restrict the Participant to that subset (plus Pass is NOT allowed). Complexity note for the grilling: with Phoenix and long straights the subset search is non-trivial but finite.
- **E-W4 Is the Wish optional?** Official: "is allowed to wish" / "darf sich ... wünschen" [FM-EN; FM-DE]. Practice: BGA offers an explicit "no wish" choice (the "empty set symbol Ø") [BGA-TIPS]; BSW: wish "kann" be made [BSW]. Recommendation: optional; UI offers "no Wish".
- **E-W5 Wish persistence and scope.** Official: remains in force until fulfilled, across Tricks, and binds leads too (the FAQ example forces the Bomb winner to lead a straight containing the wished 8) [FM-FAQ]. It also binds the wisher and their partner (BSW says so explicitly: "including the wisher and his partner!") - consistent with "the next player who ..." in the official text. Recommendation: Wish is Round-level state cleared only when a natural card of that rank is played.
- **E-W6 Dog lead while a Wish is pending.** Official: silent. Under the literal rule the Dog is a "lawful" lead only if no lead containing the wished rank is possible; the Participant holding the rank "must play it" so leading the Dog instead is not allowed; but the Dog is a lead, not a Trick-taking Play, and no source discusses it. Practice: NOT FOUND in BSW/BGA/AARON (UNVERIFIED either way). Recommendation: treat the Dog like any other lead: forbidden while the leader holds a natural card of the wished rank (strict reading), and flag as a grilling decision.
- **E-W7 Mah Jong played inside a straight.** Official: "whoever plays the Mah Jong has a free wish" / "sobald der Spieler den Mah Jong spielt" - no restriction to singles, so a Wish may be set when the Mah Jong is led in a 1-2-3-4-5 straight [FM-EN; FM-DE]. Practice: WP-EN and BSW agree. Recommendation: allow the Wish on any Play containing the Mah Jong (leads only, since the Mah Jong is the lowest card and can only ever appear in a *led* straight or a led single... note: a 1-2-3-4-5 straight can never beat a previous straight, and a single 1 beats nothing, so the Mah Jong is always led).
- **E-W8 Wish for a special card / for a rank not in play.** Official: any rank 2..A, "not a special card"; nothing forbids wishing for a rank already fully played or one the wisher holds [FM-EN; FM-DE]. Practice: BGA-TIPS explicitly allows wishing for a card you gave away or one not in your Hand. Recommendation: any rank 2..A, no further validation.
- **E-W9 Wish and a Participant who already Passed earlier in the same Trick.** Official: the obligation applies "in his ordinary turn", every time it is their turn, and a Participant who Passed may re-enter (R6.3), so the Wish binds again on each of their turns [FM-DE 2022; FM-FAQ]. Practice: AARON same. Recommendation: check the Wish on every regular turn.

### Phoenix

- **E-P1 Phoenix beating the Dragon.** Official: never ("The Phoenix can beat an Ace but not the Dragon") [FM-EN; FM-DE]. All practice agrees [BSW "cannot override the dragon"; AARON; BGA-HELP]. No divergence.
- **E-P2 Phoenix led as a single.** Official: value 1½ [FM-EN; FM-DE]. All practice agrees [AARON; BGA-HELP; BSW]. Consequence the engine must encode: a led Phoenix is beaten by any 2 or higher but *not* by the Mah Jong (1); a Phoenix played on the Mah Jong single is 1½. No divergence.
- **E-P3 Phoenix in an ambiguous Combination (A,A,Phoenix,9,9).** Official: the player declares which value the Phoenix takes; if not declared, the higher option applies [FM-FAQ]. Practice: implementations pick a canonical interpretation silently (UNVERIFIED which). Recommendation: for full houses treat the Phoenix as completing the *triple* when both readings are legal (the higher option), or require the client to send the intended rank of the Phoenix with every Play (the cleanest engine design: a Play carries an explicit Phoenix rank assignment).
- **E-P4 Which Combinations the Phoenix may complete.** Official: any Combination, as any rank 2..A: pairs, triples, stairs, full house, straights; never a Bomb; never a 3,3,3,3+Phoenix "full house" [FM-EN; FM-DE; FM-FAQ]. It cannot stand for the 1 (Mah Jong) in a straight ("between 2 and Ace"). Practice: same everywhere checked. Recommendation: official.
- **E-P5 Phoenix and Wish.** See E-W1/E-W3.

### Dragon and Dragon Gift

- **E-D1 Dragon Gift when both opponents are already out.** Official: silent; the FAQ only insists that the gift happens even on the last Trick and even when the Dragon holder finishes third [FM-FAQ]. Since both opponents are one Team and scoring is per Team, the choice is immaterial to score. Practice: NOT FOUND (UNVERIFIED whether BSW/BGA still prompt). Recommendation: engine auto-gifts to either opponent (deterministically, e.g. the next opponent in play order) when no choice would change the score; optionally still record the recipient for statistics.
- **E-D2 Dragon Gift to an opponent who is already out.** Official: "an opponent of its holder's choice" - no restriction to opponents still holding cards [FM-EN; FM-DE]. Practice: BSW "You can decide which player you give the trick" with no restriction. Recommendation: any opponent, out or not.
- **E-D3 Dragon beaten by a Bomb.** Official: no gift, the bomber keeps the Trick (even if bombing their own Dragon) [FM-FAQ; FM-EN FAQ]. Practice agrees [BGA-HELP; BSW]. No divergence.
- **E-D4 Dragon played as the third Participant's last card.** Official: Trick ends immediately, is collected, and is still gifted [FM-FAQ; FM-DE 2022 FAQ]. WP-DE claims "if finishing with it, the player keeps the points" - this contradicts the publisher FAQ (UNVERIFIED and likely an editorial error on WP-DE). Recommendation: official - always gifted.
- **E-D5 Timing of the Dragon Gift.** Official: at the moment the Trick is won (after three Passes / immediate end) [FM-FAQ]. Engine: a `chooseDragonGift` step blocks the next lead; the Dragon holder leads next regardless of the gift [FM-FAQ "spielt aber zum nächsten Stich selbst aus"].

### Dog

- **E-G1 Dog when the partner is already out.** Official: lead passes to the next Seat in play order after the *partner* (RGG and FM-EN are explicit; the Blech German "zu seiner Rechten" is ambiguous but the FAQ's "lead can come back to me" only works under the partner's-right reading) [FM-EN; RGG; FM-FAQ]. Practice: BSW "the next player still in the game gets the play; you can be yourself" and AARON "next in normal turn order from the partner" - same. Recommendation: `nextSeatInPlayOrderFrom(partner)` skipping out Seats (which can return to the Dog player).
- **E-G2 Bomb on a Dog Play.** Official: not allowed; the Dog is not a Combination, and the right to lead cannot be bombed [FM-FAQ; FM-DE FAQ]. Practice: BSW, BGA-HELP, AARON all agree. No divergence.
- **E-G3 Dog as a Participant's last card.** Official: legal (the Dog is a legal lead); the Participant is out and the lead transfers per E-G1. BGA-TIPS discusses "your last exit card Dog", so BGA allows it. Recommendation: allow; note that leaving with the Dog can complete a one-two if the partner is already out... no: if the partner is out the Dog's lead goes to an opponent, but the one-two is about *finishing order*, so a Dog last card by the second Team member still completes a one-two.
- **E-G4 Ownership of the Dog "Trick".** Official: silent; the Dog "has no trick-taking power", carries 0 points. Recommendation: discard to the Dog player's Trick pile (or a Table discard); scoring-neutral either way.
- **E-G5 Dog after having Passed in the current Trick (house rule).** T1-HAUS lists a house rule "Dog only if the player has not yet passed in the current trick" - meaningless under official rules because the Dog can only be led to a fresh Trick. No engine decision needed.

### Bombs

- **E-B1 Bomb on an empty Trick / as a lead.** Official: only the Participant whose lead it is may lead a Bomb; others cannot bomb "the right to lead" [FM-EN; FM-DE; FM-FAQ]. Practice agrees [BSW; AARON "you must give a player a chance to lead"]. No divergence.
- **E-B2 Timing/priority of out-of-turn Bombs (the online race).** Official: Tichu "should not be a game of reaction"; after every Play each Participant in play order gets a Bomb opportunity before the next regular Play; simultaneous Bombs resolve in play order; a Participant may ask for thinking time; one may not wait to see a Play and then claim a prior Bomb [FM-FAQ; FM-EN FAQ]. Practice: BSW and BGA let any Participant click a Bomb at any time until the next Play is registered (first-come) [BSW "can even be played if you are not at all in the row"; BGA-HELP "every player given a chance to play bigger bombs"] - UNVERIFIED whether either implements a formal window. Options for the engine: (a) first-come-first-served with server ordering; (b) an explicit Bomb window after each Play (every Participant must decline or Bomb, possibly with a short timeout and a "never ask me" default); (c) hybrid: instant Bombs allowed but a Participant may pre-declare "hold" to keep the window open. Recommendation: (b) matches the official text best and is bot-friendly and deterministic; grilling should weigh UX cost.
- **E-B3 Bomb after one's own Pass in the same Trick.** Official: allowed (bombs "at any moment"; a Passer may re-enter) [FM-EN; FM-DE 2022]. Practice: BSW/BGA allow; T1-HAUS lists "once you pass you're out of the trick except for bombs" as a *house* rule, i.e. even that stricter variant keeps Bombs. Recommendation: allowed.
- **E-B4 Bomb after three consecutive Passes, before the Trick is collected.** Official: allowed [FM-EN FAQ; FM-DE 2022; FM-FAQ]. Practice: online implementations typically collect the Trick as soon as the third Pass arrives (UNVERIFIED for BSW/BGA; no source describes a post-pass Bomb window). Recommendation: implement the Trick end as a short Bomb window (same mechanism as E-B2, option b) or accept the deviation and document it.
- **E-B5 Bomb ordering.** Official: number of cards first, then rank; any straight flush (≥5) beats any four-of-a-kind; longer straight flush beats shorter regardless of rank [FM-EN; FM-DE]. Practice agrees [AARON's list "4444, 5555, 45678, 56789, 234567"; BSW]. No divergence.
- **E-B6 Bombing one's own Play.** Official: allowed, but others' Bombs have priority [FM-FAQ]. Practice: BGA/BSW allow (UNVERIFIED priority handling). Recommendation: allowed, subject to E-B2.
- **E-B7 Bomb in a regular turn while a Wish is pending.** Official: if the Participant holds a natural card of the wished rank and has any legal Play containing it, they must make such a Play - a Bomb without the wished rank is not a legal choice in turn (E-W2); a Bomb *with* the wished rank satisfies the Wish. BSW diverges (allows the Bomb, Wish stays pending). Recommendation: official.
- **E-B8 Straight flush declared as an ordinary straight.** Official: not allowed [FM-FAQ]. Also: may a straight flush of 6+ cards be split into a 5-card Bomb plus singles? Yes - only the cards actually laid count; the engine classifies each Play by its own cards. Practice: no divergence found.
- **E-B9 Mah Jong inside a straight-flush Bomb.** Official: not possible (the 1 has no suit). WP-DE documents a house rule allowing it. Recommendation: official; possible option flag.
- **E-B10 Phoenix inside a Bomb.** Official: never. No divergence.
- **E-B11 Playing on one's own Trick after three Passes (non-Bomb).** Official: after three Passes the Trick is over; the winner "gathers in the trick and leads a new one" [FM-EN]; AARON: "not allowable ... He must collect the trick and start a new one. Bombs are ... an exception" [AARON]. So a Participant cannot extend their own winning Trick with a higher ordinary Combination; only Bombs (E-B4/E-B6) can be played before collection. No divergence.

### Calls

- **E-C1 Tichu Call after Passing but before playing a card.** Official: "until he plays his first card" - a Pass plays nothing, so the Call is still allowed; nothing in FM-EN/FM-DE/FM-FAQ forbids it. Practice: AARON explicitly "You can therefore choose to pass for several full tricks and still call a Tichu later"; BGA-TIPS implies the same. Recommendation: allowed while the Participant's Hand is still 14 cards (after Exchange) i.e. no Play made.
- **E-C2 Tichu Call after playing a card.** Official: not allowed [FM-EN; FM-DE]. All practice agrees. The Dog counts as a card. No divergence.
- **E-C3 Tichu Call during the Exchange.** Official FAQ: not allowed to Call at a moment when some have already given cards and others not; the intended windows are: after 14 cards, then Exchange, then again after the Exchange, then after the first lead [FM-FAQ]. Practice: BSW/BGA allow a Tichu click at any time until the first card (UNVERIFIED whether they block it mid-Exchange). Recommendation: offer Call before Exchange and after Exchange; if the engine resolves the Exchange atomically (all three cards submitted, then revealed simultaneously), the mid-Exchange problem cannot arise - only a Participant who has not yet *submitted* is affected, and their Call can be timestamped before/after their submission.
- **E-C4 Grand Tichu Call timing and information.** Official: before taking the ninth card, with a turn-order procedure in which later Seats know earlier Seats' decisions [FM-FAQ; FM-EN FAQ]. Practice: every online implementation deals 8 and asks all four simultaneously [BSW "before you see the remaining 6 cards"; BGA-HELP "after viewing eight cards"; WP-EN]. Options: (a) simultaneous private decisions (majority practice, no information leak, faster); (b) sequential in Seat order starting from the dealer's left with earlier decisions visible (official). Recommendation: (a) as default; (b) as an option flag; both are compatible with the published text since calls "on 1-7 cards are possible" and the sequence is described as a tie-break procedure.
- **E-C5 Both partners Call (Grand) Tichu.** Official: legal; only one can succeed [FM-FAQ]. Practice agrees. Recommendation: allowed; a failed Call by the partner of a successful caller costs -100/-200 as usual.
- **E-C6 Upgrading Tichu → Grand Tichu or stacking both.** Official: silent; Grand Tichu's window closes before any Tichu window practically matters; AARON states it outright: "A single player may not call both a 'Grand Tichu' and a standard 'Tichu'" [AARON]. Recommendation: a Participant holds at most one Call; a Grand Tichu caller cannot also Call Tichu; a Tichu cannot be "upgraded".
- **E-C7 Withdrawal of a Call.** Official: irrevocable; the FAQ's withdrawal is an arbiter concession for simultaneous partner Grand Tichus [FM-FAQ]. Recommendation: irrevocable; with sequential Grand Tichu (E-C4 b) the situation cannot arise.
- **E-C8 Call points on a one-two.** Official (ABACUS FAQ; FM-EN "in addition to"): Call results are added/subtracted on top of the 200 [ABACUS; FM-EN]. Example: Team A goes one-two but A1 had Called Tichu and A2 went out first: A scores 200 - 100 = 100. Practice agrees [AARON]. No divergence.
- **E-C9 Tichu Called by a Participant whose partner is already out.** Official: allowed if the caller has played no card; it can only fail (partner out first). Recommendation: allow (it is the caller's problem) or warn in UI.

### Trick flow and end of Round

- **E-TR1 "Three Passes" with Participants out.** Official: unchanged wording [FM-EN]. Practice: all implementations end the Trick when every *remaining* Participant other than the last Player has Passed (UNVERIFIED as an explicit statement; it is the only workable reading). Recommendation: Trick ends when all Participants still holding cards, other than the last Player, have Passed in sequence.
- **E-TR2 Re-entering a Trick after Passing.** Official: allowed (FM-DE 2022: "Wer gepasst hat, darf ohne weiteres wieder ins Spiel eingreifen") [FM-DE 2022; AARON "legal ... as long as some other player played in between"]. Practice: BSW guide is silent; T1-HAUS lists "once passed, out of the trick" as a house rule, implying the default is re-entry. Recommendation: allowed (official).
- **E-TR3 Direction of play.** Official text: to the right (counter-clockwise); RGG FAQ: clockwise is fine [RGG]. Practice: BSW/BGA go clockwise on screen (UNVERIFIED). Recommendation: engine is direction-agnostic (Seat order 0→1→2→3); UI decides.
- **E-TR4 Lead when the Trick winner is out.** Official: passes to the next Seat in play order still holding cards [FM-EN; FM-DE]. Note: the winner still *collects* the Trick (and still makes the Dragon Gift). No divergence.
- **E-E1 Round end on one-two.** Official: immediate; counting skipped; 200 to the Team [FM-EN; FM-DE; RGG "the round ends immediately"]. Practice agrees [BSW "double win ... 200 points"; AARON]. No divergence. (A "play the Round out anyway" variant was NOT FOUND.)
- **E-E2 Bomb by the last Participant on the final Play of the third to go out.** Official: "the trick is ended immediately" [FM-FAQ] - which reads as: no further Play, so no Bomb. Practice: UNVERIFIED. Recommendation: no Bomb window on the Round-ending Play (it could not change who went out third anyway; it could only move card points).
- **E-E3 Transfer of the last Participant's Hand and Tricks.** Official: Hand → opposing Team; Tricks → first Participant out [FM-EN; FM-DE; FM-HILFE]. Practice agrees [BSW; BGA-HELP; AARON; WP-EN]. (The 6-player Tientsin variant differs, see Part 3.) No divergence.
- **E-E4 Round ends when three are out.** Official [FM-EN; FM-DE]; practice agrees [BSW]. No divergence.
- **E-S1 Ties at the target score.** Official FM text: silent on an exact tie; both ≥1000 → higher total wins [FM-EN; FM-DE]. RGG: "In case of a tie, the game continues until a team has 1000 or more at the end of a round and there is no tie" [RGG]. AARON same as RGG. WP-DE: in tournament format a tie scores 1 point per Team (i.e. tournaments accept draws) [WP-DE, UNVERIFIED]. BSW's "Runde X" option ends after a fixed number of Rounds instead [BSW]. Recommendation: RGG rule (play on until untied) for the default Match; support a fixed-Rounds Match mode where a draw is a valid outcome.
- **E-S2 Negative and sub-target scores.** A Team can score -25 in a Round and its cumulative total can go negative (Phoenix, failed Calls); the target is checked only at Round end [RGG]. No source caps negatives. Recommendation: no floor.
- **E-S3 Configurable target.** Official: 1000. An old public BGA implementation repo defines a "Quick game (600 points) / Standard game (1000 points)" option and a "Grand Tichu: No" option (<https://raw.githubusercontent.com/AndyKerrison/bga-tichu/master/gameoptions.inc.php>, reported by the sweep, UNVERIFIED and not visible on the live BGA panel). BSW: fixed-Rounds option; tournaments (Fata Morgana Swiss championship) use 1000 or a fixed number of deals or a time limit [Part 3]. Recommendation: target is a Match parameter defaulting to 1000.

### Exchange

- **E-X1 Seeing received cards before giving.** Official: forbidden [FM-EN; FM-DE]. Online implementations reveal all received cards only after everyone has submitted (simultaneous) [BSW; WP-EN "simultaneous exchange"]. Recommendation: atomic Exchange: collect three chosen cards from each Seat, then reveal.
- **E-X2 Exactly one card to each other Seat.** Official: yes, one to each [FM-EN; FM-DE]; no source allows giving two to the partner. No divergence.

### Irregularities (not engine-enforced)

- **E-I1 Unhonoured Wish penalty** (ABACUS FAQ: 200 to the opponents as for a one-two, Calls still counted) - only relevant to a live table; an engine enforces R7.2-R7.7 and never needs it [ABACUS].
- **E-I2 Simultaneous partner Grand Tichus** - see E-C7.

**Edge-case count: 59** (E-W1-9, E-P1-5, E-D1-5, E-G1-5, E-B1-11, E-C1-9, E-TR1-4, E-E1-4, E-S1-3, E-X1-2, E-I1-2). Of these, the official text is silent or ambiguous on 13 (E-W6, E-P3, E-D1, E-D2, E-G4, E-B2, E-B4, E-C1, E-C3, E-C6, E-TR1, E-E2, E-S1), and secondary sources or implementations demonstrably diverge from the official text on 5 (E-W1 BGA wording, E-W2/E-B7 BSW pre-2007 and the BGA bug report, E-C4 simultaneous Grand Tichu, E-D4 WP-DE's Dragon claim, E-S1 tie handling); the rest are confirmed agreements recorded so the engine grilling can close them quickly.

---

## Part 3 - Documented variants (one line each)

Official (printed in the publisher's rules booklet):

- **Tichu Nanjing (4 players)** - the standard game described in Part 1. [FM-EN; FM-DE]
- **Trichu / "Threechu" (3 players)** - deal as for four; the dealer plays solo with a face-up dummy partner ("Frau Tisch") opposite; dealer sees both Hands, Exchanges only with the opponents (two cards each way), lays the dummy open after the Exchange and plays it; dealer and dummy may not Call Grand Tichu (opponents may), dealer may Call Tichu for the dummy; the dummy need not honour a Wish; scored per player with a "Tisch" column; solo seat rotates; play a number of Rounds divisible by three (booklet: nine), not to 1000. Credited to Janus Staecker (Munich). [FM-EN §"Threechu"; FM-DE §"Trichu"; RGG]
- **Tichu Tientsin (6 players)** - two Teams of three seated alternately; Grand Tichu before the seventh card; each Participant gives one card to each partner only (two cards); the Dog gives the lead to a partner of choice; the last Participant loses Hand *and* all Tricks to the opponents, the fifth gives Tricks to the winner; no one-two bonus, but a triple victory scores 300. Credited to guide Mr Zhu. [FM-EN; FM-DE; RGG]
- **Grand Seigneur / Grandseigneur (5-12 players)** - non-partnership climbing game (President-style) with Tichu Combinations, no Calls, no point counting, Dog removed; seat hierarchy (Great Lord … Wretch) from previous finishing order with unequal forced Exchanges (3/2/1 best cards upward); two decks recommended from seven players (remove second Mah Jong; second Dragon beats the first; four-of-a-kind Bombs need four different suits). Learned in Aix-en-Provence; simplified version sold as "Career Poker" (Hexagames). [FM-EN; FM-DE; RGG]
- **Player count on the box** - RGG prints "for 3-10 players"; Fata Morgana says variants for 6+ need two decks. [RGG; FM-PAGE/URS]
- **5-player official variant** - NOT FOUND in any publisher text; Urs Hostettler only mentions having seen a five-player game in Chinese parks, details unconfirmed. [URS] (Secondary "5er Tichu" at tichu.de: fifth Participant plays solo with the Dog holder; page now 404 - UNVERIFIED.)
- **2-player official variant** - NOT FOUND in FM/ABACUS/RGG. Secondary "Würzburger 2er-Tichu" (each Participant plays two Hands alternately; one-two = both own Hands out first) is described only in forum posts/BGG threads (BGG 403, mirror unreachable) - UNVERIFIED.
- **Tichu Booster (2016, 25th anniversary)** - official expansion by Fata Morgana/Abacus: 57 text cards + 3 rule cards; a Participant who Calls Tichu draws/chooses booster cards that add new Combinations (e.g. rainbows, extra straight types) and effects; has its own FAQ and tournament rules (six Rounds, 30-second decision limit). [FM-PAGE; URS; Booster FAQ <https://urs.fatamorgana.ch/tichuboosterfaq.html>]
- **Official tournament formats (Swiss championship)** - individual: tables of four in a Swiss system, a "round" ends after six deals, 1000 points, or 50 minutes; 3/1/0 match points, tie-break on game points, extra deal if 1000:1000; team event: eight deals / 1000 / 60 minutes. [Fata Morgana Turniere page <https://fatamorgana.ch/fatamorgana/tichu/turniere> - reported by the sweep, UNVERIFIED by direct fetch in this session]

Product names asked about in the ticket but NOT FOUND as real products/variants (checked fatamorgana.ch, urs.fatamorgana.ch, WP-EN, WP-DE, web search): **Tichu Pokerface**, **Tichu Weekend**, **Tichu Kagemusha**, **Tichu Uno**, **"Big Tichu"**, **"Tichu mit 10 Karten"**. "Grand Tichu" / "grosses Tichu" is the 200-point Call in the base game, not a product; "Kleines Tichu" is the official name of the 100-point Call. Other editions exist (Fata Morgana tin box, Bavarian-dialect edition, Abacus/RGG 1998 two-deck edition, Dutch "Tai Pan", Korea Boardgames "Tichu Deluxe" bundling the Booster) but change no rules [WP-EN; BGG version pages - secondary].

House rules and platform options (all secondary, UNVERIFIED against publisher text):

- **"Tichu ohne Wunsch" (no Wish)** - NOT FOUND as a named documented variant; the only related thing is BGA's per-play "no wish (Ø)" choice, which is simply the official optional Wish. [BGA-TIPS]
- **Chaos-Tichu** - online fun variant where both Teams must Call Grand Tichu every Round, limited partner talk allowed. [WP-DE]
- **Mah Jong in a straight-flush Bomb** - house rule allowing the 1 in a one-suit run Bomb. [WP-DE]
- **Chained triples (666777)** - house rule allowing sequences of triples as a Combination. [T1-HAUS]
- **Pass-and-out** - once Passed, out of the Trick except for Bombs. [T1-HAUS]
- **Dog only if not yet Passed** - house rule (moot under official rules). [T1-HAUS]
- **Mega Tichu** - trailing Team predicts first and second finisher before the deal for ±500-750. [T1-HAUS]
- **BrettspielWelt options** - "Runde X" (fixed number of Rounds instead of 1000), "Tichujoline" (auto seating/partner rotation), "Turnier" (nine Rounds, rotating partners, Grand Tichu disabled, ranking by win points then Tichu points; a one-two in this mode gives three win points and 100 (not 200) Tichu points). [BSW]
- **Fata Morgana licensed iOS app (MystcMage)** - the only documented option found is one "to ban bombing out of turn" (App Store listing snippet; page returned 429 - UNVERIFIED).
- **Board Game Arena** - no rule options documented; the "Grand Tichu 12 rounds / Easy 7 / Hard 5 / Ultimate 1" formats are a player's homebrew forum proposal. [BGA-HELP; <https://forum.boardgamearena.com/viewtopic.php?t=30053> - reported by the sweep, UNVERIFIED]
- **Dealing 8 + 6 and playing clockwise** - described as permitted procedural variants by RGG and AARON; identical to the official game. [RGG FAQ; AARON]
- **Alternative German tournament scoring** - "DTM" association rules with 2/1 match points, four-deal rounds. [spielen.de thread <https://www.spielen.de/forum/viewtopic.php?t=169365> - reported by the sweep, UNVERIFIED]

## Open items for the engine grilling (issue 05)

E-W3 (Wish subset computation), E-W6 (Dog vs Wish), E-B2/E-B4 (Bomb window design), E-C4 (Grand Tichu simultaneous vs sequential), E-S1 (tie/target/fixed-Rounds Match modes), E-P3 (explicit Phoenix rank in a Play), E-D1 (auto Dragon Gift).
