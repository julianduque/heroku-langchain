import { z } from "zod";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { WikipediaQueryRun } from "@langchain/community/tools/wikipedia_query_run"; // Ensure @langchain/community is installed
import { HerokuMia } from "../src";

async function main() {
  console.log(
    "Running HerokuMia Chat with official WikipediaQueryRun Tool Example...",
  );

  // 1. Instantiate the official WikipediaQueryRun tool
  const wikipediaLangChainTool = new WikipediaQueryRun({
    topKResults: 3,
    maxDocContentLength: 2000, // Reduced for example brevity
  });

  // 2. Wrap WikipediaQueryRun with DynamicStructuredTool to provide a Zod schema
  const structuredWikipediaTool = new DynamicStructuredTool({
    name: "wikipedia_lookup", // You can choose a name, e.g., the original or wikipediaLangChainTool.name
    description:
      "Looks up a term on Wikipedia. Input should be the search term.",
    schema: z.object({
      term: z.string().describe("The search term to look up on Wikipedia"),
    }),
    func: async ({ term }) => {
      console.log(
        `[StructuredWikipediaTool] Calling WikipediaQueryRun with term: "${term}"`,
      );
      try {
        return await wikipediaLangChainTool.invoke(term);
      } catch (e: any) {
        console.error(
          `[StructuredWikipediaTool] Error invoking WikipediaQueryRun: ${e.message}`,
        );
        return `Error looking up "${term}": ${e.message}`;
      }
    },
  });

  // 3. Instantiate HerokuMia
  const llm = new HerokuMia({
    temperature: 0.1,
  });

  const tools = [structuredWikipediaTool];

  const chatHistory: (HumanMessage | AIMessage | ToolMessage)[] = [
    new HumanMessage("Hi! Can you tell me about Heroku using Wikipedia?"),
  ];

  console.log(`Initial Human Message: "${chatHistory[0].content}"`);

  try {
    // 4. Initial call to HerokuMia with the tool
    let response = await llm.invoke(chatHistory, { tools });
    console.log("\n--- First LLM Response ---");
    console.log("Content:", response.content);
    console.log("Tool Calls:", response.tool_calls);
    chatHistory.push(response);

    // 5. Handle potential tool_calls
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log("\n--- Handling Tool Calls ---");
      for (const toolCall of response.tool_calls) {
        const toolToCall = tools.find((t) => t.name === toolCall.name);
        if (toolToCall) {
          console.log(
            `Executing tool: ${toolCall.name} with args:`,
            toolCall.args,
          );
          try {
            // toolCall.args should match the schema: { term: "..." }
            // Cast to the expected schema type for DynamicStructuredTool's invoke method
            const toolOutput = await toolToCall.invoke(
              toolCall.args as { term: string },
            );
            console.log(`Tool Output (${toolCall.name}): "${toolOutput}"`);
            chatHistory.push(
              new ToolMessage({
                content: toolOutput,
                tool_call_id: toolCall.id!,
              }),
            );
          } catch (e: any) {
            console.error(
              `Error during toolToCall.invoke for ${toolCall.name}:`,
              e.message,
            );
            chatHistory.push(
              new ToolMessage({
                content: `Error executing tool ${toolCall.name}: ${e.message}`,
                tool_call_id: toolCall.id!,
              }),
            );
          }
        } else {
          console.warn(`Tool ${toolCall.name} not found.`);
          chatHistory.push(
            new ToolMessage({
              content: `Error: Tool ${toolCall.name} not found.`,
              tool_call_id: toolCall.id!,
            }),
          );
        }
      }

      // 6. Call LLM again with the tool's output
      console.log("\n--- Second LLM Call (with tool results) ---");
      response = await llm.invoke(chatHistory, { tools });
      console.log("\n--- Final LLM Response ---");
      console.log("Content:", response.content);
      chatHistory.push(response);
    } else {
      console.log("\nNo tool calls made by the LLM in the first response.");
    }

    console.log("\n--- Final Chat History ---");
    chatHistory.forEach((msg) =>
      console.log(JSON.stringify(msg.toJSON(), null, 2)),
    ); // Log full message structure with pretty formatting
  } catch (error) {
    console.error(
      "\nError during HerokuMia chat with WikipediaTool execution:",
      error,
    );
  }
}

main().catch(console.error);
