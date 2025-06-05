import { HerokuMia } from "../src"; // Adjusted for local example structure
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

async function main() {
  console.log("🔗 Running HerokuMia Chat with LCEL PromptTemplate Example...");

  const llm = new HerokuMia({
    temperature: 0.7,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are a helpful assistant that translates {input_language} to {output_language}.",
    ],
    ["human", "{text}"],
  ]);

  const outputParser = new StringOutputParser();

  const chain = prompt.pipe(llm).pipe(outputParser);

  try {
    console.log("\n🔗 Invoking LCEL chain for translation...");
    const translationResponse = await chain.invoke({
      input_language: "English",
      output_language: "French",
      text: "Hello, how are you today?",
    });

    console.log("✅ Translation Response:", translationResponse);

    console.log(
      "\n🔄 Invoking LCEL chain for another translation (streaming)...",
    );
    const stream = await chain.stream({
      input_language: "English",
      output_language: "Spanish",
      text: "LangChain is a powerful framework!",
    });

    console.log("🔄 Streaming Spanish Translation:");
    for await (const chunk of stream) {
      process.stdout.write(chunk);
    }
    console.log("\n✅ Stream ended.");
  } catch (error) {
    console.error("❌ Error during LCEL chain invoke:", error);
  }
}

main().catch(console.error);
