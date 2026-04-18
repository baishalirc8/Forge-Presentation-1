import {
  type Partner, type InsertPartner,
  type Assessment, type InsertAssessment,
  type Activity, type InsertActivity,
  type User, type InsertUser,
  type Artifact, type InsertArtifact,
  type PartnerArtifact, type InsertPartnerArtifact,
  type VerticalConfig, type InsertVerticalConfig,
  type PartnerDocument, type InsertPartnerDocument,
  type Capability, type InsertCapability,
  type SubCapability, type InsertSubCapability,
  type PartnerCapability, type InsertPartnerCapability,
  type AssessmentFeedback, type InsertAssessmentFeedback,
  type Resource, type InsertResource,
  type Event, type InsertEvent,
  partners, assessments, activities, users, artifacts, partnerArtifacts, verticalConfigs, partnerDocuments,
  capabilities, subCapabilities, partnerCapabilities, assessmentFeedback, resources, events
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, isNull, isNotNull } from "drizzle-orm";

export interface IStorage {
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;

  getPartners(): Promise<Partner[]>;
  getPartner(id: string): Promise<Partner | undefined>;
  createPartner(partner: InsertPartner): Promise<Partner>;
  updatePartner(id: string, data: Partial<InsertPartner>): Promise<Partner | undefined>;
  deletePartner(id: string): Promise<void>;

  getAssessments(partnerId: string): Promise<Assessment[]>;
  getAllAssessments(): Promise<Assessment[]>;
  getAssessment(id: string): Promise<Assessment | undefined>;
  createAssessment(assessment: InsertAssessment): Promise<Assessment>;
  updateAssessment(id: string, data: Partial<InsertAssessment>): Promise<Assessment | undefined>;

