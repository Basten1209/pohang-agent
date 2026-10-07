import "dotenv/config";
import express from "express";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planSchema, observationsSchema } from "../shared/model";
import { calculate } from "../shared/planner";
import { runAgent } from "./agent";
import { fetchEvidence } from "./eum";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "24kb" }));
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
const requestSchema = z.object({
  plan: planSchema,
  observations: observationsSchema,
});
app.get("/api/status", (_req, res) =>
  res.json({
    agent: process.env.OPENAI_API_KEY ? "CONFIGURED" : "DEMO",
    eum: !!process.env.EUM_SERVICE_KEY,
    airDevice: !!process.env.EUM_AIR_DEVICE_ID,
    transport: "DEMO",
    model: process.env.OPENAI_API_KEY
      ? process.env.OPENAI_MODEL || "gpt-4.1-mini"
      : null,
  }),
);
app.get("/api/evidence", async (_req, res) =>
  res.json({
    evidence: await Promise.all([
      fetchEvidence("traffic"),
      fetchEvidence("air"),
    ]),
  }),
);
app.post("/api/plan", (req, res) => {
  const { plan, observations } = requestSchema.parse(req.body);
  res.json(calculate(plan, observations));
});
app.post("/api/agent", async (req, res) => {
  const { plan, observations, message } = requestSchema
    .extend({ message: z.string().trim().min(1).max(1000) })
    .parse(req.body);
  res.json({
    revision: plan.revision,
    ...(await runAgent(message, plan, observations)),
  });
});
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API_NOT_FOUND" });
});
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(error instanceof z.ZodError ? 422 : 500).json({
      error: error instanceof z.ZodError ? "INVALID_INPUT" : "REQUEST_FAILED",
    });
  },
);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || process.env.CONDUCTOR_PORT || 5173);
app.listen(port, "127.0.0.1", () =>
  console.log(`RUN2구룡포 → http://localhost:${port}`),
);
