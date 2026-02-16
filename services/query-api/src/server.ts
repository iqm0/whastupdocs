import { buildApp } from "./app.js";

async function main(): Promise<void> {
  const app = await buildApp({ logger: true });
  const port = Number(process.env.PORT ?? 8080);
  const host = "0.0.0.0";

  await app.listen({ port, host });
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
