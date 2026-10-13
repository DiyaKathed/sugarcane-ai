import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import OpenAI from "openai";

type TextContentItem = {
  type: "text";
  text: string;
};

function isTextContentItem(item: unknown): item is TextContentItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "type" in item &&
    (item as { type?: unknown }).type === "text" &&
    "text" in item &&
    typeof (item as { text?: unknown }).text === "string"
  );
}

async function main() {
  // 1. Check environment variables.
  const apiKey = process.env.OPENAI_API_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing from your environment or .env file.");
  }

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing from your environment or .env file.");
  }

  const openai = new OpenAI({ apiKey });

  // 2. Hard-coded question.
  const question =
    "Which 3 farmers have the highest pending payments? " +
    "Show their names, villages, pending amounts, and the total pending amount for these 3 farmers.";

  // 3. Create MCP client.
  const client = new Client({
    name: "sugarcane-farmer-client",
    version: "1.0.0",
  });

  // 4. Pass environment variables to the MCP server.
  const childEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string"
    )
  );

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["node_modules/tsx/dist/cli.mjs", "server.ts"],
    env: childEnv,
  });

  try {
    // 5. Connect to MCP server.
    console.log("Connecting to MCP server...");
    await client.connect(transport);

    // 6. Discover the registered tool.
    const { tools } = await client.listTools();
    console.log("Available MCP tools:", tools.map((tool) => tool.name));

    // 7. Call the PostgreSQL tool.
    console.log("Fetching farmer records...");

    const result = await client.callTool({
      name: "get_farmer_summary",
      arguments: {},
    });

    if (result.isError) {
      const errorDetails = Array.isArray(result.content)
        ? result.content
            .filter(isTextContentItem)
            .map((item) => item.text)
            .join("\n")
        : "";

      throw new Error(errorDetails || "MCP tool failed.");
    }

    // 8. Extract records returned by the MCP server.
    const records = Array.isArray(result.content)
      ? result.content
          .filter(isTextContentItem)
          .map((item) => item.text)
          .join("\n")
      : "";

    if (!records) {
      throw new Error("No farmer records were returned by the MCP tool.");
    }

    console.log("Farmer records retrieved successfully.");
    console.log("Sending question to OpenAI...");

    // 9. Ask OpenAI to answer using the retrieved records.
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      instructions:
        "You are a sugarcane factory data assistant. " +
        "Use only the supplied database records. " +
        "Do not invent farmer information. " +
        "All payment amounts are in Indian rupees. " +
        "Calculate totals accurately.",
      input: `Question: ${question}\n\nFarmer records: ${records}`,
    });

    // 10. Print the answer.
    console.log("\nQuestion:", question);
    console.log("\nAI Answer:\n");
    console.log(response.output_text);
  } finally {
    // 11. Close the MCP connection.
    await client.close();
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : String(error);

  console.error("Application error:", message);
  process.exitCode = 1;
});