  getActivities(partnerId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  getArtifacts(vertical?: string): Promise<Artifact[]>;
  getArtifact(id: string): Promise<Artifact | undefined>;
  createArtifact(artifact: InsertArtifact): Promise<Artifact>;
  updateArtifact(id: string, data: Partial<InsertArtifact>): Promise<Artifact | undefined>;
  deleteArtifact(id: string): Promise<void>;

  getPartnerArtifacts(partnerId: string): Promise<PartnerArtifact[]>;
  getPartnerArtifact(id: string): Promise<PartnerArtifact | undefined>;
  getPartnerArtifactByIds(partnerId: string, artifactId: string): Promise<PartnerArtifact | undefined>;
  createPartnerArtifact(pa: InsertPartnerArtifact): Promise<PartnerArtifact>;
  updatePartnerArtifact(id: string, data: Partial<InsertPartnerArtifact>): Promise<PartnerArtifact | undefined>;

  getVerticalConfigs(): Promise<VerticalConfig[]>;
  upsertVerticalConfig(config: InsertVerticalConfig): Promise<VerticalConfig>;

  getPartnerDocuments(partnerId: string, partnerArtifactId?: string): Promise<PartnerDocument[]>;
  getPartnerDocument(id: string): Promise<PartnerDocument | undefined>;
  createPartnerDocument(doc: InsertPartnerDocument): Promise<PartnerDocument>;
  updatePartnerDocument(id: string, data: Partial<PartnerDocument>): Promise<PartnerDocument | undefined>;
  deletePartnerDocument(id: string): Promise<void>;

  getCapabilities(): Promise<Capability[]>;
  getCapability(id: string): Promise<Capability | undefined>;
  createCapability(cap: InsertCapability): Promise<Capability>;
  updateCapability(id: string, data: Partial<InsertCapability>): Promise<Capability | undefined>;
  deleteCapability(id: string): Promise<void>;

  getSubCapabilities(capabilityId: string): Promise<SubCapability[]>;
  getSubCapability(id: string): Promise<SubCapability | undefined>;
  createSubCapability(sub: InsertSubCapability): Promise<SubCapability>;
  updateSubCapability(id: string, data: Partial<InsertSubCapability>): Promise<SubCapability | undefined>;
  deleteSubCapability(id: string): Promise<void>;

  getPartnerCapabilities(partnerId: string): Promise<PartnerCapability[]>;
  getAllPartnerCapabilities(): Promise<PartnerCapability[]>;
  getPartnerCapability(id: string): Promise<PartnerCapability | undefined>;
  createPartnerCapability(cap: InsertPartnerCapability): Promise<PartnerCapability>;
  updatePartnerCapability(id: string, data: Partial<InsertPartnerCapability>): Promise<PartnerCapability | undefined>;
  deletePartnerCapability(id: string): Promise<void>;
  restorePartnerCapability(id: string): Promise<PartnerCapability | undefined>;
  getDeletedPartnerCapabilities(partnerId?: string): Promise<PartnerCapability[]>;

  getAssessmentFeedback(partnerCapabilityId: string): Promise<AssessmentFeedback[]>;
  createAssessmentFeedback(fb: InsertAssessmentFeedback): Promise<AssessmentFeedback>;

  getResources(): Promise<Resource[]>;
  getResource(id: string): Promise<Resource | undefined>;
  createResource(resource: InsertResource): Promise<Resource>;
  deleteResource(id: string): Promise<void>;

  getEvents(): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, data: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getPartners(): Promise<Partner[]> {
    return db.select().from(partners).orderBy(desc(partners.createdAt));
  }

  async getPartner(id: string): Promise<Partner | undefined> {
    const [partner] = await db.select().from(partners).where(eq(partners.id, id));
    return partner;
  }

  async createPartner(partner: InsertPartner): Promise<Partner> {
    const [created] = await db.insert(partners).values(partner).returning();
    return created;
  }

  async updatePartner(id: string, data: Partial<InsertPartner>): Promise<Partner | undefined> {
    const [updated] = await db.update(partners).set(data).where(eq(partners.id, id)).returning();
    return updated;
  }

  async deletePartner(id: string): Promise<void> {
    await db.delete(partners).where(eq(partners.id, id));
  }

  async getAssessments(partnerId: string): Promise<Assessment[]> {
    return db.select().from(assessments).where(eq(assessments.partnerId, partnerId)).orderBy(desc(assessments.updatedAt));
  }

  async getAllAssessments(): Promise<Assessment[]> {
    return db.select().from(assessments).orderBy(desc(assessments.updatedAt));
  }

  async getAssessment(id: string): Promise<Assessment | undefined> {
    const [assessment] = await db.select().from(assessments).where(eq(assessments.id, id));
    return assessment;
  }

  async createAssessment(assessment: InsertAssessment): Promise<Assessment> {
    const [created] = await db.insert(assessments).values(assessment).returning();
    return created;
  }

  async updateAssessment(id: string, data: Partial<InsertAssessment>): Promise<Assessment | undefined> {
    const [updated] = await db.update(assessments).set(data).where(eq(assessments.id, id)).returning();
    return updated;
  }

  async getActivities(partnerId: string): Promise<Activity[]> {
    return db.select().from(activities).where(eq(activities.partnerId, partnerId)).orderBy(desc(activities.createdAt));
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [created] = await db.insert(activities).values(activity).returning();
    return created;
  }

  async getArtifacts(vertical?: string): Promise<Artifact[]> {
    if (vertical) {
      return db.select().from(artifacts).where(eq(artifacts.vertical, vertical)).orderBy(artifacts.level);
    }
    return db.select().from(artifacts).orderBy(artifacts.vertical, artifacts.level);
  }

  async getArtifact(id: string): Promise<Artifact | undefined> {
    const [artifact] = await db.select().from(artifacts).where(eq(artifacts.id, id));
    return artifact;
  }

  async createArtifact(artifact: InsertArtifact): Promise<Artifact> {
    const [created] = await db.insert(artifacts).values(artifact).returning();
    return created;
  }

  async updateArtifact(id: string, data: Partial<InsertArtifact>): Promise<Artifact | undefined> {
    const [updated] = await db.update(artifacts).set(data).where(eq(artifacts.id, id)).returning();
    return updated;
  }

  async deleteArtifact(id: string): Promise<void> {
    await db.delete(artifacts).where(eq(artifacts.id, id));
  }

  async getPartnerArtifacts(partnerId: string): Promise<PartnerArtifact[]> {
    return db.select().from(partnerArtifacts).where(eq(partnerArtifacts.partnerId, partnerId));
  }

  async getPartnerArtifact(id: string): Promise<PartnerArtifact | undefined> {
    const [pa] = await db.select().from(partnerArtifacts).where(eq(partnerArtifacts.id, id));
    return pa;
  }

  async getPartnerArtifactByIds(partnerId: string, artifactId: string): Promise<PartnerArtifact | undefined> {
    const [pa] = await db.select().from(partnerArtifacts)
      .where(and(eq(partnerArtifacts.partnerId, partnerId), eq(partnerArtifacts.artifactId, artifactId)));
    return pa;
  }

  async createPartnerArtifact(pa: InsertPartnerArtifact): Promise<PartnerArtifact> {
    const [created] = await db.insert(partnerArtifacts).values(pa).returning();
    return created;
  }

  async updatePartnerArtifact(id: string, data: Partial<InsertPartnerArtifact>): Promise<PartnerArtifact | undefined> {
    const [updated] = await db.update(partnerArtifacts).set(data).where(eq(partnerArtifacts.id, id)).returning();
    return updated;
  }

  async getVerticalConfigs(): Promise<VerticalConfig[]> {
    return db.select().from(verticalConfigs);
  }

  async upsertVerticalConfig(config: InsertVerticalConfig): Promise<VerticalConfig> {
    const existing = await db.select().from(verticalConfigs).where(eq(verticalConfigs.verticalKey, config.verticalKey));
    if (existing.length > 0) {
      const [updated] = await db.update(verticalConfigs)
        .set({ ...config, updatedAt: new Date() })
        .where(eq(verticalConfigs.verticalKey, config.verticalKey))
        .returning();
      return updated;
    }
    const [created] = await db.insert(verticalConfigs).values(config).returning();
    return created;
  }
  async getPartnerDocuments(partnerId: string, partnerArtifactId?: string): Promise<PartnerDocument[]> {
    if (partnerArtifactId) {
      return db.select().from(partnerDocuments)
        .where(and(eq(partnerDocuments.partnerId, partnerId), eq(partnerDocuments.partnerArtifactId, partnerArtifactId)))
        .orderBy(desc(partnerDocuments.uploadedAt));
    }
    return db.select().from(partnerDocuments)
      .where(eq(partnerDocuments.partnerId, partnerId))
      .orderBy(desc(partnerDocuments.uploadedAt));
  }

  async getPartnerDocument(id: string): Promise<PartnerDocument | undefined> {
    const [doc] = await db.select().from(partnerDocuments).where(eq(partnerDocuments.id, id));
    return doc;
  }

  async createPartnerDocument(doc: InsertPartnerDocument): Promise<PartnerDocument> {
    const [created] = await db.insert(partnerDocuments).values(doc).returning();
    return created;
  }

  async updatePartnerDocument(id: string, data: Partial<PartnerDocument>): Promise<PartnerDocument | undefined> {
    const [updated] = await db.update(partnerDocuments).set(data).where(eq(partnerDocuments.id, id)).returning();
    return updated;
  }

  async deletePartnerDocument(id: string): Promise<void> {
    await db.delete(partnerDocuments).where(eq(partnerDocuments.id, id));
  }

  async getCapabilities(): Promise<Capability[]> {
    return db.select().from(capabilities).orderBy(capabilities.sortOrder);
  }

  async getCapability(id: string): Promise<Capability | undefined> {
    const [cap] = await db.select().from(capabilities).where(eq(capabilities.id, id));
    return cap;
  }

  async createCapability(cap: InsertCapability): Promise<Capability> {
    const [created] = await db.insert(capabilities).values(cap).returning();
    return created;
  }

  async updateCapability(id: string, data: Partial<InsertCapability>): Promise<Capability | undefined> {
    const [updated] = await db.update(capabilities).set(data).where(eq(capabilities.id, id)).returning();
    return updated;
  }

  async deleteCapability(id: string): Promise<void> {
    await db.delete(subCapabilities).where(eq(subCapabilities.capabilityId, id));
    await db.delete(capabilities).where(eq(capabilities.id, id));
  }

  async getSubCapabilities(capabilityId: string): Promise<SubCapability[]> {
    return db.select().from(subCapabilities).where(eq(subCapabilities.capabilityId, capabilityId)).orderBy(subCapabilities.sortOrder);
  }

  async getSubCapability(id: string): Promise<SubCapability | undefined> {
    const [sub] = await db.select().from(subCapabilities).where(eq(subCapabilities.id, id));
    return sub;
  }

  async createSubCapability(sub: InsertSubCapability): Promise<SubCapability> {
    const [created] = await db.insert(subCapabilities).values(sub).returning();
    return created;
  }

  async updateSubCapability(id: string, data: Partial<InsertSubCapability>): Promise<SubCapability | undefined> {
    const [updated] = await db.update(subCapabilities).set(data).where(eq(subCapabilities.id, id)).returning();
    return updated;
  }

  async deleteSubCapability(id: string): Promise<void> {
    await db.delete(subCapabilities).where(eq(subCapabilities.id, id));
  }

  async getPartnerCapabilities(partnerId: string): Promise<PartnerCapability[]> {
    return db.select().from(partnerCapabilities).where(and(eq(partnerCapabilities.partnerId, partnerId), isNull(partnerCapabilities.deletedAt))).orderBy(desc(partnerCapabilities.createdAt));
  }

  async getAllPartnerCapabilities(): Promise<PartnerCapability[]> {
    return db.select().from(partnerCapabilities).where(isNull(partnerCapabilities.deletedAt)).orderBy(desc(partnerCapabilities.updatedAt));
  }

  async getPartnerCapability(id: string): Promise<PartnerCapability | undefined> {
    const [cap] = await db.select().from(partnerCapabilities).where(and(eq(partnerCapabilities.id, id), isNull(partnerCapabilities.deletedAt)));
    return cap;
  }

  async createPartnerCapability(cap: InsertPartnerCapability): Promise<PartnerCapability> {
    const [created] = await db.insert(partnerCapabilities).values(cap).returning();
    return created;
  }

  async updatePartnerCapability(id: string, data: Partial<InsertPartnerCapability>): Promise<PartnerCapability | undefined> {
    const [updated] = await db.update(partnerCapabilities).set({ ...data, updatedAt: new Date() }).where(eq(partnerCapabilities.id, id)).returning();
    return updated;
  }

  async deletePartnerCapability(id: string): Promise<void> {
    await db.update(partnerCapabilities).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(partnerCapabilities.id, id));
  }

