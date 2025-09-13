import { ChatHeroku } from "../src";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  RunnableSequence,
  RunnablePassthrough,
} from "@langchain/core/runnables";

async function main() {
  const llm = new ChatHeroku({ temperature: 0.7 });

  const prompt1 = ChatPromptTemplate.fromMessages([
    ["system", "You are a creative assistant."],
    ["human", "Generate a sci-fi movie concept about: {theme}"],
  ]);

  const prompt2 = ChatPromptTemplate.fromMessages([
    ["system", "You elaborate on concepts."],
    ["human", "Write a 2-3 sentence pitch for: {concept}"],
  ]);

  const chain1 = prompt1.pipe(llm).pipe(new StringOutputParser());

  const runnable = RunnableSequence.from([
    RunnablePassthrough.assign({ concept: chain1 }),
    prompt2,
    llm,
    new StringOutputParser(),
  ]);

  const final = await runnable.invoke({ theme: "AI taking over a city" });
  console.log(final);
}

main().catch(console.error);
