import { HerokuMia } from "../src"; // Adjusted for local example structure
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { DynamicTool } from "@langchain/core/tools";

// Define a custom Node.js function to be used as a tool
async function getCurrentWeather(
  location: string,
  unit: "celsius" | "fahrenheit" = "celsius",
) {
  console.log(
    `[Tool Call] getCurrentWeather called with location: ${location}, unit: ${unit}`,
  );
  if (location.toLowerCase().includes("tokyo")) {
    return JSON.stringify({
      location: "Tokyo",
      temperature: "15",
      unit: unit,
      condition: "Cloudy",
    });
  }
  if (location.toLowerCase().includes("london")) {
    return JSON.stringify({
      location: "London",
      temperature: "10",
      unit: unit,
      condition: "Rainy",
    });
  }
  return JSON.stringify({ location, temperature: "unknown", unit: unit });
}

const weatherTool = new DynamicTool({
  name: "get_current_weather",
  description:
    "Get the current weather in a given location. Returns temperature and conditions.",
  func: async (input) => {
    // Assuming input is a JSON string like '{"location": "Tokyo", "unit": "celsius"}'
    // Or just a string for location if the schema is simpler
    let location = "";
    let unit: "celsius" | "fahrenheit" = "celsius";
    try {
      const parsedInput = JSON.parse(input as string);
      location = parsedInput.location;
      unit = parsedInput.unit || "celsius";
    } catch (e) {
      // Fallback if input is not JSON, treat it as location string
      location = input as string;
      console.warn(
        `Tool input was not valid JSON, treating as location string: ${input}`,
      );
    }
    if (!location)
      throw new Error("Location is required for get_current_weather tool");
    return getCurrentWeather(location, unit);
  },
  // For more robust input parsing, define a Zod schema for the tool's input
  // schema: z.object({ location: z.string(), unit: z.enum(["celsius", "fahrenheit"]).optional() })
});

async function main() {
  console.log("Running HerokuMia Chat with Custom Tool Example...");

  const llm = new HerokuMia({
    // model: "claude-3-opus-20240229", // Choose a model good at tool use
    temperature: 0.2,
  });

  const messages: (HumanMessage | AIMessage | ToolMessage)[] = [
    new HumanMessage("What is the weather like in London?"),
  ];

  try {
    console.log("\nInitial LLM call with tool...");
    let aiResponse = await llm.invoke(messages, {
      tools: [weatherTool as any], // Cast to any if StructuredTool vs DynamicTool causes issues with HerokuFunctionTool conversion
    });

    messages.push(aiResponse as AIMessage);
    console.log("LLM Response 1:", aiResponse.content);
    console.log("Tool Calls:", aiResponse.tool_calls);

    // Loop to handle tool calls (simplified loop for one tool call)
    if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
      for (const toolCall of aiResponse.tool_calls) {
        console.log(`\nExecuting tool: ${toolCall.name}`);
        const toolOutput = await weatherTool.call(toolCall.args, {
          // You can pass callbacks here if needed for tracing tool execution
        });
        console.log(
          `Tool output for ${toolCall.name} (id: ${toolCall.id}):`,
          toolOutput,
        );
        messages.push(
          new ToolMessage({ content: toolOutput, tool_call_id: toolCall.id! }),
        );
      }

      console.log("\nLLM call after tool execution...");
      aiResponse = await llm.invoke(messages, {
        tools: [weatherTool as any],
      });
      messages.push(aiResponse as AIMessage);
      console.log("LLM Response 2 (after tool execution):", aiResponse.content);
    }
  } catch (error) {
    console.error("Error during custom tool example:", error);
  }
}

main().catch(console.error);
