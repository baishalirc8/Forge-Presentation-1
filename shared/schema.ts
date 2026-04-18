import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const VERTICALS = [
  { key: "BRL", name: "Business Readiness", description: "Legal & Entity Status", priority: 1 },
  { key: "FRL", name: "Financial Readiness", description: "Accounting & Pricing", priority: 1 },
  { key: "PRL", name: "Legal & Policy Readiness", description: "Regulatory Compliance", priority: 1 },
  { key: "CCRL", name: "Contract & Cost Readiness", description: "Pricing & Affordability", priority: 1 },
  { key: "CRL", name: "Cyber Readiness", description: "RMF & Zero-Trust", priority: 2 },
  { key: "TRL", name: "Technology Readiness", description: "Maturity & Prototyping", priority: 2 },
  { key: "SRL", name: "System Readiness", description: "Design & Architecture", priority: 3 },
  { key: "IRL", name: "Integration Readiness", description: "Systems-of-Systems", priority: 3 },
  { key: "HRL", name: "Human Readiness", description: "HF & Usability", priority: 2 },
  { key: "TVRL", name: "Test & Validation Readiness", description: "TEMP & OT&E", priority: 3 },
  { key: "AIRL", name: "AI Readiness", description: "XAI & Ground Truth", priority: 3 },
  { key: "MRL", name: "Manufacturing Readiness", description: "Quality & LRIP", priority: 2 },
  { key: "SCRL", name: "Supply Chain Readiness", description: "SCRM & SBOM", priority: 3 },
  { key: "SFTL", name: "Safety & Environmental", description: "MSDS & Hazard Analysis", priority: 3 },
  { key: "MSNL", name: "Mission Readiness", description: "Combat Validation & OPLAN Entry", priority: 3 },
  { key: "WRL", name: "Workforce Readiness", description: "Clearances & Training", priority: 3 },
  { key: "LDRL", name: "Logistics & Distribution", description: "Packaging & Theater Rehearsal", priority: 3 },
] as const;

export const LEVEL_LABELS: Record<number, string> = {
  1: "Initial",
  2: "Defined",
  3: "Managed",
  4: "Quantified",
  5: "Optimizing",
  6: "Validated",
  7: "Proven",
  8: "Qualified",
  9: "Sustained",
};

export const VERIFICATION_METHODS = ["automatic", "self_attested", "manual_upload"] as const;
export type VerificationMethod = typeof VERIFICATION_METHODS[number];

export const VERIFICATION_LABELS: Record<VerificationMethod, string> = {
  automatic: "Automatic",
  self_attested: "Self Attested",
  manual_upload: "Manual Upload",
};

export type VerticalScores = Record<string, number>;

