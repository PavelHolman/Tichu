# Tichu

A web app where friends play the card game Tichu together at a shared table, with bots filling empty seats.

## Language

### Table

**Table**:
A room where one Match is played. Joined by link, holds four Seats.
_Avoid_: Room, lobby, game (when meaning the room)

**Seat**:
A fixed position at a Table, numbered from 0 in play order. How many there are comes from the Layout.
_Avoid_: Slot, position

**Team**:
A group of Seats that score together. In standard Tichu, the two opposite Seats. Individual play is Teams of one.
_Avoid_: Side, partnership

**Variant**:
A named rule set played with a Layout. Standard Tichu is the default Variant.
_Avoid_: Mode, game type, rule set (when meaning the whole Variant)

**Layout**:
The Seat count and the partition of Seats into Teams that a Variant is played with.
_Avoid_: Configuration, table size

**Participant**:
Whoever holds a Seat: a Player or a Bot.
_Avoid_: User, member

**Player**:
A human Participant, identified at the Table only by a nickname.
_Avoid_: User, account

**Bot**:
A computer Participant. Bots have tiers (random, heuristic; later search and learned).
_Avoid_: AI, agent, CPU

### Play

**Match**:
A sequence of Rounds at one Table, ending as the Variant defines. In standard Tichu, when a Team reaches the target score.
_Avoid_: Game, session

**Round**:
One deal of the Deck, ending as the Variant defines. In standard Tichu, when three Participants are out or one Team goes one-two.
_Avoid_: Hand (when meaning the deal), deal, game

**Hand**:
The cards a Participant currently holds.
_Avoid_: Cards, holding

**Trick**:
A sequence of Plays started by a lead, won by the last unbeaten Play, and collected by its winner.
_Avoid_: Pile, stack

**Play**:
One Participant's action on a Trick: laying a Combination or a Pass.
_Avoid_: Move, turn, action

**Combination**:
A legal set of cards laid as one Play: single, pair, triple, full house, straight, stairs, or bomb.
_Avoid_: Set, meld, pattern

**Pass**:
A Play that lays nothing. Three consecutive Passes end the Trick.
_Avoid_: Skip

**Bomb**:
A four-of-a-kind or straight flush. The only Combination that may be played out of turn.

**Call**:
A Tichu or Grand Tichu declaration by a Participant, worth plus or minus 100 or 200 points.
_Avoid_: Bet, bid, announcement

**Exchange**:
The phase after the deal where each Participant passes one card to each other Participant.
_Avoid_: Passing, swap

**Wish**:
The rank demanded by whoever plays the Mah Jong, which must be honoured when possible.
_Avoid_: Request, demand

**Dragon Gift**:
Handing the Trick won with the Dragon to a chosen opponent.

**Deck**:
The set of card instances a Variant deals from. Standard Tichu uses one deck of 56 cards; some Variants use two.
_Avoid_: Pack

### Choices

**Decision**:
A choice the engine requires from a Participant before play continues: Grand Tichu, Exchange, Play, Dragon Gift.
_Avoid_: Prompt, request, action

**Reaction**:
An optional action a Participant may volunteer whenever it is legal: a Call, an out-of-turn Bomb.
_Avoid_: Interrupt, opportunistic action

**Observation**:
Everything a Participant in a Seat may see: their Hand, the public state, and the Round's public history.
_Avoid_: View, snapshot, game state (when meaning what one Seat sees)

### Special cards

**Mah Jong**:
The 1. Its holder leads the first Trick of a Round and may make a Wish.

**Dog**:
Passes the lead to the partner. Only playable as a lead.

**Phoenix**:
Wildcard in Combinations, or a single half a rank above the previous single.

**Dragon**:
The highest single. Its Trick is always given away as a Dragon Gift.
