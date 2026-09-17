# Research: Can the free tier hold the Match event-log corpus in R2?

Resolves: `../issues/18-r2-export.md`
Date: 2026-09-17
Method: primary sources only (developers.cloudflare.com; docs.github.com for the GitHub fallback). Every claim carries the URL it was read from. Claims not backed by a page are marked **UNVERIFIED**. No sub-agents; all pages were read in this session.

## Summary

**Recommendation: GO for "export each finished Match's event log to R2 from the Table Durable Object".**

- R2 has its own free tier, independent of the Workers plan: 10 GB-month storage, 1 M Class A ops, 10 M Class B ops per month, egress free. At 300 KB × 50 Matches/month the corpus reaches ~0.54 GB after 3 years, about 5 % of the storage quota, and uses ~50 of the 1 M monthly Class A ops. Even a 20× worse scenario stays inside the quota (section 4).
- A Durable Object gets the same `env` as the Worker, so `this.env.CORPUS.put(key, jsonl, { httpMetadata: { contentType: "application/x-ndjson" } })` works directly from the DO. A 300 KB object is far below the 5 GiB single-request limit; no multipart.
- No documented Workers-Free restriction on R2 bindings. The one real gate: R2 is an add-on "subscription" that must be enabled via a checkout flow in the dashboard, and Cloudflare requires a payment method on file for add-on subscriptions. Expect to enter a card once (it is not charged inside the free tier). If the owner refuses to add a card, R2 is a NO-GO and the fallback is section 5a (keep logs in DO SQLite).
- The 7-day cleanup is an ordinary DO alarm followed by `ctx.storage.deleteAll()`, which on compat date ≥ 2026-02-24 also clears the alarm.

Design shape that follows: on Match end, the DO writes the JSONL to R2 with `onlyIf: { etagDoesNotMatch: "*" }`-style idempotency (see section 2, use a deterministic key `matches/<tableId>/<matchId>.jsonl`), then sets an alarm 7 idle days out; the alarm handler re-checks idleness and calls `deleteAll()`.

## 1. R2 free tier

