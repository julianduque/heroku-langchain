import { z } from "zod";
import { HerokuMia } from "../src"; // Adjusted for local example structure
import { HumanMessage } from "@langchain/core/messages";

// TODO: Currently not working with HerokuMia

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
  console.log("Running HerokuMia Chat with Structured Output Example...");

  const llm = new HerokuMia({
    temperature: 0.7,
  });

  // Create a version of the LLM that can return structured output
  const structuredLLM = llm.withStructuredOutput(JokeSchema);

  try {
    console.log("\nInvoking structured LLM to get a joke...");
    const jokeResponse = await structuredLLM.invoke([
      new HumanMessage("Tell me a short, clean joke about programming."),
    ]);

    console.log("Structured Joke Response:");
    console.log("Setup:", jokeResponse.setup);
    console.log("Punchline:", jokeResponse.punchline);
    if (jokeResponse.explanation) {
      console.log("Explanation:", jokeResponse.explanation);
    }
  } catch (error) {
    console.error("Error during structured LLM invoke:", error);
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
    console.log("\nInvoking structured LLM for text analysis...");
    const analysisResponse = await analysisLLM.invoke([
      new HumanMessage(
        "LangChain Expression Language (LCEL) makes it easy to build complex chains from basic components. It's a powerful and flexible way to work with LLMs.",
      ),
    ]);
    console.log("Structured Analysis Response:", analysisResponse);
  } catch (error) {
    console.error("Error during structured LLM analysis invoke:", error);
  }
}

main().catch(console.error);
