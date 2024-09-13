import { Hono } from "hono";
import { PrismaClient } from "@prisma/client";
import { lucia } from "../lib/auth.js";
import { verify } from "@node-rs/argon2";
import type { Context } from "../lib/context.js";

const prisma = new PrismaClient();

export const loginRouter = new Hono<Context>();

loginRouter.get("/login", async (c) => {
  const session = c.get("session");
  if (session) {
    return c.json({ redirect: "/" }, 200);
  }
  return c.json({ message: "Please log in" }, 200);
});

loginRouter.post("/login", async (c) => {
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

  const existingUser = await prisma.user.findUnique({
    where: { username: username, password_hash: password }
  });

  if (!existingUser) {
    return c.json({ error: "Incorrect username or password" }, 401);
  }

  const validPassword = await verify(existingUser.password_hash, password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1
  });

  if (!validPassword) {
    return c.json({ error: "Incorrect username or password" }, 401);
  }

  const session = await lucia.createSession(existingUser.id.toString(), {});
  c.header("Set-Cookie", lucia.createSessionCookie(session.id).serialize(), { append: true });

  return c.json({ message: "Login successful", redirect: "/" }, 200);
});

export default loginRouter;