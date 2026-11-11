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

  app.get("/candidate-identity", async (_request, reply) => {
    const deliveryId = process.env.AIDELIVERY_DELIVERY_ID;
    const candidateSha = process.env.AIDELIVERY_CANDIDATE_SHA;
    if (!deliveryId || !candidateSha) {
      await reply
        .code(503)
        .send({ error: "candidate_identity_unavailable" });
      return;
    }

    await reply
      .header("Cache-Control", "no-store")
      .send({ deliveryId, candidateSha });
  });
}
