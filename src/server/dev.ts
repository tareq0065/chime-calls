import "dotenv/config";
import express from "express";
import cors from "cors";
import router from "./router";

const app = express();
const PORT = process.env.PORT || 8080;
const ORIGIN = process.env.CORS_ORIGIN || true;

app.use(cors({ origin: ORIGIN as any, credentials: true }));
app.use(express.json());
app.use("/api", router);

app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
