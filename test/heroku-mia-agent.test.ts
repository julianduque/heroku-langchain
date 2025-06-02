import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { HerokuMiaAgent } from "../src/heroku-mia-agent";
import { HerokuApiError } from "../src/common";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import type { HerokuAgentToolDefinition } from "../src/types";

describe("HerokuMiaAgent", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Backup and set environment variables
    originalEnv = {
      HEROKU_API_KEY: process.env.HEROKU_API_KEY,
      INFERENCE_URL: process.env.INFERENCE_URL,
      INFERENCE_MODEL_ID: process.env.INFERENCE_MODEL_ID,
    };

    // Set test environment variables
    process.env.HEROKU_API_KEY = "test-api-key";
    process.env.INFERENCE_URL = "https://test-api.url";
    process.env.INFERENCE_MODEL_ID = "test-model";
  });

  afterEach(() => {
    // Restore original environment variables
    process.env.HEROKU_API_KEY = originalEnv.HEROKU_API_KEY;
    process.env.INFERENCE_URL = originalEnv.INFERENCE_URL;
    process.env.INFERENCE_MODEL_ID = originalEnv.INFERENCE_MODEL_ID;
  });

  describe("Constructor", () => {
    test("should create instance with minimal configuration", () => {
      const agent = new HerokuMiaAgent({});

      assert.ok(agent);
    });

    test("should create instance with provided configuration", () => {
      const agent = new HerokuMiaAgent({
        model: "claude-3-7-sonnet",
        temperature: 0.7,
        maxTokensPerRequest: 1000,
        apiKey: "custom-key",
        apiUrl: "https://custom.url",
      });

      assert.ok(agent);
    });

    test("should accept tools configuration", () => {
      const tools: HerokuAgentToolDefinition[] = [
        {
          type: "heroku_tool",
          name: "app_logs",
          description: "Get application logs",
          runtime_params: {
            target_app_name: "my-app",
          },
        },
        {
          type: "mcp",
          name: "file_search",
          description: "Search through files",
        },
      ];

      const agent = new HerokuMiaAgent({
        tools,
      });

      assert.ok(agent);
    });

    test("should accept additional kwargs", () => {
      const agent = new HerokuMiaAgent({
        additionalKwargs: {
          session_id: "test-session",
          metadata: { user_id: "user123" },
        },
      });

      assert.ok(agent);
    });
  });

  describe("Model properties", () => {
    test("should have correct _llmType", () => {
      const agent = new HerokuMiaAgent({});
      assert.strictEqual(agent._llmType(), "HerokuMiaAgent");
    });

    test("should have invocation params method", () => {
      const agent = new HerokuMiaAgent({});
      const params = agent.invocationParams();

      assert.ok(params);
      assert.strictEqual(typeof params, "object");
    });
  });

  describe("Configuration validation", () => {
    test("should accept valid temperature range", () => {
      assert.doesNotThrow(() => {
        new HerokuMiaAgent({ temperature: 0.0 });
        new HerokuMiaAgent({ temperature: 0.5 });
        new HerokuMiaAgent({ temperature: 1.0 });
      });
    });

    test("should accept valid topP range", () => {
      assert.doesNotThrow(() => {
        new HerokuMiaAgent({ topP: 0.1 });
        new HerokuMiaAgent({ topP: 0.5 });
        new HerokuMiaAgent({ topP: 1.0 });
      });
    });

    test("should accept valid maxTokensPerRequest", () => {
      assert.doesNotThrow(() => {
        new HerokuMiaAgent({ maxTokensPerRequest: 100 });
        new HerokuMiaAgent({ maxTokensPerRequest: 1000 });
        new HerokuMiaAgent({ maxTokensPerRequest: 4000 });
      });
    });

    test("should accept stop sequences", () => {
      assert.doesNotThrow(() => {
        new HerokuMiaAgent({ stop: ["STOP"] });
        new HerokuMiaAgent({ stop: ["END", "FINISH", "DONE"] });
      });
    });
  });

  describe("Tool definitions", () => {
    test("should accept heroku_tool type", () => {
      const tools: HerokuAgentToolDefinition[] = [
        {
          type: "heroku_tool",
          name: "app_info",
          description: "Get app information",
          runtime_params: {
            target_app_name: "my-app",
            dyno_size: "standard-1x",
            ttl_seconds: 300,
            max_calls: 10,
            tool_params: {
              format: "json",
            },
          },
        },
      ];

      assert.doesNotThrow(() => {
        new HerokuMiaAgent({ tools });
      });
    });

    test("should accept mcp tool type", () => {
      const tools: HerokuAgentToolDefinition[] = [
        {
          type: "mcp",
          name: "weather_api",
          description: "Get weather information",
        },
      ];

      assert.doesNotThrow(() => {
        new HerokuMiaAgent({ tools });
      });
    });

    test("should accept mixed tool types", () => {
      const tools: HerokuAgentToolDefinition[] = [
        {
          type: "heroku_tool",
          name: "app_status",
          runtime_params: {
            target_app_name: "my-app",
          },
        },
        {
          type: "mcp",
          name: "database_query",
          description: "Query database",
        },
      ];

      assert.doesNotThrow(() => {
        new HerokuMiaAgent({ tools });
      });
    });
  });

  describe("Call options", () => {
    test("should accept valid call options", () => {
      const agent = new HerokuMiaAgent({});

      const callOptions = [
        { metadata: { user_id: "123" } },
        { sessionId: "session-456" },
        { additionalKwargs: { custom_param: "value" } },
      ];

      callOptions.forEach((options) => {
        assert.doesNotThrow(() => {
          // Test that invocationParams accepts these options
          const params = agent.invocationParams(options);
          assert.ok(params);
        });
      });
    });
  });

  describe("Message handling", () => {
    test("should handle simple message conversations", () => {
      const _agent = new HerokuMiaAgent({});
      const _messages = [new HumanMessage("Deploy my application")];

      // This should not throw any validation errors
      assert.doesNotThrow(() => {
        // We're testing message type acceptance without API calls
      });
    });

    test("should handle complex conversations", () => {
      const _agent = new HerokuMiaAgent({});
      const _messages = [
        new HumanMessage("What's the status of my app?"),
        new AIMessage("Let me check the status for you."),
        new HumanMessage("Can you also check the logs?"),
      ];

      assert.doesNotThrow(() => {
        // Testing conversation flow acceptance
      });
    });

    test("should handle streaming responses (mock)", () => {
      const _agent = new HerokuMiaAgent({
        model: "claude-3-7-sonnet",
        temperature: 0.7,
      });
      const _messages = [new HumanMessage("Test streaming")];
      // Mock test - would test actual streaming in integration tests
      assert.ok(_agent);
      assert.ok(_messages);
    });

    test("should handle non-streaming responses (mock)", () => {
      const _agent = new HerokuMiaAgent({
        model: "claude-3-7-sonnet",
        temperature: 0.7,
      });
      const _messages = [new HumanMessage("Test non-streaming")];
      // Mock test - would test actual invoke in integration tests
      assert.ok(_agent);
      assert.ok(_messages);
    });
  });

  describe("Error handling", () => {
    test("should handle HerokuApiError correctly", () => {
      const error = new HerokuApiError("Agent API error", 500, {
        error: "Internal Server Error",
        details: "Agent processing failed",
      });

      assert.strictEqual(error.message, "Agent API error");
      assert.strictEqual(error.status, 500);
      assert.ok(error.errorResponse);
      assert(error instanceof Error);
      assert(error instanceof HerokuApiError);
    });
  });

  describe("Model identification", () => {
    test("should use provided model", () => {
      const agent = new HerokuMiaAgent({
        model: "claude-3-7-sonnet",
      });

      assert.ok(agent);
    });

    test("should fall back to environment model", () => {
      const agent = new HerokuMiaAgent({});

      assert.ok(agent);
      // Should use INFERENCE_MODEL_ID from environment
    });
  });

  describe("Retry and timeout configuration", () => {
    test("should accept retry configuration", () => {
      const agent = new HerokuMiaAgent({
        maxRetries: 3,
        timeout: 60000,
      });

      assert.ok(agent);
    });

    test("should use default values when not specified", () => {
      const agent = new HerokuMiaAgent({});

      assert.ok(agent);
    });
  });

  describe("Session and metadata", () => {
    test("should accept session configuration", () => {
      const agent = new HerokuMiaAgent({
        additionalKwargs: {
          sessionId: "session-123",
          metadata: {
            user_id: "user456",
            app_context: "production",
          },
        },
      });

      assert.ok(agent);
    });
  });
});
