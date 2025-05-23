import { HerokuMia } from "../src"; // Adjusted for local example structure
import { HumanMessage } from "@langchain/core/messages";

async function main() {
  console.log("Running HerokuMia Chat Example...");

  const llm = new HerokuMia({
    temperature: 0.5,
    maxTokens: 1024,
  });

  try {
    console.log("\nInvoking HerokuMia...");
    const response = await llm.invoke([
      new HumanMessage("Hello Mia, tell me about Heroku Inference."),
    ]);
    console.log("Response content:", response.content);
  } catch (error) {
    console.error("Error during invoke:", error);
  }

  try {
    console.log("\nStreaming HerokuMia...");
    const stream = await llm.stream([
      new HumanMessage("Explain streaming in 50 words."),
    ]);
    let fullStreamedResponse = "";
    for await (const chunk of stream) {
      fullStreamedResponse += chunk.content;
      process.stdout.write(chunk.content as string);
    }
    console.log("\nFull streamed response received.");
    console.log("Full streamed response:", fullStreamedResponse);
  } catch (error) {
    console.error("Error during stream:", error);
  }
}

main().catch(console.error);
