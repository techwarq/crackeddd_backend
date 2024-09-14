import { Hono } from "hono";
import { PrismaClient } from "@prisma/client";
import { lucia } from "../lib/auth.js";
import { verify } from "@node-rs/argon2";
import type { Context } from "../lib/context.js";

const prisma = new PrismaClient();

export const loginRouter = new Hono<Context>();

loginRouter.post("/login", async (c) => {
  console.log("Login attempt received");
  const body = await c.req.json<{
    username: string;
    password: string;
  }>();

  console.log("Login body:", body);
 // use existingUser.id without toString()

  const username: string | null = body.username ?? null;
  if (!username || username.length < 3 || username.length > 31 || !/^[a-z0-9_-]+$/.test(username)) {
    console.log("Invalid username:", username);
    return c.json({ error: "Invalid username" }, 400);
  }

  const password: string | null = body.password ?? null;
  if (!password || password.length < 6 || password.length > 255) {
    console.log("Invalid password");
    return c.json({ error: "Invalid password" }, 400);
  }

  const existingUser = await prisma.user.findUnique({
    where: { username: username }
  });

  if (!existingUser) {
    console.log("User not found:", username);
    return c.json({ error: "Incorrect username or password" }, 401);
  }

  console.log("User found:", existingUser.username);

  try {
    const validPassword = await verify(existingUser.password_hash, password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1
    });

    if (!validPassword) {
      console.log("Invalid password for user:", username);
      return c.json({ error: "Incorrect username or password" }, 401);
    }

    const session = await lucia.createSession(existingUser.id.toString(), {}); // use existingUser.id without toString()

    c.header("Set-Cookie", lucia.createSessionCookie(session.id).serialize(), { append: true });

    console.log("Login successful for user:", username);
    return c.json({ message: "Login successful", redirect: "/" }, 200);
  } catch (error) {
    console.error("Error during password verification:", error);
    return c.json({ error: "An error occurred during login" }, 500);
  }
});


loginRouter.get("/check-user/:username", async (c) => {
  const username = c.req.param("username");
  const user = await prisma.user.findUnique({
    where: { username: username },
    select: { id: true, username: true, createdAt: true }
  });

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json(user);
});

export default loginRouter;