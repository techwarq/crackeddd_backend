import { Hono } from "hono";
import { PrismaClient } from "@prisma/client";
import { lucia } from "../lib/auth.js";
import { hash } from "@node-rs/argon2";
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError
} from "@prisma/client/runtime/library";
import type { Context } from "../lib/context.js";

export const signupRouter = new Hono<Context>();
const prisma = new PrismaClient();

signupRouter.get("/signup", async (c) => {
  const session = c.get("session");
  if (session) {
    return c.json({ redirect: "/" }, 200);
  }
  return c.json({ message: "Please sign up" }, 200);
});

signupRouter.post("/signup", async (c) => {
  try {
    // Parse request body
    const body = await c.req.json<{ username: string; password: string }>();
    const username = body.username ?? null;
    const password = body.password ?? null;

    // Validate username
    if (!username || username.length < 3 || username.length > 31 || !/^[a-z0-9_-]+$/.test(username)) {
      return c.json({ error: "Invalid username" }, 400);
    }

    // Validate password
    if (!password || password.length < 6 || password.length > 255) {
      return c.json({ error: "Invalid password" }, 400);
    }

    // Hash the password
    const passwordHash = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1
    });

    // Create user in the database
    const user = await prisma.user.create({
      data: {
        username: username,
        password_hash: passwordHash,
        // Prisma automatically handles the `id` field
      }
    });

    // Create a session for the user
    const session = await lucia.createSession(user.id, {});
    c.header("Set-Cookie", lucia.createSessionCookie(session.id).serialize(), { append: true });

    return c.json({ message: "Signup successful", redirect: "/" }, 200);
  } catch (e: unknown) {
    // Log the error
    console.error("Signup Error:", e);

    // Detailed error handling
    if (e instanceof PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return c.json({ error: "Username already used" }, 400);
      }
      // Handle other Prisma client known request errors if needed
      return c.json({ error: `Prisma error: ${e.message}` }, 400);
    } else if (e instanceof PrismaClientInitializationError) {
      return c.json({ error: "Prisma initialization error" }, 500);
    } else if (e instanceof PrismaClientRustPanicError) {
      return c.json({ error: "Prisma Rust panic error" }, 500);
    } else if (e instanceof Error) {
      // Handle generic JavaScript errors
      return c.json({ error: "An unknown error occurred", details: e.message }, 500);
    } else {
      // Handle cases where `e` is not an instance of Error
      return c.json({ error: "An unknown error occurred" }, 500);
    }
  }
});

export default signupRouter;
