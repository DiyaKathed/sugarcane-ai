
import "dotenv/config";
import express from "express";
import cors from "cors";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import OpenAI from "openai";

const app = express();
const PORT = 3000;

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is missing from .env");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from .env");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors({ origin: "http://localhost:4200" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "Sugarcane API is running" });
});

app.post("/api/ask", async (req, res) => {
  const question = req.body?.question;

  if (typeof question !== "string" || !question.trim()) {
    res.status(400).json({ error: "Please provide a question." });
    return;
  }

  const client = new Client({
    name: "sugarcane-angular-api",
    version: "1.0.0",
  });

  try {
    const childEnv: Record<string, string> = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string"
      )
    );

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["node_modules/tsx/dist/cli.mjs", "server.ts"],
      cwd: process.cwd(),
      env: childEnv,
    });

    await client.connect(transport);

    const result = await client.callTool({
      name: "get_farmer_summary",
      arguments: {},
    });

    if (result.isError) {
      throw new Error("MCP could not retrieve farmer records.");
    }

    const records = result.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");

    if (!records) {
      throw new Error("No farmer records were returned.");
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      instructions:
        "You are a sugarcane factory data assistant. " +
        "Answer using only the supplied farmer database records. " +
        "Do not invent farmer details. " +
        "Payment amounts are in Indian rupees. " +
        "Calculate totals accurately.",
      input: `Question: ${question}\n\nFarmer records: ${records}`,
    });

    res.json({ answer: response.output_text });
  } catch (error) {
    console.error("API error:", error);

    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "An unexpected server error occurred.",
    });
  } finally {
    try {
      await client.close();
    } catch (error) {
      console.error("MCP cleanup error:", error);
    }
  }
});

app.listen(PORT, () => {
  console.log(`Sugarcane API running at http://localhost:${PORT}`);
});
