import type { FastifyInstance } from "fastify";
import { users } from "@minimi/db";

interface CreateUserBody {
  email: string;
  name?: string | null;
  timezone?: string;
}

const createUserSchema = {
  body: {
    type: "object",
    required: ["email"],
    additionalProperties: false,
    properties: {
      email: { type: "string", format: "email", minLength: 1, maxLength: 255 },
      name: { type: ["string", "null"], maxLength: 255 },
      timezone: { type: "string", minLength: 1, maxLength: 100 },
    },
  },
} as const;

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const record = err as { code?: string; cause?: { code?: string } };
  return record.code === "23505" || record.cause?.code === "23505";
}

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateUserBody }>(
    "/users",
    { schema: createUserSchema },
    async (request, reply) => {
      const email = request.body.email.trim().toLowerCase();
      const name =
        request.body.name === undefined
          ? undefined
          : request.body.name === null
            ? null
            : request.body.name.trim() || null;
      const timezone = request.body.timezone?.trim();

      try {
        const [created] = await app.db
          .insert(users)
          .values({
            email,
            ...(name !== undefined ? { name } : {}),
            ...(timezone ? { timezone } : {}),
          })
          .returning();

        return reply.code(201).send(created);
      } catch (err) {
        if (isUniqueViolation(err)) {
          return reply.code(409).send({
            error: "User with this email already exists",
          });
        }
        throw err;
      }
    }
  );
}

