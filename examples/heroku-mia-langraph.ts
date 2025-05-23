import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import {
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { HerokuMia } from "../src";
import fs from "fs";

const model = new HerokuMia({});

function fetchWeatherAgent(city) {
  return async (state) => {
    try {
      // Mock weather data response
      const mockWeatherData = {
        main: {
          temp: 72,
          humidity: 65,
        },
        weather: [
          {
            description: "partly cloudy",
          },
        ],
        wind: {
          speed: 8,
        },
      };

      const json = mockWeatherData;

      if (!json.main || !json.weather || !json.wind) {
        return {
          messages: [new AIMessage({ content: "No weather data available" })],
        };
      }

      // Use the model to format the weather data in a more natural way
      const weatherPrompt = `Format this weather data in a clear, natural way: Temperature: ${json.main.temp}°F, Weather: ${json.weather[0].description}, Humidity: ${json.main.humidity}%, Wind Speed: ${json.wind.speed} mph`;
      const formattedWeather = await model.invoke([
        new SystemMessage(
          "You are a helpful weather assistant. Format weather data in a clear, natural way."
        ),
        new HumanMessage(weatherPrompt),
      ]);

      const messageContent = `Weather data for ${city}: ${formattedWeather.content}`;
      const responseMessage = new AIMessage({ content: messageContent });
      return { messages: [responseMessage] };
    } catch (error) {
      const messageContent = `Error fetching weather data for ${city}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
      const responseMessage = new AIMessage({ content: messageContent });
      return { messages: [responseMessage] };
    }
  };
}

async function analyzeWeatherAgent(state) {
  const dataMessage = state.messages.find(
    (msg) =>
      msg instanceof AIMessage &&
      msg.content.toString().includes("Weather data for")
  );
  if (!dataMessage) {
    return {
      messages: [new AIMessage({ content: "No weather data available" })],
    };
  }

  // Use the model to analyze the weather and provide personalized suggestions
  const analysisPrompt = `Based on this weather data: "${dataMessage.content}", provide personalized suggestions for activities and clothing. Consider temperature, weather conditions, and general comfort.`;

  const analysis = await model.invoke([
    new SystemMessage(
      "You are a helpful weather advisor. Provide personalized suggestions based on weather conditions."
    ),
    new HumanMessage(analysisPrompt),
  ]);

  const responseMessage = new AIMessage({ content: analysis.content });
  return { messages: [responseMessage] };
}

async function localEventsAgent(state) {
  const dataMessage = state.messages.find(
    (msg) =>
      msg instanceof AIMessage &&
      msg.content.toString().includes("Weather data for")
  );
  if (!dataMessage) {
    return {
      messages: [new AIMessage({ content: "No weather data available" })],
    };
  }

  // Use the model to suggest local events based on weather
  const eventsPrompt = `Based on this weather data: "${dataMessage.content}", suggest 2-3 local events or activities that would be enjoyable in these conditions.`;

  const events = await model.invoke([
    new SystemMessage(
      "You are a local events coordinator. Suggest activities based on current weather conditions."
    ),
    new HumanMessage(eventsPrompt),
  ]);

  const responseMessage = new AIMessage({ content: events.content });
  return { messages: [responseMessage] };
}

function shouldContinue(state) {
  const dataFetcherMessage = state.messages.find(
    (msg) =>
      msg instanceof AIMessage &&
      msg.content.toString().includes("Weather data for")
  );

  // If there's no weather data or there's an error, end the workflow
  if (
    !dataFetcherMessage ||
    dataFetcherMessage.content.includes("Error") ||
    dataFetcherMessage.content.includes("No weather data available")
  ) {
    return END;
  }

  // Otherwise
  return ["analyzeWeather", "suggestEvents"];
}

const createGraph = (city) => {
  return new StateGraph(MessagesAnnotation)
    .addNode("fetchWeather", fetchWeatherAgent(city))
    .addNode("analyzeWeather", analyzeWeatherAgent)
    .addNode("suggestEvents", localEventsAgent)
    .addEdge(START, "fetchWeather")
    .addConditionalEdges("fetchWeather", shouldContinue)
    .addEdge("analyzeWeather", END)
    .addEdge("suggestEvents", END)
    .compile();
};

export async function runMultiAgent(city = "New York") {
  const graph = createGraph(city);
  const result = await graph.invoke({
    messages: [
      new HumanMessage(`Fetch and analyze the current weather for ${city}`),
    ],
  });

  const compiledGraph = await graph.getGraphAsync();
  const image = await compiledGraph.drawMermaidPng();
  const arrayBuffer = await image.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    messages: result.messages,
    graph: `data:image/png;base64,${base64}`,
  };
}

runMultiAgent().then((result) => {
  console.log("Weather Analysis Results:");
  result.messages.forEach((msg, index) => {
    console.log(`Message ${index + 1}: ${msg.content}`);
  });

  // Save the graph visualization as a PNG file

  const graphData = result.graph.replace("data:image/png;base64,", "");
  fs.writeFileSync(
    "weather-analysis-graph.png",
    Buffer.from(graphData, "base64")
  );
  console.log("Graph visualization saved as weather-analysis-graph.png");
});
