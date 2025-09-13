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
import { ChatHeroku } from "../src";

const model = new ChatHeroku({});

function fetchWeatherAgent(city: string) {
  return async () => {
    const mock = {
      main: { temp: 72, humidity: 65 },
      weather: [{ description: "partly cloudy" }],
      wind: { speed: 8 },
    };
    const formatted = await model.invoke([
      new SystemMessage("Format weather data in a clear, natural way."),
      new HumanMessage(
        `Temperature: ${mock.main.temp}°F, Weather: ${mock.weather[0].description}, Humidity: ${mock.main.humidity}%, Wind: ${mock.wind.speed} mph`,
      ),
    ]);
    return {
      messages: [
        new AIMessage({ content: `Weather for ${city}: ${formatted.content}` }),
      ],
    };
  };
}

async function analyzeWeatherAgent(state: { messages: any[] }) {
  const data = state.messages.find(
    (m) =>
      m instanceof AIMessage && m.content.toString().includes("Weather for"),
  );
  if (!data)
    return { messages: [new AIMessage({ content: "No weather data" })] };
  const analysis = await model.invoke([
    new SystemMessage("Provide suggestions based on weather."),
    new HumanMessage(String(data.content)),
  ]);
  return { messages: [new AIMessage({ content: analysis.content })] };
}

function shouldContinue(state: { messages: any[] }) {
  const data = state.messages.find(
    (m) =>
      m instanceof AIMessage && m.content.toString().includes("Weather for"),
  );
  return data ? ["analyzeWeather"] : END;
}

const createGraph = (city: string) =>
  new StateGraph(MessagesAnnotation)
    .addNode("fetchWeather", fetchWeatherAgent(city))
    .addNode("analyzeWeather", analyzeWeatherAgent)
    .addEdge(START, "fetchWeather")
    .addConditionalEdges("fetchWeather", shouldContinue)
    .addEdge("analyzeWeather", END)
    .compile();

export async function run(city = "New York") {
  const graph = createGraph(city);
  const result = await graph.invoke({
    messages: [new HumanMessage(`Weather for ${city}`)],
  });
  return result.messages.map((m: any) => m.content);
}

run().then((msgs) =>
  msgs.forEach((m, i) => console.log(`Message ${i + 1}:`, m)),
);
