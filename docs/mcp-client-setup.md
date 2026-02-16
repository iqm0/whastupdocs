# MCP Client Setup

Last updated: 2026-02-16

## Local MCP (`stdio`) for IDE agents

From `/Users/igormoreira/code/wud`:

```bash
npm run dev:mcp
```

This starts MCP over `stdio` (default mode).

## Local MCP over HTTP (hosted-compatible mode)

From `/Users/igormoreira/code/wud`:

```bash
npm run dev:mcp:http
```

Default endpoint:

- `http://localhost:3001/mcp`
- health: `http://localhost:3001/health`

## Point local MCP to cloud backend

```bash
WIUD_BACKEND_URL='https://wud-query-api-prod.fly.dev' npm run dev:mcp
```

Or for HTTP mode:

```bash
WIUD_BACKEND_URL='https://wud-query-api-prod.fly.dev' npm run dev:mcp:http
```

## Ollama pairing pattern

Run Ollama locally for generation and use `what is up, docs` MCP tools for retrieval:

1. Start Ollama (`http://localhost:11434`).
2. Start MCP (`npm run dev:mcp` or `npm run dev:mcp:http`).
3. Configure your MCP-capable client to:
   - use Ollama as model provider
   - attach the MCP server (command or URL)

Recommended tool strategy:

1. `docs_preflight` first
2. `search_docs` or `answer_with_sources` only when preflight requests lookup
3. `list_changes` for deprecation/breaking-change checks before merge/release
