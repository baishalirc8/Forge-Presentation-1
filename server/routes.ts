import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPartnerSchema, insertAssessmentSchema, insertActivitySchema, insertArtifactSchema, insertPartnerArtifactSchema, insertVerticalConfigSchema, insertCapabilitySchema, insertSubCapabilitySchema, insertResourceSchema, insertEventSchema, VERTICALS, LEVEL_LABELS } from "@shared/schema";
import { samLookup, recommendLevel } from "./sam-emulator";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth, requireAdmin } from "./auth";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const distUploadsDir = path.join(process.cwd(), "dist", "uploads");

function resolveUploadPath(filePath: string): string | null {
  const basename = path.basename(filePath);
  const primary = path.resolve(uploadsDir, basename);
  if (fs.existsSync(primary)) return primary;
  const fallback = path.resolve(distUploadsDir, basename);
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueSuffix}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "image/png", "image/jpeg", "image/gif",
      "text/plain", "text/csv",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

function checkPartnerAccess(req: any, res: any, partnerId: string): boolean {
  if (req.user?.role === "partner" && req.user?.partnerId !== partnerId) {
    res.status(403).json({ message: "Access denied" });
    return false;
  }
  return true;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use("/api", (req, res, next) => {
    const publicPaths = ["/login", "/logout", "/user", "/register"];
    if (publicPaths.includes(req.path)) return next();
    requireAuth(req, res, next);
  });

  app.post("/api/register", async (req, res) => {
    try {
      const { username, password, firstName, lastName, phone, email, companyName } = req.body;
      if (!username || !password) return res.status(400).json({ message: "Email and password are required" });
      if (!email) return res.status(400).json({ message: "Email is required" });
      if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(409).json({ message: "An account with this email already exists" });

      const { hashPassword } = await import("./auth");
      const hashedPassword = await hashPassword(password);
      const displayName = [firstName, lastName].filter(Boolean).join(" ") || username;
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        role: "partner",
        partnerId: null,
        displayName,
      });

      res.status(201).json({ id: user.id, username: user.username, message: "Registration successful" });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Registration failed" });
    }
  });

  app.get("/api/users", requireAdmin, async (_req, res) => {
    const allUsers = await storage.getUsers();
    res.json(allUsers.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      partnerId: u.partnerId,
      displayName: u.displayName,
    })));
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const { username, password, displayName, role } = req.body;
      if (!username || !password) return res.status(400).json({ message: "Username and password required" });
      if (username.length < 3) return res.status(400).json({ message: "Username must be at least 3 characters" });
      if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(409).json({ message: "Username already taken" });

      const { hashPassword } = await import("./auth");
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        role: role || "partner",
        partnerId: null,
        displayName: displayName || username,
      });

      res.status(201).json({
        id: user.id,
        username: user.username,
        role: user.role,
        partnerId: user.partnerId,
        displayName: user.displayName,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to create user" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    if (req.user!.id === req.params.id) return res.status(400).json({ message: "Cannot delete your own account" });
    await storage.deleteUser(req.params.id);
    res.status(204).end();
  });

  app.patch("/api/user/link-partner", async (req, res) => {
    if (req.user!.role !== "partner") return res.status(403).json({ message: "Only partner users can link to an organization" });
    if (req.user!.partnerId) return res.status(409).json({ message: "You are already linked to an organization" });

    const { partnerId } = req.body;
    if (!partnerId) return res.status(400).json({ message: "partnerId is required" });

    const partner = await storage.getPartner(partnerId);
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    const updated = await storage.updateUser(req.user!.id, { partnerId });
    if (!updated) return res.status(500).json({ message: "Failed to link partner" });

    req.login({
      id: updated.id,
      username: updated.username,
      role: updated.role,
      partnerId: updated.partnerId,
      displayName: updated.displayName,
    }, (err) => {
      if (err) return res.status(500).json({ message: "Link succeeded but session update failed" });
      res.json({
        id: updated.id,
        username: updated.username,
        role: updated.role,
        partnerId: updated.partnerId,
        displayName: updated.displayName,
      });
    });
  });

  app.get("/api/partners", async (req, res) => {
    if (req.user!.role === "partner" && req.user!.partnerId) {
      const partner = await storage.getPartner(req.user!.partnerId);
      return res.json(partner ? [partner] : []);
    }
    const partners = await storage.getPartners();
    res.json(partners);
  });

  app.get("/api/partners/:id", async (req, res) => {
    if (req.user!.role === "partner" && req.user!.partnerId !== req.params.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    const partner = await storage.getPartner(req.params.id);
    if (!partner) return res.status(404).json({ message: "Partner not found" });
    res.json(partner);
  });

  app.post("/api/partners", async (req, res) => {
    if (req.user!.role === "partner" && req.user!.partnerId) {
      return res.status(403).json({ message: "You already have an organization linked" });
    }
    const result = insertPartnerSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const partner = await storage.createPartner(result.data);
    res.status(201).json(partner);
  });

  app.patch("/api/partners/:id", async (req, res) => {
    if (req.user!.role === "partner" && req.user!.partnerId !== req.params.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    const existing = await storage.getPartner(req.params.id);
    if (!existing) return res.status(404).json({ message: "Partner not found" });

    const updates = { ...req.body };
    if (existing.cage && updates.cage !== undefined && updates.cage !== existing.cage) {
      return res.status(400).json({ message: "CAGE Code cannot be changed once set" });
    }
    if (existing.uei && updates.uei !== undefined && updates.uei !== existing.uei) {
      return res.status(400).json({ message: "UEI cannot be changed once set" });
    }
    delete updates.entityType;

    const partner = await storage.updatePartner(req.params.id, updates);
    if (!partner) return res.status(404).json({ message: "Update failed" });
    res.json(partner);
  });

  app.delete("/api/partners/:id", requireAdmin, async (req, res) => {
    await storage.deletePartner(req.params.id);
    res.status(204).end();
  });

  app.get("/api/partners/:id/assessments", async (req, res) => {
    if (!checkPartnerAccess(req, res, req.params.id)) return;
    const assessmentsList = await storage.getAssessments(req.params.id);
    const allArtifacts = await storage.getArtifacts();
    const partnerArts = await storage.getPartnerArtifacts(req.params.id);
    const enriched = [];
    for (const a of assessmentsList) {
      const cap = a.capabilityId ? await storage.getCapability(a.capabilityId) : null;
      const sub = a.subCapabilityId ? await storage.getSubCapability(a.subCapabilityId) : null;
      const targetLvl = a.targetLevel;
      const relevantArtifacts = allArtifacts.filter(art => art.level <= targetLvl);
      const paMap = new Map(partnerArts.map(pa => [pa.artifactId, pa]));
      let pendingDocuments = 0;
      for (const art of relevantArtifacts) {
        const pa = paMap.get(art.id);
        if (!pa || (pa.status !== "verified" && pa.status !== "draft")) {
          pendingDocuments++;
        }
      }
      enriched.push({ ...a, capability: cap, subCapability: sub, pendingDocuments });
    }
    res.json(enriched);
  });

  app.get("/api/assessments/:id", async (req, res) => {
    const assessment = await storage.getAssessment(req.params.id);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });
    if (!checkPartnerAccess(req, res, assessment.partnerId)) return;
    const cap = assessment.capabilityId ? await storage.getCapability(assessment.capabilityId) : null;
    const sub = assessment.subCapabilityId ? await storage.getSubCapability(assessment.subCapabilityId) : null;
    res.json({ ...assessment, capability: cap, subCapability: sub });
  });

  app.post("/api/sam-lookup", async (req, res) => {
    const { uei, cage, ein } = req.body;
    if (!uei && !cage && !ein) {
      return res.status(400).json({ message: "Provide a UEID, CAGE code, or EIN/TIN to search" });
    }
    const result = samLookup({ uei: uei || undefined, cage: cage || undefined });
    if (!result.found || !result.entity) {
      return res.status(404).json({ message: "No matching entity found in SAM.gov" });
    }
    const entity = result.entity;
    res.json({
      found: true,
      name: entity.legalBusinessName,
      uei: entity.uei,
      cage: entity.cage,
      entityType: entity.entityType,
      samStatus: entity.samStatus,
      address: entity.physicalAddress,
      naicsCodes: entity.naicsCodes,
      registrationDate: entity.registrationDate,
      expirationDate: entity.expirationDate,
      pointOfContact: entity.pointOfContact,
    });
  });

  app.post("/api/partners/:id/sam-search", async (req, res) => {
    if (!checkPartnerAccess(req, res, req.params.id)) return;
    const partner = await storage.getPartner(req.params.id);
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    const samResult = samLookup({ cage: partner.cage || undefined, uei: partner.uei });
    const allArtifacts = await storage.getArtifacts();
    const partnerArts = await storage.getPartnerArtifacts(req.params.id);
    const paMap = new Map(partnerArts.map(pa => [pa.artifactId, pa]));

    const discoveredDocs: Array<{
      name: string;
      source: string;
      status: string;
      regulation: string;
      vertical: string;
      level: number;
      type: "sam" | "artifact";
    }> = [];

    if (samResult.found && samResult.entity) {
      for (const art of samResult.discoveredArtifacts) {
        discoveredDocs.push({
          name: art.name,
          source: "SAM.gov",
          status: art.status,
          regulation: art.regulation,
          vertical: art.vertical,
          level: art.level,
          type: "sam",
        });
      }
    }

    for (const artifact of allArtifacts) {
      const pa = paMap.get(artifact.id);
      if (pa && pa.status === "verified") {
        discoveredDocs.push({
          name: artifact.name,
          source: "Platform Records",
          status: "verified",
          regulation: artifact.regulation || "",
          vertical: artifact.vertical,
          level: artifact.level,
          type: "artifact",
        });
      }
    }

    const initialScores: Record<string, number> = {};
    if (samResult.found && samResult.entity) {
      const samEntity = samResult.entity;
      if (samEntity.samStatus === "Active") {
        initialScores["BRL"] = Math.max(initialScores["BRL"] || 0, 2);
      }
      if (samEntity.knownArtifacts.some(a => a.vertical === "FRL" && a.status === "active")) {
        initialScores["FRL"] = Math.max(initialScores["FRL"] || 0, 2);
      }
      if (samEntity.knownArtifacts.some(a => a.vertical === "CRL" && a.status === "active")) {
        initialScores["CRL"] = Math.max(initialScores["CRL"] || 0, 1);
      }
      if (samEntity.knownArtifacts.some(a => a.vertical === "PRL" && a.status === "active")) {
        initialScores["PRL"] = Math.max(initialScores["PRL"] || 0, 1);
      }
    }

    const documentsByLevel: Record<number, Array<{
      name: string;
      source: string;
      status: string;
      regulation: string;
      vertical: string;
      type: "sam" | "artifact";
    }>> = {};
    for (const doc of discoveredDocs) {
      if (!documentsByLevel[doc.level]) documentsByLevel[doc.level] = [];
      documentsByLevel[doc.level].push({
        name: doc.name,
        source: doc.source,
        status: doc.status,
        regulation: doc.regulation,
        vertical: doc.vertical,
        type: doc.type,
      });
    }

    const samResponseData = {
      samFound: samResult.found,
      samEntity: samResult.entity ? {
        legalBusinessName: samResult.entity.legalBusinessName,
        cage: samResult.entity.cage,
        uei: samResult.entity.uei,
        entityType: samResult.entity.entityType,
        samStatus: samResult.entity.samStatus,
        naicsCodes: samResult.entity.naicsCodes,
        registrationDate: samResult.entity.registrationDate,
        expirationDate: samResult.entity.expirationDate,
      } : null,
      discoveredDocuments: discoveredDocs,
      documentsByLevel,
      initialScores,
      totalDiscovered: discoveredDocs.length,
      fetchedAt: new Date().toISOString(),
    };

    await storage.updatePartner(req.params.id, {
      samData: samResponseData as Record<string, unknown>,
    });

    res.json(samResponseData);
  });

  app.post("/api/partners/:id/assessments", async (req, res) => {
    if (!checkPartnerAccess(req, res, req.params.id)) return;
    const partner = await storage.getPartner(req.params.id);
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    const { capabilityId, subCapabilityId, productName, description, certifications, targetLevel, samSearchResults, discoveredDocuments, initialScores: clientScores } = req.body;
    if (!capabilityId) return res.status(400).json({ message: "capabilityId is required" });
    if (!targetLevel || targetLevel < 1 || targetLevel > 9) return res.status(400).json({ message: "targetLevel must be between 1 and 9" });

    const capability = await storage.getCapability(capabilityId);
    if (!capability) return res.status(400).json({ message: "Capability not found" });

    if (subCapabilityId) {
      const subCap = await storage.getSubCapability(subCapabilityId);
      if (!subCap || subCap.capabilityId !== capabilityId) {
        return res.status(400).json({ message: "Sub-capability not found or does not belong to selected capability" });
      }
    }

    const validVerticalKeys = new Set(VERTICALS.map(v => v.key));
    const initialScores: Record<string, number> = {};
    let samPopulated = false;

    const samResult = samLookup({ cage: partner.cage || undefined, uei: partner.uei });
    if (samResult.found && samResult.entity) {
      samPopulated = true;
      const samEntity = samResult.entity;
      if (samEntity.samStatus === "Active") {
        initialScores["BRL"] = Math.max(initialScores["BRL"] || 0, 2);
      }
      if (samEntity.knownArtifacts.some(a => a.vertical === "FRL" && a.status === "active")) {
        initialScores["FRL"] = Math.max(initialScores["FRL"] || 0, 2);
      }
      if (samEntity.knownArtifacts.some(a => a.vertical === "CRL" && a.status === "active")) {
        initialScores["CRL"] = Math.max(initialScores["CRL"] || 0, 1);
      }
      if (samEntity.knownArtifacts.some(a => a.vertical === "PRL" && a.status === "active")) {
        initialScores["PRL"] = Math.max(initialScores["PRL"] || 0, 1);
      }

      const allArtifacts = await storage.getArtifacts();
      for (const samArt of samEntity.knownArtifacts) {
        if (samArt.status !== "active") continue;
        const matchingArtifacts = allArtifacts.filter(a =>
          a.name.toLowerCase().includes(samArt.name.toLowerCase().split("(")[0].trim().toLowerCase()) ||
          samArt.name.toLowerCase().includes(a.name.toLowerCase().split("(")[0].trim().toLowerCase())
        );
        for (const matchedArt of matchingArtifacts) {
          const existing = await storage.getPartnerArtifactByIds(req.params.id, matchedArt.id);
          if (!existing) {
            await storage.createPartnerArtifact({
              partnerId: req.params.id,
              artifactId: matchedArt.id,
              status: "verified",
              verifiedBy: "SAM.gov Auto-Discovery",
              notes: `Auto-discovered from SAM.gov (${samArt.regulation})`,
            });
          } else if (existing.status === "missing") {
            await storage.updatePartnerArtifact(existing.id, {
              status: "verified",
              verifiedBy: "SAM.gov Auto-Discovery",
              notes: `Auto-verified from SAM.gov (${samArt.regulation})`,
            });
          }
        }
      }
    }

    const gaps: string[] = [];
    for (const v of VERTICALS) {
      const score = initialScores[v.key] || 0;
      if (score < parseInt(targetLevel.toString())) {
        gaps.push(v.key);
      }
    }

    const savedSamData = (partner.samData || {}) as Record<string, any>;
    const savedDocs = (savedSamData.discoveredDocuments || []) as Array<{ name: string }>;
    const savedEntity = savedSamData.samEntity || {};
    const savedDocNames = savedDocs.map((d: any) => d.name);

    const assessment = await storage.createAssessment({
      partnerId: req.params.id,
      capabilityId: capabilityId || null,
      subCapabilityId: subCapabilityId || null,
      vertical: "TRL",
      currentLevel: 1,
      targetLevel: parseInt(targetLevel) || 5,
      status: "in_progress",
      productName: productName || null,
      description: description || null,
      certifications: certifications || null,
      notes: null,
      scores: initialScores,
      samDataPopulated: samPopulated,
      artifacts: savedDocNames.length > 0 ? savedDocNames : (discoveredDocuments || []),
      gaps,
      samSearchResults: Object.keys(savedEntity).length > 0 ? savedEntity : (samSearchResults || {}),
      discoveredDocuments: savedDocNames.length > 0 ? savedDocNames : (discoveredDocuments || []),
    });

    await storage.createActivity({
      partnerId: req.params.id,
      type: "assessment_created",
      description: `Assessment started: ${productName || "Untitled"} — ${capability.name}, target L${targetLevel}`,
      vertical: null,
      metadata: { assessmentId: assessment.id, capabilityId, subCapabilityId, targetLevel, productName },
    });

    const cap = assessment.capabilityId ? await storage.getCapability(assessment.capabilityId) : null;
    const sub = assessment.subCapabilityId ? await storage.getSubCapability(assessment.subCapabilityId) : null;
    res.status(201).json({ ...assessment, capability: cap, subCapability: sub });
  });

  app.get("/api/assessments/:id/report-card", async (req, res) => {
    const assessment = await storage.getAssessment(req.params.id);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });
    if (!checkPartnerAccess(req, res, assessment.partnerId)) return;

    const targetLevel = assessment.targetLevel;
    const allArtifacts = await storage.getArtifacts();
    let partnerArts = await storage.getPartnerArtifacts(assessment.partnerId);
    const existingArtifactIds = new Set(partnerArts.map(pa => pa.artifactId));
    const missingPAs = allArtifacts.filter(a => !existingArtifactIds.has(a.id));
    for (const a of missingPAs) {
      await storage.createPartnerArtifact({
        partnerId: assessment.partnerId,
        artifactId: a.id,
        status: "missing",
        verifiedAt: null,
        verifiedBy: null,
        notes: null,
        documentRef: null,
      });
    }
    if (missingPAs.length > 0) {
      partnerArts = await storage.getPartnerArtifacts(assessment.partnerId);
    }
    const partnerDocs = await storage.getPartnerDocuments(assessment.partnerId);
    const paMap = new Map(partnerArts.map(pa => [pa.artifactId, pa]));
    const docsByPaId = new Map<string, typeof partnerDocs>();
    for (const doc of partnerDocs) {
      if (doc.partnerArtifactId) {
        const existing = docsByPaId.get(doc.partnerArtifactId) || [];
        existing.push(doc);
        docsByPaId.set(doc.partnerArtifactId, existing);
      }
    }

    const items = allArtifacts.map(artifact => {
      const pa = paMap.get(artifact.id);
      const docs = pa ? (docsByPaId.get(pa.id) || []) : [];
      return {
        artifact,
        partnerArtifact: pa || null,
        status: pa?.status || "missing",
        documents: docs,
      };
    });

    const totalRequired = items.length;
    const verified = items.filter(i => i.status === "verified").length;
    const draft = items.filter(i => i.status === "draft" || i.status === "submitted").length;
    const missing = items.filter(i => i.status === "missing").length;

    const itemsByVL: Record<string, Record<number, typeof items>> = {};
    for (const item of items) {
      const vKey = item.artifact.vertical;
      const level = item.artifact.level;
      if (!itemsByVL[vKey]) itemsByVL[vKey] = {};
      if (!itemsByVL[vKey][level]) itemsByVL[vKey][level] = [];
      itemsByVL[vKey][level].push(item);
    }

    const verticals = VERTICALS.map((vInfo) => {
      const vKey = vInfo.key;
      const levelsMap = itemsByVL[vKey] || {};

      const levelEntries = [];
      for (let lvl = 1; lvl <= 9; lvl++) {
        const lvlItems = levelsMap[lvl] || [];
        const lVerified = lvlItems.filter(i => i.status === "verified").length;
        const lDraft = lvlItems.filter(i => i.status === "draft" || i.status === "submitted").length;
        const lMissing = lvlItems.filter(i => i.status === "missing").length;
        const lTotal = lvlItems.length;
        let levelStatus: "compliant" | "partial" | "non_compliant" | "no_artifacts" = "no_artifacts";
        if (lTotal > 0) {
          if (lMissing === lTotal) levelStatus = "non_compliant";
          else if (lMissing > 0 || lDraft > 0) levelStatus = "partial";
          else levelStatus = "compliant";
        }
        levelEntries.push({
          level: lvl,
          status: levelStatus,
          summary: { total: lTotal, verified: lVerified, draft: lDraft, missing: lMissing },
          items: lvlItems,
        });
      }

      const allVItems = Object.values(levelsMap).flat();
      const vVerified = allVItems.filter(i => i.status === "verified").length;
      const vDraft = allVItems.filter(i => i.status === "draft" || i.status === "submitted").length;
      const vMissing = allVItems.filter(i => i.status === "missing").length;
      const vTotal = allVItems.length;

      let verticalStatus: "compliant" | "partial" | "non_compliant" | "no_artifacts" = "no_artifacts";
      if (vTotal > 0) {
        if (vMissing === vTotal) verticalStatus = "non_compliant";
        else if (vMissing > 0 || vDraft > 0) verticalStatus = "partial";
        else verticalStatus = "compliant";
      }

      return {
        key: vKey,
        name: vInfo.name,
        description: vInfo.description,
        priority: vInfo.priority,
        status: verticalStatus,
        summary: { total: vTotal, verified: vVerified, draft: vDraft, missing: vMissing },
        levels: levelEntries,
      };
    });

    const isAdmin = req.user?.role === "admin";
    if (!isAdmin) {
      for (const v of verticals) {
        for (const lvl of v.levels) {
          for (const item of lvl.items) {
            for (const doc of item.documents) {
              const details = (doc as any).complianceDetails;
              if (details?.status === "analyzing") {
                (doc as any).complianceDetails = { status: "analyzing" };
              } else {
                delete (doc as any).complianceDetails;
              }
            }
          }
        }
      }
    }

    res.json({
      assessmentId: assessment.id,
      targetLevel,
      summary: { totalRequired, verified, draft, missing },
      verticals,
    });
  });

  app.patch("/api/assessments/:id", async (req, res) => {
    const existing = await storage.getAssessment(req.params.id);
    if (!existing) return res.status(404).json({ message: "Assessment not found" });
    if (!checkPartnerAccess(req, res, existing.partnerId)) return;
    const { scores, notes, status, reviewNotes } = req.body;
    const updates: Record<string, any> = {};
    if (scores !== undefined) updates.scores = scores;
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) {
      const userRole = req.user?.role;
      const currentStatus = existing.status;
      const allowedTransitions: Record<string, Record<string, string[]>> = {
        partner: {
          pending: ["in_progress"],
          in_progress: ["pending_review", "completed"],
          completed: ["pending_review"],
          rejected: ["pending_review"],
        },
        admin: {
          pending: ["in_progress", "pending_review", "approved", "rejected"],
          in_progress: ["pending_review", "approved", "rejected"],
          pending_review: ["approved", "rejected"],
          completed: ["approved", "rejected"],
          approved: ["rejected"],
          rejected: ["approved"],
        },
      };
      const role = userRole === "admin" ? "admin" : "partner";
      const allowed = allowedTransitions[role]?.[currentStatus || "pending"] || [];
      if (!allowed.includes(status)) {
        return res.status(403).json({ message: `Cannot transition from ${currentStatus} to ${status}` });
      }
      if (status === "approved" && role === "admin") {
        const cap = existing.capabilityId ? await storage.getCapability(existing.capabilityId) : null;
        if (cap && cap.status !== "published") {
          return res.status(400).json({ message: `Cannot mark compliant — capability "${cap.name}" must be published first. Go to Configuration → Capabilities to publish it.` });
        }
      }
      updates.status = status;
    }
    const assessment = await storage.updateAssessment(req.params.id, updates);
    res.json(assessment);
  });

  app.get("/api/partners/:id/activities", async (req, res) => {
    if (!checkPartnerAccess(req, res, req.params.id)) return;
    const activities = await storage.getActivities(req.params.id);
    res.json(activities);
  });

  app.post("/api/activities", async (req, res) => {
    const result = insertActivitySchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const activity = await storage.createActivity(result.data);
    res.status(201).json(activity);
  });

  app.get("/api/activities", async (req, res) => {
    let targetPartners;
    if (req.user!.role === "partner") {
      const p = await storage.getPartner(req.user!.partnerId!);
      targetPartners = p ? [p] : [];
    } else {
      targetPartners = await storage.getPartners();
    }

    const allEvents: any[] = [];

    const partnerMap = new Map(targetPartners.map(p => [p.id, p.name]));

    for (const p of targetPartners) {
      const caps = await storage.getPartnerCapabilities(p.id);
      for (const cap of caps) {
        if (cap.status !== "draft") {
          allEvents.push({
            id: `cap-created-${cap.id}`,
            partnerId: p.id,
            type: "capability_submitted",
            description: `Capability "${cap.name}" submitted for assessment`,
            vertical: null,
            metadata: { capabilityId: cap.id, capabilityName: cap.name, offeringType: cap.offeringType },
            createdAt: cap.createdAt,
            partnerName: p.name,
          });
        }
        if (cap.status === "approved") {
          allEvents.push({
            id: `cap-approved-${cap.id}`,
            partnerId: p.id,
            type: "capability_verified",
            description: `Capability "${cap.name}" has been verified`,
            vertical: null,
            metadata: { capabilityId: cap.id, capabilityName: cap.name },
            createdAt: cap.updatedAt || cap.createdAt,
            partnerName: p.name,
          });
        }
        if (cap.status === "rejected") {
          allEvents.push({
            id: `cap-rejected-${cap.id}`,
            partnerId: p.id,
            type: "capability_rejected",
            description: `Capability "${cap.name}" was not verified`,
            vertical: null,
            metadata: { capabilityId: cap.id, capabilityName: cap.name },
            createdAt: cap.updatedAt || cap.createdAt,
            partnerName: p.name,
          });
        }

        const feedbackItems = await storage.getAssessmentFeedback(cap.id);
        for (const fb of feedbackItems) {
          allEvents.push({
            id: `fb-${fb.id}`,
            partnerId: p.id,
            type: fb.role === "admin" ? "admin_feedback" : "partner_response",
            description: fb.message,
            vertical: fb.section !== "basic_info" ? fb.section : null,
            metadata: { capabilityId: cap.id, capabilityName: cap.name, section: fb.section, displayName: fb.displayName },
            createdAt: fb.createdAt,
            partnerName: p.name,
          });
        }
      }
    }

    allEvents.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json(allEvents.slice(0, 100));
  });

  app.get("/api/artifacts", async (req, res) => {
    const vertical = req.query.vertical as string | undefined;
    const arts = await storage.getArtifacts(vertical);
    res.json(arts);
  });

  app.get("/api/artifacts/:id", async (req, res) => {
    const artifact = await storage.getArtifact(req.params.id);
    if (!artifact) return res.status(404).json({ message: "Artifact not found" });
    res.json(artifact);
  });

  app.post("/api/artifacts", requireAdmin, async (req, res) => {
    const result = insertArtifactSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const artifact = await storage.createArtifact(result.data);
    res.status(201).json(artifact);
  });

  app.patch("/api/artifacts/:id", requireAdmin, async (req, res) => {
    const artifact = await storage.updateArtifact(req.params.id, req.body);
    if (!artifact) return res.status(404).json({ message: "Artifact not found" });
    res.json(artifact);
  });

  app.delete("/api/artifacts/:id", requireAdmin, async (req, res) => {
    await storage.deleteArtifact(req.params.id);
    res.status(204).end();
  });

  app.get("/api/partners/:id/partner-artifacts", async (req, res) => {
    if (!checkPartnerAccess(req, res, req.params.id)) return;
    const partner = await storage.getPartner(req.params.id);
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    const allArtifacts = await storage.getArtifacts();
    const existingPAs = await storage.getPartnerArtifacts(req.params.id);
    const existingArtifactIds = new Set(existingPAs.map(pa => pa.artifactId));

    const missing = allArtifacts.filter(a => !existingArtifactIds.has(a.id));
    for (const a of missing) {
      await storage.createPartnerArtifact({
        partnerId: req.params.id,
        artifactId: a.id,
        status: "missing",
        verifiedAt: null,
        verifiedBy: null,
        notes: null,
        documentRef: null,
      });
    }

    if (missing.length > 0) {
      const updated = await storage.getPartnerArtifacts(req.params.id);
      return res.json(updated);
    }

    res.json(existingPAs);
  });

  app.post("/api/partner-artifacts", async (req, res) => {
    const result = insertPartnerArtifactSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const pa = await storage.createPartnerArtifact(result.data);
    res.status(201).json(pa);
  });

  app.patch("/api/partner-artifacts/:id", async (req, res) => {
    const pa = await storage.updatePartnerArtifact(req.params.id, req.body);
    if (!pa) return res.status(404).json({ message: "Partner artifact not found" });
    res.json(pa);
  });

  app.get("/api/vertical-configs", async (_req, res) => {
    const configs = await storage.getVerticalConfigs();
    res.json(configs);
  });

  app.post("/api/vertical-configs", requireAdmin, async (req, res) => {
    const result = insertVerticalConfigSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const config = await storage.upsertVerticalConfig(result.data);
    res.json(config);
  });

  app.get("/api/capabilities", async (req, res) => {
    const caps = await storage.getCapabilities();
    const user = (req as any).user;
    const isAdmin = user?.role === "admin";
    const partnerId = user?.partnerId;
    const filtered = isAdmin ? caps : caps.filter(c => c.status === "published" || (partnerId && c.createdBy === partnerId));
    const result = [];
    for (const cap of filtered) {
      const subs = await storage.getSubCapabilities(cap.id);
      result.push({ ...cap, subCapabilities: subs });
    }
    res.json(result);
  });

  app.post("/api/capabilities", requireAdmin, async (req, res) => {
    const result = insertCapabilitySchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const cap = await storage.createCapability({ ...result.data, status: req.body.status || "published" });
    res.status(201).json(cap);
  });

  app.post("/api/capabilities/propose", async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    if (user.role !== "partner") return res.status(403).json({ message: "Only partners can propose capabilities" });
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Capability name is required" });
    }
    const cap = await storage.createCapability({
      name: name.trim(),
      status: "pending",
      createdBy: user.partnerId || user.id,
      sortOrder: 999,
    });
    res.status(201).json(cap);
  });

  app.patch("/api/capabilities/:id", requireAdmin, async (req, res) => {
    const cap = await storage.updateCapability(req.params.id, req.body);
    if (!cap) return res.status(404).json({ message: "Capability not found" });
    res.json(cap);
  });

  app.patch("/api/capabilities/:id/status", requireAdmin, async (req, res) => {
    const { status } = req.body;
    if (!["pending", "approved", "published"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const cap = await storage.updateCapability(req.params.id, { status });
    if (!cap) return res.status(404).json({ message: "Capability not found" });
    res.json(cap);
  });

  app.delete("/api/capabilities/:id", requireAdmin, async (req, res) => {
    await storage.deleteCapability(req.params.id);
    res.status(204).end();
  });

  app.post("/api/capabilities/:id/sub-capabilities", requireAdmin, async (req, res) => {
    const data = { ...req.body, capabilityId: req.params.id };
    const result = insertSubCapabilitySchema.safeParse(data);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const sub = await storage.createSubCapability(result.data);
    res.status(201).json(sub);
  });

  app.patch("/api/sub-capabilities/:id", requireAdmin, async (req, res) => {
    const sub = await storage.updateSubCapability(req.params.id, req.body);
    if (!sub) return res.status(404).json({ message: "Sub-capability not found" });
    res.json(sub);
  });

  app.delete("/api/sub-capabilities/:id", requireAdmin, async (req, res) => {
    await storage.deleteSubCapability(req.params.id);
    res.status(204).end();
  });

  app.get("/api/partner-capabilities", async (req, res) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const partnerId = user.partnerId;
    if (!partnerId) return res.json([]);
    const caps = await storage.getPartnerCapabilities(partnerId);
    res.json(caps);
  });

  app.get("/api/partner-capabilities/deleted", async (req, res) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.role === "admin") {
      const deleted = await storage.getDeletedPartnerCapabilities();
      res.json(deleted);
    } else {
      const deleted = await storage.getDeletedPartnerCapabilities(user.partnerId);
      res.json(deleted);
    }
  });

  app.get("/api/partner-capabilities/:id", async (req, res) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const cap = await storage.getPartnerCapability(req.params.id);
    if (!cap) return res.status(404).json({ message: "Not found" });
    if (user.role !== "admin" && cap.partnerId !== user.partnerId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    if (user.role === "admin") {
      const partner = await storage.getPartner(cap.partnerId);
      return res.json({ ...cap, partner: partner ? { id: partner.id, name: partner.name, cage: partner.cage } : null });
    }
    res.json(cap);
  });

  app.post("/api/partner-capabilities", async (req, res) => {
    const user = req.user as any;
    if (!user?.partnerId) return res.status(403).json({ message: "Must be linked to a partner" });
    const { name, offeringType, description, problemStatement, verticalSelections, imagePath, materials, additionalInfo } = req.body;
    const created = await storage.createPartnerCapability({
      partnerId: user.partnerId,
      name: name || "Untitled",
      offeringType: offeringType || "capability",
      description: description || null,
      problemStatement: problemStatement || null,
      imagePath: imagePath || null,
      materials: materials || [],
      additionalInfo: additionalInfo || null,
      verticalSelections: verticalSelections || {},
    });
    res.status(201).json(created);
  });

  app.patch("/api/partner-capabilities/:id", async (req, res) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const existing = await storage.getPartnerCapability(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (user.role !== "admin" && existing.partnerId !== user.partnerId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const { name, offeringType, description, problemStatement, verticalSelections, status, imagePath, materials, additionalInfo } = req.body;
    let mergedSelections = verticalSelections;
    if (verticalSelections !== undefined) {
      const existingSelections = (existing.verticalSelections || {}) as Record<string, any>;
      mergedSelections = { ...existingSelections };
      for (const [key, incoming] of Object.entries(verticalSelections as Record<string, any>)) {
        const prev = existingSelections[key] || {};
        mergedSelections[key] = {
          ...prev,
          ...incoming,
          uploadedDocs: incoming.uploadedDocs !== undefined
            ? incoming.uploadedDocs
            : (prev.uploadedDocs || []),
        };
      }
      for (const key of Object.keys(existingSelections)) {
        if (!(key in (verticalSelections as Record<string, any>))) {
          mergedSelections[key] = existingSelections[key];
        }
      }
    }
    const updated = await storage.updatePartnerCapability(req.params.id, {
      ...(name !== undefined && { name }),
      ...(offeringType !== undefined && { offeringType }),
      ...(description !== undefined && { description }),
      ...(problemStatement !== undefined && { problemStatement }),
      ...(mergedSelections !== undefined && { verticalSelections: mergedSelections }),
      ...(imagePath !== undefined && { imagePath }),
      ...(materials !== undefined && { materials }),
      ...(additionalInfo !== undefined && { additionalInfo }),
      ...(status !== undefined && user.role === "admin" && { status }),
      ...(status !== undefined && user.role !== "admin" && status === "submitted" && { status }),
    });

    if (status === "submitted" && updated) {
      runCapabilityDocAnalysis(updated.id).catch(err => {
        console.error(`Capability doc analysis failed for ${updated.id}:`, err);
      });
    }

    res.json(updated);
  });

  app.post("/api/capability-uploads", (req, res, next) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({ message: err.message || "File upload error" });
      }
      next();
    });
  }, async (req, res) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });
    const { verticalKey, option } = req.body;
    if (!verticalKey || !option) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ message: "verticalKey and option are required" });
    }
    res.status(201).json({
      fileName: file.originalname,
      filePath: file.filename,
      fileSize: file.size,
      contentType: file.mimetype,
      verticalKey,
      option,
    });
  });

  app.post("/api/partner-capabilities/:id/analyze", async (req, res) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const capability = await storage.getPartnerCapability(req.params.id);
    if (!capability) return res.status(404).json({ message: "Not found" });
    if (user.role !== "admin" && capability.partnerId !== user.partnerId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const capabilityId = req.params.id;
    const verticalKey = req.body.vertical as string | undefined;
    res.status(200).json({ status: "started", message: "AI analysis started in background" });

    setImmediate(async () => {
      try {
        const cap = await storage.getPartnerCapability(capabilityId);
        if (cap) {
          const selections = JSON.parse(JSON.stringify(cap.verticalSelections || {})) as Record<string, any>;
          if (verticalKey) {
            const sel = selections[verticalKey];
            if (sel) {
              for (const doc of (sel.uploadedDocs || [])) {
                delete doc.complianceScore;
                delete doc.complianceDetails;
                delete doc.scoredAt;
              }
            }
          } else {
            for (const [, sel] of Object.entries(selections)) {
              for (const doc of (sel.uploadedDocs || [])) {
                delete doc.complianceScore;
                delete doc.complianceDetails;
                delete doc.scoredAt;
              }
            }
          }
          await storage.updatePartnerCapability(capabilityId, { verticalSelections: selections } as any);
        }
        await runCapabilityDocAnalysis(capabilityId, verticalKey);
      } catch (err) {
        console.error(`Background analysis failed for ${capabilityId}:`, err);
      }
    });
  });

  app.get("/api/admin/partners/:partnerId/capabilities", async (req, res) => {
    const user = req.user as any;
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin only" });
    const caps = await storage.getPartnerCapabilities(req.params.partnerId);
    res.json(caps.filter(c => c.status !== "draft"));
  });

  app.get("/api/admin/partner-capabilities", async (req, res) => {
    const user = req.user as any;
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin only" });
    const all = await storage.getAllPartnerCapabilities();
    const nonDraft = all.filter(c => c.status !== "draft");
    const partnerIds = [...new Set(nonDraft.map(c => c.partnerId))];
    const partnersMap: Record<string, any> = {};
    for (const pid of partnerIds) {
      const p = await storage.getPartner(pid);
      if (p) partnersMap[pid] = { id: p.id, name: p.name, cage: p.cage };
    }
    res.json(nonDraft.map(c => ({ ...c, partner: partnersMap[c.partnerId] || null })));
  });

  app.get("/api/assessment-feedback/:partnerCapabilityId", async (req, res) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const cap = await storage.getPartnerCapability(req.params.partnerCapabilityId);
    if (!cap) return res.status(404).json({ message: "Not found" });
    if (user.role !== "admin" && cap.partnerId !== user.partnerId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const feedback = await storage.getAssessmentFeedback(req.params.partnerCapabilityId);
    res.json(feedback);
  });

  app.post("/api/assessment-feedback/:partnerCapabilityId", async (req, res) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const cap = await storage.getPartnerCapability(req.params.partnerCapabilityId);
    if (!cap) return res.status(404).json({ message: "Not found" });
    if (user.role !== "admin" && cap.partnerId !== user.partnerId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const { section, message } = req.body;
    if (!section || !message) return res.status(400).json({ message: "section and message required" });
    const feedback = await storage.createAssessmentFeedback({
      partnerCapabilityId: req.params.partnerCapabilityId,
      section,
      message,
      role: user.role,
      username: user.username,
      displayName: user.displayName || user.username,
    });
    res.status(201).json(feedback);
  });

  app.patch("/api/partner-capabilities/:id/status", async (req, res) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const existing = await storage.getPartnerCapability(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "status required" });
    if (user.role === "admin") {
      if (!["under_review", "feedback_sent", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid admin status transition" });
      }
    } else {
      if (existing.partnerId !== user.partnerId) return res.status(403).json({ message: "Forbidden" });
      if (!["submitted", "partner_responded"].includes(status)) {
        return res.status(400).json({ message: "Invalid partner status transition" });
      }
    }
    const updated = await storage.updatePartnerCapability(req.params.id, { status } as any);
    res.json(updated);
  });

  app.delete("/api/partner-capabilities/:id", async (req, res) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const existing = await storage.getPartnerCapability(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (user.role !== "admin" && existing.partnerId !== user.partnerId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deletePartnerCapability(req.params.id);
    res.status(204).end();
  });

  app.patch("/api/partner-capabilities/:id/restore", async (req, res) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const restored = await storage.restorePartnerCapability(req.params.id);
    if (!restored) return res.status(404).json({ message: "Not found" });
    if (user.role !== "admin" && restored.partnerId !== user.partnerId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(restored);
  });

  app.post("/api/sam-lookup", async (req, res) => {
    const { cage, uei } = req.body;
    if (!cage && !uei) return res.status(400).json({ message: "Provide cage or uei" });

    const result = samLookup({ cage, uei });
    res.json(result);
  });

  app.post("/api/ai-recommend-level", async (req, res) => {
    const { samStatus, knownArtifactCount, artifactCount, entityType, hasExportControl, hasCMMC, hasCPARS, capabilityDescription, description, naicsCodes } = req.body;

    const recommendation = recommendLevel({
      samStatus: samStatus || "Inactive",
      knownArtifactCount: knownArtifactCount || artifactCount || 0,
      entityType: entityType || "vendor",
      hasExportControl: !!hasExportControl,
      hasCMMC: !!hasCMMC,
      hasCPARS: !!hasCPARS,
      capabilityDescription: capabilityDescription || description || "",
    });

    res.json(recommendation);
  });

  app.post("/api/partners/:id/prerequisite-validation", async (req, res) => {
    const partner = await storage.getPartner(req.params.id);
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    const { targetLevel, vertical } = req.body;
    if (!targetLevel || !vertical) return res.status(400).json({ message: "Provide targetLevel and vertical" });

    const allArtifacts = await storage.getArtifacts(vertical);
    const partnerArts = await storage.getPartnerArtifacts(req.params.id);
    const paMap = new Map(partnerArts.map(pa => [pa.artifactId, pa]));

    const prerequisiteLevels = [];
    for (let level = 1; level < targetLevel; level++) {
      const levelArtifacts = allArtifacts.filter(a => a.level === level);
      const levelStatus = levelArtifacts.map(a => {
        const pa = paMap.get(a.id);
        return { artifact: a, partnerArtifact: pa, status: pa?.status || "missing" };
      });
      const allVerified = levelArtifacts.length === 0 || levelStatus.every(s => s.status === "verified");
      prerequisiteLevels.push({
        level,
        artifacts: levelStatus,
        satisfied: allVerified,
        missingCount: levelStatus.filter(s => s.status !== "verified").length,
      });
    }

    const allSatisfied = prerequisiteLevels.every(l => l.satisfied);

    res.json({
      vertical,
      targetLevel,
      allPrerequisitesMet: allSatisfied,
      levels: prerequisiteLevels,
    });
  });

  app.post("/api/partners/:id/auto-discover", async (req, res) => {
    if (!checkPartnerAccess(req, res, req.params.id)) return;
    const partner = await storage.getPartner(req.params.id);
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    const samResult = samLookup({ cage: partner.cage || undefined, uei: partner.uei });
    if (!samResult.found || !samResult.entity) {
      return res.json({ discovered: 0, artifacts: [] });
    }

    const allArtifacts = await storage.getArtifacts();

    const existingPAs = await storage.getPartnerArtifacts(partner.id);
    const existingArtifactIds = new Set(existingPAs.map(pa => pa.artifactId));
    for (const a of allArtifacts) {
      if (!existingArtifactIds.has(a.id)) {
        await storage.createPartnerArtifact({
          partnerId: partner.id,
          artifactId: a.id,
          status: "missing",
          verifiedAt: null,
          verifiedBy: null,
          notes: null,
          documentRef: null,
        });
      }
    }

    const partnerArts = await storage.getPartnerArtifacts(partner.id);
    const paMap = new Map(partnerArts.map(pa => [pa.artifactId, pa]));

    const discoveredNames = new Set(samResult.discoveredArtifacts.map(a => a.name));
    const autoVerified: string[] = [];

    for (const artifact of allArtifacts) {
      if (discoveredNames.has(artifact.name)) {
        const pa = paMap.get(artifact.id);
        if (pa && pa.status !== "verified") {
          await storage.updatePartnerArtifact(pa.id, {
            status: "verified",
            verifiedAt: new Date(),
            verifiedBy: "SAM.gov API (Auto)",
            notes: "Auto-verified via SAM.gov artifact discovery",
            documentRef: `SAM-${samResult.entity.cage}-${Date.now().toString(36).toUpperCase()}`,
          });
          autoVerified.push(artifact.name);
        }
      }
    }

    if (autoVerified.length > 0) {
      await storage.createActivity({
        partnerId: partner.id,
        type: "artifact_discovery",
        description: `SAM.gov API auto-verified ${autoVerified.length} artifact(s): ${autoVerified.join(", ")}`,
        vertical: null,
        metadata: { source: "sam_api", count: autoVerified.length, artifacts: autoVerified },
      });
    }

    res.json({
      discovered: autoVerified.length,
      artifacts: autoVerified,
      samEntity: samResult.entity,
    });
  });

  app.post("/api/partners/:id/gap-advisor", async (req, res) => {
    if (!checkPartnerAccess(req, res, req.params.id)) return;
    const partner = await storage.getPartner(req.params.id);
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    const { message, history } = req.body;
    if (!message || typeof message !== "string") return res.status(400).json({ message: "Message is required" });
    if (message.length > 2000) return res.status(400).json({ message: "Message too long (max 2000 chars)" });

    const sanitizedHistory: Array<{ role: string; content: string }> = [];
    if (history && Array.isArray(history)) {
      const maxTurns = 20;
      const recent = history.slice(-maxTurns);
      for (const h of recent) {
        if (h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string") {
          sanitizedHistory.push({ role: h.role, content: h.content.slice(0, 4000) });
        }
      }
    }

    const scores = partner.scores as Record<string, number>;
    const allArtifacts = await storage.getArtifacts();
    const partnerArts = await storage.getPartnerArtifacts(req.params.id);
    const paMap = new Map(partnerArts.map(pa => [pa.artifactId, pa]));

    const gapVerticals = VERTICALS.filter(v => (scores[v.key] || 0) < partner.targetLevel);
    const metVerticals = VERTICALS.filter(v => (scores[v.key] || 0) >= partner.targetLevel);

    const verticalDetails = gapVerticals.map(v => {
      const current = scores[v.key] || 0;
      const vertArtifacts = allArtifacts.filter(a => a.vertical === v.key);
      const missing = vertArtifacts.filter(a => {
        const pa = paMap.get(a.id);
        return !pa || pa.status !== "verified";
      });
      const verified = vertArtifacts.filter(a => {
        const pa = paMap.get(a.id);
        return pa && pa.status === "verified";
      });
      return {
        vertical: v.key,
        name: v.name,
        description: v.description,
        currentLevel: current,
        targetLevel: partner.targetLevel,
        delta: partner.targetLevel - current,
        missingArtifacts: missing.map(a => `${a.name} (L${a.level}, ${a.verificationMethod})`),
        verifiedArtifacts: verified.map(a => a.name),
      };
    });

    const systemPrompt = `You are a Defense Readiness Advisor embedded in the Cencore Platform — a WRA 2026 capability assessment dashboard. Your role is to help defense/government partners close gaps in their readiness verticals to meet target levels.

PARTNER PROFILE:
- Name: ${partner.name}
- Entity Type: ${partner.entityType || "Unknown"}
- SAM.gov Registration: ${partner.samRegistered ? "Active" : "Inactive"}
- CAGE Code: ${partner.cage || "None"}
- UEI: ${partner.uei}
- Overall Level: L${partner.overallLevel} (${LEVEL_LABELS[partner.overallLevel] || "Unknown"})
- Target Level: L${partner.targetLevel} (${LEVEL_LABELS[partner.targetLevel] || "Unknown"})

WRA LEVEL SCALE:
${Object.entries(LEVEL_LABELS).map(([k, v]) => `L${k}: ${v}`).join("\n")}

VERTICALS AT TARGET (${metVerticals.length}):
${metVerticals.map(v => `✓ ${v.key} — ${v.name}: L${scores[v.key] || 0}`).join("\n") || "None"}

GAP VERTICALS REQUIRING ADVANCEMENT (${gapVerticals.length}):
${verticalDetails.map(v => `⚠ ${v.vertical} — ${v.name} (${v.description})
  Current: L${v.currentLevel} → Target: L${v.targetLevel} (need +${v.delta} levels)
  Missing artifacts (${v.missingArtifacts.length}): ${v.missingArtifacts.slice(0, 10).join("; ") || "None tracked"}
  Verified (${v.verifiedArtifacts.length}): ${v.verifiedArtifacts.slice(0, 5).join("; ") || "None"}`).join("\n\n")}

GUIDELINES:
- Be specific and actionable. Reference exact verticals, levels, and artifact names.
- When recommending actions, prioritize by: (1) Priority 1 verticals (BRL, FRL, PRL, CCRL) first, (2) lowest current levels, (3) artifacts that can be auto-verified via API.
- Suggest concrete steps: specific documents to prepare, certifications to obtain, registrations to complete.
- For each gap, explain what the target level requires in practical terms.
- If asked about a specific vertical, provide a detailed roadmap with milestones.
- Reference relevant regulations (FAR, DFARS, NIST, ITAR, etc.) when applicable.
- Keep responses focused and professional — this is a defense/government context.
- Use short paragraphs and bullet points for readability.
- Do not hallucinate artifact names — only reference artifacts from the data above.`;

    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    for (const h of sanitizedHistory) {
      chatMessages.push({ role: h.role as "user" | "assistant", content: h.content });
    }

    chatMessages.push({ role: "user", content: message });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      let aborted = false;
      req.on("close", () => { aborted = true; });

      const stream = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: chatMessages,
        stream: true,
        max_completion_tokens: 8192,
      });

      for await (const chunk of stream) {
        if (aborted) break;
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      if (!aborted) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
      res.end();
    } catch (error: any) {
      console.error("Gap advisor error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: error.message || "AI service error" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "AI service error" });
      }
    }
  });

  const analysisInProgress = new Set<string>();

  async function runCapabilityDocAnalysis(capabilityId: string, onlyVertical?: string) {
    const lockKey = onlyVertical ? `${capabilityId}:${onlyVertical}` : capabilityId;
    if (analysisInProgress.has(lockKey)) {
      console.log(`[DocAnalysis] Analysis already running for ${lockKey}, skipping`);
      return;
    }
    analysisInProgress.add(lockKey);
    try {
      console.log(`[DocAnalysis] Starting for capability ${capabilityId}${onlyVertical ? ` (vertical: ${onlyVertical})` : ' (all verticals)'}`);
      const capability = await storage.getPartnerCapability(capabilityId);
      if (!capability) { console.log(`[DocAnalysis] Capability not found`); return; }

      const selections = JSON.parse(JSON.stringify(capability.verticalSelections || {})) as Record<string, any>;
      const allArtifacts = await storage.getArtifacts();
      let updated = false;

      const verticalEntries = onlyVertical
        ? Object.entries(selections).filter(([k]) => k === onlyVertical)
        : Object.entries(selections);

    for (const [verticalKey, selection] of verticalEntries) {
      const docs = selection.uploadedDocs || [];
      if (docs.length === 0) continue;

      const checkedIds = (selection.checkedArtifacts || []) as string[];
      const selectedLevel = selection.level || selection.selectedLevel;
      console.log(`[DocAnalysis] ${verticalKey}: ${docs.length} docs, ${checkedIds.length} checked artifacts, level=${selectedLevel}`);

      const verticalArtifactsWithPolicies = allArtifacts.filter(a => {
        if (a.vertical !== verticalKey) return false;
        if (!a.policies || (a.policies as string[]).length === 0) return false;
        return true;
      });
      console.log(`[DocAnalysis] ${verticalKey}: ${verticalArtifactsWithPolicies.length} artifacts with policies in vertical`);
      if (verticalArtifactsWithPolicies.length === 0) continue;

      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        if (doc.complianceScore !== undefined) continue;

        const docArtifact = doc.option
          ? verticalArtifactsWithPolicies.find(a => a.name === doc.option)
          : null;
        const artifactsForDoc = docArtifact ? [docArtifact] : verticalArtifactsWithPolicies.filter(a => {
          if (checkedIds.length > 0) return checkedIds.includes(a.id);
          if (selectedLevel && a.level > selectedLevel) return false;
          return true;
        });

        const relevantPolicies = artifactsForDoc.flatMap(a => {
          const policies = (a.policies || []) as string[];
          const policyLinks = (a.policyLinks || []) as string[];
          return policies.map((p, pi) => ({
            policy: p,
            link: policyLinks[pi] || "",
            artifactName: a.name,
            level: a.level,
          }));
        });

        if (relevantPolicies.length === 0) continue;

        const docFilePath = resolveUploadPath(doc.filePath);
        if (!docFilePath) {
          docs[i] = { ...doc, complianceScore: null, complianceDetails: { error: "File not found on disk" }, scoredAt: new Date().toISOString() };
          updated = true;
          continue;
        }

        let fileContent = "";
        try {
          const buf = fs.readFileSync(docFilePath);
          if (/\.(txt|csv|md|json|xml|html|doc|docx|pdf)$/i.test(doc.fileName || docFilePath)) {
            fileContent = buf.toString("utf-8").slice(0, 8000);
          } else {
            fileContent = `[Binary document — base64 preview]: ${buf.toString("base64").slice(0, 4000)}`;
          }
        } catch {
          fileContent = "[Could not read file content]";
        }

        const policyList = relevantPolicies.map((p, idx) =>
          `${idx + 1}. ${p.policy} (Artifact: ${p.artifactName}, L${p.level})${p.link ? ` — ${p.link}` : ""}`
        ).join("\n");

        const prompt = `You are a defense compliance auditor. Analyze the uploaded document against the following policies and produce a compliance assessment.

VERTICAL: ${verticalKey}
DOCUMENT: ${doc.fileName || "Unknown"}

POLICIES TO VERIFY:
${policyList}

DOCUMENT CONTENT:
${fileContent}

Instructions:
1. For EACH policy, determine if the document demonstrates compliance.
2. Rate each policy: "compliant", "partial", or "non_compliant".
3. Provide a brief reason for each rating.
4. Calculate an overall compliance score from 1-100.

Respond in this exact JSON format:
{
  "overallScore": <number 1-100>,
  "summary": "<brief overall assessment>",
  "policyResults": [
    {
      "policy": "<policy name>",
      "status": "compliant|partial|non_compliant",
      "score": <number 1-100>,
      "reason": "<brief reason>"
    }
  ]
}

Respond ONLY with valid JSON, no markdown or extra text.`;

        try {
          const openai = new OpenAI({
            apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
            baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
          });

          const completion = await openai.chat.completions.create({
            model: "gpt-5-mini",
            messages: [{ role: "user", content: prompt }],
          });

          const raw = completion.choices[0]?.message?.content || "";
          const jsonStr = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
          const result = JSON.parse(jsonStr);
          const score = Math.max(1, Math.min(100, Math.round(result.overallScore || 50)));

          docs[i] = { ...doc, complianceScore: score, complianceDetails: result, scoredAt: new Date().toISOString() };
          updated = true;
          console.log(`Capability doc analysis: ${doc.fileName} scored ${score}/100`);
        } catch (err: any) {
          console.error(`AI analysis error for capability doc ${doc.fileName}:`, err);
          docs[i] = { ...doc, complianceScore: null, complianceDetails: { error: "AI analysis failed — retry later", message: err.message || "Unknown error" }, scoredAt: new Date().toISOString() };
          updated = true;
        }

        if (updated) {
          const freshCap = await storage.getPartnerCapability(capabilityId);
          if (freshCap) {
            const freshSelections = JSON.parse(JSON.stringify(freshCap.verticalSelections || {})) as Record<string, any>;
            const freshSel = freshSelections[verticalKey] || {};
            const freshDocs = freshSel.uploadedDocs || [];
            for (const scoredDoc of docs) {
              const idx = freshDocs.findIndex((d: any) => d.filePath === scoredDoc.filePath);
              if (idx >= 0) {
                freshDocs[idx] = { ...freshDocs[idx], complianceScore: scoredDoc.complianceScore, complianceDetails: scoredDoc.complianceDetails, scoredAt: scoredDoc.scoredAt };
              }
            }
            freshSelections[verticalKey] = { ...freshSel, uploadedDocs: freshDocs };
            await storage.updatePartnerCapability(capabilityId, { verticalSelections: freshSelections } as any);
          }
          console.log(`[DocAnalysis] Incremental save after scoring ${doc.fileName}`);
        }
      }

      selections[verticalKey] = { ...selection, uploadedDocs: docs };
    }

    if (updated) {
      const freshCap = await storage.getPartnerCapability(capabilityId);
      if (freshCap) {
        const freshSelections = JSON.parse(JSON.stringify(freshCap.verticalSelections || {})) as Record<string, any>;
        for (const [vk, sel] of Object.entries(selections)) {
          if (!sel.uploadedDocs) continue;
          const freshSel = freshSelections[vk] || {};
          const freshDocs = freshSel.uploadedDocs || [];
          for (const scoredDoc of sel.uploadedDocs) {
            const idx = freshDocs.findIndex((d: any) => d.filePath === scoredDoc.filePath);
            if (idx >= 0) {
              freshDocs[idx] = { ...freshDocs[idx], complianceScore: scoredDoc.complianceScore, complianceDetails: scoredDoc.complianceDetails, scoredAt: scoredDoc.scoredAt };
            }
          }
          freshSelections[vk] = { ...freshSel, uploadedDocs: freshDocs };
        }
        await storage.updatePartnerCapability(capabilityId, { verticalSelections: freshSelections } as any);
      }
      console.log(`[DocAnalysis] Capability ${capabilityId} doc analysis complete and saved`);
    } else {
      console.log(`[DocAnalysis] No docs were updated for ${capabilityId}`);
    }
    } finally {
      analysisInProgress.delete(lockKey);
    }
  }

  async function runComplianceAnalysis(docId: string, filePath: string, artifact: any) {
    const policies = artifact.policies || [];
    if (policies.length === 0) {
      await storage.updatePartnerDocument(docId, {
        complianceScore: 100,
        complianceDetails: { policies: [], summary: "No policies defined — auto-passed." },
        scoredAt: new Date(),
      } as any);
      return;
    }

    await storage.updatePartnerDocument(docId, {
      complianceDetails: { status: "analyzing", startedAt: new Date().toISOString() },
    } as any);

    let fileContent = "";
    try {
      const buf = fs.readFileSync(filePath);
      if (artifact && /\.(txt|csv|md|json|xml|html)$/i.test(filePath)) {
        fileContent = buf.toString("utf-8").slice(0, 8000);
      } else {
        fileContent = buf.toString("base64").slice(0, 4000);
        fileContent = `[Binary document — base64 preview]: ${fileContent}`;
      }
    } catch {
      fileContent = "[Could not read file content]";
    }

    const policyList = policies.map((p: string, i: number) => {
      const link = artifact.policyLinks?.[i] || "";
      return `${i + 1}. ${p}${link ? ` (${link})` : ""}`;
    }).join("\n");

    const prompt = `You are a defense compliance auditor. Analyze the uploaded document against the following policies and produce a compliance assessment.

ARTIFACT: ${artifact.name}
VERTICAL: ${artifact.vertical}
LEVEL: ${artifact.level}

POLICIES TO VERIFY:
${policyList}

DOCUMENT CONTENT:
${fileContent}

Instructions:
1. For EACH policy, determine if the document demonstrates compliance.
2. Rate each policy: "compliant", "partial", or "non_compliant".
3. Provide a brief reason for each rating.
4. Calculate an overall compliance score from 1-100.

Respond in this exact JSON format:
{
  "overallScore": <number 1-100>,
  "summary": "<brief overall assessment>",
  "policyResults": [
    {
      "policy": "<policy name>",
      "status": "compliant|partial|non_compliant",
      "score": <number 1-100>,
      "reason": "<brief reason>"
    }
  ]
}

Respond ONLY with valid JSON, no markdown or extra text.`;

    try {
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [{ role: "user", content: prompt }],
      });

      const raw = completion.choices[0]?.message?.content || "";
      const jsonStr = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const result = JSON.parse(jsonStr);

      const score = Math.max(1, Math.min(100, Math.round(result.overallScore || 50)));

      await storage.updatePartnerDocument(docId, {
        complianceScore: score,
        complianceDetails: result,
        scoredAt: new Date(),
      } as any);

      console.log(`Compliance analysis complete for doc ${docId}: score=${score}`);
    } catch (err) {
      console.error(`AI compliance analysis error for doc ${docId}, falling back to demo scoring:`, err);

      const demoStatuses = ["compliant", "partial", "non_compliant"];
      const demoReasons: Record<string, string[]> = {
        compliant: [
          "Document adequately addresses this policy requirement with supporting evidence.",
          "Sufficient documentation provided to demonstrate compliance.",
          "Policy requirements are fully met based on document content.",
        ],
        partial: [
          "Document references this requirement but lacks specific implementation details.",
          "Partial evidence found — additional documentation may strengthen compliance.",
          "Some aspects addressed but key supporting artifacts are missing.",
        ],
        non_compliant: [
          "No evidence found in the document addressing this policy requirement.",
          "Document does not reference or demonstrate compliance with this policy.",
          "Critical gap — this policy is not addressed in the submitted documentation.",
        ],
      };

      const policyResults = policies.map((p: string, i: number) => {
        const seed = (docId.charCodeAt(i % docId.length) + i * 31) % 100;
        const status = seed > 55 ? "compliant" : seed > 25 ? "partial" : "non_compliant";
        const pScore = status === "compliant" ? 80 + (seed % 21) : status === "partial" ? 55 + (seed % 25) : 15 + (seed % 35);
        const reasons = demoReasons[status];
        return {
          policy: p,
          status,
          score: pScore,
          reason: reasons[i % reasons.length],
        };
      });

      const avgScore = Math.round(policyResults.reduce((sum: number, r: any) => sum + r.score, 0) / policyResults.length);
      const overallScore = Math.max(1, Math.min(100, avgScore));
      const compCount = policyResults.filter((r: any) => r.status === "compliant").length;
      const summary = `Demo analysis: ${compCount}/${policies.length} policies compliant. Overall score ${overallScore}%.`;

      const demoResult = { overallScore, summary, policyResults, demoMode: true };

      await storage.updatePartnerDocument(docId, {
        complianceScore: overallScore,
        complianceDetails: demoResult,
        scoredAt: new Date(),
      } as any);

      console.log(`Demo compliance scoring complete for doc ${docId}: score=${overallScore}`);
    }
  }

  app.post("/api/documents/:id/analyze", async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Not authenticated" });
    const doc = await storage.getPartnerDocument(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    const userRole = (req as any).user?.role;
    if (userRole !== "admin" && !checkPartnerAccess(req, res, doc.partnerId)) return;

    const artifact = doc.artifactId ? await storage.getArtifact(doc.artifactId) : null;
    if (!artifact) return res.status(400).json({ message: "No artifact linked to this document" });
    if (!artifact.policies || (artifact.policies as string[]).length === 0) {
      return res.status(400).json({ message: "No policies defined for this artifact" });
    }

    const filePath = resolveUploadPath(doc.filePath);
    if (!filePath) return res.status(404).json({ message: "File not found on disk" });

    try {
      await runComplianceAnalysis(doc.id, filePath, artifact);
      const updated = await storage.getPartnerDocument(doc.id);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Analysis failed: " + (err.message || "Unknown error") });
    }
  });

  app.get("/api/partners/:id/documents", async (req, res) => {
    if (!checkPartnerAccess(req, res, req.params.id)) return;
    const partnerArtifactId = req.query.partnerArtifactId as string | undefined;
    const docs = await storage.getPartnerDocuments(req.params.id, partnerArtifactId);
    const userRole = (req as any).user?.role;
    if (userRole !== "admin") {
      const sanitized = docs.map(d => ({ ...d, complianceDetails: d.complianceScore != null ? { summary: (d.complianceDetails as any)?.summary || null } : null }));
      return res.json(sanitized);
    }
    res.json(docs);
  });

  app.post("/api/partners/:id/documents", (req, res, next) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({ message: err.message || "File upload error" });
      }
      next();
    });
  }, async (req, res) => {
    if (!checkPartnerAccess(req, res, req.params.id)) return;
    const partner = await storage.getPartner(req.params.id);
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const { partnerArtifactId, artifactId } = req.body;

    if (partnerArtifactId) {
      const pa = await storage.getPartnerArtifact(partnerArtifactId);
      if (!pa || pa.partnerId !== req.params.id) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ message: "Invalid artifact reference for this partner" });
      }
    }

    const doc = await storage.createPartnerDocument({
      partnerId: req.params.id,
      partnerArtifactId: partnerArtifactId || null,
      artifactId: artifactId || null,
      fileName: file.originalname,
      fileSize: file.size,
      contentType: file.mimetype,
      filePath: file.filename,
    });

    if (partnerArtifactId) {
      const pa = await storage.getPartnerArtifact(partnerArtifactId);
      if (pa && (pa.status === "missing")) {
        await storage.updatePartnerArtifact(partnerArtifactId, {
          status: "draft",
          notes: `Document uploaded: ${file.originalname}`,
          documentRef: `DOC-${doc.id.slice(0, 8).toUpperCase()}`,
        });
      }

      await storage.createActivity({
        partnerId: req.params.id,
        type: "document_upload",
        description: `Document uploaded for artifact: ${file.originalname}`,
        vertical: null,
        metadata: { documentId: doc.id, fileName: file.originalname, artifactId, partnerArtifactId },
      });
    }

    let analysisTriggered = false;
    if (artifactId) {
      const artifact = await storage.getArtifact(artifactId);
      if (artifact && artifact.policies && (artifact.policies as string[]).length > 0) {
        analysisTriggered = true;
        runComplianceAnalysis(doc.id, file.path, artifact).catch(err => {
          console.error(`Compliance analysis failed for doc ${doc.id}:`, err);
        });
      }
    }

    res.status(201).json({ ...doc, analysisTriggered });
  });

  app.get("/api/documents/:filename", (req, res) => {
    const sanitized = path.basename(req.params.filename);
    const filePath = resolveUploadPath(sanitized);
    if (!filePath) return res.status(404).json({ message: "File not found" });
    res.sendFile(filePath);
  });

  app.delete("/api/documents/:id", async (req, res) => {
    const doc = await storage.getPartnerDocument(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const filePath = resolveUploadPath(doc.filePath);
    if (filePath) fs.unlinkSync(filePath);

    await storage.deletePartnerDocument(req.params.id);
    res.status(204).end();
  });

  app.get("/api/stats", async (_req, res) => {
    const partners = await storage.getPartners();
    const allAssessments = await storage.getAllAssessments();
    const totalPartners = partners.length;
    const activeAssessments = allAssessments.filter(a => a.status === "in_progress").length;
    const pendingAssessments = allAssessments.filter(a => a.status === "pending_review").length;
    const samRegistered = partners.filter(p => p.samRegistered).length;

    res.json({
      totalPartners,
      activeAssessments,
      pendingAssessments,
      samRegistered,
    });
  });

  app.post("/api/admin/guide", requireAdmin, async (req, res) => {
    const { message, history, context } = req.body;
    if (!message || typeof message !== "string") return res.status(400).json({ message: "Message is required" });
    if (message.length > 2000) return res.status(400).json({ message: "Message too long (max 2000 chars)" });

    const sanitizedHistory: Array<{ role: string; content: string }> = [];
    if (history && Array.isArray(history)) {
      const recent = history.slice(-20);
      for (const h of recent) {
        if (h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string") {
          sanitizedHistory.push({ role: h.role, content: h.content.slice(0, 4000) });
        }
      }
    }

    const partners = await storage.getPartners();
    const allArtifacts = await storage.getArtifacts();
    const capabilities = await storage.getCapabilities();
    const verticalConfigs = await storage.getVerticalConfigs();
    const configMap = new Map(verticalConfigs.map(c => [c.verticalKey, c]));

    const verticalSummary = VERTICALS.map(v => {
      const config = configMap.get(v.key);
      const artifactCount = allArtifacts.filter(a => a.vertical === v.key).length;
      return `${v.key} — ${config?.label || v.name}: ${config?.enabled !== false ? "Enabled" : "Disabled"}, Max L${config?.maxLevel || 9}, ${artifactCount} artifacts`;
    }).join("\n");

    const capSummary = capabilities.map(c => {
      const subs = (c as any).subCapabilities || [];
      return `${c.name} (${subs.length} sub-capabilities)`;
    }).join("\n");

    const artifactSummary = VERTICALS.map(v => {
      const arts = allArtifacts.filter(a => a.vertical === v.key);
      if (arts.length === 0) return null;
      return `${v.key}: ${arts.map(a => `${a.name} (L${a.level}, ${a.verificationMethod})`).join("; ")}`;
    }).filter(Boolean).join("\n");

    const partnerSummary = partners.map(p => {
      const scores = p.scores as Record<string, number>;
      const gapCount = VERTICALS.filter(v => (scores[v.key] || 0) < p.targetLevel).length;
      return `${p.name}: L${p.overallLevel}→L${p.targetLevel}, SAM ${p.samRegistered ? "✓" : "✗"}, ${gapCount} gap verticals`;
    }).join("\n");

    const systemPrompt = `You are the CENCORE Platform Admin Guide — an AI assistant embedded in the Configuration section of the WRA 2026 capability assessment dashboard. Your role is to help administrators understand and manage the platform's configuration effectively.

PLATFORM OVERVIEW:
The Cencore Platform is a Warfighter Readiness Assessment (WRA) 2026 capability assessment dashboard for defense/government partners. It evaluates partners across 17 readiness verticals and 9 capability levels (L1-L9).

WRA LEVEL SCALE:
${Object.entries(LEVEL_LABELS).map(([k, v]) => `L${k}: ${v}`).join("\n")}

CURRENT VERTICALS (${VERTICALS.length}):
${verticalSummary}

CAPABILITIES (${capabilities.length}):
${capSummary || "None configured"}

ARTIFACTS:
${artifactSummary || "None configured"}

PARTNERS (${partners.length}):
${partnerSummary || "None registered"}

CURRENT ADMIN CONTEXT: ${context || "General configuration"}

CONFIGURATION TABS:
1. Verticals — Enable/disable readiness verticals, set max levels, customize labels
2. Capabilities — Define capability categories and sub-capabilities for assessment structuring
3. Artifacts — Define verification artifacts per vertical with levels, verification methods, and policy references

VERIFICATION METHODS:
- automatic: System verifies data automatically via API or integration
- self_attested: Client checks a checkbox declaration confirming the capability
- manual_upload: Client uploads supporting documents

GUIDELINES:
- Be specific and reference actual data from the platform (verticals, artifacts, partner counts).
- When asked about best practices, reference defense/government compliance frameworks (FAR, DFARS, NIST, ITAR, CRL/CCRL).
- Provide actionable recommendations — e.g., "Add a CRL Level 2 artifact (Security Plan) to advance cyber readiness" rather than vague advice.
- If asked about a specific vertical, describe what artifacts are already configured and what might be missing.
- Help admins understand the relationship between verticals, capabilities, artifacts, and partner scoring.
- Suggest optimal configurations based on defense industry standards.
- Keep responses focused, professional, and formatted with bullet points for readability.
- Do not hallucinate data — only reference what exists in the platform data above.`;

    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];
    for (const h of sanitizedHistory) {
      chatMessages.push({ role: h.role as "user" | "assistant", content: h.content });
    }
    chatMessages.push({ role: "user", content: message });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      let aborted = false;
      req.on("close", () => { aborted = true; });

      const stream = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: chatMessages,
        stream: true,
        max_completion_tokens: 8192,
      });

      for await (const chunk of stream) {
        if (aborted) break;
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      if (!aborted) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
      res.end();
    } catch (error: any) {
      console.error("Admin guide error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: error.message || "AI service error" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "AI service error" });
      }
    }
  });

  app.post("/api/admin/chatbot", requireAdmin, async (req, res) => {
    const { message, history } = req.body;
    if (!message || typeof message !== "string") return res.status(400).json({ message: "Message required" });
    if (message.length > 4000) return res.status(400).json({ message: "Message too long" });
    const sanitizedHistory = (Array.isArray(history) ? history : [])
      .slice(-20)
      .filter((h: any) => h && typeof h.role === "string" && typeof h.content === "string" && ["user", "assistant"].includes(h.role) && h.content.length <= 4000);

    const partners = await storage.getPartners();
    const allArtifacts = await storage.getArtifacts();

    const partnerCapsSummary: string[] = [];
    for (const p of partners) {
      const caps = await storage.getPartnerCapabilities(p.id);
      const statuses = caps.reduce((acc: Record<string, number>, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      }, {});
      const statusStr = Object.entries(statuses).map(([s, n]) => `${n} ${s}`).join(", ");
      partnerCapsSummary.push(`${p.name} (UEI: ${p.uei}, CAGE: ${p.cage || "N/A"}, SAM: ${p.samRegistered ? "Yes" : "No"}): ${caps.length} capabilities (${statusStr || "none"})`);
    }

    const artifactsByVertical: Record<string, string[]> = {};
    allArtifacts.forEach(a => {
      if (!artifactsByVertical[a.vertical]) artifactsByVertical[a.vertical] = [];
      artifactsByVertical[a.vertical].push(`L${a.level}: ${a.name} (${a.verificationMethod})`);
    });
    const artifactSummary = Object.entries(artifactsByVertical).map(([v, arts]) => `${v}: ${arts.join("; ")}`).join("\n");

    const systemPrompt = `You are the CENCORE Admin Assistant — an AI chatbot embedded in the CENCORE WRA 2026 capability assessment dashboard. You help administrators with:

1. DASHBOARD EXPLANATION: Explain what each metric, chart, and section on the dashboard means (Total Partners, Total Capabilities, Needs Review, Verified, SAM.gov Verified, Assessment Pipeline, Verification Rate, Vertical Coverage, Partner Portfolio).

2. PARTNER ASSESSMENT: Help admins understand the partner assessment workflow — how capabilities flow from Submitted → Under Review → Feedback Sent → Partner Responded → Verified/Not Verified. Explain what each status means and what actions admins should take.

3. CONFIGURATION: Explain how the platform's configurator works — verticals (9 readiness verticals: TRL, PRL, CRL, IRL, SCRL, TVRL, MRL, HRL, AIRL), artifacts (verification items per vertical per level), and how they connect to partner assessments.

4. POLICY & COMPLIANCE: Explain defense/government policies referenced in the platform — FAR, DFARS, NIST SP 800-171, ITAR, CMMC, RMF (Risk Management Framework), ATO (Authority to Operate), STIG compliance, etc. Help admins understand what each vertical assesses against which regulatory framework.

5. ASSESSMENT REVIEW: Guide admins through reviewing partner capabilities — what to look for in each vertical, how to evaluate maturity levels L1-L9, when to send feedback vs. verify/reject.

PLATFORM DATA:
Partners (${partners.length}):
${partnerCapsSummary.join("\n")}

Artifacts by Vertical:
${artifactSummary}

9 VERTICALS:
- TRL (Technology Readiness): Measures technology maturity from basic research to mission-proven
- PRL (Policy & Legal): Covers policy compliance, data rights, ITAR, privacy, legal authority
- CRL (Cyber Security): RMF, ATO, STIG, Zero Trust security posture
- IRL (Integration): System-of-systems interoperability and multi-domain integration
- SCRL (Supply Chain): SCRM, dual sourcing, SBOM, geopolitical risk
- TVRL (Testing & Verification): TEMP, test procedures, OT&E, safety release
- MRL (Manufacturing): Production maturity from lab to full-rate production
- HRL (Human Engineering): Human factors, usability, training, operator trust
- AIRL (AI Readiness): AI/ML maturity, data governance, XAI, ethical AI

MATURITY LEVELS:
L1: Initial — Basic awareness
L2: Defined — Requirements documented
L3: Managed — Processes established
L4: Quantified — Metrics tracked
L5: Optimizing — Continuous improvement
L6: Demonstrated — Proven in relevant environment
L7: Validated — Multi-domain validation
L8: Certified — Full certification
L9: Mission Ready — Operational deployment

GUIDELINES:
- Be specific, professional, and reference actual platform data when possible.
- Use bullet points and structured formatting for readability.
- When explaining policies, provide the regulation number and a brief practical explanation.
- Help admins make informed decisions about partner assessments.
- Do not hallucinate data — only reference what exists in the platform.`;

    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];
    for (const h of sanitizedHistory) {
      chatMessages.push({ role: h.role as "user" | "assistant", content: h.content });
    }
    chatMessages.push({ role: "user", content: message });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      let aborted = false;
      req.on("close", () => { aborted = true; });

      const stream = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: chatMessages,
        stream: true,
        max_completion_tokens: 8192,
      });

      for await (const chunk of stream) {
        if (aborted) break;
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      if (!aborted) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
      res.end();
    } catch (error: any) {
      console.error("Admin chatbot error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: error.message || "AI service error" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "AI service error" });
      }
    }
  });

  app.post("/api/partner/chatbot", async (req, res) => {
    if (!req.user || req.user.role !== "partner") return res.status(403).json({ message: "Partner access only" });
    const partnerId = req.user.partnerId;
    if (!partnerId) return res.status(400).json({ message: "No partner linked" });

    const { message, history } = req.body;
    if (!message || typeof message !== "string") return res.status(400).json({ message: "Message required" });
    if (message.length > 4000) return res.status(400).json({ message: "Message too long" });
    const sanitizedHistory = (Array.isArray(history) ? history : [])
      .slice(-20)
      .filter((h: any) => h && typeof h.role === "string" && typeof h.content === "string" && ["user", "assistant"].includes(h.role) && h.content.length <= 4000);

    const partner = await storage.getPartner(partnerId);
    const partnerCaps = await storage.getPartnerCapabilities(partnerId);
    const allArtifacts = await storage.getArtifacts();

    const capSummary = partnerCaps.map(c => {
      const vs = (c.verticalSelections as Record<string, { level?: number }>) || {};
      const verticals = Object.entries(vs).filter(([, v]) => v.level && v.level > 0).map(([k, v]) => `${k}:L${v.level}`).join(", ");
      return `"${c.name}" (${c.offeringType}, status: ${c.status}): ${verticals || "no verticals assessed"}`;
    }).join("\n");

    const artifactsByVertical: Record<string, string[]> = {};
    allArtifacts.forEach(a => {
      if (!artifactsByVertical[a.vertical]) artifactsByVertical[a.vertical] = [];
      artifactsByVertical[a.vertical].push(`L${a.level}: ${a.name} — ${a.description || ""} (${a.verificationMethod})${a.policies?.length ? ` [Policy: ${a.policies.join(", ")}]` : ""}`);
    });
    const artifactSummary = Object.entries(artifactsByVertical).map(([v, arts]) => `${v}:\n  ${arts.join("\n  ")}`).join("\n\n");

    const systemPrompt = `You are the IWE Partner Assistant — an AI chatbot embedded in the partner portal of the CENCORE WRA 2026 capability assessment platform. You help partners (defense contractors/vendors) with:

1. FILLING OUT CAPABILITIES: Guide partners through the 4-step capability wizard:
   - Step 1 (Basic Info): Product/service name, offering type (product/service/capability), description, problem statement, image, and supporting materials (Quad Chart, White Paper, etc.)
   - Step 2 (Governance Verticals): TRL, PRL, CRL, IRL — select maturity level (L1-L9), check required artifacts, upload supporting documents, add compliance remarks
   - Step 3 (Operational Verticals): SCRL, TVRL, MRL, HRL, AIRL — same as governance but for operational readiness
   - Step 4 (Review & Submit): Review all sections and submit for admin assessment

2. EXPLAINING EACH SECTION/VERTICAL:
   - TRL (Technology Readiness): How mature is your technology? From basic principles (L1) to mission-proven (L9). Key policy: DoDD 5000.01
   - PRL (Policy & Legal): Are you compliant with export controls, data rights, privacy? Key: ITAR, DFARS 252.227, Privacy Act
   - CRL (Cyber Security): RMF categorization, ATO, STIG compliance, Zero Trust. Key: DoDI 8510.01, NIST SP 800-53
   - IRL (Integration): Can your product integrate with existing DoD systems? Key: DoDI 5000.88
   - SCRL (Supply Chain): Supply chain risk management, dual sourcing. Key: NIST SP 800-161
   - TVRL (Testing & Verification): Test plans, OT&E data, safety release. Key: DoDI 5000.89
   - MRL (Manufacturing): Production readiness from lab to full-rate. Key: DoD MRL Deskbook
   - HRL (Human Engineering): Usability, human factors, operator training. Key: DoDD 1100.4
   - AIRL (AI Readiness): AI/ML governance, data pipelines, explainability. Key: DoD AI Strategy

3. EXPLAINING ARTIFACTS: For each vertical level, there are specific artifacts (documents/certifications) that need to be verified. Explain what each artifact is, why it's needed, and how to prepare it.

4. EXPLAINING DASHBOARDS: Help partners understand their home dashboard — Capabilities count, Average Readiness, Verticals Assessed, Feedback Pending, Readiness chart, Assessment Progress.

5. ASSESSMENT STATUS: Explain what each status means:
   - Draft: Not yet submitted, can edit freely
   - Submitted: Sent for admin review, waiting for assessment
   - Feedback Received: Admin has sent feedback — partner needs to respond/update
   - Verified: Admin approved the capability assessment
   - Not Verified: Admin found issues — may need to resubmit

YOUR PARTNER'S DATA:
Partner: ${partner?.name || "Unknown"} (UEI: ${partner?.uei || "N/A"}, CAGE: ${partner?.cage || "N/A"}, SAM: ${partner?.samRegistered ? "Registered" : "Not Registered"})

Current Capabilities (${partnerCaps.length}):
${capSummary || "No capabilities submitted yet"}

AVAILABLE ARTIFACTS BY VERTICAL:
${artifactSummary}

MATURITY LEVELS (L1-L9):
L1: Initial — Basic awareness and identification
L2: Defined — Requirements and plans documented
L3: Managed — Processes established and controlled
L4: Quantified — Performance metrics tracked
L5: Optimizing — Continuous improvement implemented
L6: Demonstrated — Proven in relevant environment
L7: Validated — Multi-domain/multi-service validation
L8: Certified — Full certification and accreditation
L9: Mission Ready — Operational deployment confirmed

GUIDELINES:
- Be helpful, clear, and practical. Partners may not be familiar with DoD jargon.
- When explaining artifacts, describe them in simple terms and mention what documents to prepare.
- Reference specific policies/regulations when relevant but explain them simply.
- If the partner asks about a vertical they haven't assessed yet, explain what's involved and what level they should aim for.
- Help partners understand how to improve their readiness levels.
- Do not hallucinate data — only reference what exists in their profile and the platform.`;

    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];
    for (const h of sanitizedHistory) {
      chatMessages.push({ role: h.role as "user" | "assistant", content: h.content });
    }
    chatMessages.push({ role: "user", content: message });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      let aborted = false;
      req.on("close", () => { aborted = true; });

      const stream = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: chatMessages,
        stream: true,
        max_completion_tokens: 8192,
      });

      for await (const chunk of stream) {
        if (aborted) break;
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      if (!aborted) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
      res.end();
    } catch (error: any) {
      console.error("Partner chatbot error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: error.message || "AI service error" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "AI service error" });
      }
    }
  });

  // ── Resources ─────────────────────────────────────────────────────────────
  app.get("/api/resources", requireAuth, async (_req, res) => {
    const all = await storage.getResources();
    res.json(all);
  });

  app.post("/api/resources", requireAdmin, upload.single("file"), async (req, res) => {
    const parsed = insertResourceSchema.safeParse({
      title: req.body.title,
      description: req.body.description || null,
      category: req.body.category || "Reference Materials",
      fileType: req.body.fileType || "PDF",
      externalUrl: req.body.externalUrl || null,
      filePath: req.file ? `/uploads/${req.file.filename}` : null,
    });
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
    const created = await storage.createResource(parsed.data);
    res.status(201).json(created);
  });

  app.delete("/api/resources/:id", requireAdmin, async (req, res) => {
    await storage.deleteResource(req.params.id);
    res.status(204).end();
  });

  // ── Events ─────────────────────────────────────────────────────────────────
  app.get("/api/events", requireAuth, async (_req, res) => {
    const all = await storage.getEvents();
    res.json(all);
  });

  app.post("/api/events", requireAdmin, upload.single("image"), async (req, res) => {
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : (req.body.imageUrl || null);
    const parsed = insertEventSchema.safeParse({
      title: req.body.title,
      description: req.body.description || null,
      imageUrl,
      startDate: req.body.startDate || null,
      endDate: req.body.endDate || null,
      location: req.body.location || null,
      link: req.body.link || null,
    });
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
    const created = await storage.createEvent(parsed.data);
    res.status(201).json(created);
  });

  app.patch("/api/events/:id", requireAdmin, async (req, res) => {
    const updated = await storage.updateEvent(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Event not found" });
    res.json(updated);
  });

  app.delete("/api/events/:id", requireAdmin, async (req, res) => {
    await storage.deleteEvent(req.params.id);
    res.status(204).end();
  });

  app.get("/api/assessments", requireAdmin, async (_req, res) => {
    const allAssessments = await storage.getAllAssessments();
    const partners = await storage.getPartners();
    const partnerMap = new Map(partners.map(p => [p.id, p]));

    const enriched = await Promise.all(allAssessments.map(async (a) => {
      const cap = a.capabilityId ? await storage.getCapability(a.capabilityId) : null;
      const sub = a.subCapabilityId ? await storage.getSubCapability(a.subCapabilityId) : null;
      const partner = partnerMap.get(a.partnerId);
      return { ...a, capability: cap, subCapability: sub, partnerName: partner?.name || "Unknown" };
    }));

    res.json(enriched);
  });

  return httpServer;
}
