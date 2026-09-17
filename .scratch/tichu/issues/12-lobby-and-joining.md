# 12 How does a Table get created, joined, and started?

Type: grilling
Status: resolved
Blocked by: 
Map: ../map.md

## Question

Decide the flow from creating a Table to the first deal: link format, nickname entry, choosing a Seat, adding Bots to empty Seats, who may start, what a Player sees when they open a link to a running Match, and what the Table does when the Match ends (rematch or new Table).

Note (from the rules engine resolution): creating a Table picks a Variant; the Table's Seat count and Team shape come from that Variant's Layout. Design the flow for standard Tichu but do not assume four Seats.

## Answer

Resolved by grilling with Pavel, 2026-09-17.

- **Create**: pick a Variant (standard Tichu now; Grand Seigneur once built) and its Match settings; receive a link with a short unguessable Table id.
- **Join**: open the link, enter a nickname (unique per Table, a number is appended on collision), take any empty Seat. Seat choice is deliberate because in standard Tichu it picks the partner. The Seat count and Team shape come from the Variant's Layout.
- **Start**: the creator fills empty Seats with Bots and starts when the Layout is full.
- **Full Table**: a link opened on a full, running Table shows "in progress, no free Seat". No spectating.
- **Seat release**: any connected Player may release a disconnected Seat (new token, new joiner) or hand it to a Bot. Only the creator can start, close, or change settings. If the creator's Seat is released, the creator role passes to the longest-connected Player.
- **Match end**: standard Tichu offers a rematch keeping Seats and Participants; Grand Seigneur is open-ended and the creator closes the Table, the hierarchy at that moment being the result. The creator can close a Table at any time.
