import { createServer } from "node:http";
import OpenAI from "openai";
import { ZodError } from "zod";
import {
  createGatewayClient,
  draftNonprofitMessage,
  draftRequestSchema,
} from "./nonprofit_ai.js";

const port = Number(process.env.PORT ?? 3000);
const client = createGatewayClient();

function sendJson(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/drafts") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = draftRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    sendJson(response, 200, await draftNonprofitMessage(client, input));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Invalid request body" });
      return;
    }
    if (error instanceof OpenAI.APIError && error.status && error.status < 500) {
      sendJson(response, error.status, { error: error.message });
      return;
    }
    console.error(error);
    sendJson(response, 500, { error: "Could not draft message" });
  }
});

server.listen(port, () => {
  console.log(`Nonprofit drafting service listening on http://localhost:${port}`);
});
