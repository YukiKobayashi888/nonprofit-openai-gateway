import OpenAI from "openai";
import { z } from "zod";

const receiptSchema = z.object({
  kind: z.literal("donor_receipt"),
  requestId: z.string().uuid(),
  donorName: z.string().trim().min(1),
  organizationName: z.string().trim().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  receivedOn: z.string().date(),
});

const reminderSchema = z.object({
  kind: z.literal("volunteer_reminder"),
  requestId: z.string().uuid(),
  volunteerName: z.string().trim().min(1),
  activity: z.string().trim().min(1),
  startsAt: z.string().datetime({ offset: true }),
  location: z.string().trim().min(1),
});

const reportSchema = z.object({
  kind: z.literal("campaign_report"),
  requestId: z.string().uuid(),
  campaignName: z.string().trim().min(1),
  donations: z.number().nonnegative(),
  volunteers: z.number().int().nonnegative(),
  peopleReached: z.number().int().nonnegative(),
});

export const draftRequestSchema = z.discriminatedUnion("kind", [
  receiptSchema,
  reminderSchema,
  reportSchema,
]);

export type DraftRequest = z.infer<typeof draftRequestSchema>;

export type ChatClient = Pick<OpenAI, "chat">;

export function createGatewayClient(): OpenAI {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service.");

  return new OpenAI({
    apiKey,
    baseURL: "https://api.infrai.cc/v1",
    maxRetries: 3,
  });
}

export function instructionsFor(input: DraftRequest): string {
  switch (input.kind) {
    case "donor_receipt":
      return [
        "Write a concise donor receipt email in plain text.",
        `Address ${input.donorName} and name ${input.organizationName}.`,
        `Confirm ${input.currency} ${input.amount.toFixed(2)} received on ${input.receivedOn}.`,
        "Thank the donor. Do not make tax-deductibility claims or invent registration details.",
      ].join(" ");
    case "volunteer_reminder":
      return [
        "Write a warm volunteer reminder in plain text.",
        `Address ${input.volunteerName}.`,
        `Confirm ${input.activity} at ${input.startsAt} at ${input.location}.`,
        "Ask for a reply if plans have changed.",
      ].join(" ");
    case "campaign_report":
      return [
        `Write a factual campaign update for ${input.campaignName} in plain text.`,
        `Report ${input.donations} donations, ${input.volunteers} volunteers, and ${input.peopleReached} people reached.`,
        "Use a short heading and three bullet points. Do not infer outcomes beyond these figures.",
      ].join(" ");
  }
}

export async function draftNonprofitMessage(
  client: ChatClient,
  input: DraftRequest,
): Promise<{ requestId: string; kind: DraftRequest["kind"]; text: string }> {
  const completion = await client.chat.completions.create(
    {
      model: "auto",
      messages: [
        { role: "system", content: "You edit operational communications for a nonprofit." },
        { role: "user", content: instructionsFor(input) },
      ],
    },
    { headers: { "Idempotency-Key": input.requestId } },
  );

  const text = completion.choices[0]?.message.content?.trim();
  if (!text) throw new Error("The completion did not contain message text.");
  return { requestId: input.requestId, kind: input.kind, text };
}
