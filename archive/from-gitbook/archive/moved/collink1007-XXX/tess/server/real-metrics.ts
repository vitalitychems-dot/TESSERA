let _counter = 0;
export const generateId = (prefix = "id") => `${prefix}-${Date.now()}-${++_counter}`;
export const getRealSystemMetrics = () => ({
  uptime: process.uptime(),
  memory: process.memoryUsage(),
  cpu: process.cpuUsage(),
  timestamp: Date.now(),
});
export const logAgentActivity = (agentId: string, activity: string) => {
  console.log(`[AgentActivity] ${agentId}: ${activity}`);
};
