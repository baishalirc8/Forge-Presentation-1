import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { partners, activities, artifacts, partnerArtifacts, verticalConfigs, users, capabilities, subCapabilities } from "@shared/schema";
import { VERTICALS } from "@shared/schema";
import { hashPassword } from "./auth";
import fs from "fs";
import path from "path";
import pg from "pg";

async function cleanVerticalConfigData() {
  const verticalsToClean = ['BRL','FRL','CCRL','SRL','SFTL','MSNL','WRL','LDRL'];
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const check = await client.query(
      `SELECT count(*)::int as cnt FROM artifacts WHERE vertical = ANY($1)`,
      [verticalsToClean]
    );
    const cnt = check.rows[0]?.cnt ?? 0;
    if (cnt === 0) {
      console.log("Vertical config cleanup already done, skipping");
      return;
    }

    console.log(`Cleaning configurator data for ${verticalsToClean.join(', ')}...`);

    await client.query(
      `DELETE FROM partner_artifacts WHERE artifact_id IN (SELECT id FROM artifacts WHERE vertical = ANY($1))`,
      [verticalsToClean]
    );

    await client.query(
      `DELETE FROM artifacts WHERE vertical = ANY($1)`,
      [verticalsToClean]
    );

    console.log(`Cleaned configurator artifacts for ${verticalsToClean.length} verticals`);
  } catch (err: any) {
    console.error("Vertical config cleanup error:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

async function runSeedDataDump() {
  const jsonPath = path.join(import.meta.dirname || __dirname, "seed-data.json");
  if (!fs.existsSync(jsonPath)) {
    console.log("No seed-data.json found, skipping data restore");
    return;
  }

  const capRows = await db.execute(sql`SELECT count(*)::int as cnt FROM partner_capabilities`);
  const capCount = (capRows.rows?.[0] as any)?.cnt ?? 0;
  if (capCount > 0) {
    console.log("Database already has capability data, skipping seed-data.json");
    return;
  }

  console.log("Restoring full dev data from seed-data.json...");
  const statements: string[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const tablesToClear = [
      "messages", "conversations",
      "activities", "assessment_feedback", "assessments",
      "partner_capabilities", "partner_documents", "partner_artifacts",
      "partners", "artifacts", "sub_capabilities", "capabilities",
      "vertical_configs", "users"
    ];
    for (const table of tablesToClear) {
      await client.query(`DELETE FROM ${table}`).catch(() => {});
    }
    console.log("Cleared existing data");

    let executed = 0;
    let errors = 0;
    for (const stmt of statements) {
      try {
        await client.query(stmt);
        executed++;
      } catch (err: any) {
        errors++;
        if (errors <= 5) {
          console.error(`Insert error [${errors}]: ${err.message.substring(0, 150)}`);
        }
      }
    }

    console.log(`seed-data.json: ${executed}/${statements.length} inserted, ${errors} errors`);
  } catch (err: any) {
    console.error("seed-data.json restore failed:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

async function clearStaleCapabilityData() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const artRows = await client.query(`SELECT id FROM artifacts`);
    const artIdSet = new Set(artRows.rows.map((r: any) => r.id));

    const capRows = await client.query(`SELECT id, vertical_selections FROM partner_capabilities WHERE vertical_selections IS NOT NULL`);
    let clearedCount = 0;

    for (const cap of capRows.rows) {
      const selections = cap.vertical_selections;
      if (!selections || typeof selections !== "object") continue;

      let hasStaleIds = false;
      for (const [, sel] of Object.entries(selections) as [string, any][]) {
        const checkedIds = sel.checkedArtifacts;
        if (!Array.isArray(checkedIds) || checkedIds.length === 0) continue;
        if (checkedIds.some((id: string) => !artIdSet.has(id))) {
          hasStaleIds = true;
          break;
        }
      }

      if (hasStaleIds) {
        await client.query(
          `UPDATE partner_capabilities SET vertical_selections = '{}', status = 'draft' WHERE id = $1`,
          [cap.id]
        );
        clearedCount++;
        console.log(`[Cleanup] Cleared stale capability data for ${cap.id} — partner can re-submit`);
      }
    }

    if (clearedCount > 0) {
      console.log(`[Cleanup] Reset ${clearedCount} capability record(s) with mismatched artifact IDs`);
    } else {
      console.log("[Cleanup] No stale capability data found");
    }
  } catch (err: any) {
    console.error("[Cleanup] Error:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

export async function seedDatabase() {
  await cleanVerticalConfigData();

  for (const v of VERTICALS) {
    await db.insert(verticalConfigs).values({
      verticalKey: v.key,
      label: v.name,
      description: v.description,
      enabled: true,
      maxLevel: 9,
    }).onConflictDoNothing();
  }

  await seedCapabilities();

  await runSeedDataDump();

  await clearStaleCapabilityData();

  const existing = await db.select().from(partners);
  if (existing.length > 0) return;

  const artifactDefs = [
    { vertical: "BRL", level: 1, name: "Articles of Incorporation", regulation: "State Statutes / UCC; 13 CFR § 121", verificationMethod: "automatic", description: "Legal Formation" },
    { vertical: "BRL", level: 2, name: "Validated SAM.gov Profile", regulation: "FAR Subpart 4.11; 2 CFR Part 25", verificationMethod: "manual_upload", description: "Corporate Registration" },
    { vertical: "BRL", level: 3, name: "SF-328 (Foreign Interests)", regulation: "32 CFR Part 117 (NISPOM); DoDI 5220.22", verificationMethod: "automatic", description: "FOCI Mitigation" },
    { vertical: "BRL", level: 4, name: "CAGE Code Confirmation", regulation: "FAR 52.204-7; DFARS 204.72; FAR 52.203-13", verificationMethod: "manual_upload", description: "CAGE & Ethics" },
    { vertical: "BRL", level: 5, name: "DD Form 2345 (JCP)", regulation: "22 CFR Parts 120-130 (ITAR); 15 CFR Parts 730-774 (EAR)", verificationMethod: "automatic", description: "Export Control" },
    { vertical: "BRL", level: 6, name: "OCI Mitigation Plan", regulation: "FAR Subpart 9.5; DFARS 252.227-7013", verificationMethod: "manual_upload", description: "OCI & IP Rights" },
    { vertical: "BRL", level: 7, name: "SPRS Score Statement", regulation: "DFARS 252.204-7012 / 7019 / 7020 (CMMC 2.0)", verificationMethod: "manual_upload", description: "Cyber Maturity" },
    { vertical: "BRL", level: 8, name: "FCL Sponsorship Letter", regulation: "32 CFR § 117.13; 48 CFR Chapter 99", verificationMethod: "manual_upload", description: "FCL & CAS" },
    { vertical: "BRL", level: 9, name: "Enterprise Risk Assessment", regulation: "OMB Circular A-123; DoDD 5000.01", verificationMethod: "automatic", description: "Governance" },
    { vertical: "FRL", level: 1, name: "IRS Form SS-4 (EIN Assignment)", regulation: "IRS Publication 583", verificationMethod: "manual_upload", description: "Initial Records" },
    { vertical: "FRL", level: 2, name: "Chart of Accounts (COA)", regulation: "FAR 31.201-2", verificationMethod: "automatic", description: "System & Cost Centers" },
    { vertical: "FRL", level: 3, name: "Internal Control Policy", regulation: "COSO Framework; FAR 52.203-13", verificationMethod: "manual_upload", description: "Policies & Segregation" },
    { vertical: "FRL", level: 4, name: "Completed SF-1408 Checklist", regulation: "Standard Form 1408", verificationMethod: "manual_upload", description: "SF-1408 Pre-Audit" },
    { vertical: "FRL", level: 5, name: "Capitalization (Cap) Table", regulation: "FAR 42.704; DoDI 5000.85", verificationMethod: "manual_upload", description: "Rates & Transparency" },
    { vertical: "FRL", level: 6, name: "Labor Distribution Report", regulation: "DFARS 252.242-7006", verificationMethod: "manual_upload", description: "Compliant Job-Costing" },
    { vertical: "FRL", level: 7, name: "Incurred Cost Submission (ICS)", regulation: "FAR 52.216-7; DCAA Manual 7641.90", verificationMethod: "manual_upload", description: "Incurred Cost/Liquidity" },
    { vertical: "FRL", level: 8, name: "Forward Pricing Rate Proposal", regulation: "FAR 42.17; DFARS 215.407-3", verificationMethod: "manual_upload", description: "Forward Pricing" },
    { vertical: "FRL", level: 9, name: "CAS Disclosure Statement (DS-1)", regulation: "48 CFR Chapter 99 (CAS); PL 100-679", verificationMethod: "manual_upload", description: "CAS-Compliant" },
    { vertical: "PRL", level: 1, name: "Policy Impact Analysis", regulation: "DoDI 5000.02 (Acquisition Law)", policies: ["DoDI 5000.02 (Acquisition Law)"], verificationMethod: "manual_upload", description: "Policy Constraints" },
    { vertical: "PRL", level: 2, name: "Privacy Impact Assessment (PIA)", regulation: "DoDI 5400.11 (Privacy Program)", policies: ["DoDI 5400.11 (Privacy Program)"], verificationMethod: "manual_upload", description: "PIA Drafted" },
    { vertical: "PRL", level: 3, name: "Targeting Logic (LOAC Analysis)", regulation: "CJCSI 5810.01 (LOAC Review)", policies: ["CJCSI 5810.01 (LOAC Review)"], verificationMethod: "manual_upload", description: "LOAC Review" },
    { vertical: "PRL", level: 4, name: "DFARS Data Rights Table", regulation: "DFARS 227.71 (Data Rights)", policies: ["DFARS 227.71 (Data Rights)"], verificationMethod: "manual_upload", description: "Data Rights/EULA" },
    { vertical: "PRL", level: 5, name: "Article 36 Review Report", regulation: "DoDD 5000.01 (Weapons Legal Review)", policies: ["DoDD 5000.01 (Weapons Legal Review)"], verificationMethod: "manual_upload", description: "Article 36 Review" },
    { vertical: "PRL", level: 6, name: "PII/PHI Anonymization Plan", regulation: "Privacy Act of 1974 / HIPAA", policies: ["Privacy Act of 1974 / HIPAA"], verificationMethod: "manual_upload", description: "PII/PHI Certified" },
    { vertical: "PRL", level: 7, name: "Policy Waiver / Exception (ETP)", regulation: "DoDI 5000.02 (Acquisition Policy)", policies: ["DoDI 5000.02 (Acquisition Policy)"], verificationMethod: "manual_upload", description: "Waivers/Exceptions" },
    { vertical: "PRL", level: 8, name: "Legal Authority to Operate (LATO)", regulation: "Joint Publication 3-0 (Legal Basis)", policies: ["Joint Publication 3-0 (Legal Basis)"], verificationMethod: "manual_upload", description: "Authority/Basis" },
    { vertical: "PRL", level: 9, name: "International Legal Clearance Memo", regulation: "DoDD 2311.01 (Law of War Program)", policies: ["DoDD 2311.01 (Law of War Program)"], verificationMethod: "manual_upload", description: "Global Clearance" },
    { vertical: "CCRL", level: 1, name: "Rough Order of Magnitude (ROM)", regulation: "FAR Part 15 (Contract Pricing)", verificationMethod: "manual_upload", description: "ROM Cost" },
    { vertical: "CCRL", level: 2, name: "Cost-Benefit Analysis (CBA)", regulation: "OSD CAPE Guidance", verificationMethod: "manual_upload", description: "CBA vs. Legacy" },
    { vertical: "CCRL", level: 3, name: "Market Research Report", regulation: "FAR Part 10 (Market Research)", verificationMethod: "manual_upload", description: "Market Research" },
    { vertical: "CCRL", level: 4, name: "Commercial Product Determination", regulation: "FAR Part 12 (Commercial Items)", verificationMethod: "manual_upload", description: "Commerciality" },
    { vertical: "CCRL", level: 5, name: "Independent Gov Cost Est (IGCE)", regulation: "FAR Part 15.4 (Contract Pricing)", verificationMethod: "manual_upload", description: "IGCE Validated" },
    { vertical: "CCRL", level: 6, name: "Life Cycle Cost (LCC) Model", regulation: "DoDI 5000.73 (Cost Analysis)", verificationMethod: "manual_upload", description: "TCO / LCC" },
    { vertical: "CCRL", level: 7, name: "Basis of Estimate (BOE)", regulation: "FAR Part 15 (Price Reasonableness)", verificationMethod: "manual_upload", description: "Price Reasonableness" },
    { vertical: "CCRL", level: 8, name: "Formal Pricing Proposal & MIPR", regulation: "GFEBS / DEAMS (Financial Systems)", verificationMethod: "manual_upload", description: "Proposal/Funding" },
    { vertical: "CCRL", level: 9, name: "Historical Price Performance Log", regulation: "FPDS-NG (Federal Spend Data)", verificationMethod: "manual_upload", description: "Price Stability" },
    { vertical: "CRL", level: 1, name: "Cyber Risk Assessment (CRA)", regulation: "NIST SP 800-30 (Risk Assessments)", policies: ["NIST SP 800-30 (Risk Assessments)"], verificationMethod: "manual_upload", description: "Threat Awareness" },
    { vertical: "CRL", level: 2, name: "Security Plan (SP)", regulation: "NIST SP 800-60 / FIPS 199", policies: ["NIST SP 800-60 / FIPS 199"], verificationMethod: "manual_upload", description: "RMF Categorization" },
    { vertical: "CRL", level: 3, name: "MFA Implementation Report", regulation: "Executive Order 14028 (Improving Cybersecurity)", policies: ["Executive Order 14028 (Improving Cybersecurity)"], verificationMethod: "manual_upload", description: "Hygiene & MFA" },
    { vertical: "CRL", level: 4, name: "Boundary Protection Plan", regulation: "DoD Cloud Computing SRG (IL Levels)", policies: ["DoD Cloud Computing SRG (IL Levels)"], verificationMethod: "manual_upload", description: "Enclave Design" },
    { vertical: "CRL", level: 5, name: "STIG Compliance Logs", regulation: "NIST SP 800-53 Rev. 5", policies: ["NIST SP 800-53 Rev. 5"], verificationMethod: "manual_upload", description: "Controls Implemented" },
    { vertical: "CRL", level: 6, name: "Authorization to Operate (ATO)", regulation: "DoDI 8510.01 (RMF for DoD)", policies: ["DoDI 8510.01 (RMF for DoD), SECDEF Mandate Software Acquisition Pathway (SWP)"], verificationMethod: "manual_upload", description: "IL5/IL6 Accredited" },
    { vertical: "CRL", level: 7, name: "Continuous Monitoring Strategy", regulation: "NIST SP 800-137 (ISCM)", policies: ["NIST SP 800-137 (ISCM)"], verificationMethod: "manual_upload", description: "Continuous Monitoring" },
    { vertical: "CRL", level: 8, name: "Incident Response Plan (IRP)", regulation: "DoDI 8530.01 (Cybersecurity Activities)", policies: ["DoDI 8530.01 (Cybersecurity Activities)"], verificationMethod: "manual_upload", description: "Cyber Ops" },
    { vertical: "CRL", level: 9, name: "Zero Trust Architecture (ZTA)", regulation: "DoD Zero Trust Strategy & Reference Architecture", policies: ["DoD Zero Trust Strategy & Reference Architecture. SECDEF Memorandum, \"Directing Modern Software Acquisition to Maximize Lethality\""], verificationMethod: "manual_upload", description: "Zero-Trust" },
    { vertical: "TRL", level: 1, name: "Scientific White Papers / Patent Filings", regulation: "DoD TRA Guidebook", policies: ["DoDI 5000.02 (Acquisition Law)"], verificationMethod: "manual_upload", description: "Basic Principles" },
    { vertical: "TRL", level: 2, name: "Conceptual Design Diagrams", regulation: "DoD TRA Guidebook", policies: ["DoDI 5400.11 (Privacy Program)"], verificationMethod: "manual_upload", description: "Concept Formulated" },
    { vertical: "TRL", level: 3, name: "Lab Bench Test Data Logs", regulation: "DoDI 5000.02", policies: ["CJCSI 5810.01 (LOAC Review)"], verificationMethod: "manual_upload", description: "Proof-of-Concept" },
    { vertical: "TRL", level: 4, name: "Software Unit Test Results", regulation: "NIST SP 800-115", policies: ["DFARS 227.71 (Data Rights)"], verificationMethod: "manual_upload", description: "Lab Validation" },
    { vertical: "TRL", level: 5, name: "High-Fidelity M&S Results", regulation: "DoD TRA Guidebook", policies: ["DoDD 5000.01 (Weapons Legal Review)"], verificationMethod: "manual_upload", description: "Relevant Env" },
    { vertical: "TRL", level: 6, name: "TRA Certification Report", regulation: "10 U.S.C. § 4251", policies: ["Privacy Act of 1974 / HIPAA"], verificationMethod: "manual_upload", description: "Prototype (Relevant)" },
    { vertical: "TRL", level: 7, name: "Interface Control Document (ICD)", regulation: "10 U.S.C. § 4401 (MOSA)", policies: ["DoDI 5000.02 (Acquisition Policy)"], verificationMethod: "manual_upload", description: "Prototype (Ops/MOSA)" },
    { vertical: "TRL", level: 8, name: "Environmental Test Reports", regulation: "MIL-STD-810H", policies: ["Joint Publication 3-0 (Legal Basis)"], verificationMethod: "manual_upload", description: "System Qualified" },
    { vertical: "TRL", level: 9, name: "Mission After-Action Reports", regulation: "Joint Publication 3-0", policies: ["DoDD 2311.01 (Law of War Program)"], verificationMethod: "manual_upload", description: "Mission Proven" },
    { vertical: "SRL", level: 1, name: "System Engineering Plan (SEP)", regulation: "DoDI 5000.88; DoDI 5000.97", verificationMethod: "self_attested", description: "Concept Outlined" },
    { vertical: "SRL", level: 2, name: "DoDAF Views (OV-1, SV-1)", regulation: "DoD Architecture Framework (DoDAF)", verificationMethod: "automatic", description: "Functional Arch" },
    { vertical: "SRL", level: 3, name: "SysML/MBSE Model; RTM", regulation: "MIL-STD-961E; DoDI 5000.97", verificationMethod: "manual_upload", description: "Baseline Modeled" },
    { vertical: "SRL", level: 4, name: "Digital Twin Validation Report", regulation: "DIU Digital Twin Guidelines; DoDI 5000.97", verificationMethod: "automatic", description: "Digital Twin" },
    { vertical: "SRL", level: 5, name: "M&S VV&A Report & Logs", regulation: "DoDI 5000.59; DoDI 5000.97", verificationMethod: "manual_upload", description: "End-to-End Sim" },
    { vertical: "SRL", level: 6, name: "Cyber Survivability Endorsement", regulation: "10 U.S.C. § 4252 / CSSIR; DoDI 5000.97", verificationMethod: "manual_upload", description: "Op Sim (Cyber)" },
    { vertical: "SRL", level: 7, name: "Independent V&V (IV&V) Report", regulation: "NIST SP 800-160 Vol. 1", verificationMethod: "manual_upload", description: "Independent V&V" },
    { vertical: "SRL", level: 8, name: "IOT&E Report to Congress", regulation: "10 U.S.C. § 4171", verificationMethod: "manual_upload", description: "Full Op Test" },
    { vertical: "SRL", level: 9, name: "Life Cycle Sustainment Plan (LCSP)", regulation: "DoDI 5000.91", verificationMethod: "automatic", description: "Sustained SoS" },
    { vertical: "IRL", level: 1, name: "Physical Architecture Diagram", regulation: "DoD OSA Guidebook", policies: ["DoD Open Systems Architecture (OSA) Guidebook"], verificationMethod: "manual_upload", description: "Interface Recognition" },
    { vertical: "IRL", level: 2, name: "Interface Control Document (ICD)", regulation: "MIL-STD-961E", policies: ["MIL-STD-961E (Interface Specifications)"], verificationMethod: "manual_upload", description: "Interface Specs" },
    { vertical: "IRL", level: 3, name: "Integration Test Plan & Logs", regulation: "DoDI 5000.88 (Systems Engineering)", policies: ["DoDI 5000.88 (Systems Engineering - Integration)"], verificationMethod: "manual_upload", description: "Lab Integration" },
    { vertical: "IRL", level: 4, name: "Verification Cross Ref Matrix (VCRM)", regulation: "IEEE 15288.1", policies: ["IEEE 15288.1 (SE on Defense Programs)"], verificationMethod: "manual_upload", description: "Subsystem Lab Validation" },
    { vertical: "IRL", level: 5, name: "Digital Twin Simulation Report", regulation: "DoD Digital Engineering Strategy", policies: ["DoD Digital Engineering Strategy (Digital Twins)"], verificationMethod: "manual_upload", description: "Subsystem Relevant Env" },
    { vertical: "IRL", level: 6, name: "SoS Architecture View (OV-1)", regulation: "CJCSI 5123.01 (JROC)", policies: ["CJCSI 5123.01 (Joint Requirements / JROC)"], verificationMethod: "manual_upload", description: "System-of-Systems (SoS)" },
    { vertical: "IRL", level: 7, name: "MOSA Compliance Report", regulation: "10 U.S.C. § 4401 (Mandatory MOSA)", policies: ["10 U.S.C. § 4401 (Mandatory MOSA)"], verificationMethod: "manual_upload", description: "Multi-Service Validation" },
    { vertical: "IRL", level: 8, name: "JITC Interoperability Cert", regulation: "CJCSI 6212.01 (Net-Ready KPP)", policies: ["CJCSI 6212.01 (Net-Ready KPP)"], verificationMethod: "manual_upload", description: "Joint-Wide Certified" },
    { vertical: "IRL", level: 9, name: "DevSecOps Pipeline Architecture", regulation: "DoDI 5000.87 (Software Acquisition)", policies: ["DoDI 5000.87 (Software Acquisition Pathway)"], verificationMethod: "manual_upload", description: "Continuous Integration" },
    { vertical: "HRL", level: 1, name: "HSI Strategy", regulation: "DoDI 5000.95 (Human Systems Integration)", policies: ["DoDI 5000.95 (Human Systems Integration)"], verificationMethod: "manual_upload", description: "Roles Identified" },
    { vertical: "HRL", level: 2, name: "HEPP (Human Eng Program Plan)", regulation: "MIL-STD-46855A", policies: ["MIL-STD-46855A (Human Engineering)"], verificationMethod: "manual_upload", description: "HF Plan Drafted" },
    { vertical: "HRL", level: 3, name: "UI/UX Design Document", regulation: "MIL-HDBK-759C", policies: ["MIL-HDBK-759C (Human Engineering Design)"], verificationMethod: "manual_upload", description: "Mock-ups Tested" },
    { vertical: "HRL", level: 4, name: "HITL Evaluation Test Report", regulation: "NIST IR 8428 (Digital Twin for HSI)", policies: ["NIST IR 8428 (Digital Twin for HSI)"], verificationMethod: "manual_upload", description: "Human-in-the-Loop (HITL)" },
    { vertical: "HRL", level: 5, name: "Usability Test Report", regulation: "MIL-STD-882E (System Safety)", policies: ["MIL-STD-882E (System Safety)"], verificationMethod: "manual_upload", description: "Usability/Safety" },
    { vertical: "HRL", level: 6, name: "Model Card & XAI Rationale", regulation: "DoD AI Ethics (Explainability)", policies: ["DoD AI Ethics (Explainability)"], verificationMethod: "manual_upload", description: "Explainability / Training" },
    { vertical: "HRL", level: 7, name: "Program of Instruction (POI)", regulation: "DoDD 1322.18 (Military Training)", policies: ["DoDD 1322.18 (Military Training)"], verificationMethod: "manual_upload", description: "Operators Trained" },
    { vertical: "HRL", level: 8, name: "Published TTPs & Doctrine", regulation: "Joint Publication 3-0 (Joint Operations)", policies: ["Joint Publication 3-0 (Joint Operations)"], verificationMethod: "manual_upload", description: "Doctrine/Trust" },
    { vertical: "HRL", level: 9, name: "Post-Deployment Performance Review", regulation: "CJCSI 3170.01 (JCIDS)", policies: ["CJCSI 3170.01 (JCIDS)"], verificationMethod: "manual_upload", description: "Combat Validation" },
    { vertical: "TVRL", level: 1, name: "T&E Strategy (TES)", regulation: "DoDI 5000.89 (Test and Evaluation)", policies: ["DoDI 5000.89 (Test and Evaluation)"], verificationMethod: "manual_upload", description: "Need Acknowledged" },
    { vertical: "TVRL", level: 2, name: "Test Master Plan (TEMP)", regulation: "DoDI 5000.89 (Mandatory TEMP)", policies: ["DoDI 5000.89 (Mandatory TEMP)"], verificationMethod: "manual_upload", description: "TEMP Created" },
    { vertical: "TVRL", level: 3, name: "Detailed Test Procedures", regulation: "MIL-HDBK-881F (WBS)", policies: ["MIL-HDBK-881F (WBS)"], verificationMethod: "manual_upload", description: "Procedures Approved" },
    { vertical: "TVRL", level: 4, name: "VCRM (Subsystem Level)", regulation: "DAU T&E Management Guide", policies: ["DAU T&E Management Guide"], verificationMethod: "manual_upload", description: "Subsystem Validation" },
    { vertical: "TVRL", level: 5, name: "Preliminary Hazard Analysis (PHA)", regulation: "DoDD 5000.01 (Acquisition System)", policies: ["DoDD 5000.01 (Acquisition System)"], verificationMethod: "manual_upload", description: "Certification Initiated" },
    { vertical: "TVRL", level: 6, name: "Security Assessment Report (SAR)", regulation: "NIST SP 800-53A", policies: ["NIST SP 800-53A (Security Controls)"], verificationMethod: "manual_upload", description: "Docs Complete" },
    { vertical: "TVRL", level: 7, name: "Independent Data Package (IDP)", regulation: "10 U.S.C. § 4171; DoDM 5000.100", policies: ["10 U.S.C. § 4171 (Independent Test). DoDM 5000.100, \"Test and Evaluation Master Plans and Reporting\""], verificationMethod: "manual_upload", description: "OT&E Data Delivered" },
    { vertical: "TVRL", level: 8, name: "Safety Release / Airworthiness (AWR)", regulation: "MIL-STD-882E / AR 70-62", policies: ["MIL-STD-882E / AR 70-62"], verificationMethod: "manual_upload", description: "Certs Granted" },
    { vertical: "TVRL", level: 9, name: "Automated Regression Logs", regulation: "DoDI 5000.87 (Continuous Testing)", policies: ["DoDI 5000.87 (Continuous Testing)"], verificationMethod: "manual_upload", description: "Embedded Regression" },
    { vertical: "AIRL", level: 1, name: "Concept Recognized", regulation: "DoD RAI Strategy & Implementation Pathway", policies: ["DoD RAI Strategy & Implementation Pathway"], verificationMethod: "manual_upload", description: "Concept Recognized" },
    { vertical: "AIRL", level: 2, name: "Data Pipeline", regulation: "DoD Data Strategy (VAULT Requirements)", policies: ["DoD Data Strategy (VAULT Requirements)"], verificationMethod: "manual_upload", description: "Data Pipeline" },
    { vertical: "AIRL", level: 3, name: "Dataset Curated", regulation: "DoD CDAO Data Decrees (2025)", policies: ["DoD CDAO Data Decrees (2025)"], verificationMethod: "manual_upload", description: "Dataset Curated" },
    { vertical: "AIRL", level: 4, name: "Baseline/Bias", regulation: "NIST AI RMF; DoD AI Cybersecurity Risk Mgmt", policies: ["NIST AI RMF (Risk Management Framework). DoD AI Cybersecurity Risk Management Tailoring Guide (2025)"], verificationMethod: "manual_upload", description: "Baseline/Bias" },
    { vertical: "AIRL", level: 5, name: "Ground Truth/XAI", regulation: "DIU Responsible AI Guidelines", policies: ["DIU Responsible AI Guidelines (Explainability)"], verificationMethod: "manual_upload", description: "Ground Truth/XAI" },
    { vertical: "AIRL", level: 6, name: "Robustness", regulation: "Executive Order 14110 (Adversarial Testing)", policies: ["Executive Order 14110 (Adversarial Testing)"], verificationMethod: "manual_upload", description: "Robustness" },
    { vertical: "AIRL", level: 7, name: "MLOps/cATO", regulation: "DoDI 5000.87 (Software Pathway for ML)", policies: ["DoDI 5000.87 (Software Pathway for ML), DoD AI Cybersecurity Risk Management Tailoring Guide (2025)"], verificationMethod: "manual_upload", description: "MLOps/cATO" },
    { vertical: "AIRL", level: 8, name: "Ops Retraining", regulation: "DoD AI Strategy Memo (2026)", policies: ["DoD AI Strategy Memo (2026)"], verificationMethod: "manual_upload", description: "Ops Retraining" },
    { vertical: "AIRL", level: 9, name: "Continuous Red-Teaming", regulation: "FY2026 NDAA Sec 1572 (Red-Teaming)", policies: ["Sec 1572 of the FY2026 NDAA (Persistent Red-Teaming)"], verificationMethod: "manual_upload", description: "Continuous Red-Teaming" },
    { vertical: "MRL", level: 1, name: "Manufacturing Feasibility Study", regulation: "DoD MRL Deskbook", policies: ["DoD MRL Deskbook: Basic manufacturing feasibility assessed alongside TRL 1"], verificationMethod: "self_attested", description: "Feasibility" },
    { vertical: "MRL", level: 2, name: "Preliminary Bill of Materials (BOM)", regulation: "EO 14017 (Supply Chains)", policies: ["EO 14017: America's Supply Chains (Requirement for risk assessment)"], verificationMethod: "automatic", description: "Materials/Proc" },
    { vertical: "MRL", level: 3, name: "Laboratory Build Records", regulation: "DoDI 5000.02 (EMD)", policies: ["DoDI 5000.02: (Section on Engineering & Manufacturing Development - EMD)"], verificationMethod: "manual_upload", description: "Lab-scale Build" },
    { vertical: "MRL", level: 4, name: "AS9100D Certificate", regulation: "AS9100D (Quality Management)", policies: ["AS9100D: Quality Management Systems - Requirements for Aerospace/Defense"], verificationMethod: "manual_upload", description: "Process Repeatable" },
    { vertical: "MRL", level: 5, name: "MPV (Process Verification) Report", regulation: "DoD MRL Deskbook", policies: ["DoD MRL Deskbook: Evaluation of \"Production-Relevant\" environments"], verificationMethod: "automatic", description: "Reproducible (Lab)" },
    { vertical: "MRL", level: 6, name: "MRA Report & Producibility Analysis", regulation: "10 U.S.C. § 4252 (Milestone B)", policies: ["10 U.S.C. § 4252: Statutory requirement for Milestone B certification"], verificationMethod: "manual_upload", description: "Relevant Build" },
    { vertical: "MRL", level: 7, name: "DD Form 250 & Quality Manual", regulation: "DFARS 252.246-7000; DFARS 225.7018", policies: ["DFARS 252.246-7000; DFARS 225.7018 (Specialty Metals)"], verificationMethod: "automatic", description: "Quality (DFARS)" },
    { vertical: "MRL", level: 8, name: "First Article Inspection (AS9102)", regulation: "FAR 34.005-2; SD-22 (DMSMS)", policies: ["FAR 34.005-2; SD-22 (DMSMS Obsolescence Management)"], verificationMethod: "automatic", description: "LRIP Ready" },
    { vertical: "MRL", level: 9, name: "FRP Decision Memo & Spares Catalog", regulation: "DoDI 5000.91; FRP Decision Memo", policies: ["DoDI 5000.91: Product Support Management; FRP Decision Memo"], verificationMethod: "manual_upload", description: "Full-Rate" },
    { vertical: "SCRL", level: 1, name: "Executive Order 14017 (Supply Chains)", regulation: "Executive Order 14017 (Supply Chains)", policies: ["Executive Order 14017 (Supply Chains)"], verificationMethod: "automatic", description: "Ad-hoc Sourcing" },
    { vertical: "SCRL", level: 2, name: "FAR 52.204-24 (889 Prohibitions)", regulation: "FAR 52.204-24 (889 Prohibitions)", policies: ["FAR 52.204-24 (889 Prohibitions)"], verificationMethod: "automatic", description: "Key Suppliers Listed" },
    { vertical: "SCRL", level: 3, name: "DoDI 5000.60 (Industrial Base)", regulation: "DoDI 5000.60 (Industrial Base)", policies: ["DoDI 5000.60 (Industrial Base)"], verificationMethod: "automatic", description: "Tier-1 Alternates" },
    { vertical: "SCRL", level: 4, name: "NIST SP 800-161 Rev. 1", regulation: "NIST SP 800-161 Rev. 1", policies: ["NIST SP 800-161 Rev. 1"], verificationMethod: "manual_upload", description: "SCRM Plan Formalized" },
    { vertical: "SCRL", level: 5, name: "DFARS 225.7018 (Specialty Metals)", regulation: "DFARS 225.7018 (Specialty Metals)", policies: ["DFARS 225.7018 (Specialty Metals)"], verificationMethod: "manual_upload", description: "Dual Sourcing Qualified" },
    { vertical: "SCRL", level: 6, name: "DoDI 5200.44 (Trusted Systems)", regulation: "DoDI 5200.44 (Trusted Systems)", policies: ["DoDI 5200.44 (Trusted Systems)"], verificationMethod: "manual_upload", description: "Geopolitical Assessment" },
    { vertical: "SCRL", level: 7, name: "AS6174A (Counterfeit Materiel)", regulation: "AS6174A (Counterfeit Materiel)", policies: ["AS6174A (Counterfeit Materiel)"], verificationMethod: "automatic", description: "Tier-2 Visibility" },
    { vertical: "SCRL", level: 8, name: "EO 14028 / Sec 889 Part B", regulation: "EO 14028 / Sec 889 Part B", policies: ["EO 14028 / Sec 889 Part B"], verificationMethod: "automatic", description: "SBOM/Redundancy" },
    { vertical: "SCRL", level: 9, name: "DoD SCRM Strategy (2024) / 10 U.S.C. § 4811", regulation: "DoD SCRM Strategy (2024) / 10 U.S.C. § 4811", policies: ["DoD SCRM Strategy (2024) / 10 U.S.C. § 4811"], verificationMethod: "automatic", description: "Automated Monitoring" },
    { vertical: "SFTL", level: 1, name: "Preliminary Hazard List (PHL)", regulation: "MIL-STD-882E (System Safety)", verificationMethod: "self_attested", description: "Risks Identified" },
    { vertical: "SFTL", level: 2, name: "Safety Data Sheets (SDS)", regulation: "OSHA / Global GHS", verificationMethod: "manual_upload", description: "MSDS Curated" },
    { vertical: "SFTL", level: 3, name: "Record of Env Consideration (REC)", regulation: "42 U.S.C. § 4321 (NEPA)", verificationMethod: "manual_upload", description: "NEPA Started" },
    { vertical: "SFTL", level: 4, name: "Hazard Tracking System (HTS) Log", regulation: "MIL-STD-882E (Hazard Analysis)", verificationMethod: "manual_upload", description: "Hazard Analysis" },
    { vertical: "SFTL", level: 5, name: "Lithium Battery / Radiation Certs", regulation: "S9310-AQ-SAF-010 / HERO", verificationMethod: "manual_upload", description: "Certifications" },
    { vertical: "SFTL", level: 6, name: "Demilitarization (DEMIL) Plan", regulation: "DoDM 4160.28 (Demil Program)", verificationMethod: "manual_upload", description: "Disposal/Demil" },
    { vertical: "SFTL", level: 7, name: "Safety Release Letter", regulation: "MIL-STD-882E (Safety Confirmation)", verificationMethod: "manual_upload", description: "Safety Release" },
    { vertical: "SFTL", level: 8, name: "Environmental Impact Statement", regulation: "EPA / Federal Register (FONSI)", verificationMethod: "manual_upload", description: "EIS Signed" },
    { vertical: "SFTL", level: 9, name: "Master Safety Data Package", regulation: "Service HQ Safety Oversight", verificationMethod: "manual_upload", description: "Global Safe" },
    { vertical: "MSNL", level: 1, name: "Gap Identification", regulation: "CJCSI 5123.01 (JCIDS)", verificationMethod: "manual_upload", description: "Theater Requirements Document" },
    { vertical: "MSNL", level: 2, name: "Environmental Scoping", regulation: "Joint Publication 5-0 (Joint Planning)", verificationMethod: "manual_upload", description: "Expeditionary CONOPS" },
    { vertical: "MSNL", level: 3, name: "Digital Mission Rehearsal", regulation: "DoDI 5000.61 (M&S VV&A)", verificationMethod: "automatic", description: "High-Fidelity Sim Report (DDIL/EW)" },
    { vertical: "MSNL", level: 4, name: "Signature Management", regulation: "CJCSM 3500.04 (UJTL)", verificationMethod: "self_attested", description: "LPI/LPD Signature Analysis" },
    { vertical: "MSNL", level: 5, name: "Field Validation Planned", regulation: "DoDI 5000.89 (T&E Planning)", verificationMethod: "manual_upload", description: "Austere Test Plan" },
    { vertical: "MSNL", level: 6, name: "Theater Representative Demo", regulation: "10 U.S.C. § 4001 (Prototyping)", verificationMethod: "manual_upload", description: "Signed GO/FO Combat Demo" },
    { vertical: "MSNL", level: 7, name: "Coalition Handshake", regulation: "AJP series; DoDP 2010.06 (Interoperability)", verificationMethod: "manual_upload", description: "Interoperability / STANAG Cert" },
    { vertical: "MSNL", level: 8, name: "Combat Deployment Decision", regulation: "DoDI 5000.91 (Deployment Decisions)", verificationMethod: "manual_upload", description: "Theater Fielding Decision" },
    { vertical: "MSNL", level: 9, name: "Mission Proven", regulation: "Joint Publication 3-0 (Joint Operations)", verificationMethod: "automatic", description: "Combat AAR / OPLAN Entry" },
    { vertical: "WRL", level: 1, name: "Manpower Requirements Document", regulation: "DoDI 1100.22 (Workforce Mix)", verificationMethod: "automatic", description: "Skeleton Staff" },
    { vertical: "WRL", level: 2, name: "KMP Resumes", regulation: "DoD Strategic Workforce Plan (NDS)", verificationMethod: "automatic", description: "Key Hires Identified" },
    { vertical: "WRL", level: 3, name: "Employee Handbook / I-9 Docs", regulation: "5 U.S.C. § 3301 (Federal Standards)", verificationMethod: "automatic", description: "Core Team / Onboarding" },
    { vertical: "WRL", level: 4, name: "Personnel Security (PERSEC) SOP", regulation: "32 CFR Part 147 (Adjudicative Guidelines)", verificationMethod: "self_attested", description: "Clearance Workflow" },
    { vertical: "WRL", level: 5, name: "Investigation Roster (SF-86 Logs)", regulation: "SEAD 4 (Adjudicative Guidelines)", verificationMethod: "manual_upload", description: "Clearances Initiated" },
    { vertical: "WRL", level: 6, name: "DCWF Work Role Mapping Matrix", regulation: "DoD Cyber Workforce Framework (DCWF)", verificationMethod: "manual_upload", description: "Competency Model" },
    { vertical: "WRL", level: 7, name: "Succession Plan", regulation: "DoDI 1400.25 (Vol 410)", verificationMethod: "manual_upload", description: "Succession & Cross-train" },
    { vertical: "WRL", level: 8, name: "Certification Registry", regulation: "DoDM 8140.03 (Cyber Qualification)", verificationMethod: "manual_upload", description: "Workforce Certified" },
    { vertical: "WRL", level: 9, name: "Continuity of Operations (COOP)", regulation: "10 U.S.C. § 1580 (Essential Employees)", verificationMethod: "manual_upload", description: "Surge-Ready" },
    { vertical: "LDRL", level: 1, name: "Life Cycle Sustainment Plan (LCSP)", regulation: "DoDI 5000.91 (Product Support)", verificationMethod: "self_attested", description: "Concept Noted" },
    { vertical: "LDRL", level: 2, name: "PHS&T Plan (Packaging)", regulation: "MIL-STD-2073-1 / MIL-STD-129", verificationMethod: "manual_upload", description: "Packaging/Shipping" },
    { vertical: "LDRL", level: 3, name: "HAZMAT Certifications", regulation: "49 CFR Parts 100-185 (DOT)", verificationMethod: "manual_upload", description: "Domestic Shipping Trial" },
    { vertical: "LDRL", level: 4, name: "Logistics Chain Map", regulation: "DTR 4500.9-R (Defense Transportation)", verificationMethod: "automatic", description: "Initial Chain Mapped" },
    { vertical: "LDRL", level: 5, name: "MIL-STD-810H Test Reports", regulation: "MIL-STD-810H (Vibration/Transit)", verificationMethod: "automatic", description: "Packaging/Delivery Demo" },
    { vertical: "LDRL", level: 6, name: "AAR from Austere Testing", regulation: "Joint Publication 4-0 (Joint Logistics)", verificationMethod: "manual_upload", description: "Expeditionary Rehearsal" },
    { vertical: "LDRL", level: 7, name: "Spares Provisioning List", regulation: "DoDM 4140.01 (Materiel Management)", verificationMethod: "manual_upload", description: "Sustainment/Spares" },
    { vertical: "LDRL", level: 8, name: "Theater-Specific Distro Plan", regulation: "Joint Publication 4-09 (Distribution)", verificationMethod: "manual_upload", description: "Theater Distribution" },
    { vertical: "LDRL", level: 9, name: "Contested Sustainment Plan", regulation: "2024 DoD Contested Logistics Strategy", verificationMethod: "automatic", description: "Contested Logistics" },
  ];

  const createdArtifacts: Record<string, string> = {};
  for (const a of artifactDefs) {
    const [created] = await db.insert(artifacts).values({
      ...a,
      required: true,
    }).returning();
    createdArtifacts[`${a.vertical}-${a.level}`] = created.id;
  }

  const seedPartners = [
    {
      name: "Meridian Defense Solutions",
      uei: "HJ5LK7DGBZ15",
      cage: "3A2B7",
      entityType: "contractor",
      status: "active",
      targetLevel: 6,
      samRegistered: true,
      scores: generateScores({ min: 3, max: 7, weakSpots: ["CRL", "AIRL", "SCRL"] }),
    },
    {
      name: "Ironclad Systems Group",
      uei: "MN9QR4WXTZ82",
      cage: "7K5D2",
      entityType: "contractor",
      status: "active",
      targetLevel: 7,
      samRegistered: true,
      scores: generateScores({ min: 4, max: 8, weakSpots: ["MSNL", "SFTL", "LDRL"] }),
    },
    {
      name: "Vanguard Integrated Technologies",
      uei: "PL3FG8HJKN46",
      cage: "9C1E4",
      entityType: "subcontractor",
      status: "active",
      targetLevel: 5,
      samRegistered: true,
      scores: generateScores({ min: 2, max: 6, weakSpots: ["WRL", "HRL", "MRL"] }),
    },
    {
      name: "Citadel Cyber Operations",
      uei: "RT6UV2CDYA91",
      cage: "2F8G3",
      entityType: "vendor",
      status: "active",
      targetLevel: 8,
      samRegistered: true,
      scores: generateScores({ min: 5, max: 9, weakSpots: ["LDRL", "MRL"] }),
    },
    {
      name: "Sentinel Aerospace Partners",
      uei: "WX1AB5EFGR73",
      cage: null,
      entityType: "contractor",
      status: "active",
      targetLevel: 5,
      samRegistered: false,
      scores: generateScores({ min: 1, max: 5, weakSpots: ["AIRL", "MSNL", "CRL", "TVRL"] }),
    },
  ];

  for (const p of seedPartners) {
    const overallLevel = Math.min(...Object.values(p.scores));
    const [created] = await db.insert(partners).values({
      ...p,
      overallLevel,
    }).returning();

    const artifactStatuses = ["verified", "verified", "pending", "missing", "draft"];
    for (const [key, artifactId] of Object.entries(createdArtifacts)) {
      const [vert, lvl] = key.split("-");
      const score = p.scores[vert] || 0;
      const level = parseInt(lvl);
      let status: string;
      if (level <= score) {
        status = Math.random() > 0.2 ? "verified" : "pending";
      } else if (level === score + 1) {
        status = Math.random() > 0.5 ? "draft" : "pending";
      } else {
        status = "missing";
      }

      await db.insert(partnerArtifacts).values({
        partnerId: created.id,
        artifactId: artifactId,
        status,
        verifiedAt: status === "verified" ? new Date() : null,
        verifiedBy: status === "verified" ? "SAM.gov Auto" : null,
        notes: null,
        documentRef: status === "verified" ? `DOC-${Math.random().toString(36).substring(2, 8).toUpperCase()}` : null,
      });
    }

    await db.insert(activities).values([
      {
        partnerId: created.id,
        type: "registration",
        description: `${p.name} registered via SAM.gov lookup (UEI: ${p.uei})`,
        vertical: null,
        metadata: { source: "sam.gov" },
      },
      {
        partnerId: created.id,
        type: "assessment",
        description: `Initial baseline assessment completed across 17 WRA verticals`,
        vertical: null,
        metadata: { verticals: 17 },
      },
      {
        partnerId: created.id,
        type: "scan_approve",
        description: `Automated document scan completed for BRL artifacts`,
        vertical: "BRL",
        metadata: { artifacts: 4, verified: 3 },
      },
    ]);
  }

  const existingUsers = await db.select().from(users);
  if (existingUsers.length === 0) {
    const adminPw = await hashPassword("forge2026");
    await db.insert(users).values({
      username: "admin",
      password: adminPw,
      role: "admin",
      partnerId: null,
      displayName: "System Administrator",
    });

    const allPartners = await db.select().from(partners);
    for (const p of allPartners) {
      const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, ".");
      const pw = await hashPassword("partner123");
      await db.insert(users).values({
        username: slug,
        password: pw,
        role: "partner",
        partnerId: p.id,
        displayName: p.name,
      });
    }
    console.log(`Seeded ${allPartners.length + 1} user accounts (1 admin + ${allPartners.length} partners)`);
  }

  console.log("Database seeded with 5 partners, artifacts, and configurations");
}

async function seedCapabilities() {
  await db.update(capabilities)
    .set({ name: "Unmanned Systems Support" })
    .where(eq(capabilities.name, "AI generated replit studio"));

  const existingCaps = await db.select().from(capabilities);
  const existingNames = new Set(existingCaps.map(c => c.name));

  const capabilityDefs = [
    {
      name: "Command & Control Systems",
      sortOrder: 1,
      subs: [
        { name: "Tactical Data Links", description: "Link 16, Link 22, and tactical data exchange systems for real-time battlefield communication" },
        { name: "Battle Management Systems", description: "Integrated command systems for mission planning, execution monitoring, and force coordination" },
        { name: "Joint C2 Interoperability", description: "Cross-service and coalition command and control interoperability standards and protocols" },
        { name: "Decision Support Tools", description: "AI-assisted decision support and course-of-action analysis for operational commanders" },
      ],
    },
    {
      name: "Cyber Operations",
      sortOrder: 2,
      subs: [
        { name: "Defensive Cyber Operations", description: "Network defense, intrusion detection, and incident response capabilities" },
        { name: "Offensive Cyber Capabilities", description: "Cyber engagement tools, vulnerability assessment, and penetration testing" },
        { name: "Cyber Threat Intelligence", description: "Threat intelligence collection, analysis, and dissemination for cyber domain awareness" },
        { name: "Zero Trust Architecture", description: "Implementation of zero trust security models across enterprise and tactical networks" },
      ],
    },
    {
      name: "Intelligence, Surveillance & Reconnaissance",
      sortOrder: 3,
      subs: [
        { name: "SIGINT Processing", description: "Signals intelligence collection, processing, and exploitation systems" },
        { name: "GEOINT & Remote Sensing", description: "Geospatial intelligence, satellite imagery analysis, and terrain mapping" },
        { name: "HUMINT Support Systems", description: "Human intelligence management, source tracking, and reporting platforms" },
        { name: "Multi-INT Fusion", description: "Cross-domain intelligence fusion and all-source analysis platforms" },
        { name: "Unmanned ISR Platforms", description: "UAS-based surveillance, reconnaissance, and persistent monitoring systems" },
      ],
    },
    {
      name: "Electronic Warfare",
      sortOrder: 4,
      subs: [
        { name: "Electronic Attack", description: "Jamming, spoofing, and electromagnetic spectrum denial capabilities" },
        { name: "Electronic Protection", description: "Hardening, frequency management, and anti-jam communication systems" },
        { name: "Spectrum Management", description: "Electromagnetic spectrum operations planning, deconfliction, and monitoring" },
      ],
    },
    {
      name: "Logistics & Sustainment",
      sortOrder: 5,
      subs: [
        { name: "Supply Chain Management", description: "End-to-end supply chain visibility, forecasting, and optimization for defense materiel" },
        { name: "Predictive Maintenance", description: "Condition-based maintenance, IoT sensor integration, and failure prediction analytics" },
        { name: "Additive Manufacturing", description: "3D printing and rapid prototyping for expeditionary and depot-level part production" },
        { name: "Autonomous Logistics", description: "Unmanned ground/air resupply, robotic warehousing, and autonomous convoy operations" },
      ],
    },
    {
      name: "Communications & Networking",
      sortOrder: 6,
      subs: [
        { name: "SATCOM Systems", description: "Military satellite communications terminals, modems, and network management" },
        { name: "Tactical Radio Systems", description: "Software-defined radios, MANET networking, and waveform development" },
        { name: "5G/Next-Gen Networks", description: "5G military applications, private network deployment, and edge computing integration" },
        { name: "Mesh Networking", description: "Self-forming, self-healing mesh networks for disconnected and contested environments" },
      ],
    },
    {
      name: "Weapons Systems Integration",
      sortOrder: 7,
      subs: [
        { name: "Fire Control Systems", description: "Targeting, tracking, and fire control computer integration for precision engagement" },
        { name: "Missile Defense", description: "Ballistic and cruise missile defense systems, sensors, and interceptor integration" },
        { name: "Directed Energy Weapons", description: "High-energy laser, high-power microwave, and directed energy system development" },
        { name: "Precision Munitions", description: "GPS/INS-guided munitions, smart fuzing, and precision strike systems" },
      ],
    },
    {
      name: "Platform Integration",
      sortOrder: 8,
      subs: [
        { name: "Ground Vehicle Systems", description: "Armored vehicle electronics, vetronics integration, and platform modernization" },
        { name: "Aviation Systems", description: "Avionics, flight management, and mission systems for rotary and fixed-wing aircraft" },
        { name: "Maritime Systems", description: "Shipboard combat systems, sonar, and naval platform integration" },
        { name: "Space Systems", description: "Satellite bus integration, payload management, and space domain awareness" },
      ],
    },
    {
      name: "Artificial Intelligence & Autonomy",
      sortOrder: 9,
      subs: [
        { name: "Computer Vision", description: "Object detection, classification, and tracking for ISR and targeting applications" },
        { name: "Natural Language Processing", description: "Machine translation, document exploitation, and automated reporting" },
        { name: "Autonomous Navigation", description: "GPS-denied navigation, SLAM, and autonomous path planning for unmanned systems" },
        { name: "Human-Machine Teaming", description: "Manned-unmanned teaming, adjustable autonomy, and trust calibration frameworks" },
      ],
    },
    {
      name: "Training & Simulation",
      sortOrder: 10,
      subs: [
        { name: "Live-Virtual-Constructive", description: "LVC training environments linking live forces with virtual and constructive simulations" },
        { name: "Synthetic Training Environments", description: "Immersive training worlds with terrain, weather, and force-on-force modeling" },
        { name: "After-Action Review Systems", description: "Automated data collection, replay, and performance assessment for training events" },
      ],
    },
    {
      name: "Test & Evaluation",
      sortOrder: 11,
      subs: [
        { name: "Developmental Testing", description: "Engineering-level testing, performance verification, and system characterization" },
        { name: "Operational Testing", description: "Operational effectiveness and suitability evaluation in realistic conditions" },
        { name: "Modeling & Simulation for T&E", description: "Digital twin modeling, Monte Carlo analysis, and simulation-based test planning" },
        { name: "Cybersecurity T&E", description: "Adversarial assessment, red team operations, and cooperative vulnerability penetration testing" },
      ],
    },
    {
      name: "Nuclear, Biological & Chemical Defense",
      sortOrder: 12,
      subs: [
        { name: "CBRN Detection", description: "Chemical, biological, radiological, and nuclear threat detection and identification systems" },
        { name: "Decontamination Systems", description: "Equipment and personnel decontamination technologies and rapid-response kits" },
        { name: "Protective Equipment", description: "Individual and collective protection systems, filtration, and sealed shelter solutions" },
      ],
    },
  ];

  let addedCaps = 0;
  let addedSubs = 0;
  const maxSort = existingCaps.reduce((m, c) => Math.max(m, c.sortOrder), 0);

  for (const cap of capabilityDefs) {
    if (existingNames.has(cap.name)) continue;

    const [created] = await db.insert(capabilities).values({
      name: cap.name,
      sortOrder: maxSort + cap.sortOrder,
    }).returning();

    for (let i = 0; i < cap.subs.length; i++) {
      await db.insert(subCapabilities).values({
        capabilityId: created.id,
        name: cap.subs[i].name,
        description: cap.subs[i].description,
        sortOrder: i + 1,
      });
      addedSubs++;
    }
    addedCaps++;
  }
  if (addedCaps > 0) {
    console.log(`Seeded ${addedCaps} new capabilities with ${addedSubs} sub-capabilities`);
  }
}

function generateScores({ min, max, weakSpots }: { min: number; max: number; weakSpots: string[] }) {
  const scores: Record<string, number> = {};
  VERTICALS.forEach((v) => {
    if (weakSpots.includes(v.key)) {
      scores[v.key] = Math.max(1, min - Math.floor(Math.random() * 2));
    } else {
      scores[v.key] = min + Math.floor(Math.random() * (max - min + 1));
    }
  });
  return scores;
}