export const partners = pgTable("partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  uei: text("uei").notNull(),
  cage: text("cage"),
  entityType: text("entity_type"),
  status: text("status").notNull().default("active"),
  overallLevel: integer("overall_level").notNull().default(1),
  scores: jsonb("scores").$type<VerticalScores>().notNull().default({}),
  targetLevel: integer("target_level").notNull().default(5),
  samRegistered: boolean("sam_registered").default(false),
  samData: jsonb("sam_data").$type<Record<string, unknown>>().default({}),
  lastAssessed: timestamp("last_assessed"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assessments = pgTable("assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull(),
  capabilityId: varchar("capability_id"),
  subCapabilityId: varchar("sub_capability_id"),
  vertical: text("vertical").notNull(),
  currentLevel: integer("current_level").notNull().default(1),
  targetLevel: integer("target_level").notNull().default(5),
  status: text("status").notNull().default("pending"),
  productName: text("product_name"),
  description: text("description"),
  certifications: text("certifications"),
  notes: text("notes"),
  scores: jsonb("scores").$type<VerticalScores>().notNull().default({}),
  samDataPopulated: boolean("sam_data_populated").default(false),
  artifacts: jsonb("artifacts").$type<string[]>().default([]),
  gaps: jsonb("gaps").$type<string[]>().default([]),
  samSearchResults: jsonb("sam_search_results").$type<Record<string, unknown>>().default({}),
  discoveredDocuments: jsonb("discovered_documents").$type<string[]>().default([]),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  vertical: text("vertical"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const artifacts = pgTable("artifacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vertical: text("vertical").notNull(),
  level: integer("level").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  regulation: text("regulation"),
  policies: text("policies").array().default([]),
  policyLinks: text("policy_links").array().default([]),
  verificationMethod: text("verification_method").notNull().default("manual_upload"),
  automationScore: real("automation_score").default(0),
  required: boolean("required").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const partnerArtifacts = pgTable("partner_artifacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull(),
  artifactId: varchar("artifact_id").notNull(),
  status: text("status").notNull().default("missing"),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: text("verified_by"),
  notes: text("notes"),
  documentRef: text("document_ref"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const verticalConfigs = pgTable("vertical_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  verticalKey: text("vertical_key").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(true),
  maxLevel: integer("max_level").notNull().default(9),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPartnerSchema = createInsertSchema(partners).omit({ id: true, createdAt: true });
export const insertAssessmentSchema = createInsertSchema(assessments).omit({ id: true, updatedAt: true, createdAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertArtifactSchema = createInsertSchema(artifacts).omit({ id: true, createdAt: true });
export const insertPartnerArtifactSchema = createInsertSchema(partnerArtifacts).omit({ id: true, createdAt: true });
export const insertVerticalConfigSchema = createInsertSchema(verticalConfigs).omit({ id: true, updatedAt: true });

export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Partner = typeof partners.$inferSelect;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type Assessment = typeof assessments.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
export type Artifact = typeof artifacts.$inferSelect;
export type InsertArtifact = z.infer<typeof insertArtifactSchema>;
export type PartnerArtifact = typeof partnerArtifacts.$inferSelect;
export type InsertPartnerArtifact = z.infer<typeof insertPartnerArtifactSchema>;
export type VerticalConfig = typeof verticalConfigs.$inferSelect;
export type InsertVerticalConfig = z.infer<typeof insertVerticalConfigSchema>;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("partner"),
  partnerId: varchar("partner_id"),
  displayName: text("display_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  companyName: text("company_name"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country"),
});

export const partnerDocuments = pgTable("partner_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull(),
  partnerArtifactId: varchar("partner_artifact_id"),
  artifactId: varchar("artifact_id"),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  contentType: text("content_type").notNull(),
  filePath: text("file_path").notNull(),
  complianceScore: integer("compliance_score"),
  complianceDetails: jsonb("compliance_details"),
  scoredAt: timestamp("scored_at"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const CAPABILITY_STATUSES = ["pending", "approved", "published"] as const;
export type CapabilityStatus = typeof CAPABILITY_STATUSES[number];

export const CAPABILITY_STATUS_LABELS: Record<CapabilityStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  published: "Published",
};

export const capabilities = pgTable("capabilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  status: text("status").notNull().default("published"),
  createdBy: varchar("created_by"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subCapabilities = pgTable("sub_capabilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  capabilityId: varchar("capability_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCapabilitySchema = createInsertSchema(capabilities).omit({ id: true, createdAt: true });
export const insertSubCapabilitySchema = createInsertSchema(subCapabilities).omit({ id: true, createdAt: true });
export type Capability = typeof capabilities.$inferSelect;
export type InsertCapability = z.infer<typeof insertCapabilitySchema>;
export type SubCapability = typeof subCapabilities.$inferSelect;
export type InsertSubCapability = z.infer<typeof insertSubCapabilitySchema>;

export const insertPartnerDocumentSchema = createInsertSchema(partnerDocuments).omit({ id: true, uploadedAt: true });
export type PartnerDocument = typeof partnerDocuments.$inferSelect;
export type InsertPartnerDocument = z.infer<typeof insertPartnerDocumentSchema>;

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const PARTNER_CAPABILITY_STATUSES = ["draft", "submitted", "under_review", "feedback_sent", "partner_responded", "approved", "rejected"] as const;
export type PartnerCapabilityStatus = typeof PARTNER_CAPABILITY_STATUSES[number];

export const PARTNER_CAPABILITY_STATUS_LABELS: Record<PartnerCapabilityStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  feedback_sent: "Feedback Received",
  partner_responded: "Partner Responded",
  approved: "Verified",
  rejected: "Not Verified",
};

export const ASSESSMENT_SECTIONS = [
  { key: "basic_info", label: "Basic Info" },
  { key: "TRL", label: "Technology Readiness" },
  { key: "PRL", label: "Policy & Legal" },
  { key: "CRL", label: "Cyber Security" },
  { key: "IRL", label: "Partnership & Integration" },
  { key: "SCRL", label: "Supply Chain" },
  { key: "TVRL", label: "Testing & Verification" },
  { key: "MRL", label: "Manufacturing" },
  { key: "HRL", label: "Human Engineering" },
  { key: "AIRL", label: "AI" },
] as const;

export const assessmentFeedback = pgTable("assessment_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerCapabilityId: varchar("partner_capability_id").notNull(),
  section: text("section").notNull(),
  message: text("message").notNull(),
  role: text("role").notNull(),
  username: text("username").notNull(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAssessmentFeedbackSchema = createInsertSchema(assessmentFeedback).omit({ id: true, createdAt: true });
export type AssessmentFeedback = typeof assessmentFeedback.$inferSelect;
export type InsertAssessmentFeedback = z.infer<typeof insertAssessmentFeedbackSchema>;

export const OFFERING_TYPES = ["capability", "product", "service", "other"] as const;
export type OfferingType = typeof OFFERING_TYPES[number];

export const partnerCapabilities = pgTable("partner_capabilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull(),
  name: text("name").notNull(),
  offeringType: text("offering_type").notNull().default("capability"),
  description: text("description"),
  problemStatement: text("problem_statement"),
  imagePath: text("image_path"),
  materials: jsonb("materials").$type<{ fileName: string; filePath: string; option: string }[]>().default([]),
  additionalInfo: text("additional_info"),
  status: text("status").notNull().default("draft"),
  verticalSelections: jsonb("vertical_selections").$type<Record<string, { level: number; checkedArtifacts: string[]; compliance: string; complianceRemarks: string; additionalEvidence: string; uploadedDocs?: { fileName: string; filePath: string; option: string; complianceScore?: number | null; complianceDetails?: any; scoredAt?: string }[] }>>().default({}),
  whitepaperPath: text("whitepaper_path"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPartnerCapabilitySchema = createInsertSchema(partnerCapabilities).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type PartnerCapability = typeof partnerCapabilities.$inferSelect;
export type InsertPartnerCapability = z.infer<typeof insertPartnerCapabilitySchema>;

export const RESOURCE_CATEGORIES = [
  "Compliance & Standards",
  "Getting Government-Ready",
  "Best Practices",
  "Reference Materials",
] as const;
export type ResourceCategory = typeof RESOURCE_CATEGORIES[number];

export const resources = pgTable("resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("Reference Materials"),
  filePath: text("file_path"),
  fileType: text("file_type").default("PDF"),
  externalUrl: text("external_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertResourceSchema = createInsertSchema(resources).omit({ id: true, createdAt: true });
export type Resource = typeof resources.$inferSelect;
export type InsertResource = z.infer<typeof insertResourceSchema>;

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  location: text("location"),
  link: text("link"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true });
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export * from "./models/chat";
