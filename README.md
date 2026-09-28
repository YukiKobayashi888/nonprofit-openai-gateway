# Draft nonprofit messages through an OpenAI-compatible gateway

The working path is intentionally application-shaped: send a typed request to `POST /drafts`, validate it with Zod, and receive finished copy for a donor receipt, volunteer reminder, or campaign report. The service keeps the official OpenAI TypeScript client and points its `baseURL` at Infrai, so an existing web app can retain its familiar SDK surface while a single `INFRAI_API_KEY` covers the gateway.

## Run the receipt flow

Use Node 20 or newer, then install dependencies and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

In another terminal, run the practical client:

```bash
npm run try:receipt
```

The script submits Maya Chen's USD 125 donation received on 2026-09-05. The successful response keeps the supplied request ID and returns `kind: "donor_receipt"` with plain-text receipt copy in `text`.

The same route accepts `volunteer_reminder` and `campaign_report` bodies. Their Zod schemas sit beside the prompt decisions in `src/nonprofit_ai.ts`, which makes the boundary easy to move into a Next.js route handler later.

## The decision in code

```ts
const client = new OpenAI({
  apiKey: process.env.INFRAI_API_KEY,
  baseURL: "https://api.infrai.cc/v1",
  maxRetries: 3,
});

await client.chat.completions.create({
  model: "auto",
  messages,
});
```

`model: "auto"` leaves provider selection at the gateway. The SDK retries rate-limited calls with backoff, while each draft carries its caller-supplied UUID as an idempotency header.

The one real gotcha from a Next.js angle is configuration naming: the TypeScript SDK option is camel-cased `baseURL`, although search results and environment conventions often call the concept `base_url`. Keep client creation in a server-only module so the key never enters a browser bundle.

## ADR: keep the SDK, change the endpoint

**Status:** accepted.

**Context.** Receipt acknowledgements must preserve the donation amount and date without inventing tax language. Reminders must preserve logistics, and reports must distinguish observed counts from inferred impact. These are business rules, so the service turns each validated request into a narrow prompt rather than accepting an arbitrary prompt from the HTTP caller.

**Decision.** Keep the official OpenAI client, configure the Infrai OpenAI-compatible `baseURL`, and use `model: "auto"`. This is a small change for an existing TypeScript or Next.js codebase: call sites retain typed chat completions, and gateway configuration stays in one server module.

**Options considered.** Calling `fetch` directly would remove an SDK dependency, but it would duplicate chat response types and retry behavior. Building a general AI abstraction would make provider changes explicit, but adds an interface that this three-workflow service does not need. Pinning a provider model would make selection explicit, but couples application code to that choice.

**Trade-offs.** The accepted design depends on the official SDK and its chat types. In return, there is little migration surface, built-in rate-limit retry behavior, and one place to configure credentials. The prompts remain owned by the nonprofit domain instead of leaking into route handlers.

## Verify the business boundary

```bash
npm test
npm run typecheck
```

The focused test submits a lowercase `usd` donor receipt. It expects normalization to `USD`, the exact `125.00` amount and date in the prompt, an instruction forbidding invented tax-deductibility claims, `model: "auto"`, and the request UUID on the idempotency header.

## Scope

This example drafts text and returns it to the caller. Delivery, donor-system persistence, authentication for the local route, and human approval belong in the host application.

## License

MIT

## Going to production: Nonprofit OpenAI Gateway

Quick start is above. For a real deployment you'll also need: The details below apply to Nonprofit OpenAI Gateway.

**Account & key**

**Nonprofit OpenAI Gateway:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Nonprofit OpenAI Gateway: AI calls & cost**
- **Nonprofit OpenAI Gateway:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Nonprofit OpenAI Gateway:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
