import { Hono } from "hono";
import { PrismaClient } from "@prisma/client";
import type { Context } from "../lib/context.js";

const prisma = new PrismaClient();

export const mainRouter = new Hono<Context>();

mainRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.redirect("/login");
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: parseInt(user.id, 10) },
      select: { id: true, username: true }
    });

    if (!dbUser) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({
      username: dbUser.username,
      user_id: dbUser.id
    }, 200);
  } catch (error) {
    console.error("Error fetching user data:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default mainRouter;