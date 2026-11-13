import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { users } from "@minimi/db";

interface CreateUserBody {
  email: string;
  name?: string | null;
}

interface GetUserByEmailQuery {
  email: string;
}

const createUserSchema = {
  body: {
    type: "object",
    required: ["email"],
    additionalProperties: false,
    properties: {
      email: { type: "string", format: "email", minLength: 1, maxLength: 255 },
      name: { type: ["string", "null"], maxLength: 255 },
    },
  },
} as const;

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const record = err as { code?: string; cause?: { code?: string } };
  return record.code === "23505" || record.cause?.code === "23505";
}

const getUserByEmailSchema = {
  querystring: {
    type: "object",
    required: ["email"],
    additionalProperties: false,
    properties: {
      email: { type: "string", format: "email", minLength: 1, maxLength: 255 },
    },
  },
} as const;

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: GetUserByEmailQuery }>(
    "/users",
    { schema: getUserByEmailSchema },
    async (request, reply) => {
      const email = request.query.email.trim().toLowerCase();

      const [user] = await app.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return reply.code(404).send({
          error: "User not found",
        });
      }

      return reply.send(user);
    }
  );

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

      try {
        const [created] = await app.db
          .insert(users)
          .values({
            email,
            ...(name !== undefined ? { name } : {}),
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

