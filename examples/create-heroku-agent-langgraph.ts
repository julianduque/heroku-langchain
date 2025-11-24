import { createAgent } from "langchain";
import { HumanMessage, type BaseMessage } from "@langchain/core/messages";
import type { ToolCall } from "@langchain/core/messages/tool";
import {
  END,
  MessagesAnnotation,
  START,
  StateGraph,
  type CompiledStateGraph,
} from "@langchain/langgraph";
import { HerokuAgent } from "../src/index.js";
import { HerokuTool } from "../src/types.js";
import { writeFileSync } from "node:fs";
import { Buffer } from "node:buffer";

const tools: HerokuTool[] = [
  {
    type: "heroku_tool",
    name: "code_exec_python",
  },
];

const herokuModel = new HerokuAgent();
const agent = createAgent({
  model: herokuModel,
  tools,
  systemPrompt:
    "You are a Heroku operator. Use code_exec_python for heavier analysis.",
});

type WeatherGraphState = (typeof MessagesAnnotation)["State"] & {
  weather_city?: string;
};

const getMessageContentText = (message: BaseMessage): string => {
  const { content } = message;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }
        if (typeof entry === "object" && entry && "text" in entry) {
          const text = (entry as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("\n")
      .trim();
  }
  return "";
};

const getMessageResponseMetadata = (message: BaseMessage) =>
  message.response_metadata as
    | {
        tool_calls?: unknown;
        tool_results?: unknown;
      }
    | undefined;

const extractMessageToolCalls = (
  message: BaseMessage,
): ToolCall[] | undefined => {
  if (
    "tool_calls" in message &&
    Array.isArray((message as { tool_calls?: unknown }).tool_calls)
  ) {
    return (message as { tool_calls: ToolCall[] }).tool_calls;
  }
  const metadata = getMessageResponseMetadata(message);
  if (metadata && Array.isArray(metadata.tool_calls)) {
    return metadata.tool_calls as ToolCall[];
  }
  return undefined;
};

const extractMessageToolResults = (message: BaseMessage) => {
  if (message.additional_kwargs && "tool_result" in message.additional_kwargs) {
    return (message.additional_kwargs as { tool_result?: unknown }).tool_result;
  }
  const metadata = getMessageResponseMetadata(message);
  if (metadata?.tool_results) {
    return metadata.tool_results;
  }
  if (
    "tool_call_chunks" in message &&
    (message as { tool_call_chunks?: unknown }).tool_call_chunks
  ) {
    return (message as { tool_call_chunks: unknown }).tool_call_chunks;
  }
  return undefined;
};

// Node to fetch weather data using API
async function fetchWeatherData(state: WeatherGraphState) {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  const lastMessageText = getMessageContentText(lastMessage);

  // Extract city from the user's message
  const cityMatch = lastMessageText.match(
    /weather.*?(?:in|for)\s+([a-zA-Z\s]+)/i,
  );
  const city = cityMatch ? cityMatch[1].trim() : "London";

  console.log(`🌤️  Fetching weather data for ${city}...`);

  const prompt = `
Use the code_exec_python tool to fetch weather data for ${city} using the OpenWeatherMap API.
Use this Python code:

import requests
import json

# Free weather API (no key needed for basic data)
url = f"https://api.open-meteo.com/v1/forecast?latitude=51.5074&longitude=-0.1278&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&hourly=temperature_2m&daily=temperature_2m_max,temperature_2m_min&timezone=auto"

try:
    response = requests.get(url)
    data = response.json()
    
    current = data['current']
    daily = data['daily']
    
    weather_data = {
        "city": "${city}",
        "temperature": current['temperature_2m'],
        "humidity": current['relative_humidity_2m'],
        "wind_speed": current['wind_speed_10m'],
        "weather_code": current['weather_code'],
        "max_temp_today": daily['temperature_2m_max'][0],
        "min_temp_today": daily['temperature_2m_min'][0]
    }
    
    print("WEATHER_DATA:", json.dumps(weather_data))
    
except Exception as e:
    print("ERROR:", str(e))
    print("WEATHER_DATA:", json.dumps({"error": "Failed to fetch weather data"}))
`;

  const response = await agent.invoke({ messages: [new HumanMessage(prompt)] });

  return {
    messages: [response],
    weather_city: city,
  };
}

