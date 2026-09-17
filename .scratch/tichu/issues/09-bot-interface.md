# 09 What is the Bot interface?

Type: grilling
Status: resolved
Blocked by: 05
Map: ../map.md

## Question

Decide the interface every Bot tier implements: the observation a Bot receives (its Hand, public state, history), the decisions it must make (Grand Tichu, Exchange, Call, Play, Wish, Dragon Gift), the time budget, and how the engine asks for a decision. Design the random Bot and the heuristic Bot at outline level. Verify the interface would fit a search Bot and a learned Bot without engine changes, but do not design those.

Note (from the rules engine resolution): the observation a Bot receives includes the Layout; a Bot must not assume four Seats or a single partner. Legality comes from the engine's `legalPlays`, never recomputed by the Bot.

## Answer

Resolved by grilling with Pavel, 2026-09-17.

**Interface**
- Two entry points. `decide(observation, decision)` answers a **Decision** the engine requires (Grand Tichu, Exchange, Play with its Wish, Dragon Gift) and must return one of the legal options attached to it. `react(observation)` is called after every event where a **Reaction** is legal (a Tichu Call, an out-of-turn Bomb) and returns nothing by default.
- **Observation** is exactly the visibility-filtered state a human in that Seat receives: Layout, own Hand, every Seat's card count, Calls, scores, the current Trick, the pending Wish, who is out, and the public event history of the Round. The realtime protocol defines one projection for humans and Bots. A Decision carries the engine-computed legal options; Bots never recompute legality.
- Bots are **pure** functions of (observation, decision, seed). No private state between calls; anything needed is derived from the event history. Deterministic in tests, immune to Durable Object hibernation.
- Every Decision carries a **time budget** in milliseconds set by the Table. On overrun the Table answers with a uniformly random legal option and logs it. Human-feel thinking delays are the Table's concern.
- Observation and options are plain data (Effect Schema), never functions.

**Guarantees for future Bots** (nothing more is designed here)
- The kernel exposes `replay(deal, events)` so a search Bot can build hypothetical full states from a guessed deal plus the public history.
- Plain-data observations make a learned Bot's encoder a pure function of the same schema.

**Random Bot**: uniform over legal options; never Calls, never Bombs out of turn; Grand Tichu always no; no Wish; Dragon Gift to a random opponent.

**Heuristic Bot** (outline; thresholds tunable): Grand Tichu when the first eight cards hold at least two of Dragon, Phoenix, Aces. Exchange: lowest cards to opponents, a strong card to the partner. Tichu Call when Hand strength is high and no Grand Tichu was called. Play: lead the Combination that sheds the most low cards; beat with the cheapest sufficient option; Pass when the partner is winning; Bomb only to secure its own or partner's Call or to break an opponent's. Wish: a rank the Bot lacks that hurts opponents. Dragon Gift: the opponent holding more cards.

**Takeover**: a disconnected Player's Seat is driven by the heuristic Bot through this same interface; the Player resumes on return. Trigger and timing belong to the realtime protocol ticket.

Glossary updated in `CONTEXT.md`: Decision, Reaction, Observation.
