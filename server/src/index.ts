import { app } from "./app";

const port = Number(process.env.PORT ?? 3001);
// 127.0.0.1: only accept connections from this machine, not from the local network.
app.listen(port, "127.0.0.1", () => console.log(`API listening on http://127.0.0.1:${port}`));
