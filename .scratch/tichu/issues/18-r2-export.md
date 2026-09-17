# 18 Can the free tier hold the Match event-log corpus in R2?

Type: research
Status: resolved
Blocked by: 
Map: ../map.md

## Question

From Cloudflare's own docs: R2 free-tier limits (storage, Class A and B operations, egress), whether a Durable Object can write to an R2 binding directly, object size limits, and whether a Worker on the free plan can bind R2 at all. Estimate corpus growth at one JSONL object per finished Match (a few hundred KB) for a friends group. Deliverable: `.scratch/tichu/research/r2-export.md` with a go or no-go and the fallback (keep logs in DO SQLite, or export to a GitHub repo via API).

## Answer

**GO.** Findings with citations: [research/r2-export.md](../research/r2-export.md).

- R2 free tier: 10 GB-month storage, 1M Class A and 10M Class B operations per month, free egress, no paid Workers plan required.
- **Gate**: R2 is an add-on enabled through a dashboard checkout, and Cloudflare requires a payment method on file for add-ons. Expect to enter a card once; nothing is charged inside the free tier.
- A Durable Object receives the same `env` as its Worker, so it can call the R2 binding directly. Single-request limit is 5 GiB; a 300 KB JSONL object needs no multipart.
- Corpus estimate: 300 KB per Match at 50 Matches a month is 15 MB a month, about 540 MB after three years, roughly 5% of quota. A 20x stress case still fits.
- Fallbacks ranked: a dedicated corpus Durable Object in SQLite (5 GB free, 2 MB per row) beats the GitHub Contents API (directory and file-size limits, secondary rate limits).
- Cleanup: the 7-idle-day Alarm calls `deleteAll()`, which also clears the alarm on a compatibility date of 2026-02-24 or later. Flag the export after the put so retries are idempotent.
