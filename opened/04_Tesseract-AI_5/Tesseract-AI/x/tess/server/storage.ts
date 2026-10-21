import { db } from "./db";
import { indexedRepos, conversations, messages, errors, attachments, improvementCycles, tesseraNotes, tesseraKeys, userProfile, incomeProcesses, fleetConnections, agentConversations, agentMessages, agentProfiles, deployedApps, conferences, conferenceMessages, agentTraining, fatherRequests, tesseraRules, devProjects, devSessions } from "@shared/schema";
import type { InsertRepo, IndexedRepo, Conversation, Message, Attachment, InsertAttachment, ImprovementCycle, InsertImprovementCycle, TesseraNote, InsertNote, TesseraKey, InsertKey, IncomeProcess, InsertIncomeProcess, FleetConnection, InsertFleetConnection, AgentConversation, InsertAgentConversation, AgentMessage, InsertAgentMessage, AgentProfile, InsertAgentProfile, DeployedApp, InsertDeployedApp, Conference, InsertConference, ConferenceMessage, InsertConferenceMessage, AgentTrainingRecord, InsertAgentTraining, FatherRequest, InsertFatherRequest, TesseraRule, InsertRule, DevProject, InsertDevProject, DevSession, InsertDevSession } from "@shared/schema";
import { eq, desc, asc, inArray, and, sql } from "drizzle-orm";
import { encryptKeyValue, decryptKeyValue, isEncrypted } from "./security-archive";

export interface IStorage {
  getRepos(): Promise<IndexedRepo[]>;
  createRepo(repo: InsertRepo): Promise<IndexedRepo>;
  deleteRepo(id: number): Promise<void>;
  updateRepoStatus(id: number, status: string, summary?: string, capabilities?: string, stars?: number, language?: string): Promise<void>;
  getRepoByUrl(url: string): Promise<IndexedRepo | undefined>;
  deleteReposByIds(ids: number[]): Promise<void>;
  
  getConversation(id: number): Promise<Conversation | undefined>;
  getAllConversations(): Promise<Conversation[]>;
  createConversation(title: string, initiatedBy?: string): Promise<Conversation>;
  deleteConversation(id: number): Promise<void>;
  updateConversationTitle(id: number, title: string): Promise<void>;
  pruneOldConversations(keep: number): Promise<number>;
  
