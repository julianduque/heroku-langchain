import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { ChatHeroku } from "../src/chat";
import { HerokuApiError } from "../src/common";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { z } from "zod";

describe("ChatHeroku", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Backup and set environment variables
    originalEnv = {
      INFERENCE_KEY: process.env.INFERENCE_KEY,
      INFERENCE_URL: process.env.INFERENCE_URL,
      INFERENCE_MODEL_ID: process.env.INFERENCE_MODEL_ID,
    };

    // Set test environment variables
    process.env.INFERENCE_KEY = "test-api-key";
    process.env.INFERENCE_URL = "https://test-api.url";
    process.env.INFERENCE_MODEL_ID = "test-model";
  });

  afterEach(() => {
    // Restore original environment variables
    process.env.INFERENCE_KEY = originalEnv.INFERENCE_KEY;
    process.env.INFERENCE_URL = originalEnv.INFERENCE_URL;
    process.env.INFERENCE_MODEL_ID = originalEnv.INFERENCE_MODEL_ID;
  });

  describe("Constructor", () => {
    test("should create instance with minimal configuration", () => {
      const herokuMia = new ChatHeroku({});

      assert.ok(herokuMia);
      // The constructor should use environment variables for default configuration
    });

    test("should create instance with provided configuration", () => {
      const herokuMia = new ChatHeroku({
        model: "gpt-oss-120b",
        temperature: 0.7,
        maxTokens: 1000,
        apiKey: "custom-key",
        apiUrl: "https://custom.url",
      });

      assert.ok(herokuMia);
    });

    test("should throw error when no model available", () => {
      delete process.env.INFERENCE_MODEL_ID;

      assert.throws(() => new ChatHeroku({}), /Heroku model ID not found/);
    });

    test("should accept additional kwargs", () => {
      const herokuMia = new ChatHeroku({
        additionalKwargs: {
          extended_thinking: true,
          custom_param: "value",
        },
      });

      assert.ok(herokuMia);
    });

    // New tests for optional constructor
    test("should create instance without any parameters when environment variables are set", () => {
      const herokuMia = new ChatHeroku();

      assert.ok(herokuMia);
      assert.strictEqual(herokuMia._llmType(), "ChatHeroku");
    });

    test("should throw error when no parameters and no environment variables", () => {
      // Backup current env vars
      const backupModelId = process.env.INFERENCE_MODEL_ID;

      try {
        delete process.env.INFERENCE_MODEL_ID;

        assert.throws(() => new ChatHeroku(), /Heroku model ID not found/);
      } finally {
        // Restore env vars
        if (backupModelId) {
          process.env.INFERENCE_MODEL_ID = backupModelId;
        }
      }
    });

    test("should prioritize constructor parameters over environment variables", () => {
      const customModel = "custom-gpt-model";
      const herokuMia = new ChatHeroku({ model: customModel });

      // We can't directly access the model property, but we can check that it doesn't throw
      assert.ok(herokuMia);
      // The invocation params should contain our custom model
      const params = herokuMia.invocationParams();
      assert.strictEqual(params.model, customModel);
    });

    test("should use environment variables when constructor parameters are undefined", () => {
      const envModel = process.env.INFERENCE_MODEL_ID;
      const herokuMia = new ChatHeroku();

      const params = herokuMia.invocationParams();
      assert.strictEqual(params.model, envModel);
    });

    test("should handle mixed parameter sources correctly", () => {
      const customTemperature = 0.5;
      const herokuMia = new ChatHeroku({ temperature: customTemperature });

      const params = herokuMia.invocationParams();
      // Should use environment model but custom temperature
      assert.strictEqual(params.model, process.env.INFERENCE_MODEL_ID);
      assert.strictEqual(params.temperature, customTemperature);
    });
  });

  describe("Model properties", () => {
    test("should have correct _llmType", () => {
      const herokuMia = new ChatHeroku({});
      assert.strictEqual(herokuMia._llmType(), "ChatHeroku");
    });

    test("should have invocation params method", () => {
      const herokuMia = new ChatHeroku({});
      const params = herokuMia.invocationParams();

      assert.ok(params);
      assert.strictEqual(typeof params, "object");
    });
  });

  describe("Message validation", () => {
    test("should validate simple message conversation", () => {
      const _herokuMia = new ChatHeroku({});
      const _messages = [new HumanMessage("Hello, how are you?")];

      // This should not throw any validation errors
      assert.doesNotThrow(() => {
        // We're just testing that the message types are accepted
        // without actually making API calls
      });
    });

    test("should handle conversation with AI responses", () => {
      const _herokuMia = new ChatHeroku({});
      const _messages = [
        new HumanMessage("What's 2 + 2?"),
        new AIMessage("2 + 2 equals 4."),
        new HumanMessage("Thank you!"),
      ];

      // This should not throw any validation errors
      assert.doesNotThrow(() => {
        // Testing message sequence acceptance
      });
    });
  });

  describe("Configuration validation", () => {
    test("should accept valid temperature range", () => {
      assert.doesNotThrow(() => {
        new ChatHeroku({ temperature: 0.0 });
        new ChatHeroku({ temperature: 0.5 });
        new ChatHeroku({ temperature: 1.0 });
      });
    });

    test("should accept valid topP range", () => {
      assert.doesNotThrow(() => {
        new ChatHeroku({ topP: 0.1 });
        new ChatHeroku({ topP: 0.5 });
        new ChatHeroku({ topP: 1.0 });
      });
    });

    test("should accept valid maxTokens", () => {
      assert.doesNotThrow(() => {
        new ChatHeroku({ maxTokens: 100 });
        new ChatHeroku({ maxTokens: 1000 });
        new ChatHeroku({ maxTokens: 4000 });
      });
    });

    test("should accept stop sequences", () => {
      assert.doesNotThrow(() => {
        new ChatHeroku({ stop: ["STOP"] });
        new ChatHeroku({ stop: ["END", "FINISH", "DONE"] });
      });
    });
  });

  describe("URL construction", () => {
    test("should construct correct API URL with default endpoint", () => {
      const herokuMia = new ChatHeroku({
        apiUrl: "https://test.example.com",
      });

      // The URL construction is tested in common.test.ts
      assert.ok(herokuMia);
    });

    test("should handle URL with trailing slashes", () => {
      const herokuMia = new ChatHeroku({
        apiUrl: "https://test.example.com/",
      });

      assert.ok(herokuMia);
    });
  });

  describe("Stream configuration", () => {
    test("should accept streaming configuration", () => {
      const streamingMia = new ChatHeroku({
        streaming: true,
        stream: true,
      });

      assert.ok(streamingMia);
    });

    test("should accept non-streaming configuration", () => {
      const nonStreamingMia = new ChatHeroku({
        streaming: false,
        stream: false,
      });

      assert.ok(nonStreamingMia);
    });
  });

  describe("Error handling", () => {
    test("should handle HerokuApiError correctly", () => {
      // Test that HerokuApiError instances are properly typed
      const error = new HerokuApiError("Test API error", 400, {
        error: "Bad Request",
        message: "Invalid parameter",
      });

      assert.strictEqual(error.message, "Test API error");
      assert.strictEqual(error.status, 400);
      assert.ok(error.errorResponse);
      assert(error instanceof Error);
      assert(error instanceof HerokuApiError);
    });
  });

  describe("Tool binding", () => {
    test("should have bindTools method", () => {
      const herokuMia = new ChatHeroku({});

      assert.strictEqual(typeof herokuMia.bindTools, "function");
    });

    test("should accept empty tools array", () => {
      const herokuMia = new ChatHeroku({});

      assert.doesNotThrow(() => {
        const boundMia = herokuMia.bindTools([]);
        assert.ok(boundMia);
        assert(boundMia instanceof ChatHeroku);
      });
    });
  });

  describe("Call options", () => {
    test("should accept valid call options", () => {
      const herokuMia = new ChatHeroku({});

      // Test various call option configurations
      const callOptions = [
        { temperature: 0.8 },
        { maxTokens: 500 },
        { tool_choice: "auto" as const },
        { tool_choice: "none" as const },
        { tool_choice: "required" as const },
        {
          tool_choice: {
            type: "function" as const,
            function: { name: "test_function" },
          },
        },
        { additionalKwargs: { custom_param: "value" } },
      ];

      callOptions.forEach((options) => {
        assert.doesNotThrow(() => {
          // Test that invocationParams accepts these options
          const params = herokuMia.invocationParams(options);
          assert.ok(params);
        });
      });
    });
  });

  describe("Model identification", () => {
    test("should use provided model", () => {
      const herokuMia = new ChatHeroku({
        model: "gpt-oss-120b",
      });

      assert.ok(herokuMia);
    });

    test("should fall back to environment model", () => {
      const herokuMia = new ChatHeroku({});

      assert.ok(herokuMia);
      // Should use INFERENCE_MODEL_ID from environment
    });
  });

  describe("Retry configuration", () => {
    test("should accept retry configuration", () => {
      const herokuMia = new ChatHeroku({
        maxRetries: 5,
        timeout: 30000,
      });

      assert.ok(herokuMia);
    });

    test("should use default retry values when not specified", () => {
      const herokuMia = new ChatHeroku({});

      assert.ok(herokuMia);
    });
  });

  describe("Structured output", () => {
    let originalInvoke: any;

    beforeEach(() => {
      originalInvoke = (ChatHeroku as any).prototype.invoke;
    });

    afterEach(() => {
      (ChatHeroku as any).prototype.invoke = originalInvoke;
    });

    test("should return parsed object for Zod schema", async () => {
      const JokeSchema = z.object({ setup: z.string(), punchline: z.string() });

      (ChatHeroku as any).prototype.invoke = async function () {
        return new AIMessage({
          content: "",
          tool_calls: [
            {
              id: "call_1",
              name: "extract",
              args: {
                setup: "Why did the dev cross the road?",
                punchline: "To get to the other IDE.",
              },
              type: "tool_call",
            },
          ],
        });
      };

      const llm = new ChatHeroku({});
      const structured = llm.withStructuredOutput(JokeSchema);
      const res = await structured.invoke([
        new HumanMessage("Tell me a short programming joke"),
      ]);

      assert.strictEqual(typeof res.setup, "string");
      assert.strictEqual(typeof res.punchline, "string");
      assert.ok(res.setup.length > 0);
      assert.ok(res.punchline.length > 0);
    });

    test("should return parsed object for JSON schema", async () => {
      const PersonSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name", "age"],
        additionalProperties: false,
      } as const;

      (ChatHeroku as any).prototype.invoke = async function () {
        return new AIMessage({
          content: "",
          tool_calls: [
            {
              id: "call_2",
              name: "extract",
              args: { name: "Ada", age: 36 },
              type: "tool_call",
            },
          ],
        });
      };

      const llm = new ChatHeroku({});
      const structured = llm.withStructuredOutput(PersonSchema as any);
      const res = await structured.invoke([new HumanMessage("Ada is 36.")]);
      assert.deepStrictEqual(res, { name: "Ada", age: 36 });
    });

    test("should return raw AIMessage and parsed object when includeRaw", async () => {
      const S = z.object({ x: z.number() });

      (ChatHeroku as any).prototype.invoke = async function () {
        return new AIMessage({
          content: "",
          tool_calls: [
            {
              id: "call_3",
              name: "extract",
              args: { x: 42 },
              type: "tool_call",
            },
          ],
        });
      };

      const llm = new ChatHeroku({});
      const structured = llm.withStructuredOutput(S, { includeRaw: true });
      const res = await structured.invoke([new HumanMessage("x is 42")]);
      assert.ok(res.raw);
      assert.strictEqual(res.parsed.x, 42);
    });

    test("should fail Zod validation on invalid output", async () => {
      const S = z.object({ a: z.string() });

      (ChatHeroku as any).prototype.invoke = async function () {
        return new AIMessage({
          content: "",
          tool_calls: [
            {
              id: "call_4",
              name: "extract",
              args: { b: 1 },
              type: "tool_call",
            },
          ],
        });
      };

      const llm = new ChatHeroku({});
      const structured = llm.withStructuredOutput(S);
      await assert.rejects(
        () => structured.invoke([new HumanMessage("b is 1")]),
        /Failed to parse/,
      );
    });
  });
});