// Node to analyze weather data and calculate comfort index
async function analyzeWeatherData(state: WeatherGraphState) {
  const { messages } = state;

  console.log(`🧮 Analyzing weather data and calculating comfort metrics...`);
  const prevResponseText = getMessageContentText(messages[messages.length - 1]);

  const prompt = `
Use the code_exec_python tool to analyze the weather data from the previous response and calculate a comfort index.

Look for the WEATHER_DATA in the previous response and use this Python code to analyze it:

import json
import re

# Extract weather data from previous response
prev_response = """${prevResponseText}"""

# Find the WEATHER_DATA line
weather_match = re.search(r'WEATHER_DATA: (.+)', prev_response)
if weather_match:
    weather_data = json.loads(weather_match.group(1))
    
    if "error" not in weather_data:
        temp = weather_data['temperature']
        humidity = weather_data['humidity']
        wind_speed = weather_data['wind_speed']
        
        # Calculate comfort index (0-100 scale)
        # Ideal: 20-25°C temp, 40-60% humidity, wind < 20 km/h
        temp_score = max(0, 100 - abs(temp - 22.5) * 8)  # Penalty for deviation from 22.5°C
        humidity_score = max(0, 100 - abs(humidity - 50) * 2)  # Penalty for deviation from 50%
        wind_score = max(0, 100 - max(0, wind_speed - 20) * 5)  # Penalty for wind > 20 km/h
        
        comfort_index = (temp_score + humidity_score + wind_score) / 3
        
        # Determine activity recommendation
        if comfort_index >= 70:
            activity_type = "outdoor"
            recommendation = "Perfect for outdoor activities!"
        elif comfort_index >= 40:
            activity_type = "mixed"
            recommendation = "Good for light outdoor activities or indoor activities."
        else:
            activity_type = "indoor"
            recommendation = "Better to stay indoors or do indoor activities."
        
        analysis = {
            "comfort_index": round(comfort_index, 1),
            "activity_type": activity_type,
            "recommendation": recommendation,
            "temperature": temp,
            "humidity": humidity,
            "wind_speed": wind_speed,
            "temp_range": f"{weather_data['min_temp_today']}°C - {weather_data['max_temp_today']}°C"
        }
        
        print("ANALYSIS_RESULT:", json.dumps(analysis))
    else:
        print("ANALYSIS_RESULT:", json.dumps({"error": "No weather data to analyze"}))
else:
    print("ANALYSIS_RESULT:", json.dumps({"error": "Could not find weather data in previous response"}))
`;

  const response = await agent.invoke({ messages: [new HumanMessage(prompt)] });

  return { messages: [response] };
}

// Node for outdoor activity suggestions
async function suggestOutdoorActivities(state: WeatherGraphState) {
  const { weather_city } = state;

  console.log(`🏃 Suggesting outdoor activities for ${weather_city}...`);

  const response = await agent.invoke({
    messages: [
      new HumanMessage(
        `Based on the weather analysis showing good conditions for outdoor activities in ${weather_city}, suggest 3 specific outdoor activities that would be enjoyable. Consider the temperature, humidity, and wind conditions from the analysis. Be specific and practical.`,
      ),
    ],
  });

  return { messages: [response] };
}

// Node for indoor activity suggestions
async function suggestIndoorActivities(state: WeatherGraphState) {
  const { weather_city } = state;

  console.log(`🏠 Suggesting indoor activities for ${weather_city}...`);

  const response = await agent.invoke({
    messages: [
      new HumanMessage(
        `Based on the weather analysis showing challenging conditions for outdoor activities in ${weather_city}, suggest 3 specific indoor activities that would be enjoyable. Consider the current weather conditions and provide engaging alternatives.`,
      ),
    ],
  });

  return { messages: [response] };
}

