import { onRequest } from "firebase-functions/v2/https";

export const helloScheduling = onRequest((_req, res) => {
  res.status(200).json({ ok: true, service: "scheduling-functions" });
});
