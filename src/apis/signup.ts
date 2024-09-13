import { Hono } from "hono";
import { PrismaClient } from "@prisma/client";// Assuming you use PrismaClient from a single file
import { lucia } from "../lib/auth.js";
import { hash } from "@node-rs/argon2";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

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
  const body = await c.req.json<{
    username: string;
    password: string;
    
  }>();
  


  const username: string | null = body.username ?? null;
  if (!username || username.length < 3 || username.length > 31 || !/^[a-z0-9_-]+$/.test(username)) {
    return c.json({ error: "Invalid username" }, 400);
  }

  const password: string | null = body.password ?? null;
  if (!password || password.length < 6 || password.length > 255) {
    return c.json({ error: "Invalid password" }, 400);
  }

  const passwordHash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1
  });

  try {
    const user = await prisma.user.create({
      data: {
        username: username,
        password_hash: passwordHash,
       
       
      }
    });

    const session = await lucia.createSession(user.id.toString(), {});
    c.header("Set-Cookie", lucia.createSessionCookie(session.id).serialize(), { append: true });
    return c.json({ message: "Signup successful", redirect: "/" }, 200);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      return c.json({ error: "Username already used" }, 400);
    }
    return c.json({ error: "An unknown error occurred" }, 500);
  }
});

export default signupRouter
