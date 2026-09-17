# 08 How are Table state and the Match event log stored?

Type: grilling
Status: resolved
Blocked by: 01, 07
Map: ../map.md

## Question

Decide the Durable Object SQLite schema: live Table state for rejoin and the append-only event log per Match. Decide the event shape (derivable from protocol messages or a separate domain event stream), retention, and how a future training pipeline would read the log. Decide what happens to a Table nobody returns to.

## Answer

Resolved by grilling with Pavel, 2026-09-17.

- **Engine**: raw Durable Object SQLite via the storage API, not the Effect SQL adapter (open DO-transaction issues at the time).
- **Schema**: one append-only `events` table per Table (sequence, timestamp, event JSON) and one Table row (Variant, settings, Seats with nicknames and Seat tokens, creator, timestamps). Seat tokens are stored as-is; the Durable Object is private.
- **Live state** is rebuilt on wake by folding the events. No snapshots until a Match proves too slow to replay; a full Match is on the order of a couple of thousand events.
- **Export**: at Match end (standard Tichu; a rematch produces a second object) or at Table close (Grand Seigneur), the Table writes the Match event log as one JSONL object to Cloudflare R2, the future training corpus. Confirmed by [Can the free tier hold the Match event-log corpus in R2?](18-r2-export.md): free tier suffices, a Durable Object can bind R2 directly, and enabling R2 needs a payment method on file once. Fallback if that gate is unacceptable: a dedicated corpus Durable Object in SQLite.
- **Retention**: an Alarm deletes the Table's storage 7 days after the last connection. An unfinished Match is exported as partial before deletion.
- **Training pipeline** reads the R2 bucket; nothing else is designed here.
