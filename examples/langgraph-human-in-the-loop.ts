import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
  Command,
  isInterrupted,
  MemorySaver,
  interrupt,
} from "@langchain/langgraph";
import { ChatHeroku } from "../src";
import readline from "node:readline";

const model = new ChatHeroku({ temperature: 0.7 });

// Helper to get user input from the terminal
async function askUser(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer: string = await new Promise((resolve) =>
    rl.question(prompt, resolve),
  );
  rl.close();
  return answer;
}

// Node 1: Draft an initial response
async function draftNode(state: typeof MessagesAnnotation.State) {
  const inputMsg = state.messages[state.messages.length - 1]?.content ?? "";
  const ai = await model.invoke([
    new SystemMessage("You are a helpful assistant"),
    new HumanMessage(String(inputMsg)),
  ]);
  return { messages: [ai] };
}

// Node 2: Human-in-the-loop review. This will interrupt and wait for resume input.
function reviewNode(_state: typeof MessagesAnnotation.State) {
  const feedback = interrupt({
    question:
      "Do you have any feedback for the draft? (type 'approve' to accept, Ctrl+C to exit): ",
  }) as string;
  // When resumed, feedback is injected here
  return { messages: [new HumanMessage(`Reviewer feedback: ${feedback}`)] };
}

// Node 3: Revise the draft based on human feedback
async function reviseNode(state: typeof MessagesAnnotation.State) {
  const ai = await model.invoke([
    new SystemMessage(
      "Revise the previous draft using any reviewer feedback present. If the reviewer typed 'approve', lightly polish.",
    ),
    ...state.messages,
  ]);
  return { messages: [ai] };
}

// Routing logic after the review step: if feedback is 'approve' -> END, else -> 'revise'
function reviewRouting(state: typeof MessagesAnnotation.State) {
  const lastHuman = [...state.messages]
    .reverse()
    .find((m) => m instanceof HumanMessage);
  const content = lastHuman ? String((lastHuman as any).content) : "";
  const prefix = "Reviewer feedback:";
  let feedback = content;
  const idx = content.indexOf(prefix);
  if (idx !== -1) {
    feedback = content.slice(idx + prefix.length).trim();
  }

  if (feedback.toLowerCase() === "approve") {
    console.log("Approved:\n");

    const finalMsg = state.messages[state.messages.length - 2];
    console.log(String(finalMsg.content));
    return END;
  }
  return ["revise"];
}

async function main() {
  const checkpointer = new MemorySaver();
  const threadId = "hitl-demo";

  const graph = new StateGraph(MessagesAnnotation)
    .addNode("draft", draftNode)
    .addNode("review", reviewNode)
    .addNode("revise", reviseNode)
    .addEdge(START, "draft")
    .addEdge("draft", "review")
    // If reviewer typed 'approve' go to END, otherwise go to revise
    .addConditionalEdges("review", reviewRouting)
    // After revision, return to review for the next loop
    .addEdge("revise", "review")
    .compile({ checkpointer });

  // Step 1: Invoke with initial prompt
  const initialTask = "Write a short bio for Ada Lovelace.";
  let values = await graph.invoke(
    { messages: [new HumanMessage(initialTask)] },
    { context: { thread_id: threadId } },
  );

  // Step 2: Interactive loop – show question, revision, input, revision, ...
  if (isInterrupted(values)) {
    // Show the original task first
    console.log(`Question: ${initialTask}`);

    // Show the first draft from the model before any approval
    const firstDraft = values.messages[values.messages.length - 1];
    console.log("Draft:");
    console.log(String(firstDraft.content));

    while (true) {
      const feedback = await askUser(
        "Do you have any feedback for the revision? (type 'approve' to accept, Ctrl+C to exit): ",
      );

      values = await graph.invoke(new Command({ resume: feedback }), {
        context: { thread_id: threadId },
      });

      if (isInterrupted(values)) {
        const last = values.messages[values.messages.length - 1];
        console.log("Revision:");
        console.log(String(last.content));
      } else {
        break;
      }
    }
  } else {
    // If no interrupt happened, just print the model output
    const finalMsg = values.messages[values.messages.length - 1];
    console.log(String(finalMsg.content));
  }
}

main().catch(console.error);