// Node for mixed activity suggestions
async function suggestMixedActivities(state: WeatherGraphState) {
  const { weather_city } = state;

  console.log(
    `🌤️  Suggesting mixed indoor/outdoor activities for ${weather_city}...`,
  );

  const response = await agent.invoke({
    messages: [
      new HumanMessage(
        `Based on the weather analysis showing moderate conditions in ${weather_city}, suggest a mix of 2 light outdoor activities and 2 indoor activities that would work well in these conditions. Be practical about the weather constraints.`,
      ),
    ],
  });

  return { messages: [response] };
}

// Decision function to determine which activity path to take
function decideActivityType(state: WeatherGraphState) {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  const analysisSource = getMessageContentText(lastMessage);

  // Extract activity type from the analysis
  const activityMatch = analysisSource.match(/ANALYSIS_RESULT: (.+)/);
  if (activityMatch) {
    try {
      const analysis = JSON.parse(activityMatch[1]);
      const activityType = analysis.activity_type;

      console.log(
        `🤔 Decision: Weather comfort index is ${analysis.comfort_index}, recommending ${activityType} activities`,
      );

      if (activityType === "outdoor") {
        return "outdoor_activities";
      } else if (activityType === "indoor") {
        return "indoor_activities";
      } else {
        return "mixed_activities";
      }
    } catch (e) {
      console.log(
        "❌ Could not parse analysis result, defaulting to mixed activities",
      );
      return "mixed_activities";
    }
  }

  console.log("❌ No analysis found, defaulting to mixed activities");
  return "mixed_activities";
}

// Build the graph with conditional branching
const graph = new StateGraph(MessagesAnnotation)
  .addNode("fetch_weather", fetchWeatherData)
  .addNode("analyze_weather", analyzeWeatherData)
  .addNode("outdoor_activities", suggestOutdoorActivities)
  .addNode("indoor_activities", suggestIndoorActivities)
  .addNode("mixed_activities", suggestMixedActivities)
  .addEdge(START, "fetch_weather")
  .addEdge("fetch_weather", "analyze_weather")
  .addConditionalEdges("analyze_weather", decideActivityType)
  .addEdge("outdoor_activities", END)
  .addEdge("indoor_activities", END)
  .addEdge("mixed_activities", END)
  .compile();

generateGraph(
  graph as CompiledStateGraph<WeatherGraphState, Partial<WeatherGraphState>>,
).catch(console.error);

const run = async () => {
  console.log(
    "🤖 Running Complex HerokuAgent Weather Analysis with LangGraph...",
  );
  console.log("📊 This example will:");
  console.log("  1. Fetch weather data from an API");
  console.log("  2. Calculate comfort metrics using Python");
  console.log("  3. Branch to different activity suggestions based on results");
  console.log("");

  const result = await graph.invoke({
    messages: [
      new HumanMessage(
        "What's the weather like in London and what activities should I do?",
      ),
    ],
  });

  console.log("\n✅ Graph execution finished.");
  console.log("📝 Final Results:");
  result.messages.forEach((msg, index) => {
    const messageText = getMessageContentText(msg);
    if (!messageText.trim()) {
      return;
    }

    console.log(`\n--- Step ${index + 1} ---`);
    console.log(messageText);

    const toolCalls = extractMessageToolCalls(msg);
    if (toolCalls?.length) {
      console.log("\n🛠️  Tool Calls:", JSON.stringify(toolCalls, null, 2));
    }

    const toolResults = extractMessageToolResults(msg);
    if (toolResults) {
      console.log("\n📊 Tool Result:", toolResults);
    }
  });
};

export async function generateGraph(
  graph: CompiledStateGraph<WeatherGraphState, Partial<WeatherGraphState>>,
) {
  console.log("Generating graph...");
  const g = await graph.getGraphAsync();
  const image = await g.drawMermaidPng();
  const arrayBuffer = await image.arrayBuffer();
  writeFileSync("graph.png", Buffer.from(arrayBuffer));
}

run().catch(console.error);