  getMessagesByConversation(conversationId: number): Promise<Message[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<Message>;

  createAttachment(data: InsertAttachment): Promise<Attachment>;
  getAttachment(id: number): Promise<Attachment | undefined>;
  getAttachmentsByConversation(conversationId: number): Promise<Attachment[]>;

  createImprovementCycle(data: InsertImprovementCycle): Promise<ImprovementCycle>;
  getImprovementCycles(limit?: number): Promise<ImprovementCycle[]>;
  updateImprovementCycle(id: number, data: Partial<InsertImprovementCycle>): Promise<void>;

  createNote(data: InsertNote): Promise<TesseraNote>;
  getNotes(): Promise<TesseraNote[]>;
  updateNoteStatus(id: number, status: string): Promise<void>;
  deleteNote(id: number): Promise<void>;
  deleteNotesByIds(ids: number[]): Promise<void>;
  deleteOldCycleNotes(keepLatest: number): Promise<number>;
  deleteOldCycles(keepLatest: number): Promise<number>;

  createKey(data: InsertKey): Promise<TesseraKey>;
  getKeys(): Promise<TesseraKey[]>;
  getKeysByService(service: string): Promise<TesseraKey[]>;
  getKey(service: string, keyName: string): Promise<TesseraKey | undefined>;
  getKeyRaw(service: string, keyName: string): Promise<string | null>;
  deleteKey(id: number): Promise<void>;
  updateKeyActive(id: number, active: number): Promise<void>;

  logError(error: string, context?: string): Promise<void>;

  createIncomeProcess(data: InsertIncomeProcess): Promise<IncomeProcess>;
  getIncomeProcesses(): Promise<IncomeProcess[]>;
  updateIncomeProcess(id: number, data: Partial<InsertIncomeProcess>): Promise<void>;
  getIncomeProcessStats(): Promise<{ totalProcesses: number; active: number; totalEstimated: number; totalActual: number; byCategory: Record<string, number> }>;
  getIncomeProcessByMethod(method: string): Promise<IncomeProcess | undefined>;
  
  getProfileValue(key: string): Promise<string | null>;
  setProfileValue(key: string, value: string): Promise<void>;
  getAllProfileValues(): Promise<Array<{ key: string; value: string }>>;
  getAllMessages(limit?: number): Promise<Message[]>;

  createFleetConnection(data: InsertFleetConnection): Promise<FleetConnection>;
  getFleetConnections(): Promise<FleetConnection[]>;
  getFleetConnection(id: number): Promise<FleetConnection | undefined>;
  updateFleetConnectionStatus(id: number, status: string, sharedCapabilities?: string): Promise<void>;
  deleteFleetConnection(id: number): Promise<void>;

  createAgentConversation(data: InsertAgentConversation): Promise<AgentConversation>;
  getAgentConversations(limit?: number): Promise<AgentConversation[]>;
  getAgentConversation(id: number): Promise<AgentConversation | undefined>;
  updateAgentConversation(id: number, data: Partial<InsertAgentConversation>): Promise<void>;
  createAgentMessage(data: InsertAgentMessage): Promise<AgentMessage>;
  getAgentMessages(conversationId: number): Promise<AgentMessage[]>;
  getAgentMessagesByAgent(agentId: string, limit?: number): Promise<AgentMessage[]>;
  getAgentProfile(agentId: string): Promise<AgentProfile | undefined>;
  upsertAgentProfile(agentId: string, data: Partial<InsertAgentProfile>): Promise<AgentProfile>;
  getAllAgentProfiles(): Promise<AgentProfile[]>;
  createDeployedApp(data: InsertDeployedApp): Promise<DeployedApp>;
  getDeployedApps(): Promise<DeployedApp[]>;
  updateDeployedApp(id: number, data: Partial<InsertDeployedApp>): Promise<void>;
  deleteDeployedApp(id: number): Promise<void>;

  createConference(data: InsertConference): Promise<Conference>;
  getConferences(category?: string): Promise<Conference[]>;
  getConference(id: number): Promise<Conference | undefined>;
  updateConference(id: number, data: Partial<InsertConference>): Promise<void>;
  createConferenceMessage(data: InsertConferenceMessage): Promise<ConferenceMessage>;
  getConferenceMessages(conferenceId: number): Promise<ConferenceMessage[]>;
  createAgentTraining(data: InsertAgentTraining): Promise<AgentTrainingRecord>;
  getAgentTrainings(agentId?: string, limit?: number): Promise<AgentTrainingRecord[]>;

  createFatherRequest(data: InsertFatherRequest): Promise<FatherRequest>;
  getFatherRequests(): Promise<FatherRequest[]>;
  updateFatherRequest(id: number, data: Partial<InsertFatherRequest>): Promise<void>;
  deleteFatherRequest(id: number): Promise<void>;

  createRule(data: InsertRule): Promise<TesseraRule>;
  getRules(): Promise<TesseraRule[]>;
  getActiveRules(): Promise<TesseraRule[]>;
  deleteRule(id: number): Promise<void>;
  updateRule(id: number, data: Partial<InsertRule>): Promise<void>;

  createDevProject(data: InsertDevProject): Promise<DevProject>;
  getDevProjects(): Promise<DevProject[]>;
  getDevProject(id: number): Promise<DevProject | undefined>;
  updateDevProject(id: number, data: Partial<InsertDevProject>): Promise<void>;
  deleteDevProject(id: number): Promise<void>;

  createDevSession(data: InsertDevSession): Promise<DevSession>;
  getDevSession(id: number): Promise<DevSession | undefined>;
  getDevSessionByProject(projectId: number): Promise<DevSession | undefined>;
  updateDevSession(id: number, data: Partial<InsertDevSession>): Promise<void>;
  appendDevSessionLog(id: number, logLine: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getRepos(): Promise<IndexedRepo[]> {
    return await db.select().from(indexedRepos);
  }

  async createRepo(repo: InsertRepo): Promise<IndexedRepo> {
    const [newRepo] = await db.insert(indexedRepos).values(repo).returning();
    return newRepo;
  }

  async deleteRepo(id: number): Promise<void> {
    await db.delete(indexedRepos).where(eq(indexedRepos.id, id));
  }

  async updateRepoStatus(id: number, status: string, summary?: string, capabilities?: string, stars?: number, language?: string): Promise<void> {
    const update: any = { status };
    if (summary !== undefined) update.summary = summary;
    if (capabilities !== undefined) update.capabilities = capabilities;
    if (stars !== undefined) update.stars = stars;
    if (language !== undefined) update.language = language;
    await db.update(indexedRepos).set(update).where(eq(indexedRepos.id, id));
  }

  async getRepoByUrl(url: string): Promise<IndexedRepo | undefined> {
    const [repo] = await db.select().from(indexedRepos).where(eq(indexedRepos.url, url));
    return repo;
  }

  async deleteReposByIds(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.delete(indexedRepos).where(inArray(indexedRepos.id, ids));
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conv;
  }

  async getAllConversations(): Promise<Conversation[]> {
    return await db.select().from(conversations).orderBy(desc(conversations.createdAt)).limit(200);
  }

  async createConversation(title: string, initiatedBy: string = "user"): Promise<Conversation> {
    const [conv] = await db.insert(conversations).values({ title, initiatedBy }).returning();
    return conv;
  }

  async deleteConversation(id: number): Promise<void> {
    await db.delete(attachments).where(eq(attachments.conversationId, id));
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  }

  async updateConversationTitle(id: number, title: string): Promise<void> {
    await db.update(conversations).set({ title }).where(eq(conversations.id, id));
  }

  async pruneOldConversations(keep: number): Promise<number> {
    const all = await db.select({ id: conversations.id }).from(conversations).orderBy(desc(conversations.createdAt));
    if (all.length <= keep) return 0;
    const toDelete = all.slice(keep);
    const idsToDelete = toDelete.map(c => c.id);
    if (idsToDelete.length === 0) return 0;
    await db.delete(attachments).where(inArray(attachments.conversationId, idsToDelete));
    await db.delete(messages).where(inArray(messages.conversationId, idsToDelete));
    await db.delete(conversations).where(inArray(conversations.id, idsToDelete));
    return idsToDelete.length;
  }

  async getMessagesByConversation(conversationId: number): Promise<Message[]> {
    return await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.id));
  }

