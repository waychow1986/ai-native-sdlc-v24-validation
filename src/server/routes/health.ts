import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/health/live", async (_request, reply) => {
    await reply.code(204).send();
  });

  app.get("/health/ready", async (_request, reply) => {
    await reply.code(204).send();
  });
}
