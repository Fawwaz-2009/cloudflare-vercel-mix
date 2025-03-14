import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb, DrizzleDB, superheroes } from "./db";
import { getAuth } from "./lib/auth";
import { TRUSTED_ORIGINS } from "./lib/constants";
import { logger } from "hono/logger";

type Variables = {
  DrizzleDB: DrizzleDB;
  auth: ReturnType<typeof getAuth>;
};

const app = new Hono<{ Bindings: CloudflareBindings; Variables: Variables }>();

// app.use(logger());

app.use(
  "*",
  cors({
    origin: TRUSTED_ORIGINS,
    allowHeaders: ["Content-Type", "Authorization", "Access-Control-Allow-Origin"],
    allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE"],
    exposeHeaders: ["Content-Length", "Access-Control-Allow-Origin"],
    maxAge: 600,
    credentials: true,
  })
);

app.use("*", async (c, next) => {
  c.set("DrizzleDB", createDb(c.env.DB));
  c.set("auth", getAuth({ BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET, drizzleDB: c.get("DrizzleDB") }));
  console.log("CONTEXT_SETTINGS_____________________STARTED");
  await next();
  console.log("CONTEXT_SETTINGS_____________________ENDED");
});

app.on(["POST", "GET"], "/api/auth/**", (c) =>
  c.get("auth")
    .handler(c.req.raw)
    .then((res) => {
      c.var.auth.api.getSession
      console.log(JSON.stringify(res.clone().json()), "response__________________");
      return res;
    })
    .catch((err) => {
      console.error(err, "ERROR__________________");
      return c.json({ error: "Unauthorized" }, 401);
    })
);

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/super-heroes", async (c) => {
  const db = c.get("DrizzleDB");
  const superHeroes = await db.query.superheroes.findMany();
  return c.json(superHeroes);
});

app.post("/super-heroes", async (c) => {
  const db = c.get("DrizzleDB");
  const { name } = await c.req.json();

  if (!name) {
    return c.json({ error: "Name is required" }, 400);
  }

  const newHero = await db
    .insert(superheroes)
    .values({
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .get();

  return c.json(newHero);
});

export default app;
