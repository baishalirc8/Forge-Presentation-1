export interface SamEntity {
  uei: string;
  cage: string;
  legalBusinessName: string;
  entityType: string;
  samStatus: "Active" | "Inactive" | "Expired";
  registrationDate: string;
  expirationDate: string;
  physicalAddress: {
    city: string;
    state: string;
    country: string;
  };
  naicsCodes: string[];
  knownArtifacts: SamArtifact[];
  pointOfContact: {
    firstName: string;
    lastName: string;
    title: string;
  };
}

export interface SamArtifact {
  artifactKey: string;
  name: string;
  status: "active" | "expired" | "pending";
  source: "sam_api";
  regulation: string;
  vertical: string;
  level: number;
  retrievedAt: string;
}

const KNOWN_ENTITIES: Record<string, SamEntity> = {
  "3A2B7": {
    uei: "HJ5LK7DGBZ15",
    cage: "3A2B7",
    legalBusinessName: "Meridian Defense Solutions",
    entityType: "contractor",
    samStatus: "Active",
    registrationDate: "2019-03-15",
    expirationDate: "2027-03-15",
    physicalAddress: { city: "Arlington", state: "VA", country: "USA" },
    naicsCodes: ["541511", "541512", "541330"],
    pointOfContact: { firstName: "James", lastName: "Harmon", title: "VP Contracts" },
    knownArtifacts: [
      { artifactKey: "BRL_1", name: "Articles of Incorporation", status: "active", source: "sam_api", regulation: "State Statutes / UCC; 13 CFR § 121", vertical: "BRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "BRL_2", name: "Validated SAM.gov Profile", status: "active", source: "sam_api", regulation: "FAR Subpart 4.11; 2 CFR Part 25", vertical: "BRL", level: 2, retrievedAt: new Date().toISOString() },
      { artifactKey: "BRL_3", name: "SF-328 (Foreign Interests)", status: "active", source: "sam_api", regulation: "32 CFR Part 117 (NISPOM)", vertical: "BRL", level: 3, retrievedAt: new Date().toISOString() },
      { artifactKey: "BRL_4", name: "CAGE Code Confirmation", status: "active", source: "sam_api", regulation: "FAR 52.204-7; DFARS 204.72", vertical: "BRL", level: 4, retrievedAt: new Date().toISOString() },
      { artifactKey: "BRL_5", name: "DD Form 2345 (JCP)", status: "active", source: "sam_api", regulation: "22 CFR Parts 120-130 (ITAR)", vertical: "BRL", level: 5, retrievedAt: new Date().toISOString() },
      { artifactKey: "FRL_1", name: "IRS Form SS-4 (EIN Assignment)", status: "active", source: "sam_api", regulation: "IRS Publication 583", vertical: "FRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "FRL_2", name: "Chart of Accounts (COA)", status: "active", source: "sam_api", regulation: "FAR 31.201-2", vertical: "FRL", level: 2, retrievedAt: new Date().toISOString() },
      { artifactKey: "FRL_3", name: "Internal Control Policy", status: "active", source: "sam_api", regulation: "COSO Framework; FAR 52.203-13", vertical: "FRL", level: 3, retrievedAt: new Date().toISOString() },
      { artifactKey: "FRL_4", name: "Completed SF-1408 Checklist", status: "active", source: "sam_api", regulation: "Standard Form 1408", vertical: "FRL", level: 4, retrievedAt: new Date().toISOString() },
      { artifactKey: "FRL_5", name: "Capitalization (Cap) Table", status: "pending", source: "sam_api", regulation: "FAR 42.704; DoDI 5000.85", vertical: "FRL", level: 5, retrievedAt: new Date().toISOString() },
      { artifactKey: "PRL_1", name: "Policy Impact Analysis", status: "active", source: "sam_api", regulation: "DoDI 5000.02", vertical: "PRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "PRL_2", name: "Privacy Impact Assessment (PIA)", status: "active", source: "sam_api", regulation: "DoDI 5400.11", vertical: "PRL", level: 2, retrievedAt: new Date().toISOString() },
      { artifactKey: "PRL_3", name: "Targeting Logic (LOAC Analysis)", status: "active", source: "sam_api", regulation: "CJCSI 5810.01", vertical: "PRL", level: 3, retrievedAt: new Date().toISOString() },
      { artifactKey: "CRL_1", name: "Cyber Risk Assessment (CRA)", status: "active", source: "sam_api", regulation: "NIST SP 800-30", vertical: "CRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "CRL_2", name: "Security Plan (SP)", status: "active", source: "sam_api", regulation: "NIST SP 800-60 / FIPS 199", vertical: "CRL", level: 2, retrievedAt: new Date().toISOString() },
      { artifactKey: "CRL_3", name: "MFA Implementation Report", status: "active", source: "sam_api", regulation: "Executive Order 14028", vertical: "CRL", level: 3, retrievedAt: new Date().toISOString() },
      { artifactKey: "CCRL_1", name: "Rough Order of Magnitude (ROM)", status: "active", source: "sam_api", regulation: "FAR Part 15", vertical: "CCRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "HRL_1", name: "HSI Strategy", status: "active", source: "sam_api", regulation: "DoDI 5000.95", vertical: "HRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "TRL_1", name: "Scientific White Papers / Patent Filings", status: "active", source: "sam_api", regulation: "DoD TRA Guidebook", vertical: "TRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "TRL_3", name: "Lab Bench Test Data Logs", status: "active", source: "sam_api", regulation: "DoDI 5000.02", vertical: "TRL", level: 3, retrievedAt: new Date().toISOString() },
      { artifactKey: "TRL_5", name: "High-Fidelity M&S Results", status: "active", source: "sam_api", regulation: "DoD TRA Guidebook", vertical: "TRL", level: 5, retrievedAt: new Date().toISOString() },
      { artifactKey: "TRL_7", name: "Interface Control Document (ICD)", status: "pending", source: "sam_api", regulation: "10 U.S.C. § 4401", vertical: "TRL", level: 7, retrievedAt: new Date().toISOString() },
      { artifactKey: "MRL_1", name: "Manufacturing Feasibility Study", status: "active", source: "sam_api", regulation: "DoD MRL Deskbook", vertical: "MRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "MRL_3", name: "Laboratory Build Records", status: "active", source: "sam_api", regulation: "DoDI 5000.02", vertical: "MRL", level: 3, retrievedAt: new Date().toISOString() },
      { artifactKey: "MRL_5", name: "MPV (Process Verification) Report", status: "pending", source: "sam_api", regulation: "DoD MRL Deskbook", vertical: "MRL", level: 5, retrievedAt: new Date().toISOString() },
    ],
  },
  "7K5D2": {
    uei: "MN9QR4WXTZ82",
    cage: "7K5D2",
    legalBusinessName: "Ironclad Systems Group",
    entityType: "contractor",
    samStatus: "Active",
    registrationDate: "2017-06-01",
    expirationDate: "2027-06-01",
    physicalAddress: { city: "Huntsville", state: "AL", country: "USA" },
    naicsCodes: ["541715", "334511", "334290"],
    pointOfContact: { firstName: "Sarah", lastName: "Chen", title: "Director of Compliance" },
    knownArtifacts: [
      { artifactKey: "BRL_1", name: "Articles of Incorporation", status: "active", source: "sam_api", regulation: "State Statutes / UCC; 13 CFR § 121", vertical: "BRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "BRL_2", name: "Validated SAM.gov Profile", status: "active", source: "sam_api", regulation: "FAR Subpart 4.11; 2 CFR Part 25", vertical: "BRL", level: 2, retrievedAt: new Date().toISOString() },
      { artifactKey: "BRL_4", name: "CAGE Code Confirmation", status: "active", source: "sam_api", regulation: "FAR 52.204-7; DFARS 204.72", vertical: "BRL", level: 4, retrievedAt: new Date().toISOString() },
      { artifactKey: "FRL_1", name: "IRS Form SS-4 (EIN Assignment)", status: "active", source: "sam_api", regulation: "IRS Publication 583", vertical: "FRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "FRL_3", name: "Internal Control Policy", status: "active", source: "sam_api", regulation: "COSO Framework; FAR 52.203-13", vertical: "FRL", level: 3, retrievedAt: new Date().toISOString() },
      { artifactKey: "PRL_1", name: "Policy Impact Analysis", status: "active", source: "sam_api", regulation: "DoDI 5000.02", vertical: "PRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "CRL_1", name: "Cyber Risk Assessment (CRA)", status: "active", source: "sam_api", regulation: "NIST SP 800-30", vertical: "CRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "TRL_1", name: "Scientific White Papers / Patent Filings", status: "active", source: "sam_api", regulation: "DoD TRA Guidebook", vertical: "TRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "TRL_3", name: "Lab Bench Test Data Logs", status: "active", source: "sam_api", regulation: "DoDI 5000.02", vertical: "TRL", level: 3, retrievedAt: new Date().toISOString() },
    ],
  },
  "9C1E4": {
    uei: "PL3FG8HJKN46",
    cage: "9C1E4",
    legalBusinessName: "Vanguard Integrated Technologies",
    entityType: "subcontractor",
    samStatus: "Active",
    registrationDate: "2021-01-10",
    expirationDate: "2027-01-10",
    physicalAddress: { city: "San Diego", state: "CA", country: "USA" },
    naicsCodes: ["541511", "541519"],
    pointOfContact: { firstName: "Michael", lastName: "Torres", title: "Contracts Manager" },
    knownArtifacts: [
      { artifactKey: "BRL_1", name: "Articles of Incorporation", status: "active", source: "sam_api", regulation: "State Statutes / UCC; 13 CFR § 121", vertical: "BRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "BRL_2", name: "Validated SAM.gov Profile", status: "active", source: "sam_api", regulation: "FAR Subpart 4.11; 2 CFR Part 25", vertical: "BRL", level: 2, retrievedAt: new Date().toISOString() },
      { artifactKey: "FRL_1", name: "IRS Form SS-4 (EIN Assignment)", status: "active", source: "sam_api", regulation: "IRS Publication 583", vertical: "FRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "PRL_1", name: "Policy Impact Analysis", status: "active", source: "sam_api", regulation: "DoDI 5000.02", vertical: "PRL", level: 1, retrievedAt: new Date().toISOString() },
    ],
  },
  "2F8G3": {
    uei: "RT6UV2CDYA91",
    cage: "2F8G3",
    legalBusinessName: "Citadel Cyber Operations",
    entityType: "vendor",
    samStatus: "Active",
    registrationDate: "2018-09-22",
    expirationDate: "2026-09-22",
    physicalAddress: { city: "Columbia", state: "MD", country: "USA" },
    naicsCodes: ["541512", "541519", "518210"],
    pointOfContact: { firstName: "Elena", lastName: "Kowalski", title: "CISO" },
    knownArtifacts: [
      { artifactKey: "BRL_1", name: "Articles of Incorporation", status: "active", source: "sam_api", regulation: "State Statutes / UCC; 13 CFR § 121", vertical: "BRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "BRL_2", name: "Validated SAM.gov Profile", status: "active", source: "sam_api", regulation: "FAR Subpart 4.11; 2 CFR Part 25", vertical: "BRL", level: 2, retrievedAt: new Date().toISOString() },
      { artifactKey: "BRL_3", name: "SF-328 (Foreign Interests)", status: "active", source: "sam_api", regulation: "32 CFR Part 117 (NISPOM)", vertical: "BRL", level: 3, retrievedAt: new Date().toISOString() },
      { artifactKey: "BRL_4", name: "CAGE Code Confirmation", status: "active", source: "sam_api", regulation: "FAR 52.204-7; DFARS 204.72", vertical: "BRL", level: 4, retrievedAt: new Date().toISOString() },
      { artifactKey: "CRL_1", name: "Cyber Risk Assessment (CRA)", status: "active", source: "sam_api", regulation: "NIST SP 800-30", vertical: "CRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "CRL_2", name: "Security Plan (SP)", status: "active", source: "sam_api", regulation: "NIST SP 800-60 / FIPS 199", vertical: "CRL", level: 2, retrievedAt: new Date().toISOString() },
      { artifactKey: "CRL_3", name: "MFA Implementation Report", status: "active", source: "sam_api", regulation: "Executive Order 14028", vertical: "CRL", level: 3, retrievedAt: new Date().toISOString() },
      { artifactKey: "CRL_5", name: "STIG Compliance Logs", status: "pending", source: "sam_api", regulation: "NIST SP 800-53 Rev. 5", vertical: "CRL", level: 5, retrievedAt: new Date().toISOString() },
      { artifactKey: "FRL_1", name: "IRS Form SS-4 (EIN Assignment)", status: "active", source: "sam_api", regulation: "IRS Publication 583", vertical: "FRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "FRL_2", name: "Chart of Accounts (COA)", status: "active", source: "sam_api", regulation: "FAR 31.201-2", vertical: "FRL", level: 2, retrievedAt: new Date().toISOString() },
      { artifactKey: "PRL_1", name: "Policy Impact Analysis", status: "active", source: "sam_api", regulation: "DoDI 5000.02", vertical: "PRL", level: 1, retrievedAt: new Date().toISOString() },
      { artifactKey: "PRL_2", name: "Privacy Impact Assessment (PIA)", status: "active", source: "sam_api", regulation: "DoDI 5400.11", vertical: "PRL", level: 2, retrievedAt: new Date().toISOString() },
    ],
  },
};

const UEI_INDEX: Record<string, string> = {};
for (const [cage, entity] of Object.entries(KNOWN_ENTITIES)) {
  UEI_INDEX[entity.uei] = cage;
}

export function lookupByCage(cage: string): SamEntity | null {
  return KNOWN_ENTITIES[cage.toUpperCase()] || null;
}

export function lookupByUei(uei: string): SamEntity | null {
  const cage = UEI_INDEX[uei.toUpperCase()];
  if (!cage) return null;
  return KNOWN_ENTITIES[cage];
}

export function samLookup(identifier: { cage?: string; uei?: string }): {
  found: boolean;
  entity: SamEntity | null;
  discoveredArtifacts: SamArtifact[];
} {
  let entity: SamEntity | null = null;
  if (identifier.cage) {
    entity = lookupByCage(identifier.cage);
  }
  if (!entity && identifier.uei) {
    entity = lookupByUei(identifier.uei);
  }
  return {
    found: !!entity,
    entity,
    discoveredArtifacts: entity?.knownArtifacts || [],
  };
}

export function recommendLevel(profile: {
  samStatus: string;
  knownArtifactCount: number;
  entityType: string;
  hasExportControl: boolean;
  hasCMMC: boolean;
  hasCPARS: boolean;
  capabilityDescription?: string;
}): {
  recommendedLevel: number;
  confidence: number;
  reasoning: string;
} {
  let level = 1;
  let reasoning = "Starting at baseline Level 1.";

  if (profile.samStatus === "Active") {
    level = 3;
    reasoning = "SAM.gov registration active — entity meets Level 3 baseline (entity identification, state filing, SAM registration).";
  }

  if (profile.knownArtifactCount >= 4) {
    level = Math.max(level, 4);
    reasoning += " Multiple verified artifacts on file indicate Level 4 operational maturity.";
  }

  if (profile.hasCMMC) {
    level = Math.max(level, 5);
    reasoning += " CMMC documentation presence supports Level 5 cyber readiness posture.";
  }

  if (profile.hasCPARS) {
    level = Math.max(level, 5);
    reasoning += " CPARS history demonstrates established performance record for Level 5+.";
  }

  if (profile.hasExportControl) {
    level = Math.max(level, 6);
    reasoning += " Export control classification suggests Level 6 regulatory compliance.";
  }

  if (profile.capabilityDescription && profile.capabilityDescription.length > 100) {
    level = Math.max(level, level + 1);
    reasoning += " Detailed capability description indicates readiness for next level assessment.";
  }

  level = Math.min(level, 9);

  const confidence = Math.min(0.95, 0.5 + (profile.knownArtifactCount * 0.05));

  return { recommendedLevel: level, confidence, reasoning };
}
