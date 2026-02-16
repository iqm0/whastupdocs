import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { handleToolCall } from "./tool-handlers.js";

function buildServer(): Server {
  return new Server(
    {
      name: "what-is-up-docs-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );
}

const TOOL_DEFINITIONS = [
  {
    name: "docs_preflight",
    description:
      "Token-efficient entrypoint that decides whether docs lookup is needed and how deep to research.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string" },
        sources: { type: "array", items: { type: "string" } },
      },
      required: ["task"],
      additionalProperties: false,
    },
  },
  {
    name: "search_docs",
    description:
      "Search up-to-date developer documentation across configured sources.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        sources: { type: "array", items: { type: "string" } },
        version: { type: "string" },
        top_k: { type: "integer", minimum: 1, maximum: 50 },
        updated_after: { type: "string", format: "date-time" },
        language: { type: "string" },
        region: { type: "string" },
        plan: { type: "string" },
        deployment_type: { type: "string" },
        cloud: { type: "string" },
        reference_date: { type: "string", format: "date-time" },
        compact: { type: "boolean" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "answer_with_sources",
    description:
      "Answer a developer question with citations and freshness metadata.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string" },
        sources: { type: "array", items: { type: "string" } },
        version: { type: "string" },
        style: { type: "string", enum: ["concise", "detailed"] },
        max_citations: { type: "integer", minimum: 1, maximum: 10 },
        updated_after: { type: "string", format: "date-time" },
        language: { type: "string" },
        region: { type: "string" },
        plan: { type: "string" },
        deployment_type: { type: "string" },
        cloud: { type: "string" },
        reference_date: { type: "string", format: "date-time" },
        compact: { type: "boolean" },
      },
      required: ["question"],
      additionalProperties: false,
    },
  },
  {
    name: "check_freshness",
    description: "Check sync lag and health for configured sources.",
    inputSchema: {
      type: "object",
      properties: {
        sources: { type: "array", items: { type: "string" } },
        compact: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_changes",
    description:
      "List detected documentation changes such as deprecations and potential breaking updates.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string" },
        event_type: {
          type: "string",
          enum: ["document_added", "updated", "deprecation", "breaking_change"],
        },
        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
        limit: { type: "integer", minimum: 1, maximum: 100 },
        compact: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
] as const;

function registerHandlers(server: Server): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOL_DEFINITIONS,
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;

    try {
      return await handleToolCall(name, rawArgs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: message,
          },
        ],
      };
    }
  });
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return undefined;
  }
  return JSON.parse(raw);
}

async function runStdio(): Promise<void> {
  const server = buildServer();
  registerHandlers(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function runStreamableHttp(): Promise<void> {
  const port = Number(process.env.PORT ?? process.env.WIUD_MCP_PORT ?? 3001);
  const path = process.env.WIUD_MCP_PATH ?? "/mcp";

  const httpServer = createServer(async (req, res) => {
    if (!req.url || !req.method) {
      sendJson(res, 400, { error: "invalid_request" });
      return;
    }

    if (req.url === "/health") {
      sendJson(res, 200, { status: "ok", transport: "streamable-http" });
      return;
    }

    if (!req.url.startsWith(path)) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }

    if (!["POST", "GET", "DELETE"].includes(req.method)) {
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }

    const server = buildServer();
    registerHandlers(server);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close().catch(() => undefined);
      server.close().catch(() => undefined);
    });

    try {
      await server.connect(transport);
      let body: unknown = undefined;
      if (req.method === "POST") {
        try {
          body = await readJsonBody(req);
        } catch {
          sendJson(res, 400, { error: "invalid_json_body" });
          return;
        }
      }
      await transport.handleRequest(req, res, body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "internal_error", message });
      } else {
        res.end();
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, "0.0.0.0", () => resolve());
  });

  process.stdout.write(
    `what-is-up-docs MCP listening on http://0.0.0.0:${port}${path} (streamable-http)\n`,
  );
}

async function main(): Promise<void> {
  const transport = (process.env.WIUD_MCP_TRANSPORT ?? "stdio").toLowerCase();
  if (transport === "streamable-http" || transport === "http" || transport === "sse") {
    await runStreamableHttp();
    return;
  }

  await runStdio();
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
