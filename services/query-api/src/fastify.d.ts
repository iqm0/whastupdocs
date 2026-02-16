import "fastify";

import type { RequestContext } from "./lib/request-context.js";

declare module "fastify" {
  interface FastifyRequest {
    wiudContext: RequestContext;
  }
}