All from [R2 Pricing](https://developers.cloudflare.com/r2/pricing/) unless noted.

| Item | Free per month | Paid rate above free |
|---|---|---|
| Standard storage | "10 GB-month / month" | "$0.015 / GB-month" |
| Class A operations | "1 million requests / month" | "$4.50 / million requests" |
| Class B operations | "10 million requests / month" | "$0.36 / million requests" |
| Egress (data transfer to Internet) | Free | Free |

- "The free tier only applies to Standard storage, and does not apply to Infrequent Access storage." Use Standard (the default).
- Egress: "egressing directly from R2, including via the Workers API, S3 API, and r2.dev domains does not incur data transfer (egress) charges and is free."
- Class A (writes/lists) includes `PutObject`, `UploadPart`, `CompleteMultipartUpload`, `CreateMultipartUpload`, `ListObjects`, `CopyObject`, `ListParts`, `ListMultipartUploads`, bucket-config ops. Class B (reads) includes `GetObject`, `HeadObject`, `HeadBucket`, `UsageSummary`.
- Storage is measured as GB-month "averaging the *peak* storage per day over a billing period (30 days)". Example in the doc: "1 GB * 5/30 month + 3 GB * 25/30 month = 2.66 GB-month".
- Pricing is the same regardless of access path; the page does not distinguish Workers binding vs S3 API.
- "You are not charged for operations when the caller does not have permission to make the request (HTTP 401 `Unauthorized` response status code)."

**Does R2 require a paid plan or a credit card?**

- Workers plan: R2 is not listed as Paid-only anywhere in [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/); the R2 pricing page describes its free tier without reference to the Workers plan. Workers Free itself: "100,000 per day" requests, "10 milliseconds of CPU time per invocation".
- Subscription: [R2 Get started](https://developers.cloudflare.com/r2/get-started/) says "You need a Cloudflare account with an R2 subscription. If you do not have one: 1. Go to the Cloudflare Dashboard. 2. Select **Storage & databases > R2 > Overview** 3. Complete the checkout flow to add an R2 subscription to your account." and "R2 is free to get started with included free monthly usage. You are billed for your usage on a monthly basis."
- Payment method: [Update billing information](https://developers.cloudflare.com/billing/get-started/update-billing-info/) states, in the context of add-on services, "Cloudflare must always have a payment method on file. If you need to remove a payment method, you must enter a new one to replace it." A Cloudflare search snippet additionally said you must be "using a valid payment method before changing your plan type or enabling subscriptions"; I could not locate that exact sentence on a fetched page, so treat the precise wording as **UNVERIFIED**, but the conclusion (the R2 checkout asks for a payment method) is consistent with both pages. Accepted methods per [Billing FAQ](https://developers.cloudflare.com/billing/understand/faq/): cards, PayPal, Apple Pay, Google Pay, Stripe Link, UnionPay.

Net: no paid plan, but a payment method on file, uncharged while inside the free tier.

## 2. Writing to R2 from a Durable Object

- **Bindings in DO `env`.** [Bindings (env)](https://developers.cloudflare.com/workers/runtime-apis/bindings/): `env` is "an argument to entrypoint handlers such as `fetch`", is available "as a class property on WorkerEntrypoint, DurableObject, and Workflow" (`this.env.NAME`), and can also be imported via `import { env } from "cloudflare:workers"`. R2 is in the binding list. [DurableObject base class](https://developers.cloudflare.com/durable-objects/api/base/): the constructor takes `ctx` and `env`, where `env` holds the bindings configured in Wrangler.
- **Wrangler config.** [Use R2 from Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/): `"r2_buckets": [{ "binding": "MY_BUCKET", "bucket_name": "<YOUR_BUCKET_NAME>" }]`; the bucket must already exist. For the two-Worker layout recommended in `cloudflare-durable-objects.md`, the binding goes on the Worker that hosts the `Table` DO class.
- **put() API.** [Workers API reference](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/): `put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object | null>`. A JSONL string can be passed directly. `httpMetadata` accepts `contentType`, `contentEncoding`, `cacheControl`, etc. `onlyIf` takes an `R2Conditional` (`etagMatches`, `etagDoesNotMatch`, `uploadedBefore`, `uploadedAfter`); "put() returns null, and the object will not be stored" when the condition fails, which gives cheap idempotency if the alarm retries.
- **Size limits.** [R2 Limits](https://developers.cloudflare.com/r2/platform/limits/): "5 TiB per object", "5 GiB (single-part)", "4.995 TiB (multi-part)", 10,000 parts, key length 1,024 bytes, metadata 8,192 bytes, "1 per second" concurrent writes to the same key. [Upload objects](https://developers.cloudflare.com/r2/objects/upload-objects/) recommends single upload for "Small to medium files (under ~100 MB)" and multipart for "Large files, or when you need parallelism and resumability". A few hundred KB needs **no multipart**.
- **Worker-side limits that apply inside the DO.** [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/): 128 MB memory per isolate; Free plan "50 subrequests per invocation" (an R2 call is a subrequest); request body 100 MB on Free. One put per Match end is trivially inside all of these. CPU: the DO request/alarm has 30 s CPU (see `cloudflare-durable-objects.md`); serialising a few hundred KB of JSON is milliseconds.
- **Reading back for training.** `GetObject` is Class B (10 M/month free) and egress is free, so pulling the whole corpus down periodically costs nothing.

## 3. Free-plan restrictions on R2 bindings

- No page states any Workers-Free restriction on R2 bindings. [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/) enumerates free-plan limits for KV, D1, Hyperdrive and Durable Objects ("Only Durable Objects with SQLite storage backend are available") but places no such gate on R2. [Use R2 from Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/) lists no plan prerequisite.
- The only gate is the R2 subscription/checkout in section 1. Whether the dashboard checkout can complete with no payment method at all is **UNVERIFIED**; assume it cannot.
- Free-plan quotas that do apply to the export path: 50 subrequests per invocation and the DO free-plan daily limits (100,000 DO requests/day, 100,000 SQLite rows written/day, 5 GB total DO storage) from [DO Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) and [DO Limits](https://developers.cloudflare.com/durable-objects/platform/limits/). "Daily free limits reset at 00:00 UTC"; when exceeded, "further operations of that type will fail with an error." One export per Match is nowhere near these.

## 4. Corpus estimate vs free quota

Assumptions: 300 KB JSONL per Match, 50 Matches/month, 36 months, all Standard storage, one `PutObject` per Match, occasional `ListObjects`/`GetObject` for training pulls.

| Horizon | Objects | Stored | Storage quota used | Class A ops/month | Class B ops/month |
|---|---|---|---|---|---|
| Month 1 | 50 | 15 MB | 0.15 % of 10 GB | 50 | tens |
| Year 1 | 600 | 180 MB | 1.8 % | 50 | tens |
| Year 3 | 1,800 | 540 MB | 5.4 % | 50 | tens to hundreds |

Stress case (1 MB per Match, 200 Matches/month, 3 years): 7,200 objects, 7.2 GB, 72 % of quota, 200 Class A ops/month. Still free. Break-even where storage exceeds 10 GB at 300 KB/Match: ~33,000 Matches, i.e. 55 years at 50/month.

Ops headroom is effectively unlimited: even pulling the full 3-year corpus (1,800 GETs) daily is 54,000 Class B ops/month against 10 M free. Egress is free ([R2 Pricing](https://developers.cloudflare.com/r2/pricing/)).

Because GB-month is averaged from daily peak, monthly cost at year 3 would be 0.54 GB-month, so even if the free tier vanished the bill would be under $0.01/month at "$0.015 / GB-month".

## 5. Fallbacks if R2 is a no-go

### 5a. Keep the logs in DO SQLite (preferred fallback)

- Free plan: "5 GB" total DO storage per account, "10 GB" per object, "Daily free limits" of 5 M rows read and 100,000 rows written ([DO Limits](https://developers.cloudflare.com/durable-objects/platform/limits/), [DO Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)). Max string/BLOB/row "2 MB", so a 300 KB JSONL blob fits in one row; or keep the append-only event rows as they are and never delete them.
- The same 540 MB / 3-year corpus is ~11 % of the 5 GB account cap. Storage billing for SQLite DOs starts January 2026, and the free 5 GB stands ([DO Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)).
- Trade-offs: the corpus is then spread over thousands of Table DOs (one per Table) with no cheap "list everything" API; an export Worker would have to enumerate Table ids from somewhere (a registry DO or KV) and fetch each. Storage counts against the game-state quota. Alternative: a single dedicated `Corpus` DO that receives the JSONL via RPC and stores one row per Match, so listing/exporting is one SQL query; the 10 GB per-object cap is still 18× the 3-year corpus. Note that "`deleteAll()` ... effectively deallocates all storage used by the Durable Object" ([Storage API](https://developers.cloudflare.com/durable-objects/api/storage-api/)), so the 7-day cleanup of Table DOs is unaffected as long as the corpus copy lives elsewhere.

### 5b. Push to a GitHub repo via the REST API from the Worker

- Endpoint: `PUT /repos/{owner}/{repo}/contents/{path}` with `message`, base64 `content`, and `sha` when replacing an existing file ([Repository contents API](https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28#create-or-update-file-contents)). One `fetch` subrequest from the DO; needs a fine-grained PAT stored as a Worker secret.
- Limits: 5,000 requests/hour per authenticated user; "no more than 80 content-generating requests per minute and no more than 500 content-generating requests per hour" ([REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28)). At 50 Matches/month this is irrelevant.
- Repo limits: recommended single-object size "1MB", hard limit "100 MB", recommended `.git` size "10 GB", max "3,000" entries per directory ([Repository limits](https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits)). GitHub explicitly recommends storing "programmatically generated files outside of Git, such as in object storage." 1,800 files over 3 years must be sharded into per-month directories to stay under the 3,000-per-directory guideline. Base64 inflates the 300 KB payload by 4/3; the PUT body cap for this endpoint is not documented (**UNVERIFIED**, likely bounded by the 100 MB file limit).
- Trade-offs: a repo of opaque JSONL is a poor fit per GitHub's own guidance; every export is a commit; a PAT with `contents:write` lives in the Worker; and the corpus is public unless the repo is private. Acceptable as a last resort only.

### Ranking

1. R2 (this ticket's design). 2. Dedicated `Corpus` DO in SQLite. 3. GitHub Contents API.

## 6. Cleanup after 7 idle days (context for the same DO)

- "Each Durable Object is able to schedule a single alarm at a time by calling `setAlarm()`." Alarms "have guaranteed at-least-once execution and are retried automatically when the `alarm()` handler throws", with exponential backoff "starting at a 2 second delay ... with up to 6 retries" ([Alarms API](https://developers.cloudflare.com/durable-objects/api/alarms/), [DO base](https://developers.cloudflare.com/durable-objects/api/base/)). No maximum future time is documented (**UNVERIFIED** that 7 days is fine, though `cloudflare-durable-objects.md` already relies on alarms for turn timers and nothing suggests a cap this short).
- `deleteAll()` "removes the entire contents of a Durable Object's private SQLite database, including both SQL data and key-value data" and "For Workers with a compatibility date of `2026-02-24` or later, `deleteAll()` also deletes any active alarm." ([Storage API](https://developers.cloudflare.com/durable-objects/api/storage-api/)). Set the project's compatibility date at or after 2026-02-24.
- Because the alarm handler may run more than once, the export must be idempotent: deterministic key plus `onlyIf` or a "exported" flag written in the same SQLite transaction after a successful put. Do the export at Match end (in the request that finalises the Match), not in the cleanup alarm, so the corpus copy exists long before storage is deleted.

## Risks

1. **Payment method gate.** The R2 checkout very likely requires a card/PayPal on file. If the account owner will not add one, fall back to 5a. Verify by opening Storage & databases > R2 in the dashboard before designing around R2 (a one-minute human step; the `wizard` skill could script the walk-through).
2. **Free tier scope changes.** The 10 GB / 1 M / 10 M numbers are current as of 2026-09-17; Cloudflare has changed developer-platform pricing before. The corpus is so small (0.54 GB at year 3) that even a 10× cut leaves headroom.
3. **Write races.** R2 allows "1 per second" concurrent writes to the same key. A retried alarm and the original request could collide on the same key; use `onlyIf` or accept last-writer-wins on identical content.
4. **Lost export on crash.** If the DO writes to R2 and crashes before recording "exported" in SQLite, the retry re-puts identical content, which is harmless. If it records "exported" before the put completes, the log is lost when the 7-day cleanup runs. Order: put, then flag.
5. **Subrequest cap.** 50 subrequests per invocation on Free. A single put is fine; never batch hundreds of exports into one alarm invocation.
6. **Compat date.** Older compat dates leave the alarm alive after `deleteAll()`; the alarm would fire on an empty object. Harmless but noisy; pin compat date ≥ 2026-02-24.
7. **UNVERIFIED items**: exact wording of the "valid payment method before enabling subscriptions" rule; whether the checkout can complete with no payment method; maximum alarm horizon; GitHub Contents PUT body cap.