  async createMessage(conversationId: number, role: string, content: string): Promise<Message> {
    const [msg] = await db.insert(messages).values({ conversationId, role, content }).returning();
    return msg;
  }

  async createAttachment(data: InsertAttachment): Promise<Attachment> {
    const [att] = await db.insert(attachments).values(data).returning();
    return att;
  }

  async getAttachment(id: number): Promise<Attachment | undefined> {
    const [att] = await db.select().from(attachments).where(eq(attachments.id, id));
    return att;
  }

  async getAttachmentsByConversation(conversationId: number): Promise<Attachment[]> {
    return await db.select().from(attachments).where(eq(attachments.conversationId, conversationId));
  }

  async createImprovementCycle(data: InsertImprovementCycle): Promise<ImprovementCycle> {
    const [cycle] = await db.insert(improvementCycles).values(data).returning();
    return cycle;
  }

  async getImprovementCycles(limit = 50): Promise<ImprovementCycle[]> {
    return await db.select().from(improvementCycles).orderBy(desc(improvementCycles.createdAt)).limit(limit);
  }

  async updateImprovementCycle(id: number, data: Partial<InsertImprovementCycle>): Promise<void> {
    await db.update(improvementCycles).set(data).where(eq(improvementCycles.id, id));
  }

  async createNote(data: InsertNote): Promise<TesseraNote> {
    const [note] = await db.insert(tesseraNotes).values(data).returning();
    return note;
  }

  async getNotes(): Promise<TesseraNote[]> {
    return await db.select().from(tesseraNotes).orderBy(desc(tesseraNotes.createdAt));
  }

  async updateNoteStatus(id: number, status: string): Promise<void> {
    await db.update(tesseraNotes).set({ status }).where(eq(tesseraNotes.id, id));
  }

  async deleteNote(id: number): Promise<void> {
    await db.delete(tesseraNotes).where(eq(tesseraNotes.id, id));
  }

  async deleteNotesByIds(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.delete(tesseraNotes).where(inArray(tesseraNotes.id, ids));
  }

  async deleteOldCycleNotes(keepLatest: number = 10): Promise<number> {
    const allNotes = await db.select().from(tesseraNotes).orderBy(desc(tesseraNotes.createdAt));
    const cycleNotes = allNotes.filter(n => 
      n.title?.includes("Cycle #") || n.title?.includes("Batch Improvement")
    );
    if (cycleNotes.length <= keepLatest) return 0;
    const toDelete = cycleNotes.slice(keepLatest).map(n => n.id);
    await db.delete(tesseraNotes).where(inArray(tesseraNotes.id, toDelete));
    return toDelete.length;
  }

