import { z } from "zod";
import { ChatHeroku } from "../src"; // Adjusted for local example structure
import { HumanMessage } from "@langchain/core/messages";

// Define the Zod schema for the desired structured output
const JokeSchema = z.object({
  setup: z.string().describe("The setup of the joke"),
  punchline: z.string().describe("The punchline of the joke"),
  explanation: z
    .string()
    .optional()
    .describe("An optional explanation of why the joke is funny"),
});

async function main() {
  console.log("🎯 Running ChatHeroku Chat with Structured Output Example...");

  const llm = new ChatHeroku({
    temperature: 0.7,
  });

  // First, let's test the basic model without structured output
  console.log("\n🤖 Testing basic model response...");
  try {
    const basicResponse = await llm.invoke([
      new HumanMessage("Tell me a short, clean joke about programming."),
    ]);
    console.log("✅ Basic response:", basicResponse);
  } catch (error) {
    console.error("❌ Error during basic invoke:", error);
  }

  // Now test with tools bound manually
  console.log("\n🔧 Testing with manual tool binding...");
  try {
    const toolSchema = {
      type: "function" as const,
      function: {
        name: "extract",
        description: "Extract structured information",
        parameters: {
          type: "object",
          properties: {
            setup: { type: "string", description: "The setup of the joke" },
            punchline: {
              type: "string",
              description: "The punchline of the joke",
            },
            explanation: {
              type: "string",
              description: "An optional explanation of why the joke is funny",
            },
          },
          required: ["setup", "punchline"],
        },
      },
    };

    const boundLlm = llm.bindTools([toolSchema]);
    const manualResponse = await boundLlm.invoke([
      new HumanMessage(
        "Tell me a short, clean joke about programming. Use the extract function to structure your response.",
      ),
    ]);
    console.log("✅ Manual tool response:", manualResponse);
    console.log("🔧 Tool calls:", manualResponse.tool_calls);
  } catch (error) {
    console.error("❌ Error during manual tool invoke:", error);
  }

  // Create a version of the LLM that can return structured output
  console.log("\n🎯 Testing withStructuredOutput...");
  const structuredLLM = llm.withStructuredOutput(JokeSchema);

  try {
    console.log("\n🤖 Invoking structured LLM to get a joke...");
    const jokeResponse = await structuredLLM.invoke([
      new HumanMessage("Tell me a short, clean joke about programming."),
    ]);

    console.log("✅ Structured Joke Response:");
    console.log("Setup:", jokeResponse.setup);
    console.log("Punchline:", jokeResponse.punchline);
    if (jokeResponse.explanation) {
      console.log("Explanation:", jokeResponse.explanation);
    }
  } catch (error) {
    console.error("❌ Error during structured LLM invoke:", error);
  }

  // Example with a more complex schema
  const AnalysisSchema = z.object({
    sentiment: z
      .enum(["positive", "negative", "neutral"])
      .describe("The overall sentiment of the text"),
    keywords: z
      .array(z.string())
      .describe("A list of up to 5 main keywords from the text"),
    summary: z
      .string()
      .describe("A brief summary of the text in one sentence."),
  });

  const analysisLLM = llm.withStructuredOutput(AnalysisSchema);

  try {
    console.log("\n🔬 Invoking structured LLM for text analysis...");
    const analysisResponse = await analysisLLM.invoke([
      new HumanMessage(
        "LangChain Expression Language (LCEL) makes it easy to build complex chains from basic components. It's a powerful and flexible way to work with LLMs.",
      ),
    ]);
    console.log("✅ Structured Analysis Response:", analysisResponse);
  } catch (error) {
    console.error("❌ Error during structured LLM analysis invoke:", error);
  }
}

main().catch(console.error);
