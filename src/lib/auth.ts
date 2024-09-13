import { Lucia } from "lucia";
import { PrismaClient,  User as PrismaUser } from "@prisma/client";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";

// Initialize Prisma Client
const client = new PrismaClient();

// Initialize PrismaAdapter with user and session models
const adapter = new PrismaAdapter(client.session, client.user);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },
  getUserAttributes: (attributes) => {
    return {
      username: attributes.username,
    };
  },
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: Omit<PrismaUser, "id">; // Adjust if needed based on your actual user attributes
  }
}
