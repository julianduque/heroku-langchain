import { ChatHeroku } from "../src"; // Adjusted for local example structure
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

async function main() {
  const llm = new ChatHeroku({ temperature: 0.7 });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are a helpful assistant that translates {input_language} to {output_language}.",
    ],
    ["human", "{text}"],
  ]);

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());

  const translation = await chain.invoke({
    input_language: "English",
    output_language: "French",
    text: "Hello, how are you today?",
  });

  console.log(translation);
}

main().catch(console.error);