  async restorePartnerCapability(id: string): Promise<PartnerCapability | undefined> {
    const [restored] = await db.update(partnerCapabilities).set({ deletedAt: null, updatedAt: new Date() }).where(eq(partnerCapabilities.id, id)).returning();
    return restored;
  }

  async getDeletedPartnerCapabilities(partnerId?: string): Promise<PartnerCapability[]> {
    if (partnerId) {
      return db.select().from(partnerCapabilities).where(and(eq(partnerCapabilities.partnerId, partnerId), isNotNull(partnerCapabilities.deletedAt))).orderBy(desc(partnerCapabilities.deletedAt));
    }
    return db.select().from(partnerCapabilities).where(isNotNull(partnerCapabilities.deletedAt)).orderBy(desc(partnerCapabilities.deletedAt));
  }

  async getAssessmentFeedback(partnerCapabilityId: string): Promise<AssessmentFeedback[]> {
    return db.select().from(assessmentFeedback)
      .where(eq(assessmentFeedback.partnerCapabilityId, partnerCapabilityId))
      .orderBy(assessmentFeedback.createdAt);
  }

  async createAssessmentFeedback(fb: InsertAssessmentFeedback): Promise<AssessmentFeedback> {
    const [created] = await db.insert(assessmentFeedback).values(fb).returning();
    return created;
  }

  async getResources(): Promise<Resource[]> {
    return db.select().from(resources).orderBy(desc(resources.createdAt));
  }

  async getResource(id: string): Promise<Resource | undefined> {
    const [r] = await db.select().from(resources).where(eq(resources.id, id));
    return r;
  }

  async createResource(resource: InsertResource): Promise<Resource> {
    const [created] = await db.insert(resources).values(resource).returning();
    return created;
  }

  async deleteResource(id: string): Promise<void> {
    await db.delete(resources).where(eq(resources.id, id));
  }

  async getEvents(): Promise<Event[]> {
    return db.select().from(events).orderBy(events.startDate);
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const [ev] = await db.select().from(events).where(eq(events.id, id));
    return ev;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [created] = await db.insert(events).values(event).returning();
    return created;
  }

  async updateEvent(id: string, data: Partial<InsertEvent>): Promise<Event | undefined> {
    const [updated] = await db.update(events).set(data).where(eq(events.id, id)).returning();
    return updated;
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }
}

export const storage = new DatabaseStorage();
