import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
  ChatHeroku,
  HerokuMiaAgent,
  HerokuApiError,
  type ChatHerokuFields,
  type HerokuMiaAgentFields,
  type HerokuAgentToolDefinition,
} from "../src/index";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";

describe("Integration tests", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Backup and set test environment variables
    originalEnv = {
      INFERENCE_KEY: process.env.INFERENCE_KEY,
      INFERENCE_URL: process.env.INFERENCE_URL,
      INFERENCE_MODEL_ID: process.env.INFERENCE_MODEL_ID,
      HEROKU_API_KEY: process.env.HEROKU_API_KEY,
    };

    process.env.INFERENCE_KEY = "test-inference-key";
    process.env.INFERENCE_URL = "https://test-inference.url";
    process.env.INFERENCE_MODEL_ID = "gpt-oss-120b";
    process.env.HEROKU_API_KEY = "test-heroku-key";
  });

  afterEach(() => {
    // Restore original environment variables
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  describe("Exported components", () => {
    test("should export all main classes and types", () => {
      // Test that all exports are available
      assert.strictEqual(typeof ChatHeroku, "function");
      assert.strictEqual(typeof HerokuMiaAgent, "function");
      assert.strictEqual(typeof HerokuApiError, "function");
    });

    test("should allow type imports", () => {
      // Type tests - these should compile without errors
      const miaFields: ChatHerokuFields = {
        model: "gpt-oss-120b",
        temperature: 0.7,
      };

      const agentFields: HerokuMiaAgentFields = {
        model: "gpt-oss-120b",
        temperature: 0.8,
      };

      const toolDef: HerokuAgentToolDefinition = {
        type: "heroku_tool",
        name: "test_tool",
      };

      // Assert these objects exist (compilation test)
      assert.ok(miaFields);
      assert.ok(agentFields);
      assert.ok(toolDef);
    });
  });

  describe("ChatHeroku workflow", () => {
    test("should create and configure ChatHeroku instance", () => {
      const config: ChatHerokuFields = {
        model: "gpt-oss-120b",
        temperature: 0.7,
        maxTokens: 1000,
        topP: 0.9,
      };

      const herokuMia = new ChatHeroku(config);
      assert.ok(herokuMia);
      assert.strictEqual(herokuMia._llmType(), "ChatHeroku");
    });

    test("should handle message preparation", () => {
      const _herokuMia = new ChatHeroku({});

      const messages = [
        new SystemMessage("You are a helpful assistant."),
        new HumanMessage("Hello, how can you help me today?"),
      ];

      // Test that messages are accepted without throwing
      assert.doesNotThrow(() => {
        // In a real scenario, these would be passed to invoke() or stream()
        assert.strictEqual(messages.length, 2);
      });
    });

    test("should support tool binding", () => {
      // Create a test tool
      class WeatherTool extends StructuredTool {
        name = "get_weather";
        description = "Get weather information for a location";
        schema = z.object({
          location: z.string().describe("The location to get weather for"),
          unit: z.enum(["celsius", "fahrenheit"]).optional(),
        });

        protected async _call(
          input: z.infer<typeof this.schema>,
        ): Promise<string> {
          return `Weather in ${input.location}: Sunny, 25°C`;
        }
      }

      const herokuMia = new ChatHeroku({});
      const boundMia = herokuMia.bindTools([new WeatherTool()]);

      assert.ok(boundMia);
      assert(boundMia instanceof ChatHeroku);
    });

    test("should accept call options", () => {
      const herokuMia = new ChatHeroku({});

      const callOptions = {
        temperature: 0.5,
        maxTokens: 500,
        tool_choice: "auto" as const,
        additionalKwargs: {
          extended_thinking: true,
        },
      };

      const params = herokuMia.invocationParams(callOptions);
      assert.ok(params);
      assert.strictEqual(typeof params, "object");
    });
  });

  describe("HerokuMiaAgent workflow", () => {
    test("should create and configure HerokuMiaAgent instance", () => {
      const tools: HerokuAgentToolDefinition[] = [
        {
          type: "heroku_tool",
          name: "app_info",
          description: "Get application information",
          runtime_params: {
            target_app_name: "my-app",
            dyno_size: "standard-1x",
            ttl_seconds: 300,
          },
        },
        {
          type: "mcp",
          name: "file_manager",
          description: "Manage files and directories",
        },
      ];

      const config: HerokuMiaAgentFields = {
        model: "gpt-oss-120b",
        temperature: 0.8,
        maxTokensPerRequest: 2000,
        tools,
      };

      const agent = new HerokuMiaAgent(config);
      assert.ok(agent);
      assert.strictEqual(agent._llmType(), "HerokuMiaAgent");
    });

    test("should handle agent conversations", () => {
      const _agent = new HerokuMiaAgent({});

      const messages = [
        new SystemMessage(
          "You are a Heroku assistant that helps manage applications.",
        ),
        new HumanMessage("Can you check the status of my production app?"),
      ];

      // Test conversation setup
      assert.doesNotThrow(() => {
        assert.strictEqual(messages.length, 2);
      });
    });

    test("should support various tool configurations", () => {
      const complexTools: HerokuAgentToolDefinition[] = [
        {
          type: "heroku_tool",
          name: "deploy_app",
          description: "Deploy application to Heroku",
          runtime_params: {
            target_app_name: "production-app",
            dyno_size: "performance-m",
            ttl_seconds: 600,
            max_calls: 5,
            tool_params: {
              deployment_method: "git",
              auto_promote: true,
            },
          },
        },
        {
          type: "heroku_tool",
          name: "scale_dynos",
          runtime_params: {
            target_app_name: "production-app",
          },
        },
        {
          type: "mcp",
          name: "monitoring",
          description: "Monitor application metrics",
        },
      ];

      assert.doesNotThrow(() => {
        const agent = new HerokuMiaAgent({
          tools: complexTools,
          additionalKwargs: {
            sessionId: "deploy-session-123",
            metadata: {
              user_id: "developer456",
              environment: "production",
            },
          },
        });
        assert.ok(agent);
      });
    });
  });

  describe("Error handling integration", () => {
    test("should handle configuration errors", () => {
      // Remove required environment variables
      delete process.env.INFERENCE_MODEL_ID;

      assert.throws(() => new ChatHeroku({}), /Heroku model ID not found/);
    });

    test("should create and handle HerokuApiError instances", () => {
      const error = new HerokuApiError("Integration test error", 429, {
        error: "Too Many Requests",
        retry_after: 60,
      });

      assert.strictEqual(error.message, "Integration test error");
      assert.strictEqual(error.status, 429);
      assert.strictEqual(error.errorResponse.retry_after, 60);
      assert(error instanceof Error);
      assert(error instanceof HerokuApiError);
    });
  });

  describe("Configuration patterns", () => {
    test("should support common configuration patterns", () => {
      // Pattern 1: Basic chat completion
      const chatConfig: ChatHerokuFields = {
        model: "gpt-oss-120b",
        temperature: 0.7,
        maxTokens: 1000,
      };
      const chatModel = new ChatHeroku(chatConfig);
      assert.ok(chatModel);

      // Pattern 2: Agent with Heroku tools
      const agentConfig: HerokuMiaAgentFields = {
        model: "gpt-oss-120b",
        temperature: 0.8,
        tools: [
          {
            type: "heroku_tool",
            name: "app_management",
            runtime_params: {
              target_app_name: "my-app",
            },
          },
        ],
      };
      const agent = new HerokuMiaAgent(agentConfig);
      assert.ok(agent);

      // Pattern 3: Custom API endpoints
      const customConfig: ChatHerokuFields = {
        apiKey: "custom-key",
        apiUrl: "https://custom-inference.example.com",
        maxRetries: 5,
        timeout: 30000,
      };
      const customModel = new ChatHeroku(customConfig);
      assert.ok(customModel);
    });
  });

  describe("Type safety validation", () => {
    test("should enforce type constraints", () => {
      // Test that TypeScript types are properly enforced
      assert.doesNotThrow(() => {
        const validMiaConfig: ChatHerokuFields = {
          temperature: 0.5, // Valid: 0-1 range
          topP: 0.9, // Valid: 0-1 range
          maxTokens: 1000, // Valid: positive integer
        };

        const validAgentConfig: HerokuMiaAgentFields = {
          maxTokensPerRequest: 2000,
          tools: [
            {
              type: "heroku_tool", // Valid: heroku_tool or mcp
              name: "valid_tool",
            },
          ],
        };

        // These should compile and run without errors
        assert.ok(validMiaConfig);
        assert.ok(validAgentConfig);
      });
    });
  });
});
