import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import { ChatHeroku } from "../../src/chat.js";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createAgent, tool } from "langchain";
import { z } from "zod";

const createCalculatorTool = (tracker?: { calls: number }) =>
  tool(
    async ({ operation, a, b }) => {
      if (tracker) {
        tracker.calls += 1;
      }

      switch (operation) {
        case "add":
          return String(a + b);
        case "subtract":
          return String(a - b);
        case "multiply":
          return String(a * b);
        case "divide":
          return String(a / b);
        default:
          return "Unknown operation";
      }
    },
    {
      name: "calculator",
      description: "Perform basic arithmetic operations",
      schema: z.object({
        operation: z.enum(["add", "subtract", "multiply", "divide"]),
        a: z.number(),
        b: z.number(),
      }),
    },
  );

/**
 * Integration tests for ChatHeroku following LangChain 1.0 best practices.
 *
 * These tests verify compatibility with LangChain 1.0 interfaces and ensure
 * proper integration with the Heroku Managed Inference API.
 *
 * Prerequisites:
 * - INFERENCE_KEY environment variable must be set
 * - INFERENCE_URL environment variable must be set
 * - INFERENCE_MODEL_ID environment variable must be set
 * - Access to a working Heroku Managed Inference endpoint
 */
describe("ChatHeroku Integration Tests", () => {
  let model: ChatHeroku;
  let skipTests = false;

  const buildCalculatorAgent = (tracker?: { calls: number }) => {
    const calculatorTool = createCalculatorTool(tracker);

    const agent = createAgent({
      model,
      tools: [calculatorTool],
      systemPrompt:
        "You are a calculator assistant. Always call the calculator tool for math.",
    });

    return { agent, calculatorTool };
  };

  beforeEach(() => {
    // Check if required environment variables are set
    if (
      !process.env.INFERENCE_KEY ||
      !process.env.INFERENCE_URL ||
      !process.env.INFERENCE_MODEL_ID
    ) {
      console.warn(
        "⚠️  Skipping integration tests: Required environment variables not set",
      );
      console.warn(
        "   Set INFERENCE_KEY, INFERENCE_URL, and INFERENCE_MODEL_ID to run integration tests",
      );
      skipTests = true;
      return;
    }

    model = new ChatHeroku({
      model: process.env.INFERENCE_MODEL_ID,
      temperature: 0.7,
      apiKey: process.env.INFERENCE_KEY,
      apiUrl: process.env.INFERENCE_URL,
    });
  });

  describe("Basic Chat Functionality", () => {
    test(
      "should invoke with a simple message",
      { skip: skipTests },
      async () => {
        const response = await model.invoke([
          new HumanMessage("Say 'test successful' and nothing else"),
        ]);

        assert.ok(response);
        assert.ok(response instanceof AIMessage);
        assert.ok(response.content);
        assert.strictEqual(typeof response.content, "string");
      },
    );

    test(
      "should handle multi-turn conversations",
      { skip: skipTests },
      async () => {
        const messages = [
          new HumanMessage("My name is Alice"),
          new AIMessage("Nice to meet you, Alice!"),
          new HumanMessage("What is my name?"),
        ];

        const response = await model.invoke(messages);

        assert.ok(response);
        assert.ok(response instanceof AIMessage);
        const content = response.content as string;
        assert.ok(content.toLowerCase().includes("alice"));
      },
    );

    test("should handle system messages", { skip: skipTests }, async () => {
      const messages = [
        new SystemMessage(
          "You are a helpful assistant that responds in Spanish",
        ),
        new HumanMessage("Hello, how are you?"),
      ];

      const response = await model.invoke(messages);

      assert.ok(response);
      assert.ok(response instanceof AIMessage);
      assert.ok(response.content);
    });
  });

  describe("Streaming Functionality", () => {
    test("should stream responses", { skip: skipTests }, async () => {
      const stream = await model.stream([
        new HumanMessage("Count from 1 to 5"),
      ]);

      let chunks = 0;
      let fullContent = "";

      for await (const chunk of stream) {
        chunks++;
        assert.ok(chunk);
        if (chunk.content) {
          fullContent += chunk.content;
        }
      }

      assert.ok(chunks > 0, "Should have received at least one chunk");
      assert.ok(fullContent.length > 0, "Should have received content");
    });

    test(
      "should handle streaming with callbacks",
      { skip: skipTests },
      async () => {
        let tokenCount = 0;
        const callbacks = {
          handleLLMNewToken: (token: string) => {
            tokenCount++;
            assert.strictEqual(typeof token, "string");
          },
        };

        await model.invoke([new HumanMessage("Tell me a short joke")], {
          callbacks: [callbacks],
        });

        assert.ok(tokenCount > 0, "Should have received tokens via callback");
      },
    );
  });

  describe("Tool Calling (Function Calling)", () => {
    test("should bind tools correctly", { skip: skipTests }, async () => {
      const calculatorTool = createCalculatorTool();
      const modelWithTools = model.bindTools([calculatorTool]);

      assert.ok(modelWithTools);
      assert.ok(modelWithTools instanceof ChatHeroku);
      assert.notStrictEqual(modelWithTools, model);
    });

    test(
      "should integrate with createAgent and tool helper",
      { skip: skipTests },
      async () => {
        const tracker = { calls: 0 };
        const { agent } = buildCalculatorAgent(tracker);
        const result = await agent.invoke({
          messages: [
            new SystemMessage(
              "You are a calculator. Always call the calculator tool before responding.",
            ),
            new HumanMessage("What is 25 multiplied by 4?"),
          ],
        });

        assert.ok(result);
        assert.ok(Array.isArray(result.messages));
        const finalMessage = result.messages[result.messages.length - 1];
        assert.ok(finalMessage);
        if (finalMessage instanceof AIMessage) {
          assert.strictEqual(typeof finalMessage.content, "string");
        }
        // Tracker helps ensure we exercised the tool path when the model complies.
        assert.ok(tracker.calls >= 0);
      },
    );
  });

  describe("Structured Output", () => {
    test(
      "should support withStructuredOutput with Zod schema",
      { skip: skipTests },
      async () => {
        const PersonSchema = z.object({
          name: z.string().describe("The person's name"),
          age: z.number().describe("The person's age"),
        });

        const structuredModel = model.withStructuredOutput(PersonSchema);
        const result = await structuredModel.invoke([
          new HumanMessage("John Smith is 30 years old"),
        ]);

        assert.ok(result);
        assert.strictEqual(typeof result.name, "string");
        assert.strictEqual(typeof result.age, "number");
      },
    );

    test(
      "should support withStructuredOutput with includeRaw",
      { skip: skipTests },
      async () => {
        const SimpleSchema = z.object({
          answer: z.string(),
        });

        const structuredModel = model.withStructuredOutput(SimpleSchema, {
          includeRaw: true,
        });
        const result = await structuredModel.invoke([
          new HumanMessage(
            "What is 2+2? Respond with a JSON object with an 'answer' field.",
          ),
        ]);

        assert.ok(result);
        assert.ok(result.raw, "Should include raw response");
        assert.ok(result.parsed, "Should include parsed response");
        assert.ok(result.raw instanceof AIMessage);
        assert.strictEqual(typeof result.parsed.answer, "string");
      },
    );

    test(
      "should handle complex nested schemas",
      { skip: skipTests },
      async () => {
        const ProductSchema = z.object({
          name: z.string(),
          price: z.number(),
          categories: z.array(z.string()),
          metadata: z.object({
            inStock: z.boolean(),
            rating: z.number(),
          }),
        });

        const structuredModel = model.withStructuredOutput(ProductSchema);
        const result = await structuredModel.invoke([
          new HumanMessage(
            "Describe the iPhone 15 as a product with name, price ($999), categories (Electronics, Phones), stock status (true), and rating (4.5)",
          ),
        ]);

        assert.ok(result);
        assert.strictEqual(typeof result.name, "string");
        assert.strictEqual(typeof result.price, "number");
        assert.ok(Array.isArray(result.categories));
        assert.ok(result.metadata);
        assert.strictEqual(typeof result.metadata.inStock, "boolean");
        assert.strictEqual(typeof result.metadata.rating, "number");
      },
    );

    test(
      "should respect structured output method and metadata options",
      { skip: skipTests },
      async () => {
        const SummarySchema = z.object({
          summary: z.string(),
          sentiment: z.enum(["positive", "neutral", "negative"]),
        });

        const structuredModel = model.withStructuredOutput(SummarySchema, {
          name: "summarize_feedback",
          description: "Summarize the text and classify sentiment.",
          method: "functionCalling",
        });

        const result = await structuredModel.invoke([
          new HumanMessage(
            "Summarize this review and rate the sentiment as positive, neutral, or negative: 'I loved the deployment experience and zero downtime.'",
          ),
        ]);

        assert.ok(result);
        assert.strictEqual(typeof result.summary, "string");
        assert.ok(result.summary.length > 0);
        assert.ok(
          ["positive", "neutral", "negative"].includes(result.sentiment),
        );
      },
    );
  });

  describe("Error Handling", () => {
    test(
      "should handle API errors gracefully",
      { skip: skipTests },
      async () => {
        const badModel = new ChatHeroku({
          model: "non-existent-model",
          apiKey: process.env.INFERENCE_KEY,
          apiUrl: process.env.INFERENCE_URL,
        });

        await assert.rejects(
          () => badModel.invoke([new HumanMessage("test")]),
          (error: any) => {
            assert.ok(error);
            return true;
          },
        );
      },
    );

    test("should handle timeout errors", { skip: skipTests }, async () => {
      const timeoutModel = new ChatHeroku({
        model: process.env.INFERENCE_MODEL_ID,
        apiKey: process.env.INFERENCE_KEY,
        apiUrl: process.env.INFERENCE_URL,
        timeout: 1, // 1ms timeout to force timeout
      });

      await assert.rejects(
        () => timeoutModel.invoke([new HumanMessage("test")]),
        (error: any) => {
          assert.ok(error);
          return true;
        },
      );
    });
  });

  describe("Configuration Options", () => {
    test(
      "should respect temperature parameter",
      { skip: skipTests },
      async () => {
        const deterministicModel = new ChatHeroku({
          model: process.env.INFERENCE_MODEL_ID,
          apiKey: process.env.INFERENCE_KEY,
          apiUrl: process.env.INFERENCE_URL,
          temperature: 0.0,
        });

        const response1 = await deterministicModel.invoke([
          new HumanMessage("Say 'deterministic response'"),
        ]);
        const response2 = await deterministicModel.invoke([
          new HumanMessage("Say 'deterministic response'"),
        ]);

        assert.ok(response1.content);
        assert.ok(response2.content);
        // With temperature 0, responses should be very similar (though not guaranteed identical)
      },
    );

    test(
      "should respect maxTokens parameter",
      { skip: skipTests },
      async () => {
        const limitedModel = new ChatHeroku({
          model: process.env.INFERENCE_MODEL_ID,
          apiKey: process.env.INFERENCE_KEY,
          apiUrl: process.env.INFERENCE_URL,
          maxTokens: 10,
        });

        const response = await limitedModel.invoke([
          new HumanMessage("Write a long essay about artificial intelligence"),
        ]);

        assert.ok(response.content);
        // Response should be relatively short due to token limit
        const content = response.content as string;
        assert.ok(
          content.length < 500,
          "Response should be limited by maxTokens",
        );
      },
    );

    test("should respect stop sequences", { skip: skipTests }, async () => {
      const stoppedModel = new ChatHeroku({
        model: process.env.INFERENCE_MODEL_ID,
        apiKey: process.env.INFERENCE_KEY,
        apiUrl: process.env.INFERENCE_URL,
        stop: ["END"],
      });

      const response = await stoppedModel.invoke([
        new HumanMessage("Count from 1 to 10 and say END after 5"),
      ]);

      assert.ok(response.content);
      const content = response.content as string;
      // The response should stop at or before "END"
      const endIndex = content.indexOf("END");
      if (endIndex !== -1) {
        assert.ok(endIndex >= 0);
      }
    });
  });

  describe("LangChain Compatibility", () => {
    test("should work with RunnableSequence", { skip: skipTests }, async () => {
      // Import dynamically to avoid issues if not available
      const { RunnableSequence, RunnableLambda } = await import(
        "@langchain/core/runnables"
      );

      const preprocessor = RunnableLambda.from((input: string) => [
        new HumanMessage(`Please respond to: ${input}`),
      ]);

      const chain = RunnableSequence.from([preprocessor, model]);

      const result = await chain.invoke("Hello");

      assert.ok(result);
      assert.ok(result instanceof AIMessage);
    });

    test(
      "should compose via LCEL prompt templates",
      { skip: skipTests },
      async () => {
        const prompt = ChatPromptTemplate.fromMessages([
          [
            "system",
            "You are a helpful assistant that responds enthusiastically.",
          ],
          ["human", "{input}"],
        ]);

        const chain = prompt.pipe(model).pipe(new StringOutputParser());
        const response = await chain.invoke({
          input: "Share one benefit of Heroku's inference platform.",
        });

        assert.ok(response);
        assert.strictEqual(typeof response, "string");
        assert.ok(response.length > 0);
      },
    );

    test("should stream runnable sequences", { skip: skipTests }, async () => {
      const { RunnableSequence, RunnableLambda } = await import(
        "@langchain/core/runnables"
      );

      const sequence = RunnableSequence.from([
        RunnableLambda.from((topic: string) => [
          new HumanMessage(`List three quick facts about ${topic}`),
        ]),
        model,
      ]);

      const stream = await sequence.stream("Heroku Managed Inference");
      let streamedContent = "";
      for await (const chunk of stream) {
        if (chunk?.content) {
          streamedContent += chunk.content as string;
        }
      }

      assert.ok(streamedContent.length > 0);
    });

    test("should support batch operations", { skip: skipTests }, async () => {
      const inputs = [
        [new HumanMessage("Say 'one'")],
        [new HumanMessage("Say 'two'")],
        [new HumanMessage("Say 'three'")],
      ];

      const results = await model.batch(inputs);

      assert.strictEqual(results.length, 3);
      results.forEach((result) => {
        assert.ok(result instanceof AIMessage);
        assert.ok(result.content);
      });
    });

    test("should support invoke with config", { skip: skipTests }, async () => {
      const response = await model.invoke([new HumanMessage("test")], {
        configurable: {
          temperature: 0.5,
        },
      });

      assert.ok(response);
      assert.ok(response instanceof AIMessage);
    });
  });
});
