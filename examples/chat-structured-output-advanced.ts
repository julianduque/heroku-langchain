import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatHeroku } from "../src";
import { z } from "zod";

const llm = new ChatHeroku({
  temperature: 0,
});

const actionSchema = z.object({
  label: z.string().describe("Text shown on the action"),
  action: z.string().describe("Command identifier or URL the UI should call"),
  variant: z
    .enum(["primary", "secondary", "ghost"])
    .default("primary")
    .describe("Visual emphasis"),
});

const baseComponentSchema = z.object({
  title: z.string().optional().describe("Component heading"),
  subtitle: z
    .string()
    .optional()
    .describe("Smaller copy shown under the title"),
  description: z.string().optional().describe("Helper copy under the title"),
});

const cardComponentSchema = baseComponentSchema.extend({
  type: z.literal("card"),
  badge: z.string().optional().describe("Optional badge shown above the title"),
  icon: z.string().optional().describe("Name of icon to display"),
  body: z
    .array(
      z.object({
        type: z.enum(["paragraph", "bullet"]),
        content: z.string(),
      }),
    )
    .min(1)
    .describe("Rich body content")
    .optional(),
  actions: z.array(actionSchema).optional(),
  content: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  dataKey: z
    .string()
    .optional()
    .describe("Key to look up primary content data"),
  listKey: z.string().optional().describe("Key to load list-style content"),
});

const tableComponentSchema = baseComponentSchema.extend({
  type: z.literal("table"),
  columns: z
    .array(
      z.union([
        z.object({
          key: z.string().describe("Accessor key"),
          header: z.string().describe("Column header"),
          align: z.enum(["left", "center", "right"]).default("left"),
        }),
        z.string().describe("Column header label"),
      ]),
    )
    .min(1),
  rows: z
    .array(
      z.union([
        z.object({
          id: z.string(),
          cells: z.array(
            z.object({
              column: z.string().describe("Column key"),
              value: z.string().describe("Display value"),
              trend: z.enum(["up", "down", "flat"]).optional(),
              intent: z
                .enum(["positive", "warning", "danger", "muted"])
                .optional(),
            }),
          ),
        }),
        z
          .array(z.union([z.string(), z.number()]))
          .describe("Row expressed as a list of cell values"),
      ]),
    )
    .min(1)
    .optional(),
  dataKey: z.string().optional().describe("Key to retrieve table data"),
  footer: z.string().optional(),
});

const listComponentSchema = baseComponentSchema.extend({
  type: z.literal("list"),
  style: z.enum(["unordered", "ordered", "timeline"]).default("unordered"),
  items: z
    .array(
      z.union([
        z.object({
          id: z.string(),
          primary: z.string(),
          secondary: z.string().optional(),
          icon: z.string().optional(),
          status: z
            .enum(["new", "in-progress", "complete", "blocked"])
            .optional(),
        }),
        z.string().describe("List entry text"),
      ]),
    )
    .min(1)
    .optional(),
  itemsKey: z
    .string()
    .optional()
    .describe("Key to fetch list entries dynamically"),
  itemTemplate: z
    .object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      timestamp: z.string().optional(),
      primary: z.string().optional(),
      secondary: z.string().optional(),
    })
    .optional()
    .describe("Template for rendering list entries"),
});

const statComponentSchema = baseComponentSchema.extend({
  type: z.literal("stat"),
  stats: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        delta: z.string().optional(),
        trend: z.enum(["up", "down", "neutral"]).optional(),
        caption: z.string().optional(),
      }),
    )
    .min(1)
    .optional(),
  metric: z.string().optional().describe("Primary metric value"),
  valueKey: z.string().optional().describe("Key to look up the metric value"),
  trend: z.enum(["up", "down", "neutral"]).optional(),
  unit: z.string().optional().describe("Unit suffix for the metric"),
  actions: z.array(actionSchema).optional(),
});

const componentSchemaBase = z.discriminatedUnion("type", [
  cardComponentSchema,
  tableComponentSchema,
  listComponentSchema,
  statComponentSchema,
]);

const componentSchema = componentSchemaBase.superRefine((value, ctx) => {
  if (value.type === "table" && !value.rows && !value.dataKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Tables must include either rows data or a dataKey to populate them.",
      path: ["rows"],
    });
  }

  if (value.type === "list" && !value.items && !value.itemsKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Lists must include either items or an itemsKey to populate them.",
      path: ["items"],
    });
  }

  if (value.type === "stat") {
    const hasCollection = Array.isArray(value.stats) && value.stats.length > 0;
    const hasMetricValue =
      typeof value.metric === "string" || typeof value.valueKey === "string";
    if (!hasCollection && !hasMetricValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Stats must provide either a stats collection or a metric/valueKey pair.",
        path: ["metric"],
      });
    }
  }
});

const layoutSectionSchema = z.object({
  zone: z
    .enum(["hero", "main", "sidebar", "footer"])
    .describe("Where this group is shown"),
  intent: z
    .enum(["overview", "insight", "action", "detail"])
    .describe("Purpose of the zone"),
  components: z.array(componentSchema).min(1),
});

const generativeUiSchema = z.object({
  persona: z.string().describe("Persona this UI configuration targets"),
  narrative: z
    .string()
    .describe("One paragraph story for how the UI should be used"),
  theme: z.object({
    mood: z.enum(["optimistic", "neutral", "urgent", "celebratory"]),
    accentColor: z.string().describe("Tailwind color token to emphasize"),
    density: z.enum(["comfortable", "compact", "cozy"]),
  }),
  layout: z.array(layoutSectionSchema).min(1),
  dataRequirements: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        freshness: z.string(),
        sourceOfTruth: z.string(),
      }),
    )
    .describe("Data required to render the UI"),
});

const llmWithUiSchema = llm.withStructuredOutput(generativeUiSchema);

export async function generateGenerativeUiBlueprint(context) {
  const messages = [
    new SystemMessage(
      "You are a product designer collaborating with an engineer. Produce JSON describing a configurable UI using only the allowed component types.",
    ),
    new HumanMessage(
      `Create a UI blueprint using cards, tables, lists, and stat components. Focus on clarity and include narrative context. Scenario: ${context}`,
    ),
  ];

  return llmWithUiSchema.invoke(messages);
}

generateGenerativeUiBlueprint("A chatbot for a customer support team").then(
  (res) => {
    console.log(res);
  },
);