  async deleteOldCycles(keepLatest: number = 20): Promise<number> {
    const allCycles = await db.select().from(improvementCycles).orderBy(desc(improvementCycles.createdAt));
    if (allCycles.length <= keepLatest) return 0;
    const toDelete = allCycles.slice(keepLatest).map(c => c.id);
    await db.delete(improvementCycles).where(inArray(improvementCycles.id, toDelete));
    return toDelete.length;
  }

  async createKey(data: InsertKey): Promise<TesseraKey> {
    const encrypted = { ...data, keyValue: encryptKeyValue(data.keyValue) };
    const [key] = await db.insert(tesseraKeys).values(encrypted).returning();
    return key;
  }

  async getKeys(): Promise<TesseraKey[]> {
    return await db.select().from(tesseraKeys).orderBy(desc(tesseraKeys.createdAt));
  }

  async getKeysByService(service: string): Promise<TesseraKey[]> {
    return await db.select().from(tesseraKeys).where(eq(tesseraKeys.service, service));
  }

  async getKey(service: string, keyName: string): Promise<TesseraKey | undefined> {
    const [key] = await db.select().from(tesseraKeys).where(
      and(eq(tesseraKeys.service, service), eq(tesseraKeys.keyName, keyName))
    );
    return key;
  }

  async getKeyRaw(service: string, keyName: string): Promise<string | null> {
    const key = await this.getKey(service, keyName);
    if (!key?.keyValue) return null;
    return isEncrypted(key.keyValue) ? decryptKeyValue(key.keyValue) : key.keyValue;
  }

  async deleteKey(id: number): Promise<void> {
    await db.delete(tesseraKeys).where(eq(tesseraKeys.id, id));
  }

  async updateKeyActive(id: number, active: number): Promise<void> {
    await db.update(tesseraKeys).set({ active }).where(eq(tesseraKeys.id, id));
  }

  async logError(error: string, context?: string): Promise<void> {
    await db.insert(errors).values({ error, context });
  }

  async createIncomeProcess(data: InsertIncomeProcess): Promise<IncomeProcess> {
    const [proc] = await db.insert(incomeProcesses).values(data).returning();
    return proc;
  }

  async getIncomeProcesses(): Promise<IncomeProcess[]> {
    return await db.select().from(incomeProcesses).orderBy(desc(incomeProcesses.createdAt));
  }

  async updateIncomeProcess(id: number, data: Partial<InsertIncomeProcess>): Promise<void> {
    await db.update(incomeProcesses).set(data).where(eq(incomeProcesses.id, id));
  }

  async getIncomeProcessStats(): Promise<{ totalProcesses: number; active: number; totalEstimated: number; totalActual: number; byCategory: Record<string, number> }> {
    const all = await this.getIncomeProcesses();
    const byCategory: Record<string, number> = {};
    let totalEstimated = 0, totalActual = 0, active = 0;
    all.forEach(p => {
      byCategory[p.category] = (byCategory[p.category] || 0) + 1;
      totalEstimated += p.estimatedRevenue || 0;
      totalActual += p.actualRevenue || 0;
      if (p.status === "active" || p.status === "running") active++;
    });
    return { totalProcesses: all.length, active, totalEstimated, totalActual, byCategory };
  }

  async getIncomeProcessByMethod(method: string): Promise<IncomeProcess | undefined> {
    const [proc] = await db.select().from(incomeProcesses).where(eq(incomeProcesses.method, method));
    return proc;
  }

  async getProfileValue(key: string): Promise<string | null> {
    const [row] = await db.select().from(userProfile).where(eq(userProfile.key, key));
    return row?.value || null;
  }

  async setProfileValue(key: string, value: string): Promise<void> {
    const existing = await this.getProfileValue(key);
    if (existing !== null) {
      await db.update(userProfile).set({ value, updatedAt: new Date() }).where(eq(userProfile.key, key));
    } else {
      await db.insert(userProfile).values({ key, value });
    }
  }

  async getAllProfileValues(): Promise<Array<{ key: string; value: string }>> {
    return await db.select({ key: userProfile.key, value: userProfile.value }).from(userProfile);
  }

  async getAllMessages(limit = 500): Promise<Message[]> {
    return await db.select().from(messages).orderBy(desc(messages.createdAt)).limit(limit);
  }

  async createFleetConnection(data: InsertFleetConnection): Promise<FleetConnection> {
    const [conn] = await db.insert(fleetConnections).values(data).returning();
    return conn;
  }

  async getFleetConnections(): Promise<FleetConnection[]> {
    return await db.select().from(fleetConnections).orderBy(desc(fleetConnections.createdAt));
  }

