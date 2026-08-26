import init, * as agent from "./pkg/agent.js";

await init();

export const greet = agent.greet;
