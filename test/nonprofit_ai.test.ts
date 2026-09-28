import assert from "node:assert/strict";
import test from "node:test";
import { draftNonprofitMessage, draftRequestSchema } from "../src/nonprofit_ai.js";

test("a donor receipt preserves facts and forbids invented tax claims", async () => {
  let sentBody: unknown;
  let sentOptions: unknown;
  const client = {
    chat: {
      completions: {
        create: async (body: unknown, options: unknown) => {
          sentBody = body;
          sentOptions = options;
          return { choices: [{ message: { content: "Thank you for your donation." } }] };
        },
      },
    },
  };
  const input = draftRequestSchema.parse({
    kind: "donor_receipt",
    requestId: "123e4567-e89b-12d3-a456-426614174000",
    donorName: "Maya Chen",
    organizationName: "Riverside Food Pantry",
    amount: 125,
    currency: "usd",
    receivedOn: "2026-09-05",
  });

  const result = await draftNonprofitMessage(client as never, input);
  const body = sentBody as { model: string; messages: Array<{ content: string }> };

  assert.equal(body.model, "auto");
  assert.match(body.messages[1].content, /USD 125\.00 received on 2026-09-05/);
  assert.match(body.messages[1].content, /Do not make tax-deductibility claims/);
  assert.deepEqual(sentOptions, {
    headers: { "Idempotency-Key": "123e4567-e89b-12d3-a456-426614174000" },
  });
  assert.equal(result.kind, "donor_receipt");
});
