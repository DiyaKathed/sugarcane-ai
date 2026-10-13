
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Pool } from "pg";

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const server = new McpServer({
  name: "sugarcane-farmer-server",
  version: "1.0.0",
});

server.registerTool(
  "get_farmer_summary",
  {
    description:
      "Get farmer names, villages, sugarcane supplied, amount paid, and pending payments.",
    inputSchema: {},
  },
  async () => {
    try {
      const result = await db.query(`
        SELECT id, name, village, sugarcane_tonnes,
               amount_paid, payment_pending
        FROM farmers
        ORDER BY payment_pending DESC
      `);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.rows),
          },
        ],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      console.error("PostgreSQL error:", message);

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Database error: ${message}`,
          },
        ],
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
