import { z } from "zod";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { StructuredTool } from "@langchain/core/tools";
import { WikipediaQueryRun } from "@langchain/community/tools/wikipedia_query_run";
import { RunnableLambda } from "@langchain/core/runnables";
import { ChatHeroku } from "../src";

// Custom Wikipedia tool that properly handles config propagation
class WikipediaSearchTool extends StructuredTool {
  name = "wikipedia_search";
  description = "Searches Wikipedia for information about a given topic.";
  schema = z.object({
    query: z.string().describe("The search query for Wikipedia"),
  });

  private wikipediaTool: WikipediaQueryRun;

  constructor() {
    super();
    this.wikipediaTool = new WikipediaQueryRun({
      topKResults: 3,
      maxDocContentLength: 2000,
    });
  }

  async _call(arg: { query: string }, runManager?, parentConfig?) {
    console.log(
      `🔍 [WikipediaSearchTool] Searching Wikipedia for: "${arg.query}"`,
    );
    try {
      // Pass the config to maintain trace context
      return await this.wikipediaTool.invoke(arg.query, parentConfig);
    } catch (e: any) {
      console.error(
        `❌ [WikipediaSearchTool] Error searching Wikipedia: ${e.message}`,
      );
      return `Error searching Wikipedia for "${arg.query}": ${e.message}`;
    }
  }
}

async function main() {
  console.log(
    "🔧 Running ChatHeroku Chat with official WikipediaQueryRun Tool Example...",
  );

  // Create the custom Wikipedia tool
  const wikipediaTool = new WikipediaSearchTool();

  // 3. Instantiate ChatHeroku and bind tools
  const llm = new ChatHeroku({
    temperature: 0.1,
  });

  const tools = [wikipediaTool];
  // Bind tools to the LLM - this ensures proper tracing context
  const llmWithTools = llm.bindTools(tools);

  // Create a runnable that handles the entire tool calling loop within a single trace
  const toolCallingAgent = RunnableLambda.from(
    async (
      input: { messages: (HumanMessage | AIMessage | ToolMessage)[] },
      config,
    ) => {
      const chatHistory = [...input.messages];

      console.log(`💭 Initial Human Message: "${chatHistory[0].content}"`);

      // 4. Initial call to ChatHeroku with bound tools
      let response = await llmWithTools.invoke(chatHistory, config);
      console.log("\n🤖 --- First LLM Response ---");
      console.log("Content:", response.content);
      console.log("Tool Calls:", response.tool_calls);
      chatHistory.push(response);

      // 5. Handle potential tool_calls within the same runnable context
      if (response.tool_calls && response.tool_calls.length > 0) {
        console.log("\n⚡ --- Handling Tool Calls ---");
        for (const toolCall of response.tool_calls) {
          const toolToCall = tools.find((t) => t.name === toolCall.name);
          if (toolToCall) {
            console.log(
              `🔧 Executing tool: ${toolCall.name} with args:`,
              toolCall.args,
            );
            try {
              // Execute tool within the same tracing context
              const toolOutput = await toolToCall.invoke(toolCall.args, config);
              console.log(`✅ Tool Output (${toolCall.name}): "${toolOutput}"`);
              chatHistory.push(
                new ToolMessage({
                  content: toolOutput,
                  tool_call_id: toolCall.id!,
                }),
              );
            } catch (e: any) {
              console.error(
                `❌ Error during toolToCall.invoke for ${toolCall.name}:`,
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
            console.warn(`⚠️ Tool ${toolCall.name} not found.`);
            chatHistory.push(
              new ToolMessage({
                content: `Error: Tool ${toolCall.name} not found.`,
                tool_call_id: toolCall.id!,
              }),
            );
          }
        }

        // 6. Call LLM again with the tool's output
        console.log("\n🔄 --- Second LLM Call (with tool results) ---");
        response = await llmWithTools.invoke(chatHistory, config);
        console.log("\n🎯 --- Final LLM Response ---");
        console.log("Content:", response.content);
        chatHistory.push(response);
      } else {
        console.log(
          "\n✅ No tool calls made by the LLM in the first response.",
        );
      }

      return {
        chatHistory,
        finalResponse: response.content,
      };
    },
  );

  const initialMessages = [
    new HumanMessage("Hi! Can you tell me about Heroku using Wikipedia?"),
  ];

  try {
    // Execute the entire tool calling sequence within a single trace
    const result = await toolCallingAgent.invoke({ messages: initialMessages });

    console.log("\n📋 --- Final Chat History ---");
    result.chatHistory.forEach((msg) =>
      console.log(JSON.stringify(msg.toJSON(), null, 2)),
    ); // Log full message structure with pretty formatting

    console.log("\n🎯 --- Final Result ---");
    console.log("Final Response:", result.finalResponse);
  } catch (error) {
    console.error(
      "\n❌ Error during ChatHeroku chat with WikipediaTool execution:",
      error,
    );
  }
}

main().catch(console.error);
