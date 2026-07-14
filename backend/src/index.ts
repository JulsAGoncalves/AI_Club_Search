import cors from "cors";
import express from "express";
import router from "./routes/index.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

app.use("/api", router);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

export default app;
