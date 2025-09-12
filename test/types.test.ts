import { test, describe } from "node:test";
import assert from "node:assert";
import type {
  HerokuMiaFields,
  HerokuMiaCallOptions,
  HerokuChatMessageRole,
  HerokuToolCall,
  HerokuChatMessage,
  HerokuFunctionTool,
  HerokuChatCompletionRequest,
  HerokuMiaAgentFields,
  HerokuAgentToolDefinition,
} from "../src/types";

describe("Type definitions", () => {
  describe("HerokuMiaFields", () => {
    test("should accept valid configuration", () => {
      const fields: HerokuMiaFields = {
        model: "gpt-oss-120b",
        temperature: 0.7,
        maxTokens: 1000,
        stop: ["STOP"],
        stream: false,
        topP: 0.9,
        apiKey: "test-key",
        apiUrl: "https://test.url",
        maxRetries: 3,
        timeout: 30000,
        streaming: false,
        additionalKwargs: { extended_thinking: true },
      };

      // Type assertion - if this compiles, the type is valid
      assert.ok(fields);
      assert.strictEqual(fields.model, "gpt-oss-120b");
      assert.strictEqual(fields.temperature, 0.7);
    });

    test("should work with minimal configuration", () => {
      const fields: HerokuMiaFields = {};

      assert.ok(fields);
      assert.strictEqual(Object.keys(fields).length, 0);
    });
  });

  describe("HerokuMiaCallOptions", () => {
    test("should accept valid call options", () => {
      const options: HerokuMiaCallOptions = {
        tool_choice: "auto",
        temperature: 0.5,
        maxTokens: 500,
        additionalKwargs: { some_param: "value" },
      };

      assert.ok(options);
      assert.strictEqual(options.tool_choice, "auto");
      assert.strictEqual(options.temperature, 0.5);
    });

    test("should accept specific tool choice", () => {
      const options: HerokuMiaCallOptions = {
        tool_choice: {
          type: "function",
          function: { name: "specific_tool" },
        },
      };

      assert.ok(options);
      // Check if it's an object and has the right structure
      if (
        typeof options.tool_choice === "object" &&
        options.tool_choice !== null
      ) {
        assert.strictEqual(options.tool_choice.type, "function");
        assert.strictEqual(options.tool_choice.function.name, "specific_tool");
      }
    });
  });

  describe("HerokuChatMessage", () => {
    test("should accept user message", () => {
      const message: HerokuChatMessage = {
        role: "user",
        content: "Hello, how are you?",
      };

      assert.ok(message);
      assert.strictEqual(message.role, "user");
      assert.strictEqual(message.content, "Hello, how are you?");
    });

    test("should accept assistant message with tool calls", () => {
      const message: HerokuChatMessage = {
        role: "assistant",
        content: "I'll help you with that calculation.",
        tool_calls: [
          {
            id: "call_123",
            type: "function",
            function: {
              name: "calculator",
              arguments: '{"a": 1, "b": 2}',
            },
          },
        ],
      };

      assert.ok(message);
      assert.strictEqual(message.role, "assistant");
      assert.strictEqual(message.tool_calls?.length, 1);
    });

    test("should accept tool message", () => {
      const message: HerokuChatMessage = {
        role: "tool",
        content: "The result is 3",
        tool_call_id: "call_123",
      };

      assert.ok(message);
      assert.strictEqual(message.role, "tool");
      assert.strictEqual(message.tool_call_id, "call_123");
    });
  });

  describe("HerokuToolCall", () => {
    test("should accept valid tool call", () => {
      const toolCall: HerokuToolCall = {
        id: "call_456",
        type: "function",
        function: {
          name: "weather_checker",
          arguments: '{"location": "San Francisco"}',
        },
      };

      assert.ok(toolCall);
      assert.strictEqual(toolCall.id, "call_456");
      assert.strictEqual(toolCall.type, "function");
      assert.strictEqual(toolCall.function.name, "weather_checker");
    });
  });

  describe("HerokuFunctionTool", () => {
    test("should accept valid function tool definition", () => {
      const tool: HerokuFunctionTool = {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get current weather for a location",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "The city name",
              },
              unit: {
                type: "string",
                enum: ["celsius", "fahrenheit"],
                description: "Temperature unit",
              },
            },
            required: ["location"],
          },
        },
      };

      assert.ok(tool);
      assert.strictEqual(tool.type, "function");
      assert.strictEqual(tool.function.name, "get_weather");
      assert.strictEqual(tool.function.parameters.type, "object");
      assert.strictEqual(tool.function.parameters.required?.length, 1);
    });
  });

  describe("HerokuChatCompletionRequest", () => {
    test("should compile with required fields", () => {
      // This test ensures the type compiles correctly with minimal required fields
      // The actual implementation would need to match the interface
      const request = {
        model: "gpt-oss-120b",
        messages: [
          {
            role: "user" as HerokuChatMessageRole,
            content: "Hello",
          },
        ],
      };

      // Type assertion to verify it matches the interface structure
      const typedRequest: Partial<HerokuChatCompletionRequest> = request;
      assert.ok(typedRequest);
      assert.strictEqual(typedRequest.model, "gpt-oss-120b");
    });
  });

  describe("HerokuMiaAgentFields", () => {
    test("should accept agent configuration", () => {
      // Test that agent-specific fields are properly typed
      const fields: Partial<HerokuMiaAgentFields> = {
        model: "gpt-oss-120b",
        temperature: 0.7,
        apiKey: "test-key",
        apiUrl: "https://test.url",
        maxRetries: 2,
        timeout: 10000,
        tools: [],
      };

      assert.ok(fields);
      assert.strictEqual(fields.model, "gpt-oss-120b");
    });
  });

  describe("HerokuAgentToolDefinition", () => {
    test("should accept heroku_tool type with runtime params", () => {
      const toolDef: HerokuAgentToolDefinition = {
        type: "heroku_tool",
        name: "heroku_app_logs",
        description: "Get application logs",
        runtime_params: {
          target_app_name: "my-app",
          dyno_size: "standard-1x",
          ttl_seconds: 300,
          max_calls: 5,
          tool_params: {
            cmd: "heroku logs",
            description: "Fetch logs",
          },
        },
      };

      assert.ok(toolDef);
      assert.strictEqual(toolDef.type, "heroku_tool");
      assert.strictEqual(toolDef.name, "heroku_app_logs");
      assert.strictEqual(toolDef.runtime_params?.target_app_name, "my-app");
    });

    test("should accept mcp type", () => {
      const toolDef: HerokuAgentToolDefinition = {
        type: "mcp",
        name: "file_search",
        description: "Search through files",
      };

      assert.ok(toolDef);
      assert.strictEqual(toolDef.type, "mcp");
      assert.strictEqual(toolDef.name, "file_search");
    });

    test("should work without optional fields", () => {
      const toolDef: HerokuAgentToolDefinition = {
        type: "heroku_tool",
        name: "minimal_tool",
      };

      assert.ok(toolDef);
      assert.strictEqual(toolDef.type, "heroku_tool");
      assert.strictEqual(toolDef.name, "minimal_tool");
    });
  });

  describe("Role types", () => {
    test("should accept all valid message roles", () => {
      const roles: HerokuChatMessageRole[] = [
        "system",
        "user",
        "assistant",
        "tool",
      ];

      roles.forEach((role) => {
        const message: HerokuChatMessage = {
          role,
          content: "Test content",
        };
        assert.ok(message);
        assert.strictEqual(message.role, role);
      });
    });
  });
});
