import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
  getHerokuConfigOptions,
  HerokuApiError,
  langchainMessagesToHerokuMessages,
  langchainToolsToHerokuTools,
  DEFAULT_INFERENCE_URL,
} from "../src/common";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
  FunctionMessage,
} from "@langchain/core/messages";
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";

describe("Common utilities", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Backup original environment variables
    originalEnv = {
      INFERENCE_KEY: process.env.INFERENCE_KEY,
      INFERENCE_URL: process.env.INFERENCE_URL,
    };
  });

  afterEach(() => {
    // Restore original environment variables
    process.env.INFERENCE_KEY = originalEnv.INFERENCE_KEY;
    process.env.INFERENCE_URL = originalEnv.INFERENCE_URL;
  });

  describe("getHerokuConfigOptions", () => {
    test("should use provided apiKey and apiUrl", () => {
      const config = getHerokuConfigOptions(
        "test-key",
        "https://custom.url",
        "/v1/chat/completions",
      );

      assert.strictEqual(config.apiKey, "test-key");
      assert.strictEqual(
        config.apiUrl,
        "https://custom.url/v1/chat/completions",
      );
      assert.strictEqual(config.apiEndpoint, "/v1/chat/completions");
    });

    test("should use environment variables when parameters not provided", () => {
      process.env.INFERENCE_KEY = "env-key";
      process.env.INFERENCE_URL = "https://env.url";

      const config = getHerokuConfigOptions(undefined, undefined, "/v1/test");

      assert.strictEqual(config.apiKey, "env-key");
      assert.strictEqual(config.apiUrl, "https://env.url/v1/test");
    });

    test("should use default URL when no URL provided", () => {
      process.env.INFERENCE_KEY = "env-key";
      delete process.env.INFERENCE_URL;

      const config = getHerokuConfigOptions();

      assert.strictEqual(config.apiKey, "env-key");
      assert.strictEqual(config.apiUrl, DEFAULT_INFERENCE_URL);
    });

    test("should handle trailing slashes correctly", () => {
      const config = getHerokuConfigOptions(
        "test-key",
        "https://example.com/",
        "/api/v1",
      );

      assert.strictEqual(config.apiUrl, "https://example.com/api/v1");
    });

    test("should throw error when no API key available", () => {
      delete process.env.INFERENCE_KEY;

      assert.throws(() => getHerokuConfigOptions(), /Heroku API key not found/);
    });
  });

  describe("HerokuApiError", () => {
    test("should create error with message only", () => {
      const error = new HerokuApiError("Test error");

      assert.strictEqual(error.message, "Test error");
      assert.strictEqual(error.name, "HerokuApiError");
      assert.strictEqual(error.status, undefined);
      assert.strictEqual(error.errorResponse, undefined);
      assert(error instanceof Error);
      assert(error instanceof HerokuApiError);
    });

    test("should create error with status and response", () => {
      const errorResponse = { error: "Invalid request" };
      const error = new HerokuApiError("API Error", 400, errorResponse);

      assert.strictEqual(error.message, "API Error");
      assert.strictEqual(error.status, 400);
      assert.deepStrictEqual(error.errorResponse, errorResponse);
    });
  });

  describe("langchainMessagesToHerokuMessages", () => {
    test("should convert HumanMessage", () => {
      const messages = [new HumanMessage("Hello, world!")];
      const result = langchainMessagesToHerokuMessages(messages);

      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0], {
        role: "user",
        content: "Hello, world!",
      });
    });

    test("should convert SystemMessage", () => {
      const messages = [new SystemMessage("You are a helpful assistant.")];
      const result = langchainMessagesToHerokuMessages(messages);

      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0], {
        role: "system",
        content: "You are a helpful assistant.",
      });
    });

    test("should convert AIMessage without tool calls", () => {
      const messages = [new AIMessage("I can help you!")];
      const result = langchainMessagesToHerokuMessages(messages);

      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0], {
        role: "assistant",
        content: "I can help you!",
      });
    });

    test("should convert AIMessage with tool calls", () => {
      const aiMessage = new AIMessage({
        content: "I'll help you with that calculation.",
        tool_calls: [
          {
            id: "call_123",
            name: "calculator",
            args: { operation: "add", a: 1, b: 2 },
          },
        ],
      });
      const result = langchainMessagesToHerokuMessages([aiMessage]);

      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0], {
        role: "assistant",
        content: "I'll help you with that calculation.",
        tool_calls: [
          {
            id: "call_123",
            type: "function",
            function: {
              name: "calculator",
              arguments: '{"operation":"add","a":1,"b":2}',
            },
          },
        ],
      });
    });

    test("should convert ToolMessage", () => {
      const toolMessage = new ToolMessage({
        content: "The result is 3",
        tool_call_id: "call_123",
      });
      const result = langchainMessagesToHerokuMessages([toolMessage]);

      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0], {
        role: "tool",
        content: "The result is 3",
        tool_call_id: "call_123",
      });
    });

    test("should convert FunctionMessage", () => {
      const funcMessage = new FunctionMessage({
        content: "Function executed successfully",
        name: "my_function",
      });
      const result = langchainMessagesToHerokuMessages([funcMessage]);

      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0], {
        role: "tool",
        content: "Function executed successfully",
        name: "my_function",
      });
    });

    test("should handle mixed message types", () => {
      const messages = [
        new SystemMessage("System prompt"),
        new HumanMessage("User question"),
        new AIMessage("AI response"),
      ];
      const result = langchainMessagesToHerokuMessages(messages);

      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0].role, "system");
      assert.strictEqual(result[1].role, "user");
      assert.strictEqual(result[2].role, "assistant");
    });
  });

  describe("langchainToolsToHerokuTools", () => {
    test("should return empty array for empty input", () => {
      assert.deepStrictEqual(langchainToolsToHerokuTools([]), []);
      assert.deepStrictEqual(langchainToolsToHerokuTools(null as any), []);
    });

    test("should convert StructuredTool to Heroku format", () => {
      class TestTool extends StructuredTool {
        name = "test_calculator";
        description = "Performs basic arithmetic operations";
        schema = z.object({
          operation: z.enum(["add", "subtract", "multiply", "divide"]),
          a: z.number(),
          b: z.number(),
        });

        protected async _call(
          input: z.infer<typeof this.schema>,
        ): Promise<string> {
          const { operation, a, b } = input;
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
              throw new Error(`Unknown operation: ${operation}`);
          }
        }
      }

      const tools = [new TestTool()];
      const result = langchainToolsToHerokuTools(tools);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].type, "function");
      assert.strictEqual(result[0].function.name, "test_calculator");
      assert.strictEqual(
        result[0].function.description,
        "Performs basic arithmetic operations",
      );
      assert.strictEqual(result[0].function.parameters.type, "object");
      assert(result[0].function.parameters.properties);
    });

    test("should handle tools with minimal schema", () => {
      class MinimalTool extends StructuredTool {
        name = "minimal_tool";
        description = "A minimal tool";
        schema = z.object({});

        protected async _call(): Promise<string> {
          return "success";
        }
      }

      const tools = [new MinimalTool()];
      const result = langchainToolsToHerokuTools(tools);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].function.name, "minimal_tool");
      assert.deepStrictEqual(result[0].function.parameters, {
        type: "object",
        properties: {},
        additionalProperties: false,
      });
    });
  });
});