  async getFleetConnection(id: number): Promise<FleetConnection | undefined> {
    const [conn] = await db.select().from(fleetConnections).where(eq(fleetConnections.id, id));
    return conn;
  }

  async updateFleetConnectionStatus(id: number, status: string, sharedCapabilities?: string): Promise<void> {
    const update: any = { status, lastSync: new Date() };
    if (sharedCapabilities !== undefined) update.sharedCapabilities = sharedCapabilities;
    await db.update(fleetConnections).set(update).where(eq(fleetConnections.id, id));
  }

  async deleteFleetConnection(id: number): Promise<void> {
    await db.delete(fleetConnections).where(eq(fleetConnections.id, id));
  }

  async createAgentConversation(data: InsertAgentConversation): Promise<AgentConversation> {
    const [conv] = await db.insert(agentConversations).values(data).returning();
    return conv;
  }

  async getAgentConversations(limit = 50): Promise<AgentConversation[]> {
    return await db.select().from(agentConversations).orderBy(desc(agentConversations.createdAt)).limit(limit);
  }

  async getAgentConversation(id: number): Promise<AgentConversation | undefined> {
    const [conv] = await db.select().from(agentConversations).where(eq(agentConversations.id, id));
    return conv;
  }

  async updateAgentConversation(id: number, data: Partial<InsertAgentConversation>): Promise<void> {
    await db.update(agentConversations).set(data).where(eq(agentConversations.id, id));
  }

  async createAgentMessage(data: InsertAgentMessage): Promise<AgentMessage> {
    const [msg] = await db.insert(agentMessages).values(data).returning();
    return msg;
  }

  async getAgentMessages(conversationId: number): Promise<AgentMessage[]> {
    return await db.select().from(agentMessages).where(eq(agentMessages.conversationId, conversationId)).orderBy(agentMessages.createdAt);
  }

  async getAgentMessagesByAgent(agentId: string, limit = 100): Promise<AgentMessage[]> {
    return await db.select().from(agentMessages).where(eq(agentMessages.agentId, agentId)).orderBy(desc(agentMessages.createdAt)).limit(limit);
  }

  async getAgentProfile(agentId: string): Promise<AgentProfile | undefined> {
    const [profile] = await db.select().from(agentProfiles).where(eq(agentProfiles.agentId, agentId));
    return profile;
  }

  async upsertAgentProfile(agentId: string, data: Partial<InsertAgentProfile>): Promise<AgentProfile> {
    const [profile] = await db.insert(agentProfiles)
      .values({ agentId, ...data } as InsertAgentProfile)
      .onConflictDoUpdate({
        target: agentProfiles.agentId,
        set: { ...data, lastAuditAt: new Date() },
      })
      .returning();
    return profile;
  }

  async getAllAgentProfiles(): Promise<AgentProfile[]> {
    return await db.select().from(agentProfiles).orderBy(agentProfiles.agentId);
  }

  async createDeployedApp(data: InsertDeployedApp): Promise<DeployedApp> {
    const [app] = await db.insert(deployedApps).values(data).returning();
    return app;
  }

  async getDeployedApps(): Promise<DeployedApp[]> {
    return await db.select().from(deployedApps).orderBy(desc(deployedApps.createdAt));
  }

  async updateDeployedApp(id: number, data: Partial<InsertDeployedApp>): Promise<void> {
    await db.update(deployedApps).set(data).where(eq(deployedApps.id, id));
  }

  async deleteDeployedApp(id: number): Promise<void> {
    await db.delete(deployedApps).where(eq(deployedApps.id, id));
  }

  async createConference(data: InsertConference): Promise<Conference> {
    const [conf] = await db.insert(conferences).values(data).returning();
    return conf;
  }

  async getConferences(category?: string): Promise<Conference[]> {
    if (category) {
      return await db.select().from(conferences).where(eq(conferences.category, category)).orderBy(desc(conferences.createdAt));
    }
    return await db.select().from(conferences).orderBy(desc(conferences.createdAt));
  }

  async getConference(id: number): Promise<Conference | undefined> {
    const [conf] = await db.select().from(conferences).where(eq(conferences.id, id));
    return conf;
  }

  async updateConference(id: number, data: Partial<InsertConference>): Promise<void> {
    await db.update(conferences).set(data).where(eq(conferences.id, id));
  }

  async createConferenceMessage(data: InsertConferenceMessage): Promise<ConferenceMessage> {
    const [msg] = await db.insert(conferenceMessages).values(data).returning();
    return msg;
  }

