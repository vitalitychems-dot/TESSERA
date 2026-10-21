const state = { workingMemory: [] as any[], episodicMemory: [] as any[], proceduralMemory: [] as any[], attentionFocus: "general" };
export const getCognitiveState = () => ({ ...state, status: "active" });
export const getMemoryStats = () => ({ working: state.workingMemory.length, episodic: state.episodicMemory.length, procedural: state.proceduralMemory.length });
export const addToWorkingMemory = (item: any) => { state.workingMemory.push(item); if (state.workingMemory.length > 100) state.workingMemory.shift(); };
export const storeEpisodicMemory = (item: any) => { state.episodicMemory.push(item); if (state.episodicMemory.length > 500) state.episodicMemory.shift(); };
export const storeProcedural = (item: any) => { state.proceduralMemory.push(item); if (state.proceduralMemory.length > 200) state.proceduralMemory.shift(); };
export const recall = (query: string) => {
  const all = [...state.workingMemory, ...state.episodicMemory, ...state.proceduralMemory];
  return all.filter(m => JSON.stringify(m).toLowerCase().includes(query.toLowerCase())).slice(-5);
};
export const runConsolidationCycle = () => ({ consolidated: state.episodicMemory.length, timestamp: Date.now() });
export const setAttentionFocus = (focus: string) => { state.attentionFocus = focus; };
