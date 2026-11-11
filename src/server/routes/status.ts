import type { FastifyInstance, FastifyRequest } from "fastify";

function hasRequestBody(request: FastifyRequest): boolean {
  const contentLength = request.headers["content-length"];
  return (
    request.body !== undefined ||
    request.headers["transfer-encoding"] !== undefined ||
    (contentLength !== undefined && contentLength !== "0")
  );
}

export async function registerStatusRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    "/api/status",
    {
      schema: {
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["status"],
            properties: { status: { type: "string", const: "ok" } },
          },
          400: {
            type: "object",
            additionalProperties: false,
            required: ["error"],
            properties: {
              error: { type: "string", const: "invalid_request" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (hasRequestBody(request)) {
        await reply.code(400).send({ error: "invalid_request" });
        return;
      }

      await reply.header("Cache-Control", "no-store").send({ status: "ok" });
    },
  );

  app.route({
    method: ["HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    url: "/api/status",
    handler: async (_request, reply) => {
      await reply
        .code(405)
        .header("Allow", "GET")
        .send({ error: "method_not_allowed" });
    },
  });
}