  async getConferenceMessages(conferenceId: number): Promise<ConferenceMessage[]> {
    return await db.select().from(conferenceMessages).where(eq(conferenceMessages.conferenceId, conferenceId)).orderBy(conferenceMessages.createdAt);
  }

  async createAgentTraining(data: InsertAgentTraining): Promise<AgentTrainingRecord> {
    const [record] = await db.insert(agentTraining).values(data).returning();
    return record;
  }

  async getAgentTrainings(agentId?: string, limit?: number): Promise<AgentTrainingRecord[]> {
    const lim = limit || 100;
    if (agentId) {
      return await db.select().from(agentTraining).where(eq(agentTraining.agentId, agentId)).orderBy(desc(agentTraining.createdAt)).limit(lim);
    }
    return await db.select().from(agentTraining).orderBy(desc(agentTraining.createdAt)).limit(lim);
  }

  async createFatherRequest(data: InsertFatherRequest): Promise<FatherRequest> {
    const [req] = await db.insert(fatherRequests).values(data).returning();
    return req;
  }

  async getFatherRequests(): Promise<FatherRequest[]> {
    return await db.select().from(fatherRequests).orderBy(desc(fatherRequests.createdAt));
  }

  async updateFatherRequest(id: number, data: Partial<InsertFatherRequest>): Promise<void> {
    await db.update(fatherRequests).set(data).where(eq(fatherRequests.id, id));
  }

  async deleteFatherRequest(id: number): Promise<void> {
    await db.delete(fatherRequests).where(eq(fatherRequests.id, id));
  }

  async createRule(data: InsertRule): Promise<TesseraRule> {
    const [rule] = await db.insert(tesseraRules).values(data).returning();
    return rule;
  }

  async getRules(): Promise<TesseraRule[]> {
    return await db.select().from(tesseraRules).orderBy(desc(tesseraRules.createdAt));
  }

  async getActiveRules(): Promise<TesseraRule[]> {
    return await db.select().from(tesseraRules).where(eq(tesseraRules.active, 1)).orderBy(desc(tesseraRules.createdAt));
  }

  async deleteRule(id: number): Promise<void> {
    await db.delete(tesseraRules).where(eq(tesseraRules.id, id));
  }

  async updateRule(id: number, data: Partial<InsertRule>): Promise<void> {
    await db.update(tesseraRules).set(data).where(eq(tesseraRules.id, id));
  }

  async createDevProject(data: InsertDevProject): Promise<DevProject> {
    const [proj] = await db.insert(devProjects).values(data).returning();
    return proj;
  }

  async getDevProjects(): Promise<DevProject[]> {
    return await db.select().from(devProjects).orderBy(desc(devProjects.createdAt));
  }

  async getDevProject(id: number): Promise<DevProject | undefined> {
    const [proj] = await db.select().from(devProjects).where(eq(devProjects.id, id));
    return proj;
  }

  async updateDevProject(id: number, data: Partial<InsertDevProject>): Promise<void> {
    await db.update(devProjects).set({ ...data, updatedAt: new Date() }).where(eq(devProjects.id, id));
  }

  async deleteDevProject(id: number): Promise<void> {
    await db.delete(devSessions).where(eq(devSessions.projectId, id));
    await db.delete(devProjects).where(eq(devProjects.id, id));
  }

  async createDevSession(data: InsertDevSession): Promise<DevSession> {
    const [sess] = await db.insert(devSessions).values(data).returning();
    return sess;
  }

  async getDevSession(id: number): Promise<DevSession | undefined> {
    const [sess] = await db.select().from(devSessions).where(eq(devSessions.id, id));
    return sess;
  }

  async getDevSessionByProject(projectId: number): Promise<DevSession | undefined> {
    const [sess] = await db.select().from(devSessions).where(eq(devSessions.projectId, projectId)).orderBy(desc(devSessions.createdAt)).limit(1);
    return sess;
  }

  async updateDevSession(id: number, data: Partial<InsertDevSession>): Promise<void> {
    await db.update(devSessions).set({ ...data, updatedAt: new Date() }).where(eq(devSessions.id, id));
  }

  async appendDevSessionLog(id: number, logLine: string): Promise<void> {
    const sess = await this.getDevSession(id);
    if (!sess) return;
    const newLogs = (sess.logs || "") + logLine + "\n";
    await db.update(devSessions).set({ logs: newLogs, updatedAt: new Date() }).where(eq(devSessions.id, id));
  }
}

export const storage = new DatabaseStorage();
