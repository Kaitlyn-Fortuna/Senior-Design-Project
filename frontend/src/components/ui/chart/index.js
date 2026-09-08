import { createContext } from "reka-ui";

export { default as ChartContainer } from "./ChartContainer.vue";
export { default as ChartLegendContent } from "./ChartLegendContent.vue";
export { default as ChartTooltipContent } from "./ChartTooltipContent.vue";
export { componentToString } from "./utils";

// Format: { THEME_NAME: CSS_SELECTOR }
export const THEMES = { light: "", dark: ".dark" };

export const [useChart, provideChartContext] = createContext("Chart");

export {
  VisCrosshair as ChartCrosshair,
  VisTooltip as ChartTooltip,
} from "@unovis/vue";
