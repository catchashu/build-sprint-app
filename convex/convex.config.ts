import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import staticHosting from "@convex-dev/static-hosting/convex.config";
import workflow from "@convex-dev/workflow/convex.config";

const app = defineApp({ httpPrefix: "/api" });
app.use(agent);
app.use(workflow);
app.use(staticHosting, { httpPrefix: "/" });
export default app;
