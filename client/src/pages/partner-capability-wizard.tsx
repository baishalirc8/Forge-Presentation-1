import { useState, useMemo, useEffect, useRef } from "react";
import {
  useGetPartnerCapabilityQuery, useGetArtifactsQuery, useGetVerticalConfigsQuery, useGetFeedbackQuery,
  useCreatePartnerCapabilityMutation, useUpdatePartnerCapabilityMutation, useUpdatePartnerCapabilityStatusMutation,
  useSendFeedbackMutation, useUploadCapabilityFileMutation,
  api, apiRequest
} from "@/lib/api";
import { useAppDispatch } from "@/lib/store";
import { useLocation, useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { VERTICALS, LEVEL_LABELS, OFFERING_TYPES, type Artifact, type VerticalConfig, type PartnerCapability, type AssessmentFeedback, PARTNER_CAPABILITY_STATUS_LABELS, type PartnerCapabilityStatus } from "@shared/schema";
import {
  ArrowLeft, Upload, ChevronDown, Check, Loader2, Info, Clock, Eye, FileText, X, Pencil, Trash2, Send, MessageSquare, ExternalLink
} from "lucide-react";

interface UploadedDoc {
  fileName: string;
  filePath: string;
  option: string;
}

interface VerticalSelection {
  level: number;
  checkedArtifacts: string[];
  compliance: string;
  complianceRemarks: string;
  additionalEvidence: string;
  uploadedDocs?: UploadedDoc[];
}

type WizardData = {
  name: string;
  offeringType: string;
  description: string;
  problemStatement: string;
  imagePath: string;
  materials: UploadedDoc[];
  additionalInfo: string;
  verticalSelections: Record<string, VerticalSelection>;
};

const TRL_LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Basic principles observed",
  2: "Technology concept formulated",
  3: "Proof-of-concept demonstrated",
  4: "Components validated in lab environment",
  5: "Components validated in relevant environment",
  6: "Prototype demonstrated in relevant environment",
  7: "Prototype demonstrated in operational environment",
  8: "System qualified through demonstration",
  9: "System proven in mission ops.",
};

const TRL_LEVEL_GOVERNANCE: Record<number, string> = {
  1: "DoDI 5000.80 (Innovation Readiness)",
  2: "DFARS 231.205 / SAM.gov",
  3: "DoDI 5000.91 (Rapid Prototyping)",
  4: "ITAR/EAR / DoDI 8510.01",
  5: "DoDI 5000.89 / TRMC Policy",
  6: "DoDI 5000.02T / RMF Step 4",
  7: "USD(R&E) / ASW(MC) Prototype Policy",
  8: "DoDI 5000.97 (MOSA) / Zero Trust 2.0",
  9: "DoDI 5000.04 / 5000.66 (Enterprise Sustainment)",
};

const STEPS = [
  { id: 1, label: "Basic Info", group: null },
  { id: 2, label: "Governance & Digital Infrastructure", group: "governance", subItems: ["Policy & Legal", "Cyber Security", "Partnership & Integration"] },
  { id: 3, label: "Operational Capability & Execution", group: "operational", subItems: ["Supply Chain", "Testing & Verification", "Manufacturing", "Human Engineering", "AI"] },
  { id: 4, label: "Review and Complete", group: null },
];

const STEP_FEEDBACK_KEYS: Record<number, string[]> = {
  1: ["basic_info", "TRL"],
  2: ["PRL", "CRL", "IRL"],
  3: ["SCRL", "TVRL", "MRL", "HRL", "AIRL"],
};
const SUB_FEEDBACK_KEYS: Record<string, string[]> = {
  "2-0": ["PRL"], "2-1": ["CRL"], "2-2": ["IRL"],
  "3-0": ["SCRL"], "3-1": ["TVRL"], "3-2": ["MRL"], "3-3": ["HRL"], "3-4": ["AIRL"],
};

const PRL_LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Policy constraints identified",
  2: "Privacy impact assessed",
  3: "LOAC review completed",
  4: "Data rights established",
  5: "Weapons legal review passed",
  6: "PII/PHI compliance certified",
  7: "Policy waivers documented",
  8: "Legal authority confirmed",
  9: "International clearance obtained",
};

const PRL_LEVEL_GOVERNANCE: Record<number, string> = {
  1: "DoDI 5000.02 (Acquisition Law)",
  2: "DoDI 5400.11 (Privacy Program)",
  3: "CJCSI 5810.01 (LOAC Review)",
  4: "DFARS 227.71 (Data Rights)",
  5: "DoDD 5000.01 (Weapons Legal Review)",
  6: "Privacy Act of 1974 / HIPAA",
  7: "DoDI 5000.02 (Acquisition Policy)",
  8: "Joint Publication 3-0 (Legal Basis)",
  9: "DoDD 2311.01 (Law of War Program)",
};

const PRL_ARTIFACTS = [
  "Policy Impact Analysis",
  "Privacy Impact Assessment (PIA)",
  "Targeting Logic (LOAC Analysis)",
  "DFARS Data Rights Table",
  "Article 36 Review Report",
  "PII/PHI Anonymization Plan",
  "Policy Waiver / Exception (ETP)",
  "Legal Authority to Operate (LATO)",
  "International Legal Clearance Memo",
];

const IRL_LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Interface Recognition",
  2: "Interface Specs",
  3: "Lab Integration",
  4: "Subsystem Lab Val",
  5: "Relevant Env",
  6: "System-of-Systems",
  7: "Multi-Service Val",
  8: "Joint-Wide Certified",
  9: "Continuous Integration",
};

const IRL_LEVEL_GOVERNANCE: Record<number, string> = {
  1: "DoD Open Systems Architecture (OSA) Guidebook",
  2: "MIL-STD-961E (Interface Specifications)",
  3: "DoDI 5000.88 (Systems Engineering - Integration)",
  4: "IEEE 15288.1 (SE on Defense Programs)",
  5: "DoD Digital Engineering Strategy (Digital Twins)",
  6: "CJCSI 5123.01 (Joint Requirements / JROC)",
  7: "10 U.S.C. § 4401 (Mandatory MOSA)",
  8: "CJCSI 6212.01 (Net-Ready KPP)",
  9: "DoDI 5000.87 (Software Acquisition Pathway)",
};

const IRL_ARTIFACTS = [
  "Physical Architecture Diagram",
  "Interface Control Document (ICD)",
  "Integration Test Plan & Logs",
  "Verification Cross Ref Matrix (VCRM)",
  "Digital Twin Simulation Report",
  "SoS Architecture View (OV-1)",
  "MOSA Compliance Report",
  "JITC Interoperability Cert",
  "DevSecOps Pipeline Architecture",
];

const SCRL_LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Ad-hoc Sourcing",
  2: "Key Suppliers Listed",
  3: "Tier-1 Alternates",
  4: "SCRM Plan Formalized",
  5: "Dual Sourcing Qualified",
  6: "Geopolitical Assessment",
  7: "Tier-2 Visibility",
  8: "SBOM/Redundancy",
  9: "Automated Monitoring",
};

const SCRL_LEVEL_GOVERNANCE: Record<number, string> = {
  1: "Executive Order 14017 (Supply Chains)",
  2: "FAR 52.204-24 (889 Prohibitions)",
  3: "DoDI 5000.60 (Industrial Base)",
  4: "NIST SP 800-161 Rev. 1",
  5: "DFARS 225.7018 (Specialty Metals)",
  6: "DoDI 5200.44 (Trusted Systems)",
  7: "AS6174A (Counterfeit Materiel)",
  8: "EO 14028 / Sec 889 Part B",
  9: "DoD SCRM Strategy (2024) / 10 U.S.C. § 4811",
};

const SCRL_ARTIFACTS = [
  "Preliminary Vendor List",
  "Section 889 Representation Form",
  "Alternate Supplier Analysis",
  "SCRM Plan",
  "Material Certificate of Origin",
  "FOCI Disclosure (SF-328)",
  "Tier-2 Bill of Materials (BOM)",
  "Software BOM (CycloneDX/SPDX)",
  "Industrial Base Surge Plan",
];

const AIRL_LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Concept Recognized",
  2: "Data Pipeline",
  3: "Dataset Curated",
  4: "Baseline/Bias",
  5: "Ground Truth/XAI",
  6: "Robustness",
  7: "MLOps/cATO",
  8: "Ops Retraining",
  9: "Continuous Red-Teaming",
};

const AIRL_LEVEL_GOVERNANCE: Record<number, string> = {
  1: "DoD RAI Strategy & Implementation Pathway",
  2: "DoD Data Strategy (VAULT Requirements)",
  3: "DoD CDAO Data Decrees (2025)",
  4: "NIST AI RMF (Risk Management Framework). DoD AI Cybersecurity Risk Management Tailoring Guide (2025)",
  5: "DIU Responsible AI Guidelines (Explainability)",
  6: "Executive Order 14110 (Adversarial Testing)",
  7: "DoDI 5000.87 (Software Pathway for ML), DoD AI Cybersecurity Risk Management Tailoring Guide (2025)",
  8: "DoD AI Strategy Memo (2026)",
  9: "Sec 1572 of the FY2026 NDAA (Persistent Red-Teaming)",
};

const AIRL_ARTIFACTS = [
  "Concept Recognized",
  "Data Pipeline",
  "Dataset Curated",
  "Baseline/Bias",
  "Ground Truth/XAI",
  "Robustness",
  "MLOps/cATO",
  "Ops Retraining",
  "Continuous Red-Teaming",
];

const HRL_LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Roles Identified",
  2: "HF Plan Drafted",
  3: "Mock-ups Tested",
  4: "Human-in-the-Loop",
  5: "Usability/Safety",
  6: "Explainability/Training",
  7: "Operators Trained",
  8: "Doctrine/Trust",
  9: "Combat Validation",
};

const HRL_LEVEL_GOVERNANCE: Record<number, string> = {
  1: "DoDI 5000.95 (Human Systems Integration)",
  2: "MIL-STD-46855A (Human Engineering)",
  3: "MIL-HDBK-759C (Human Engineering Design)",
  4: "NIST IR 8428 (Digital Twin for HSI)",
  5: "MIL-STD-882E (System Safety)",
  6: "DoD AI Ethics (Explainability)",
  7: "DoDD 1322.18 (Military Training)",
  8: "Joint Publication 3-0 (Joint Operations)",
  9: "CJCSI 3170.01 (JCIDS)",
};

const HRL_ARTIFACTS = [
  "HSI Strategy",
  "HEPP (Human Eng Program Plan)",
  "UI/UX Design Document",
  "HITL Evaluation Test Report",
  "Usability Test Report",
  "Model Card & XAI Rationale",
  "Program of Instruction (POI)",
  "Published TTPs & Doctrine",
  "Post-Deployment Performance Review",
];

const MRL_LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Feasibility",
  2: "Materials/Proc",
  3: "Lab-scale Build",
  4: "Process Repeatable",
  5: "Reproducible (Lab)",
  6: "Relevant Build",
  7: "Quality (DFARS)",
  8: "LRIP Ready",
  9: "Full-Rate",
};

const MRL_LEVEL_GOVERNANCE: Record<number, string> = {
  1: "DoD MRL Deskbook: Basic manufacturing feasibility assessed alongside TRL 1",
  2: "EO 14017: America's Supply Chains (Requirement for risk assessment)",
  3: "DoDI 5000.02: (Section on Engineering & Manufacturing Development - EMD)",
  4: "AS9100D: Quality Management Systems - Requirements for Aerospace/Defense",
  5: "DoD MRL Deskbook: Evaluation of \"Production-Relevant\" environments",
  6: "10 U.S.C. § 4252: Statutory requirement for Milestone B certification",
  7: "DFARS 252.246-7000; DFARS 225.7018 (Specialty Metals)",
  8: "FAR 34.005-2; SD-22 (DMSMS Obsolescence Management)",
  9: "DoDI 5000.91: Product Support Management; FRP Decision Memo",
};

const MRL_ARTIFACTS = [
  "Manufacturing Feasibility Study",
  "Preliminary Bill of Materials (BOM)",
  "Laboratory Build Records",
  "AS9100D Certificate",
  "MPV (Process Verification) Report",
  "MRA Report & Producibility Analysis",
  "DD Form 250 & Quality Manual",
  "First Article Inspection (AS9102)",
  "FRP Decision Memo & Spares Catalog",
];

const TVRL_LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Need Acknowledged",
  2: "TEMP Created",
  3: "Procedures Approved",
  4: "Subsystem Validation",
  5: "Certification Initiated",
  6: "Docs Complete",
  7: "OT&E Data Delivered",
  8: "Safety Release Granted",
  9: "Embedded Regression",
};

const TVRL_LEVEL_GOVERNANCE: Record<number, string> = {
  1: "DoDI 5000.89 (Test and Evaluation)",
  2: "DoDI 5000.89 (Mandatory TEMP)",
  3: "MIL-HDBK-881F (WBS)",
  4: "DAU T&E Management Guide",
  5: "DoDD 5000.01 (Acquisition System)",
  6: "NIST SP 800-53A (Security Controls)",
  7: '10 U.S.C. § 4171 (Independent Test). DoDM 5000.100, "Test and Evaluation Master Plans and Reporting"',
  8: "MIL-STD-882E / AR 70-62",
  9: "DoDI 5000.87 (Continuous Testing)",
};

const TVRL_ARTIFACTS = [
  "T&E Strategy (TES)",
  "Test Master Plan (TEMP)",
  "Detailed Test Procedures",
  "VCRM (Subsystem Level)",
  "Preliminary Hazard Analysis (PHA)",
  "Security Assessment Report (SAR)",
  "Independent Data Package (IDP)",
  "Safety Release / Airworthiness (AWR)",
  "Automated Regression Logs",
];

const CRL_LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Threat Awareness",
  2: "RMF Categorization",
  3: "Hygiene & MFA",
  4: "Enclave Design",
  5: "Controls Implemented",
  6: "IL5/IL6 Accredited",
  7: "Continuous Monitoring",
  8: "Cyber Ops",
  9: "Zero-Trust",
};

const CRL_LEVEL_GOVERNANCE: Record<number, string> = {
  1: "NIST SP 800-30 (Risk Assessments)",
  2: "NIST SP 800-60 / FIPS 199",
  3: "Executive Order 14028 (Improving Cybersecurity)",
  4: "DoD Cloud Computing SRG (IL Levels)",
  5: "NIST SP 800-53 Rev. 5",
  6: "DoDI 8510.01 (RMF for DoD), SECDEF Mandate Software Acquisition Pathway (SWP)",
  7: "NIST SP 800-137 (ISCM)",
  8: "DoDI 8530.01 (Cybersecurity Activities)",
  9: 'DoD Zero Trust Strategy & Reference Architecture. SECDEF Memorandum, "Directing Modern Software Acquisition to Maximize Lethality"',
};

const CRL_ARTIFACTS = [
  "Cyber Risk Assessment (CRA)",
  "Security Plan (SP)",
  "MFA Implementation Report",
  "Boundary Protection Plan",
  "STIG Compliance Logs",
  "Authorization to Operate (ATO)",
  "Continuous Monitoring Strategy",
  "Incident Response Plan (IRP)",
  "Zero Trust Architecture (ZTA)",
];

export default function PartnerCapabilityWizard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const editId = params.id;
  const isEditMode = !!editId;
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<WizardData>({
    name: "",
    offeringType: "capability",
    description: "",
    problemStatement: "",
    imagePath: "",
    materials: [],
    additionalInfo: "",
    verticalSelections: {},
  });
  const [activeSubItems, setActiveSubItems] = useState<Record<number, number>>({ 2: 0, 3: 0 });
  const activeSubItem = activeSubItems[currentStep] || 0;
  const setActiveSubItem = (idx: number) => setActiveSubItems(prev => ({ ...prev, [currentStep]: idx }));
  const [initialized, setInitialized] = useState(false);

  const { data: existingCap, isLoading: loadingCap } = useGetPartnerCapabilityQuery(editId!, { skip: !isEditMode });

  useEffect(() => {
    if (isEditMode && existingCap && !initialized) {
      setFormData({
        name: existingCap.name || "",
        offeringType: existingCap.offeringType || "capability",
        description: existingCap.description || "",
        problemStatement: existingCap.problemStatement || "",
        imagePath: existingCap.imagePath || "",
        materials: existingCap.materials || [],
        additionalInfo: existingCap.additionalInfo || "",
        verticalSelections: (existingCap.verticalSelections as Record<string, VerticalSelection>) || {},
      });
      setInitialized(true);
    }
  }, [existingCap, isEditMode, initialized]);

  const { data: allArtifacts } = useGetArtifactsQuery();

  const { data: verticalConfigs } = useGetVerticalConfigsQuery();

  const { data: feedback } = useGetFeedbackQuery(editId!, { skip: !isEditMode || !editId });

  const feedbackBySection: Record<string, AssessmentFeedback[]> = {};
  (feedback || []).forEach(fb => {
    if (!feedbackBySection[fb.section]) feedbackBySection[fb.section] = [];
    feedbackBySection[fb.section].push(fb);
  });

  const hasFeedback = (feedback || []).length > 0;
  const capStatus = existingCap?.status || "draft";
  const canResubmit = capStatus === "feedback_sent";

  const dispatch = useAppDispatch();
  const [updateCapApi] = useUpdatePartnerCapabilityMutation();
  const [updateStatusApi] = useUpdatePartnerCapabilityStatusMutation();
  const [createCapApi] = useCreatePartnerCapabilityMutation();

  const resubmitMutation = { mutate: async () => {
    try {
      await updateCapApi({ id: editId!, data: formData }).unwrap();
      await updateStatusApi({ id: editId!, status: "submitted" }).unwrap();
      toast({ title: "Re-submitted for assessment" });
      navigate("/capabilities");
    } catch (err: any) {
      toast({ title: "Error", description: err.data || err.message, variant: "destructive" });
    }
  }, isPending: false };

  const enabledVerticals = useMemo(() => {
    const configMap = new Map((verticalConfigs || []).map(c => [c.verticalKey, c]));
    return VERTICALS.filter(v => {
      const cfg = configMap.get(v.key);
      return !cfg || cfg.enabled;
    }).map(v => ({
      ...v,
      maxLevel: configMap.get(v.key)?.maxLevel || 9,
    }));
  }, [verticalConfigs]);

  const artifactsByVertical = useMemo(() => {
    const map: Record<string, Record<number, Artifact[]>> = {};
    for (const a of (allArtifacts || [])) {
      if (!map[a.vertical]) map[a.vertical] = {};
      if (!map[a.vertical][a.level]) map[a.vertical][a.level] = [];
      map[a.vertical][a.level].push(a);
    }
    return map;
  }, [allArtifacts]);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedCapabilityId, setSavedCapabilityId] = useState<string | null>(editId || null);

  const saveMutation = { mutate: async (data: WizardData, _opts?: any) => {
    try {
      const capId = savedCapabilityId || editId;
      let result: any;
      if (capId) {
        result = await updateCapApi({ id: capId, data }).unwrap();
      } else {
        result = await createCapApi(data).unwrap();
      }
      if (result?.id && !savedCapabilityId) {
        setSavedCapabilityId(result.id);
      }
      toast({ title: "Capability submitted successfully" });
      navigate("/capabilities");
    } catch (err: any) {
      toast({ title: "Error", description: err.data || err.message, variant: "destructive" });
    }
  }, isPending: false };

  const saveAndContinueMutation = { mutate: async (data: WizardData, opts?: { onSuccess?: () => void }) => {
    try {
      let result: any;
      if (savedCapabilityId) {
        result = await updateCapApi({ id: savedCapabilityId, data }).unwrap();
      } else {
        result = await createCapApi(data).unwrap();
      }
      if (result?.id) {
        setSavedCapabilityId(result.id);
      }
      opts?.onSuccess?.();
    } catch (err: any) {
      toast({ title: "Error saving", description: err.data || err.message, variant: "destructive" });
    }
  }, isPending: false };

  if (isEditMode && loadingCap) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  const updateField = (field: keyof WizardData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateVerticalSelection = (verticalKey: string, updates: Partial<VerticalSelection> | ((prev: VerticalSelection) => Partial<VerticalSelection>)) => {
    setFormData(prev => {
      const existing = prev.verticalSelections[verticalKey] || {
        level: 0,
        checkedArtifacts: [],
        compliance: "",
        complianceRemarks: "",
        additionalEvidence: "",
        uploadedDocs: [],
      };
      const resolved = typeof updates === "function" ? updates(existing) : updates;
      return {
        ...prev,
        verticalSelections: {
          ...prev.verticalSelections,
          [verticalKey]: {
            ...existing,
            ...resolved,
          },
        },
      };
    });
  };

  const toggleArtifact = (verticalKey: string, artifactId: string) => {
    const current = formData.verticalSelections[verticalKey]?.checkedArtifacts || [];
    const next = current.includes(artifactId)
      ? current.filter(id => id !== artifactId)
      : [...current, artifactId];
    updateVerticalSelection(verticalKey, { checkedArtifacts: next });
  };

  const saveInBackground = () => {
    const capId = savedCapabilityId || editId;
    if (capId) {
      apiRequest("PATCH", `/api/partner-capabilities/${capId}`, formData)
        .then(() => dispatch(api.util.invalidateTags(["PartnerCapabilities"])))
        .catch(() => {});
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.name.trim()) {
        toast({ title: "Name is required", variant: "destructive" });
        return;
      }
      saveAndContinueMutation.mutate(formData, {
        onSuccess: () => {
          setShowSaveModal(true);
        },
      });
      return;
    }
    const currentStepDef = STEPS.find(s => s.id === currentStep);
    const subs = (currentStepDef as any)?.subItems as string[] | undefined;
    if (subs && activeSubItem < subs.length - 1) {
      saveInBackground();
      setActiveSubItem(activeSubItem + 1);
      return;
    }
    if (currentStep < 4) {
      saveInBackground();
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setActiveSubItems(prev => ({ ...prev, [nextStep]: 0 }));
    }
  };

  const handleSaveAndView = () => {
    setShowSaveModal(false);
    const capId = savedCapabilityId || editId;
    if (capId) {
      apiRequest("PATCH", `/api/partner-capabilities/${capId}`, formData)
        .then(() => {
          dispatch(api.util.invalidateTags(["PartnerCapabilities"]));
          toast({ title: "Capability saved" });
          navigate("/capabilities");
        })
        .catch((err: Error) => {
          toast({ title: "Error saving", description: err.message, variant: "destructive" });
        });
    } else {
      apiRequest("POST", "/api/partner-capabilities", formData)
        .then(res => res.json())
        .then((result: any) => {
          if (result?.id) setSavedCapabilityId(result.id);
          dispatch(api.util.invalidateTags(["PartnerCapabilities"]));
          toast({ title: "Capability saved" });
          navigate("/capabilities");
        })
        .catch((err: Error) => {
          toast({ title: "Error saving", description: err.message, variant: "destructive" });
        });
    }
  };

  const handleContinueAssessment = () => {
    setShowSaveModal(false);
    if (currentStep < 4) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setActiveSubItems(prev => ({ ...prev, [nextStep]: 0 }));
    }
  };

  const handleBack = () => {
    if (activeSubItem > 0) {
      setActiveSubItem(activeSubItem - 1);
      return;
    }
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      const prevStepDef = STEPS.find(s => s.id === prevStep);
      const prevSubs = (prevStepDef as any)?.subItems as string[] | undefined;
      setCurrentStep(prevStep);
      if (prevSubs) {
        setActiveSubItems(prev => ({ ...prev, [prevStep]: prevSubs.length - 1 }));
      }
    }
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ ...formData, status: "submitted" } as any);
  };

  const governanceVerticals = enabledVerticals.filter(v =>
    ["BRL", "FRL", "PRL", "CCRL", "CRL", "TRL"].includes(v.key)
  );
  const operationalVerticals = enabledVerticals.filter(v =>
    !["BRL", "FRL", "PRL", "CCRL", "CRL", "TRL"].includes(v.key)
  );

  return (
    <div className="p-3 md:p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-3">
          <Link href="/capabilities">
            <Button variant="ghost" size="icon" data-testid="button-back-capabilities">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold" data-testid="text-wizard-title">{isEditMode ? "Edit Capability" : "Enter New Capability"}</h1>
        </div>
        {isEditMode && capStatus !== "draft" && (
          <div className="flex items-center gap-2">
            <Badge className="text-[10px] border" variant="outline" data-testid="badge-wizard-status">
              {PARTNER_CAPABILITY_STATUS_LABELS[capStatus as PartnerCapabilityStatus] || capStatus}
            </Badge>
          </div>
        )}
      </div>

      <div className="md:hidden mb-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {STEPS.map((step, idx) => {
            const isActive = currentStep === step.id;
            const isDone = currentStep > step.id;
            const canNav = isEditMode || currentStep > step.id || (!!savedCapabilityId && currentStep >= step.id);
            return (
              <div key={step.id} className="flex items-center gap-1 shrink-0">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors ${
                    isActive ? "bg-primary text-primary-foreground border-primary"
                    : isDone ? "bg-primary/20 text-primary border-primary/40"
                    : "bg-muted text-muted-foreground border-border"
                  } ${canNav ? "cursor-pointer" : ""}`}
                  onClick={() => { if (canNav) setCurrentStep(step.id); }}
                >
                  {isDone ? <Check className="h-3 w-3" /> : step.id}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`w-4 h-0.5 ${isDone ? "bg-primary/40" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Step {currentStep}: {STEPS.find(s => s.id === currentStep)?.label}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-0">
        <div className="hidden md:block w-[200px] shrink-0 border-r border-border pr-4 mr-6">
          <div className="space-y-1">
            {STEPS.map((step, idx) => {
              const subItems = (step as any).subItems as string[] | undefined;
              const isLast = idx === STEPS.length - 1;
              const canNav = isEditMode || currentStep > step.id || (!!savedCapabilityId && currentStep >= step.id);
              const isActive = currentStep === step.id;
              const isDone = currentStep > step.id;
              const stepFbKeys = STEP_FEEDBACK_KEYS[step.id] || [];
              const stepHasFeedback = stepFbKeys.some(k => {
                const items = feedbackBySection[k] || [];
                if (items.length === 0) return false;
                const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                return sorted[0].role === "admin";
              });
              const isExpanded = isActive;
              return (
                <div key={step.id} data-testid={`step-indicator-${step.id}`}>
                  <div
                    className={`flex items-center gap-2 px-2 py-2.5 rounded-md transition-colors ${
                      isActive ? "bg-primary/10" : canNav ? "hover:bg-muted/60 cursor-pointer" : ""
                    }`}
                    onClick={() => { if (canNav) setCurrentStep(step.id); }}
                  >
                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : isDone
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isDone ? <Check className="h-3 w-3" /> : step.id}
                    </div>
                    <span className={`text-xs font-medium leading-tight ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                    {stepHasFeedback && !subItems && (
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" title="Has feedback" />
                    )}
                    {subItems && (
                      <ChevronDown className={`h-3 w-3 ml-auto shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
                    )}
                  </div>
                  {subItems && isExpanded && (
                    <div className="ml-5 pl-3 border-l border-border/60 mt-1 mb-1.5 space-y-0.5">
                      {subItems.map((sub, sIdx) => {
                        const subFbKeys = SUB_FEEDBACK_KEYS[`${step.id}-${sIdx}`] || [];
                        const subHasFb = subFbKeys.some(k => {
                          const items = feedbackBySection[k] || [];
                          if (items.length === 0) return false;
                          const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                          return sorted[0].role === "admin";
                        });
                        const isActiveSub = isActive && sIdx === (activeSubItems[step.id] || 0);
                        return (
                          <div
                            key={sub}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                              isActiveSub ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                            }`}
                            data-testid={`step-sub-${sub.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "and")}`}
                            onClick={() => {
                              if (currentStep !== step.id && canNav) {
                                setCurrentStep(step.id);
                              }
                              setActiveSubItems(prev => ({ ...prev, [step.id]: sIdx }));
                            }}
                          >
                            <span className={`text-[11px] leading-tight ${isActiveSub ? "font-semibold" : ""}`}>{sub}</span>
                            {subHasFb && (
                              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" title="Has feedback" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!isLast && <div className="h-px bg-border/40 mx-2 my-1" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {currentStep === 1 && (
            <>
              <BasicInfoStep
                formData={formData}
                updateField={updateField}
                enabledVerticals={enabledVerticals}
                artifactsByVertical={artifactsByVertical}
                selections={formData.verticalSelections}
                updateVerticalSelection={updateVerticalSelection}
                toggleArtifact={toggleArtifact}
              />
              {isEditMode && hasFeedback && (
                <>
                  <WizardFeedbackPanel sectionKey="basic_info" sectionLabel="Basic Info" capId={editId!} feedbackItems={feedbackBySection["basic_info"] || []} />
                  <WizardFeedbackPanel sectionKey="TRL" sectionLabel="Technology Readiness" capId={editId!} feedbackItems={feedbackBySection["TRL"] || []} />
                </>
              )}
            </>
          )}

          {currentStep === 2 && activeSubItem === 0 && (
            <>
              <PolicyLegalStep
                selections={formData.verticalSelections}
                updateVerticalSelection={updateVerticalSelection}
                artifactsByVertical={artifactsByVertical}
              />
              {isEditMode && hasFeedback && (
                <WizardFeedbackPanel sectionKey="PRL" sectionLabel="Policy & Legal" capId={editId!} feedbackItems={feedbackBySection["PRL"] || []} />
              )}
            </>
          )}

          {currentStep === 2 && activeSubItem === 1 && (
            <>
              <CyberSecurityStep
                selections={formData.verticalSelections}
                updateVerticalSelection={updateVerticalSelection}
                artifactsByVertical={artifactsByVertical}
              />
              {isEditMode && hasFeedback && (
                <WizardFeedbackPanel sectionKey="CRL" sectionLabel="Cyber Security" capId={editId!} feedbackItems={feedbackBySection["CRL"] || []} />
              )}
            </>
          )}

          {currentStep === 2 && activeSubItem === 2 && (
            <>
              <IntegrationStep
                selections={formData.verticalSelections}
                updateVerticalSelection={updateVerticalSelection}
                artifactsByVertical={artifactsByVertical}
              />
              {isEditMode && hasFeedback && (
                <WizardFeedbackPanel sectionKey="IRL" sectionLabel="Partnership & Integration" capId={editId!} feedbackItems={feedbackBySection["IRL"] || []} />
              )}
            </>
          )}

          {currentStep === 3 && activeSubItem === 0 && (
            <>
              <SupplyChainStep
                selections={formData.verticalSelections}
                updateVerticalSelection={updateVerticalSelection}
                artifactsByVertical={artifactsByVertical}
              />
              {isEditMode && hasFeedback && (
                <WizardFeedbackPanel sectionKey="SCRL" sectionLabel="Supply Chain" capId={editId!} feedbackItems={feedbackBySection["SCRL"] || []} />
              )}
            </>
          )}

          {currentStep === 3 && activeSubItem === 1 && (
            <>
              <TestingVerificationStep
                selections={formData.verticalSelections}
                updateVerticalSelection={updateVerticalSelection}
                artifactsByVertical={artifactsByVertical}
              />
              {isEditMode && hasFeedback && (
                <WizardFeedbackPanel sectionKey="TVRL" sectionLabel="Testing & Verification" capId={editId!} feedbackItems={feedbackBySection["TVRL"] || []} />
              )}
            </>
          )}

          {currentStep === 3 && activeSubItem === 2 && (
            <>
              <ManufacturingStep
                selections={formData.verticalSelections}
                updateVerticalSelection={updateVerticalSelection}
                artifactsByVertical={artifactsByVertical}
              />
              {isEditMode && hasFeedback && (
                <WizardFeedbackPanel sectionKey="MRL" sectionLabel="Manufacturing" capId={editId!} feedbackItems={feedbackBySection["MRL"] || []} />
              )}
            </>
          )}

          {currentStep === 3 && activeSubItem === 3 && (
            <>
              <HumanEngineeringStep
                selections={formData.verticalSelections}
                updateVerticalSelection={updateVerticalSelection}
                artifactsByVertical={artifactsByVertical}
              />
              {isEditMode && hasFeedback && (
                <WizardFeedbackPanel sectionKey="HRL" sectionLabel="Human Engineering" capId={editId!} feedbackItems={feedbackBySection["HRL"] || []} />
              )}
            </>
          )}

          {currentStep === 3 && activeSubItem === 4 && (
            <>
              <AIStep
                selections={formData.verticalSelections}
                updateVerticalSelection={updateVerticalSelection}
                artifactsByVertical={artifactsByVertical}
              />
              {isEditMode && hasFeedback && (
                <WizardFeedbackPanel sectionKey="AIRL" sectionLabel="AI" capId={editId!} feedbackItems={feedbackBySection["AIRL"] || []} />
              )}
            </>
          )}

          {currentStep === 4 && (
            <ReviewStep
              formData={formData}
              enabledVerticals={enabledVerticals}
              onSubmit={handleSubmit}
              isSubmitting={saveMutation.isPending}
              canResubmit={canResubmit}
              onResubmit={() => resubmitMutation.mutate()}
              isResubmitting={resubmitMutation.isPending}
            />
          )}

          {currentStep !== 4 && (
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-border/40">
            {currentStep === 1 ? (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled
                data-testid="button-wizard-back"
              >
                Back
              </Button>
            ) : (currentStep === 2 || currentStep === 3) ? (
              <div />
            ) : (
              <Button
                variant="outline"
                onClick={handleBack}
                data-testid="button-wizard-back"
              >
                Back
              </Button>
            )}

            {currentStep === 1 ? (
              <Button
                onClick={handleNext}
                disabled={saveAndContinueMutation.isPending}
                data-testid="button-wizard-next"
              >
                {saveAndContinueMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save and Next
              </Button>
            ) : (currentStep === 2 || currentStep === 3) ? (
              <div className="flex gap-3">
                <Button
                  onClick={handleNext}
                  data-testid="button-wizard-continue"
                >
                  Continue
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveAndView}
                  data-testid="button-wizard-save-quit"
                >
                  Save & Quit
                </Button>
              </div>
            ) : null}
          </div>
          )}
        </div>
      </div>

      <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
        <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden" data-testid="modal-save-capability">
          <div className="p-6 pb-2">
            <DialogTitle className="text-lg font-bold" data-testid="text-modal-title">Capability Information Saved</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Your basic information has been saved for your capability. What would you like to do next?
            </DialogDescription>
          </div>

          <div className="grid grid-cols-2 gap-4 px-6 pb-6 pt-2">
            <div className="border border-border rounded-lg p-5 flex flex-col items-center text-center" data-testid="card-save-view">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-sm font-bold mb-1">Save & View Capability</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Create your capability record and return later to complete the assessment.
              </p>
              <Button
                className="w-full"
                onClick={handleSaveAndView}
                data-testid="button-save-view"
              >
                Save & View Capability
              </Button>
            </div>

            <div className="border border-border rounded-lg p-5 flex flex-col items-center text-center" data-testid="card-continue-assessment">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-sm font-bold mb-1">Continue Assessment</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Proceed to the next steps to complete the full assessment.
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                <Clock className="h-3 w-3" />
                <span>~ 10 minutes</span>
              </div>
              <Button
                className="w-full"
                onClick={handleContinueAssessment}
                data-testid="button-continue-assessment"
              >
                Continue Assessment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function triggerImagePicker(onUpload: (filePath: string) => void, toast: any) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/jpg";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB allowed", variant: "destructive" });
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("verticalKey", "capability-image");
    fd.append("option", "capability-image");
    try {
      const res = await fetch("/api/capability-uploads", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const result = await res.json();
      onUpload(result.filePath);
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };
  input.click();
}

function ImageUploadArea({ imagePath, onImageChange, toast }: {
  imagePath: string;
  onImageChange: (path: string) => void;
  toast: any;
}) {
  if (imagePath) {
    return (
      <div className="relative group border border-border rounded-lg overflow-hidden">
        <img
          src={`/api/documents/${encodeURIComponent(imagePath)}`}
          alt="Capability"
          className="w-full h-[200px] object-cover"
          data-testid="img-capability-preview"
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={() => triggerImagePicker(onImageChange, toast)}
            data-testid="button-change-image"
          >
            <Pencil className="h-3.5 w-3.5" />
            Change
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="gap-1.5"
            onClick={() => onImageChange("")}
            data-testid="button-remove-image"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => triggerImagePicker(onImageChange, toast)}
      data-testid="dropzone-upload-image"
    >
      <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
      <p className="text-sm font-medium">Upload Image</p>
      <p className="text-xs text-muted-foreground mt-1">Photos must be less than 5MB in size.<br/>jpg, png files accepted</p>
      <Button size="sm" className="mt-3" data-testid="button-upload-image">Upload</Button>
    </div>
  );
}

function MaterialsUploadSection({ materials, onMaterialsChange }: {
  materials: UploadedDoc[];
  onMaterialsChange: (docs: UploadedDoc[]) => void;
}) {
  const [selectedOption, setSelectedOption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MATERIAL_OPTIONS = ["White Paper", "Quad Chart", "Technical Brief", "Presentation", "Other"];

  const handleUpload = () => {
    if (!selectedOption || !fileInputRef.current) return;
    fileInputRef.current.setAttribute("data-upload-option", selectedOption);
    fileInputRef.current.click();
  };

  const processFile = async (file: File, option: string) => {
    setIsUploading(true);
    setUploadFileName(file.name);
    setUploadProgress(0);
    return new Promise<UploadedDoc | null>((resolve) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("verticalKey", "materials");
      fd.append("option", option);
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve({ fileName: result.fileName, filePath: result.filePath, option });
          } catch { resolve(null); }
        } else { resolve(null); }
      };
      xhr.onerror = () => resolve(null);
      xhr.open("POST", "/api/capability-uploads");
      xhr.withCredentials = true;
      xhr.send(fd);
    });
  };

  const removeDoc = (index: number) => {
    const updated = [...materials];
    updated.splice(index, 1);
    onMaterialsChange(updated);
  };

  return (
    <div>
      <Label className="text-sm font-medium mb-1.5 block">Uploads</Label>
      <p className="text-xs text-muted-foreground mb-2">Upload White Paper and/or Quad Charts (optional) (Max file size - 500MB)</p>
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          data-testid="file-input-materials"
          onChange={async (e) => {
            const files = e.target.files;
            const option = e.target.getAttribute("data-upload-option") || "";
            if (!files || files.length === 0 || !option) return;
            const newDocs: UploadedDoc[] = [];
            for (let i = 0; i < files.length; i++) {
              const doc = await processFile(files[i], option);
              if (doc) newDocs.push(doc);
            }
            if (newDocs.length > 0) onMaterialsChange([...materials, ...newDocs]);
            setIsUploading(false);
            setUploadProgress(0);
            setUploadFileName("");
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          multiple
        />
        <Button
          size="sm"
          onClick={handleUpload}
          disabled={!selectedOption || isUploading}
          data-testid="button-upload-whitepaper"
        >
          {isUploading ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{uploadProgress}%</>
          ) : (
            <><Upload className="h-3.5 w-3.5 mr-1.5" />Upload File</>
          )}
        </Button>
        <Select value={selectedOption} onValueChange={setSelectedOption}>
          <SelectTrigger className="flex-1 h-9" data-testid="select-upload-option">
            <SelectValue placeholder="Select Option" />
          </SelectTrigger>
          <SelectContent>
            {MATERIAL_OPTIONS.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isUploading && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="truncate max-w-[200px]">{uploadFileName}</span>
            <span className="font-medium">{uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {materials.length > 0 && (
        <div className="mt-3 space-y-2">
          {materials.map((doc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 border border-border/40"
              data-testid={`uploaded-material-${idx}`}
            >
              <a
                href={`/api/documents/${encodeURIComponent(doc.filePath)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 min-w-0 hover:opacity-80 cursor-pointer"
                data-testid={`link-material-${idx}`}
              >
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate underline decoration-dotted underline-offset-2">{doc.fileName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{doc.option}</p>
                </div>
              </a>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeDoc(idx)} data-testid={`button-remove-material-${idx}`}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <button
        className="text-xs text-primary mt-2 hover:underline"
        onClick={handleUpload}
        disabled={!selectedOption || isUploading}
        data-testid="button-add-materials"
      >
        + Add more materials
      </button>
    </div>
  );
}

function AdditionalInfoSection({ additionalInfo, onInfoChange }: {
  additionalInfo: string;
  onInfoChange: (val: string) => void;
}) {
  const [expanded, setExpanded] = useState(!!additionalInfo);
  useEffect(() => {
    if (additionalInfo && !expanded) setExpanded(true);
  }, [additionalInfo]);

  return (
    <div className="space-y-2">
      <button
        className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-additional-info"
      >
        {expanded ? "- " : "+ "}Add additional Information
      </button>
      {expanded && (
        <Textarea
          value={additionalInfo}
          onChange={(e) => onInfoChange(e.target.value)}
          className="min-h-[100px]"
          placeholder="Enter any additional information about your capability or product..."
          data-testid="textarea-additional-info"
        />
      )}
    </div>
  );
}

function BasicInfoStep({ formData, updateField, enabledVerticals, artifactsByVertical, selections, updateVerticalSelection, toggleArtifact }: {
  formData: WizardData;
  updateField: (field: keyof WizardData, value: any) => void;
  enabledVerticals: Array<{ key: string; name: string; description: string; maxLevel: number }>;
  artifactsByVertical: Record<string, Record<number, Artifact[]>>;
  selections: Record<string, VerticalSelection>;
  updateVerticalSelection: (key: string, updates: Partial<VerticalSelection> | ((prev: VerticalSelection) => Partial<VerticalSelection>)) => void;
  toggleArtifact: (key: string, artifactId: string) => void;
}) {
  const { toast } = useToast();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold" data-testid="text-basic-info-title">Basic Information</h2>
        <p className="text-sm text-muted-foreground">New Capability or Product</p>
      </div>

      <div className="space-y-5">
        <div>
          <Label className="text-sm font-medium mb-1.5 block">Name</Label>
          <p className="text-xs text-muted-foreground mb-2">Capability/Product Name *</p>
          <Input
            value={formData.name}
            onChange={e => updateField("name", e.target.value)}
            placeholder="Enter capability or product name"
            data-testid="input-cap-name"
          />
        </div>

        <div>
          <Label className="text-sm font-medium mb-1.5 block">Photos</Label>
          <p className="text-xs text-muted-foreground mb-2">Upload an image of your Capability or Product *</p>
          <ImageUploadArea
            imagePath={formData.imagePath}
            onImageChange={(path) => updateField("imagePath", path)}
            toast={toast}
          />
        </div>

        <div>
          <Label className="text-sm font-medium mb-1.5 block">Type of Offering</Label>
          <div className="flex gap-6 mt-2">
            {OFFERING_TYPES.map(type => (
              <label
                key={type}
                className="flex items-center gap-2 cursor-pointer"
                data-testid={`radio-offering-${type}`}
                onClick={() => updateField("offeringType", type)}
              >
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                  formData.offeringType === type ? "border-primary" : "border-muted-foreground/40"
                }`}>
                  {formData.offeringType === type && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
                <span className="text-sm capitalize">{type}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium mb-1.5 block">
            Provide a description of your Capability or Product <span className="text-destructive">*</span>
          </Label>
          <Textarea
            value={formData.description}
            onChange={e => updateField("description", e.target.value)}
            className="mt-2 min-h-[100px]"
            placeholder="Describe your capability or product..."
            data-testid="textarea-description"
          />
        </div>

        <div>
          <Label className="text-sm font-medium mb-1.5 block">
            Describe the problem your product solves <span className="text-destructive">*</span>
          </Label>
          <Textarea
            value={formData.problemStatement}
            onChange={e => updateField("problemStatement", e.target.value)}
            className="mt-2 min-h-[100px]"
            placeholder="250 word limit"
            data-testid="textarea-problem"
          />
        </div>

        <MaterialsUploadSection
          materials={formData.materials}
          onMaterialsChange={(materials) => updateField("materials", materials)}
        />
      </div>

      <AdditionalInfoSection
        additionalInfo={formData.additionalInfo}
        onInfoChange={(val) => updateField("additionalInfo", val)}
      />

      {enabledVerticals.filter(v => v.key === "TRL").map(vertical => {
        const sel = selections[vertical.key];
        const selectedLevel = sel?.level || 0;
        const verticalArtifacts = artifactsByVertical[vertical.key] || {};

        const allArtifactsForVertical: Artifact[] = [];
        for (let l = 1; l <= vertical.maxLevel; l++) {
          if (verticalArtifacts[l]) {
            allArtifactsForVertical.push(...verticalArtifacts[l]);
          }
        }

        const levelsForDropdown: number[] = [];
        for (let l = 1; l <= vertical.maxLevel; l++) {
          levelsForDropdown.push(l);
        }

        return (
          <div key={vertical.key} className="space-y-5 pt-6" data-testid={`section-vertical-${vertical.key}`}>
            <Separator />

            <div>
              <h3 className="text-base font-bold">Technology Maturity</h3>
              <p className="text-xs text-muted-foreground">Regulatory Anchor: DoDD 1100.4</p>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">
                Authority & Guidance <Info className="h-3 w-3 inline text-muted-foreground" />
              </p>
              <p className="text-xs text-muted-foreground mb-2">TRL Specification</p>
              <Select
                value={selectedLevel > 0 ? String(selectedLevel) : ""}
                onValueChange={val => updateVerticalSelection(vertical.key, { level: parseInt(val) })}
              >
                <SelectTrigger className="w-full h-auto py-2" data-testid={`select-level-${vertical.key}`}>
                  <SelectValue placeholder="Select TRL Level" />
                </SelectTrigger>
                <SelectContent>
                  {levelsForDropdown.map(l => {
                    const levelArtifact = verticalArtifacts[l]?.[0];
                    const levelPolicy = levelArtifact?.policies?.[0] || TRL_LEVEL_GOVERNANCE[l] || "";
                    return (
                      <SelectItem key={l} value={String(l)} className="py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">Level {l} - {TRL_LEVEL_DESCRIPTIONS[l]}</span>
                          <span className="text-muted-foreground text-xs">Governance: {levelPolicy}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-sm font-medium mb-3">Select any of the following items you have completed:</p>
              <div className="space-y-3">
                {allArtifactsForVertical.map(artifact => {
                  const isChecked = sel?.checkedArtifacts?.includes(artifact.id) || false;
                  return (
                    <label
                      key={artifact.id}
                      className="flex items-center gap-3 cursor-pointer"
                      data-testid={`checkbox-artifact-${artifact.id}`}
                      onClick={() => toggleArtifact(vertical.key, artifact.id)}
                    >
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isChecked ? "bg-primary border-primary" : "border-muted-foreground/40"
                      }`}>
                        {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="text-sm">{artifact.name}</span>
                      {artifact.policyLinks?.[0] ? (
                        <a href={artifact.policyLinks[0]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary/60 hover:text-primary shrink-0" title={artifact.policies?.[0] || "View Policy"}>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <Info className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            <DocumentUploadSection
              verticalKey={vertical.key}
              artifacts={allArtifactsForVertical.map(a => a.name)}
              selections={selections}
              updateVerticalSelection={updateVerticalSelection}
            />

            <Separator />

            <div>
              <p className="text-sm font-semibold mb-2">Self-Declaration</p>
              <p className="text-xs text-muted-foreground mb-3">Declare your compliance status for this level</p>
              <div className="flex gap-8">
                <label
                  className="flex items-center gap-2 cursor-pointer"
                  data-testid={`radio-compliant-${vertical.key}`}
                  onClick={() => updateVerticalSelection(vertical.key, { compliance: "compliant" })}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                    sel?.compliance === "compliant" ? "border-primary" : "border-muted-foreground/40"
                  }`}>
                    {sel?.compliance === "compliant" && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-sm">Compliant</span>
                </label>
                <label
                  className="flex items-center gap-2 cursor-pointer"
                  data-testid={`radio-not-compliant-${vertical.key}`}
                  onClick={() => updateVerticalSelection(vertical.key, { compliance: "not_compliant" })}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                    sel?.compliance === "not_compliant" ? "border-primary" : "border-muted-foreground/40"
                  }`}>
                    {sel?.compliance === "not_compliant" && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-sm">Not Compliant</span>
                </label>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Enter any additional remarks or justification for your compliance status</p>
              <Textarea
                value={sel?.complianceRemarks || ""}
                onChange={e => updateVerticalSelection(vertical.key, { complianceRemarks: e.target.value })}
                className="min-h-[80px]"
                data-testid={`textarea-remarks-${vertical.key}`}
              />
            </div>

            <Separator />

            <div>
              <p className="text-sm font-semibold mb-2">Additional Supporting Evidence</p>
              <p className="text-xs text-muted-foreground mb-2">Describe any additional evidence supporting your self-assessment</p>
              <Textarea
                value={sel?.additionalEvidence || ""}
                onChange={e => updateVerticalSelection(vertical.key, { additionalEvidence: e.target.value })}
                className="min-h-[80px]"
                data-testid={`textarea-evidence-${vertical.key}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DocumentUploadSection({ verticalKey, artifacts, selections, updateVerticalSelection }: {
  verticalKey: string;
  artifacts: string[];
  selections: Record<string, VerticalSelection>;
  updateVerticalSelection: (key: string, updates: Partial<VerticalSelection> | ((prev: VerticalSelection) => Partial<VerticalSelection>)) => void;
}) {
  const [selectedOption, setSelectedOption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sel = selections[verticalKey] || { level: 0, checkedArtifacts: [], compliance: "", complianceRemarks: "", additionalEvidence: "", uploadedDocs: [] };
  const uploadedDocs = sel.uploadedDocs || [];

  const uploadSingleFile = (file: File, option: string): Promise<UploadedDoc | null> => {
    return new Promise((resolve) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("verticalKey", verticalKey);
      fd.append("option", option);
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve({ fileName: result.fileName, filePath: result.filePath, option });
          } catch { resolve(null); }
        } else { resolve(null); }
      };
      xhr.onerror = () => resolve(null);
      xhr.open("POST", "/api/capability-uploads");
      xhr.withCredentials = true;
      xhr.send(fd);
    });
  };

  const processFiles = async (files: FileList, option: string) => {
    setIsUploading(true);
    setUploadProgress(0);
    const newDocs: UploadedDoc[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadFileName(file.name);
      setUploadProgress(0);
      const doc = await uploadSingleFile(file, option);
      if (doc) newDocs.push(doc);
    }
    if (newDocs.length > 0) {
      updateVerticalSelection(verticalKey, (prev) => ({
        uploadedDocs: [...(prev.uploadedDocs || []), ...newDocs],
      }));
    }
    setIsUploading(false);
    setUploadProgress(0);
    setUploadFileName("");
  };

  const removeDoc = (index: number) => {
    updateVerticalSelection(verticalKey, (prev) => {
      const updated = [...(prev.uploadedDocs || [])];
      updated.splice(index, 1);
      return { uploadedDocs: updated };
    });
  };

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">Upload supporting documents (optional):</p>
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          data-testid={`file-input-${verticalKey}`}
          onChange={async (e) => {
            const files = e.target.files;
            const option = e.target.getAttribute("data-upload-option") || "";
            if (files && files.length > 0 && option) {
              await processFiles(files, option);
            }
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }}
        />
        <Button
          size="sm"
          onClick={() => {
            if (!selectedOption || !fileInputRef.current) return;
            fileInputRef.current.setAttribute("data-upload-option", selectedOption);
            fileInputRef.current.click();
          }}
          disabled={!selectedOption || isUploading}
          data-testid={`button-upload-docs-${verticalKey}`}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {uploadProgress}%
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload File
            </>
          )}
        </Button>
        <Select value={selectedOption} onValueChange={setSelectedOption}>
          <SelectTrigger className="flex-1 h-9" data-testid={`select-doc-option-${verticalKey}`}>
            <SelectValue placeholder="Select Option" />
          </SelectTrigger>
          <SelectContent>
            {artifacts.map(art => (
              <SelectItem key={art} value={art}>{art}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isUploading && (
        <div className="mt-2 space-y-1" data-testid={`upload-progress-${verticalKey}`}>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="truncate max-w-[200px]">{uploadFileName}</span>
            <span className="font-medium">{uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {uploadedDocs.length > 0 && (
        <div className="mt-3 space-y-2">
          {uploadedDocs.map((doc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 border border-border/40"
              data-testid={`uploaded-doc-${verticalKey}-${idx}`}
            >
              <a
                href={`/api/documents/${encodeURIComponent(doc.filePath)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 min-w-0 hover:opacity-80 cursor-pointer"
                data-testid={`link-doc-${verticalKey}-${idx}`}
              >
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate underline decoration-dotted underline-offset-2">{doc.fileName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{doc.option}</p>
                </div>
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => removeDoc(idx)}
                data-testid={`button-remove-doc-${verticalKey}-${idx}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PolicyLegalStep({ selections, updateVerticalSelection, artifactsByVertical }: {
  selections: Record<string, VerticalSelection>;
  updateVerticalSelection: (key: string, updates: Partial<VerticalSelection> | ((prev: VerticalSelection) => Partial<VerticalSelection>)) => void;
  artifactsByVertical: Record<string, Record<number, Artifact[]>>;
}) {
  const sel = selections["PRL"] || { level: 0, checkedArtifacts: [], compliance: "", complianceRemarks: "", additionalEvidence: "" };
  const selectedLevel = sel.level || 0;
  const verticalArtifacts = artifactsByVertical["PRL"] || {};

  const allPrlArtifacts: Artifact[] = [];
  for (let l = 1; l <= 9; l++) {
    if (verticalArtifacts[l]) allPrlArtifacts.push(...verticalArtifacts[l]);
  }

  const togglePrlArtifact = (artifactId: string) => {
    const current = sel.checkedArtifacts || [];
    const next = current.includes(artifactId)
      ? current.filter(a => a !== artifactId)
      : [...current, artifactId];
    updateVerticalSelection("PRL", { checkedArtifacts: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" data-testid="text-policy-legal-title">Policy & Legal</h2>
        <p className="text-xs text-muted-foreground">Regulatory Anchor: DoDD 1100.4</p>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">
          Authority & Guidance <Info className="h-3 w-3 inline text-muted-foreground" />
        </p>
        <p className="text-xs text-muted-foreground mb-2">PRL Specification</p>
        <Select
          value={selectedLevel > 0 ? String(selectedLevel) : ""}
          onValueChange={val => updateVerticalSelection("PRL", { level: parseInt(val) })}
        >
          <SelectTrigger className="w-full h-auto py-2" data-testid="select-level-PRL">
            <SelectValue placeholder="Select PRL Level" />
          </SelectTrigger>
          <SelectContent>
            {[1,2,3,4,5,6,7,8,9].map(l => {
              const levelArtifact = verticalArtifacts[l]?.[0];
              const levelPolicy = levelArtifact?.policies?.[0] || PRL_LEVEL_GOVERNANCE[l] || "";
              return (
                <SelectItem key={l} value={String(l)} className="py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Level {l} - {PRL_LEVEL_DESCRIPTIONS[l]}</span>
                    <span className="text-muted-foreground text-xs">Governance: {levelPolicy}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="text-sm font-medium mb-3">Select any of the following items you have completed:</p>
        <div className="space-y-3">
          {allPrlArtifacts.map(artifact => {
            const isChecked = sel.checkedArtifacts?.includes(artifact.id) || false;
            const hasSubtext = artifact.name === "Policy Waiver / Exception (ETP)";
            return (
              <label
                key={artifact.id}
                className="flex items-start gap-3 cursor-pointer"
                data-testid={`checkbox-prl-${artifact.id}`}
                onClick={() => togglePrlArtifact(artifact.id)}
              >
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  isChecked ? "bg-primary border-primary" : "border-muted-foreground/40"
                }`}>
                  {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div>
                  <span className="text-sm">{artifact.name}</span>
                  {artifact.policyLinks?.[0] ? (
                    <a href={artifact.policyLinks[0]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex ml-1 text-primary/60 hover:text-primary" title={artifact.policies?.[0] || "View Policy"}>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <Info className="h-3 w-3 inline text-muted-foreground/50 ml-1" />
                  )}
                  {hasSubtext && (
                    <p className="text-xs text-muted-foreground">Please describe and/or upload below</p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <DocumentUploadSection
        verticalKey="PRL"
        artifacts={allPrlArtifacts.map(a => a.name)}
        selections={selections}
        updateVerticalSelection={updateVerticalSelection}
      />

      <Separator />

      <div>
        <p className="text-sm font-semibold mb-2">Additional Supporting Evidence</p>
        <p className="text-xs text-muted-foreground mb-2">Describe any additional evidence supporting your self-assessment</p>
        <Textarea
          value={sel.additionalEvidence || ""}
          onChange={e => updateVerticalSelection("PRL", { additionalEvidence: e.target.value })}
          className="min-h-[100px]"
          data-testid="textarea-evidence-PRL"
        />
      </div>
    </div>
  );
}

function CyberSecurityStep({ selections, updateVerticalSelection, artifactsByVertical }: {
  selections: Record<string, VerticalSelection>;
  updateVerticalSelection: (key: string, updates: Partial<VerticalSelection> | ((prev: VerticalSelection) => Partial<VerticalSelection>)) => void;
  artifactsByVertical: Record<string, Record<number, Artifact[]>>;
}) {
  const sel = selections["CRL"] || { level: 0, checkedArtifacts: [], compliance: "", complianceRemarks: "", additionalEvidence: "" };
  const selectedLevel = sel.level || 0;
  const verticalArtifacts = artifactsByVertical["CRL"] || {};

  const allCrlArtifacts: Artifact[] = [];
  for (let l = 1; l <= 9; l++) {
    if (verticalArtifacts[l]) allCrlArtifacts.push(...verticalArtifacts[l]);
  }

  const toggleCrlArtifact = (artifactId: string) => {
    const current = sel.checkedArtifacts || [];
    const next = current.includes(artifactId)
      ? current.filter(a => a !== artifactId)
      : [...current, artifactId];
    updateVerticalSelection("CRL", { checkedArtifacts: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" data-testid="text-cyber-security-title">Cyber Security</h2>
        <p className="text-xs text-muted-foreground">Regulatory Anchor: DoDD 1100.4</p>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">
          Authority & Guidance <Info className="h-3 w-3 inline text-muted-foreground" />
        </p>
        <Select
          value={selectedLevel > 0 ? String(selectedLevel) : ""}
          onValueChange={val => updateVerticalSelection("CRL", { level: parseInt(val) })}
        >
          <SelectTrigger className="w-full h-auto py-2" data-testid="select-level-CRL">
            <SelectValue placeholder="Select CRL Level" />
          </SelectTrigger>
          <SelectContent>
            {[1,2,3,4,5,6,7,8,9].map(l => {
              const levelArtifact = verticalArtifacts[l]?.[0];
              const levelPolicy = levelArtifact?.policies?.[0] || CRL_LEVEL_GOVERNANCE[l] || "";
              return (
                <SelectItem key={l} value={String(l)} className="py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Level {l} - {CRL_LEVEL_DESCRIPTIONS[l]}</span>
                    <span className="text-muted-foreground text-xs">Governance: {levelPolicy}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="text-sm font-medium mb-3">Select any of the following items you have completed:</p>
        <div className="space-y-3">
          {allCrlArtifacts.map(artifact => {
            const isChecked = sel.checkedArtifacts?.includes(artifact.id) || false;
            return (
              <label
                key={artifact.id}
                className="flex items-start gap-3 cursor-pointer"
                data-testid={`checkbox-crl-${artifact.id}`}
                onClick={() => toggleCrlArtifact(artifact.id)}
              >
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  isChecked ? "bg-primary border-primary" : "border-muted-foreground/40"
                }`}>
                  {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div>
                  <span className="text-sm">{artifact.name}</span>
                  {artifact.policyLinks?.[0] ? (
                    <a href={artifact.policyLinks[0]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex ml-1 text-primary/60 hover:text-primary" title={artifact.policies?.[0] || "View Policy"}>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <Info className="h-3 w-3 inline text-muted-foreground/50 ml-1" />
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <DocumentUploadSection
        verticalKey="CRL"
        artifacts={allCrlArtifacts.map(a => a.name)}
        selections={selections}
        updateVerticalSelection={updateVerticalSelection}
      />

      <Separator />

      <div>
        <p className="text-sm font-semibold mb-2">Additional Supporting Evidence</p>
        <p className="text-xs text-muted-foreground mb-2">Describe any additional evidence supporting your self-assessment</p>
        <Textarea
          value={sel.additionalEvidence || ""}
          onChange={e => updateVerticalSelection("CRL", { additionalEvidence: e.target.value })}
          className="min-h-[100px]"
          data-testid="textarea-evidence-CRL"
        />
      </div>
    </div>
  );
}

function IntegrationStep({ selections, updateVerticalSelection, artifactsByVertical }: {
  selections: Record<string, VerticalSelection>;
  updateVerticalSelection: (key: string, updates: Partial<VerticalSelection> | ((prev: VerticalSelection) => Partial<VerticalSelection>)) => void;
  artifactsByVertical: Record<string, Record<number, Artifact[]>>;
}) {
  const sel = selections["IRL"] || { level: 0, checkedArtifacts: [], compliance: "", complianceRemarks: "", additionalEvidence: "" };
  const selectedLevel = sel.level || 0;
  const verticalArtifacts = artifactsByVertical["IRL"] || {};

  const allIrlArtifacts: Artifact[] = [];
  for (let l = 1; l <= 9; l++) {
    if (verticalArtifacts[l]) allIrlArtifacts.push(...verticalArtifacts[l]);
  }

  const toggleIrlArtifact = (artifactId: string) => {
    const current = sel.checkedArtifacts || [];
    const next = current.includes(artifactId)
      ? current.filter(a => a !== artifactId)
      : [...current, artifactId];
    updateVerticalSelection("IRL", { checkedArtifacts: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" data-testid="text-integration-title">Integration</h2>
        <p className="text-xs text-muted-foreground">Regulatory Anchor: DoDD 1100.4</p>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">
          Authority & Guidance <Info className="h-3 w-3 inline text-muted-foreground" />
        </p>
        <Select
          value={selectedLevel > 0 ? String(selectedLevel) : ""}
          onValueChange={val => updateVerticalSelection("IRL", { level: parseInt(val) })}
        >
          <SelectTrigger className="w-full h-auto py-2" data-testid="select-level-IRL">
            <SelectValue placeholder="Select IRL Level" />
          </SelectTrigger>
          <SelectContent>
            {[1,2,3,4,5,6,7,8,9].map(l => {
              const levelArtifact = verticalArtifacts[l]?.[0];
              const levelPolicy = levelArtifact?.policies?.[0] || IRL_LEVEL_GOVERNANCE[l] || "";
              return (
                <SelectItem key={l} value={String(l)} className="py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Level {l} - {IRL_LEVEL_DESCRIPTIONS[l]}</span>
                    <span className="text-muted-foreground text-xs">Governance: {levelPolicy}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="text-sm font-medium mb-3">Select any of the following items you have completed:</p>
        <div className="space-y-3">
          {allIrlArtifacts.map(artifact => {
            const isChecked = sel.checkedArtifacts?.includes(artifact.id) || false;
            return (
              <label
                key={artifact.id}
                className="flex items-start gap-3 cursor-pointer"
                data-testid={`checkbox-irl-${artifact.id}`}
                onClick={() => toggleIrlArtifact(artifact.id)}
              >
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  isChecked ? "bg-primary border-primary" : "border-muted-foreground/40"
                }`}>
                  {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div>
                  <span className="text-sm">{artifact.name}</span>
                  {artifact.policyLinks?.[0] ? (
                    <a href={artifact.policyLinks[0]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex ml-1 text-primary/60 hover:text-primary" title={artifact.policies?.[0] || "View Policy"}>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <Info className="h-3 w-3 inline text-muted-foreground/50 ml-1" />
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <DocumentUploadSection
        verticalKey="IRL"
        artifacts={allIrlArtifacts.map(a => a.name)}
        selections={selections}
        updateVerticalSelection={updateVerticalSelection}
      />

      <Separator />

      <div>
        <p className="text-sm font-semibold mb-2">Additional Supporting Evidence</p>
        <p className="text-xs text-muted-foreground mb-2">Describe any additional evidence supporting your self-assessment</p>
        <Textarea
          value={sel.additionalEvidence || ""}
          onChange={e => updateVerticalSelection("IRL", { additionalEvidence: e.target.value })}
          className="min-h-[100px]"
          data-testid="textarea-evidence-IRL"
        />
      </div>
    </div>
  );
}

function HumanEngineeringStep({ selections, updateVerticalSelection, artifactsByVertical }: {
  selections: Record<string, VerticalSelection>;
  updateVerticalSelection: (key: string, updates: Partial<VerticalSelection> | ((prev: VerticalSelection) => Partial<VerticalSelection>)) => void;
  artifactsByVertical: Record<string, Record<number, Artifact[]>>;
}) {
  const sel = selections["HRL"] || { level: 0, checkedArtifacts: [], compliance: "", complianceRemarks: "", additionalEvidence: "" };
  const selectedLevel = sel.level || 0;
  const verticalArtifacts = artifactsByVertical["HRL"] || {};

  const allHrlArtifacts: Artifact[] = [];
  for (let l = 1; l <= 9; l++) {
    if (verticalArtifacts[l]) allHrlArtifacts.push(...verticalArtifacts[l]);
  }

  const toggleArt = (artifactId: string) => {
    const current = sel.checkedArtifacts || [];
    const next = current.includes(artifactId) ? current.filter(a => a !== artifactId) : [...current, artifactId];
    updateVerticalSelection("HRL", { checkedArtifacts: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" data-testid="text-human-engineering-title">Human Engineering</h2>
        <p className="text-xs text-muted-foreground">Regulatory Anchor: DoDD 1100.4</p>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">
          Authority & Guidance <Info className="h-3 w-3 inline text-muted-foreground" />
        </p>
        <Select
          value={selectedLevel > 0 ? String(selectedLevel) : ""}
          onValueChange={val => updateVerticalSelection("HRL", { level: parseInt(val) })}
        >
          <SelectTrigger className="w-full h-auto py-2" data-testid="select-level-HRL">
            <SelectValue placeholder="Select HRL Level" />
          </SelectTrigger>
          <SelectContent>
            {[1,2,3,4,5,6,7,8,9].map(l => {
              const levelArtifact = verticalArtifacts[l]?.[0];
              const levelPolicy = levelArtifact?.policies?.[0] || HRL_LEVEL_GOVERNANCE[l] || "";
              return (
                <SelectItem key={l} value={String(l)} className="py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Level {l} - {HRL_LEVEL_DESCRIPTIONS[l]}</span>
                    <span className="text-muted-foreground text-xs">Governance: {levelPolicy}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="text-sm font-medium mb-3">Select any of the following items you have completed:</p>
        <div className="space-y-3">
          {allHrlArtifacts.map(artifact => {
            const isChecked = sel.checkedArtifacts?.includes(artifact.id) || false;
            return (
              <label
                key={artifact.id}
                className="flex items-start gap-3 cursor-pointer"
                data-testid={`checkbox-hrl-${artifact.id}`}
                onClick={() => toggleArt(artifact.id)}
              >
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  isChecked ? "bg-primary border-primary" : "border-muted-foreground/40"
                }`}>
                  {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div>
                  <span className="text-sm">{artifact.name}</span>
                  {artifact.policyLinks?.[0] ? (
                    <a href={artifact.policyLinks[0]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex ml-1 text-primary/60 hover:text-primary" title={artifact.policies?.[0] || "View Policy"}>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <Info className="h-3 w-3 inline text-muted-foreground/50 ml-1" />
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <DocumentUploadSection
        verticalKey="HRL"
        artifacts={allHrlArtifacts.map(a => a.name)}
        selections={selections}
        updateVerticalSelection={updateVerticalSelection}
      />

      <Separator />

      <div>
        <p className="text-sm font-semibold mb-2">Additional Supporting Evidence</p>
        <p className="text-xs text-muted-foreground mb-2">Describe any additional evidence supporting your self-assessment</p>
        <Textarea
          value={sel.additionalEvidence || ""}
          onChange={e => updateVerticalSelection("HRL", { additionalEvidence: e.target.value })}
          className="min-h-[100px]"
          data-testid="textarea-evidence-HRL"
        />
      </div>
    </div>
  );
}

function AIStep({ selections, updateVerticalSelection, artifactsByVertical }: {
  selections: Record<string, VerticalSelection>;
  updateVerticalSelection: (key: string, updates: Partial<VerticalSelection> | ((prev: VerticalSelection) => Partial<VerticalSelection>)) => void;
  artifactsByVertical: Record<string, Record<number, Artifact[]>>;
}) {
  const sel = selections["AIRL"] || { level: 0, checkedArtifacts: [], compliance: "", complianceRemarks: "", additionalEvidence: "" };
  const selectedLevel = sel.level || 0;
  const verticalArtifacts = artifactsByVertical["AIRL"] || {};

  const allAirlArtifacts: Artifact[] = [];
  for (let l = 1; l <= 9; l++) {
    if (verticalArtifacts[l]) allAirlArtifacts.push(...verticalArtifacts[l]);
  }

  const toggleArt = (artifactId: string) => {
    const current = sel.checkedArtifacts || [];
    const next = current.includes(artifactId) ? current.filter(a => a !== artifactId) : [...current, artifactId];
    updateVerticalSelection("AIRL", { checkedArtifacts: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" data-testid="text-ai-title">AI</h2>
        <p className="text-xs text-muted-foreground">Regulatory Anchor: DoDD 1100.4</p>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">
          Authority & Guidance <Info className="h-3 w-3 inline text-muted-foreground" />
        </p>
        <Select
          value={selectedLevel > 0 ? String(selectedLevel) : ""}
          onValueChange={val => updateVerticalSelection("AIRL", { level: parseInt(val) })}
        >
          <SelectTrigger className="w-full h-auto py-2" data-testid="select-level-AIRL">
            <SelectValue placeholder="Select AI Readiness Level" />
          </SelectTrigger>
          <SelectContent>
            {[1,2,3,4,5,6,7,8,9].map(l => {
              const levelArtifact = verticalArtifacts[l]?.[0];
              const levelPolicy = levelArtifact?.policies?.[0] || AIRL_LEVEL_GOVERNANCE[l] || "";
              return (
                <SelectItem key={l} value={String(l)} className="py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Level {l} - {AIRL_LEVEL_DESCRIPTIONS[l]}</span>
                    <span className="text-muted-foreground text-xs">Governance: {levelPolicy}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="text-sm font-medium mb-3">Select any of the following items you have completed:</p>
        <div className="space-y-3">
          {allAirlArtifacts.map(artifact => {
            const isChecked = sel.checkedArtifacts?.includes(artifact.id) || false;
            return (
              <label
                key={artifact.id}
                className="flex items-start gap-3 cursor-pointer"
                data-testid={`checkbox-airl-${artifact.id}`}
                onClick={() => toggleArt(artifact.id)}
              >
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  isChecked ? "bg-primary border-primary" : "border-muted-foreground/40"
                }`}>
                  {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div>
                  <span className="text-sm">{artifact.name}</span>
                  {artifact.policyLinks?.[0] ? (
                    <a href={artifact.policyLinks[0]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex ml-1 text-primary/60 hover:text-primary" title={artifact.policies?.[0] || "View Policy"}>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <Info className="h-3 w-3 inline text-muted-foreground/50 ml-1" />
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <DocumentUploadSection
        verticalKey="AIRL"
        artifacts={allAirlArtifacts.map(a => a.name)}
        selections={selections}
        updateVerticalSelection={updateVerticalSelection}
      />

      <Separator />

      <div>
        <p className="text-sm font-semibold mb-2">Additional Supporting Evidence</p>
        <p className="text-xs text-muted-foreground mb-2">Describe any additional evidence supporting your self-assessment</p>
        <Textarea
          value={sel.additionalEvidence || ""}
          onChange={e => updateVerticalSelection("AIRL", { additionalEvidence: e.target.value })}
          className="min-h-[100px]"
          data-testid="textarea-evidence-AIRL"
        />
      </div>
    </div>
  );
}

function ManufacturingStep({ selections, updateVerticalSelection, artifactsByVertical }: {
  selections: Record<string, VerticalSelection>;
  updateVerticalSelection: (key: string, updates: Partial<VerticalSelection> | ((prev: VerticalSelection) => Partial<VerticalSelection>)) => void;
  artifactsByVertical: Record<string, Record<number, Artifact[]>>;
}) {
  const sel = selections["MRL"] || { level: 0, checkedArtifacts: [], compliance: "", complianceRemarks: "", additionalEvidence: "" };
  const selectedLevel = sel.level || 0;
  const verticalArtifacts = artifactsByVertical["MRL"] || {};

  const allMrlArtifacts: Artifact[] = [];
  for (let l = 1; l <= 9; l++) {
    if (verticalArtifacts[l]) allMrlArtifacts.push(...verticalArtifacts[l]);
  }

  const toggleArt = (artifactId: string) => {
    const current = sel.checkedArtifacts || [];
    const next = current.includes(artifactId) ? current.filter(a => a !== artifactId) : [...current, artifactId];
    updateVerticalSelection("MRL", { checkedArtifacts: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" data-testid="text-manufacturing-title">Manufacturing</h2>
        <p className="text-xs text-muted-foreground">Regulatory Anchor: DoDD 1100.4</p>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">
          Authority & Guidance <Info className="h-3 w-3 inline text-muted-foreground" />
        </p>
        <Select
          value={selectedLevel > 0 ? String(selectedLevel) : ""}
          onValueChange={val => updateVerticalSelection("MRL", { level: parseInt(val) })}
        >
          <SelectTrigger className="w-full h-auto py-2" data-testid="select-level-MRL">
            <SelectValue placeholder="Select MRL Level" />
          </SelectTrigger>
          <SelectContent>
            {[1,2,3,4,5,6,7,8,9].map(l => {
              const levelArtifact = verticalArtifacts[l]?.[0];
              const levelPolicy = levelArtifact?.policies?.[0] || MRL_LEVEL_GOVERNANCE[l] || "";
              return (
                <SelectItem key={l} value={String(l)} className="py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Level {l} - {MRL_LEVEL_DESCRIPTIONS[l]}</span>
                    <span className="text-muted-foreground text-xs">Governance: {levelPolicy}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="text-sm font-medium mb-3">Select any of the following items you have completed:</p>
        <div className="space-y-3">
          {allMrlArtifacts.map(artifact => {
            const isChecked = sel.checkedArtifacts?.includes(artifact.id) || false;
            return (
              <label
                key={artifact.id}
                className="flex items-start gap-3 cursor-pointer"
                data-testid={`checkbox-mrl-${artifact.id}`}
                onClick={() => toggleArt(artifact.id)}
              >
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  isChecked ? "bg-primary border-primary" : "border-muted-foreground/40"
                }`}>
                  {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div>
                  <span className="text-sm">{artifact.name}</span>
                  {artifact.policyLinks?.[0] ? (
                    <a href={artifact.policyLinks[0]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex ml-1 text-primary/60 hover:text-primary" title={artifact.policies?.[0] || "View Policy"}>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <Info className="h-3 w-3 inline text-muted-foreground/50 ml-1" />
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <DocumentUploadSection
        verticalKey="MRL"
        artifacts={allMrlArtifacts.map(a => a.name)}
        selections={selections}
        updateVerticalSelection={updateVerticalSelection}
      />

      <Separator />

      <div>
        <p className="text-sm font-semibold mb-2">Additional Supporting Evidence</p>
        <p className="text-xs text-muted-foreground mb-2">Describe any additional evidence supporting your self-assessment</p>
        <Textarea
          value={sel.additionalEvidence || ""}
          onChange={e => updateVerticalSelection("MRL", { additionalEvidence: e.target.value })}
          className="min-h-[100px]"
          data-testid="textarea-evidence-MRL"
        />
      </div>
    </div>
  );
}

function TestingVerificationStep({ selections, updateVerticalSelection, artifactsByVertical }: {
  selections: Record<string, VerticalSelection>;
  updateVerticalSelection: (key: string, updates: Partial<VerticalSelection> | ((prev: VerticalSelection) => Partial<VerticalSelection>)) => void;
  artifactsByVertical: Record<string, Record<number, Artifact[]>>;
}) {
  const sel = selections["TVRL"] || { level: 0, checkedArtifacts: [], compliance: "", complianceRemarks: "", additionalEvidence: "" };
  const selectedLevel = sel.level || 0;
  const verticalArtifacts = artifactsByVertical["TVRL"] || {};

  const allTvrlArtifacts: Artifact[] = [];
  for (let l = 1; l <= 9; l++) {
    if (verticalArtifacts[l]) allTvrlArtifacts.push(...verticalArtifacts[l]);
  }

  const toggleArtifact = (artifactId: string) => {
    const current = sel.checkedArtifacts || [];
    const next = current.includes(artifactId)
      ? current.filter(a => a !== artifactId)
      : [...current, artifactId];
    updateVerticalSelection("TVRL", { checkedArtifacts: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" data-testid="text-testing-verification-title">Testing & Verification</h2>
        <p className="text-xs text-muted-foreground">Regulatory Anchor: DoDD 1100.4</p>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">
          Authority & Guidance <Info className="h-3 w-3 inline text-muted-foreground" />
        </p>
        <Select
          value={selectedLevel > 0 ? String(selectedLevel) : ""}
          onValueChange={val => updateVerticalSelection("TVRL", { level: parseInt(val) })}
        >
          <SelectTrigger className="w-full h-auto py-2" data-testid="select-level-TVRL">
            <SelectValue placeholder="Select TVRL Level" />
          </SelectTrigger>
          <SelectContent>
            {[1,2,3,4,5,6,7,8,9].map(l => {
              const levelArtifact = verticalArtifacts[l]?.[0];
              const levelPolicy = levelArtifact?.policies?.[0] || TVRL_LEVEL_GOVERNANCE[l] || "";
              return (
                <SelectItem key={l} value={String(l)} className="py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Level {l} - {TVRL_LEVEL_DESCRIPTIONS[l]}</span>
                    <span className="text-muted-foreground text-xs">Governance: {levelPolicy}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="text-sm font-medium mb-3">Select any of the following items you have completed:</p>
        <div className="space-y-3">
          {allTvrlArtifacts.map(artifact => {
            const isChecked = sel.checkedArtifacts?.includes(artifact.id) || false;
            return (
              <label
                key={artifact.id}
                className="flex items-start gap-3 cursor-pointer"
                data-testid={`checkbox-tvrl-${artifact.id}`}
                onClick={() => toggleArtifact(artifact.id)}
              >
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  isChecked ? "bg-primary border-primary" : "border-muted-foreground/40"
                }`}>
                  {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div>
                  <span className="text-sm">{artifact.name}</span>
                  {artifact.policyLinks?.[0] ? (
                    <a href={artifact.policyLinks[0]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex ml-1 text-primary/60 hover:text-primary" title={artifact.policies?.[0] || "View Policy"}>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <Info className="h-3 w-3 inline text-muted-foreground/50 ml-1" />
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <DocumentUploadSection
        verticalKey="TVRL"
        artifacts={allTvrlArtifacts.map(a => a.name)}
        selections={selections}
        updateVerticalSelection={updateVerticalSelection}
      />

      <Separator />

      <div>
        <p className="text-sm font-semibold mb-2">Additional Supporting Evidence</p>
        <p className="text-xs text-muted-foreground mb-2">Describe any additional evidence supporting your self-assessment</p>
        <Textarea
          value={sel.additionalEvidence || ""}
          onChange={e => updateVerticalSelection("TVRL", { additionalEvidence: e.target.value })}
          className="min-h-[100px]"
          data-testid="textarea-evidence-TVRL"
        />
      </div>
    </div>
  );
}

function SupplyChainStep({ selections, updateVerticalSelection, artifactsByVertical }: {
  selections: Record<string, VerticalSelection>;
  updateVerticalSelection: (key: string, updates: Partial<VerticalSelection> | ((prev: VerticalSelection) => Partial<VerticalSelection>)) => void;
  artifactsByVertical: Record<string, Record<number, Artifact[]>>;
}) {
  const sel = selections["SCRL"] || { level: 0, checkedArtifacts: [], compliance: "", complianceRemarks: "", additionalEvidence: "" };
  const selectedLevel = sel.level || 0;
  const verticalArtifacts = artifactsByVertical["SCRL"] || {};

  const allScrlArtifacts: Artifact[] = [];
  for (let l = 1; l <= 9; l++) {
    if (verticalArtifacts[l]) allScrlArtifacts.push(...verticalArtifacts[l]);
  }

  const toggleScrlArtifact = (artifactId: string) => {
    const current = sel.checkedArtifacts || [];
    const next = current.includes(artifactId)
      ? current.filter(a => a !== artifactId)
      : [...current, artifactId];
    updateVerticalSelection("SCRL", { checkedArtifacts: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" data-testid="text-supply-chain-title">Supply Chain</h2>
        <p className="text-xs text-muted-foreground">Regulatory Anchor: DoDD 1100.4</p>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">
          Authority & Guidance <Info className="h-3 w-3 inline text-muted-foreground" />
        </p>
        <Select
          value={selectedLevel > 0 ? String(selectedLevel) : ""}
          onValueChange={val => updateVerticalSelection("SCRL", { level: parseInt(val) })}
        >
          <SelectTrigger className="w-full h-auto py-2" data-testid="select-level-SCRL">
            <SelectValue placeholder="Select SCRL Level" />
          </SelectTrigger>
          <SelectContent>
            {[1,2,3,4,5,6,7,8,9].map(l => {
              const levelArtifact = verticalArtifacts[l]?.[0];
              const levelPolicy = levelArtifact?.policies?.[0] || SCRL_LEVEL_GOVERNANCE[l] || "";
              return (
                <SelectItem key={l} value={String(l)} className="py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Level {l} - {SCRL_LEVEL_DESCRIPTIONS[l]}</span>
                    <span className="text-muted-foreground text-xs">Governance: {levelPolicy}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="text-sm font-medium mb-3">Select any of the following items you have completed:</p>
        <div className="space-y-3">
          {allScrlArtifacts.map(artifact => {
            const isChecked = sel.checkedArtifacts?.includes(artifact.id) || false;
            return (
              <label
                key={artifact.id}
                className="flex items-start gap-3 cursor-pointer"
                data-testid={`checkbox-scrl-${artifact.id}`}
                onClick={() => toggleScrlArtifact(artifact.id)}
              >
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  isChecked ? "bg-primary border-primary" : "border-muted-foreground/40"
                }`}>
                  {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div>
                  <span className="text-sm">{artifact.name}</span>
                  {artifact.policyLinks?.[0] ? (
                    <a href={artifact.policyLinks[0]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex ml-1 text-primary/60 hover:text-primary" title={artifact.policies?.[0] || "View Policy"}>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <Info className="h-3 w-3 inline text-muted-foreground/50 ml-1" />
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <DocumentUploadSection
        verticalKey="SCRL"
        artifacts={allScrlArtifacts.map(a => a.name)}
        selections={selections}
        updateVerticalSelection={updateVerticalSelection}
      />

      <Separator />

      <div>
        <p className="text-sm font-semibold mb-2">Additional Supporting Evidence</p>
        <p className="text-xs text-muted-foreground mb-2">Describe any additional evidence supporting your self-assessment</p>
        <Textarea
          value={sel.additionalEvidence || ""}
          onChange={e => updateVerticalSelection("SCRL", { additionalEvidence: e.target.value })}
          className="min-h-[100px]"
          data-testid="textarea-evidence-SCRL"
        />
      </div>
    </div>
  );
}

function VerticalMappingStep({ title, verticals, artifactsByVertical, selections, updateVerticalSelection, toggleArtifact }: {
  title: string;
  verticals: Array<{ key: string; name: string; description: string; maxLevel: number }>;
  artifactsByVertical: Record<string, Record<number, Artifact[]>>;
  selections: Record<string, VerticalSelection>;
  updateVerticalSelection: (key: string, updates: Partial<VerticalSelection> | ((prev: VerticalSelection) => Partial<VerticalSelection>)) => void;
  toggleArtifact: (key: string, artifactId: string) => void;
}) {
  const [expandedVertical, setExpandedVertical] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold" data-testid={`text-step-title-${title.replace(/\s/g, "-").toLowerCase()}`}>{title}</h2>

      {verticals.map(vertical => {
        const isExpanded = expandedVertical === vertical.key;
        const sel = selections[vertical.key];
        const selectedLevel = sel?.level || 0;
        const verticalArtifacts = artifactsByVertical[vertical.key] || {};

        const levelsForDropdown: number[] = [];
        for (let l = 1; l <= vertical.maxLevel; l++) {
          levelsForDropdown.push(l);
        }

        const artifactsAtLevel = selectedLevel > 0 ? (verticalArtifacts[selectedLevel] || []) : [];

        return (
          <Card key={vertical.key} className="border-border/40" data-testid={`card-vertical-${vertical.key}`}>
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={() => setExpandedVertical(isExpanded ? null : vertical.key)}
              data-testid={`toggle-vertical-${vertical.key}`}
            >
              <div>
                <p className="text-sm font-semibold">{vertical.name}</p>
                <p className="text-xs text-muted-foreground">{vertical.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {selectedLevel > 0 && (
                  <span className="text-xs text-primary font-medium">L{selectedLevel}</span>
                )}
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </div>
            </div>

            {isExpanded && (
              <CardContent className="pt-0 pb-4 space-y-5">
                <Separator />

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Regulatory Anchor</p>
                  <p className="text-sm">{vertical.description}</p>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-2">Authority & Guidance <Info className="h-3 w-3 inline text-muted-foreground" /></p>
                  <p className="text-xs text-muted-foreground mb-2">{vertical.key} Specification</p>
                  <Select
                    value={selectedLevel > 0 ? String(selectedLevel) : ""}
                    onValueChange={val => updateVerticalSelection(vertical.key, { level: parseInt(val), checkedArtifacts: [] })}
                  >
                    <SelectTrigger className="w-full" data-testid={`select-level-${vertical.key}`}>
                      <SelectValue placeholder={`Select ${vertical.key} Level`} />
                    </SelectTrigger>
                    <SelectContent>
                      {levelsForDropdown.map(l => {
                        const levelArtifacts = verticalArtifacts[l] || [];
                        const governance = levelArtifacts.length > 0 ? levelArtifacts[0].regulation || "" : "";
                        return (
                          <SelectItem key={l} value={String(l)}>
                            Level {l} - {LEVEL_LABELS[l]}
                            {governance && <span className="text-muted-foreground ml-2">({governance})</span>}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {selectedLevel > 0 && artifactsAtLevel.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Select any of the following items you have completed:</p>
                    <div className="space-y-2">
                      {artifactsAtLevel.map(artifact => {
                        const isChecked = sel?.checkedArtifacts?.includes(artifact.id) || false;
                        return (
                          <label
                            key={artifact.id}
                            className="flex items-center gap-3 cursor-pointer py-1"
                            data-testid={`checkbox-artifact-${artifact.id}`}
                          >
                            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              isChecked ? "bg-primary border-primary" : "border-muted-foreground/40"
                            }`} onClick={() => toggleArtifact(vertical.key, artifact.id)}>
                              {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <span className="text-sm">{artifact.name}</span>
                            {artifact.policyLinks?.[0] ? (
                              <a href={artifact.policyLinks[0]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary/60 hover:text-primary shrink-0" title={artifact.policies?.[0] || "View Policy"}>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : artifact.verificationMethod !== "manual_upload" ? (
                              <Info className="h-3 w-3 text-muted-foreground" />
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedLevel > 0 && artifactsAtLevel.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No artifacts configured for Level {selectedLevel} in {vertical.key}. Please ask admin to configure artifacts.</p>
                )}

                {selectedLevel > 0 && (
                  <>
                    <DocumentUploadSection
                      verticalKey={vertical.key}
                      artifacts={artifactsAtLevel.map(a => a.name)}
                      selections={selections}
                      updateVerticalSelection={updateVerticalSelection}
                    />

                    <Separator />

                    <div>
                      <p className="text-sm font-semibold mb-2">Self-Declaration</p>
                      <p className="text-xs text-muted-foreground mb-2">Declare your compliance status for this level</p>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer" data-testid={`radio-compliant-${vertical.key}`}>
                          <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                            sel?.compliance === "compliant" ? "border-primary" : "border-muted-foreground/40"
                          }`} onClick={() => updateVerticalSelection(vertical.key, { compliance: "compliant" })}>
                            {sel?.compliance === "compliant" && <div className="h-2 w-2 rounded-full bg-primary" />}
                          </div>
                          <span className="text-sm">Compliant</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer" data-testid={`radio-not-compliant-${vertical.key}`}>
                          <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                            sel?.compliance === "not_compliant" ? "border-primary" : "border-muted-foreground/40"
                          }`} onClick={() => updateVerticalSelection(vertical.key, { compliance: "not_compliant" })}>
                            {sel?.compliance === "not_compliant" && <div className="h-2 w-2 rounded-full bg-primary" />}
                          </div>
                          <span className="text-sm">Not Compliant</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Enter any additional remarks or justification for your compliance status</p>
                      <Textarea
                        value={sel?.complianceRemarks || ""}
                        onChange={e => updateVerticalSelection(vertical.key, { complianceRemarks: e.target.value })}
                        className="min-h-[80px]"
                        data-testid={`textarea-remarks-${vertical.key}`}
                      />
                    </div>

                    <Separator />

                    <div>
                      <p className="text-sm font-semibold mb-2">Additional Supporting Evidence</p>
                      <p className="text-xs text-muted-foreground mb-2">Describe any additional evidence supporting your self-assessment</p>
                      <Textarea
                        value={sel?.additionalEvidence || ""}
                        onChange={e => updateVerticalSelection(vertical.key, { additionalEvidence: e.target.value })}
                        className="min-h-[80px]"
                        data-testid={`textarea-evidence-${vertical.key}`}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function WizardFeedbackPanel({ sectionKey, sectionLabel, capId, feedbackItems }: {
  sectionKey: string;
  sectionLabel: string;
  capId: string;
  feedbackItems: AssessmentFeedback[];
}) {
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(true);
  const { toast } = useToast();
  const dispatch = useAppDispatch();
  const [sendFeedbackApi] = useSendFeedbackMutation();

  const feedbackMutation = { mutate: async () => {
    try {
      await sendFeedbackApi({ capabilityId: capId, data: { section: sectionKey, message } }).unwrap();
      setMessage("");
      toast({ title: "Response submitted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.data || err.message, variant: "destructive" });
    }
  }, isPending: false };

  const hasAdminFeedback = feedbackItems.some(fb => fb.role === "admin");
  if (!hasAdminFeedback && feedbackItems.length === 0) return null;

  return (
    <div className="mt-6">
      <Card className="border-orange-500/30 bg-orange-500/5" data-testid={`card-wizard-feedback-${sectionKey}`}>
        <CardContent
          className="p-4 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {expanded ? <ChevronDown className="h-4 w-4 text-orange-400" /> : <ChevronDown className="h-4 w-4 text-orange-400 -rotate-90" />}
              <MessageSquare className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-semibold text-orange-400">Assessment Feedback — {sectionLabel}</span>
              <Badge variant="outline" className="text-[9px] border-orange-500/30 text-orange-400">{feedbackItems.length}</Badge>
            </div>
          </div>
        </CardContent>
        {expanded && (
          <CardContent className="px-4 pb-4 pt-0 space-y-3">
            {feedbackItems.map(fb => (
              <div
                key={fb.id}
                className={`rounded-md p-3 text-sm ${
                  fb.role === "admin"
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-blue-500/10 border border-blue-500/20"
                }`}
                data-testid={`wizard-feedback-${fb.id}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">
                    {fb.displayName || fb.username}
                    <Badge variant="outline" className="text-[9px] ml-2">{fb.role === "admin" ? "Admin" : "You"}</Badge>
                  </span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {fb.createdAt ? new Date(fb.createdAt).toLocaleString() : ""}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{fb.message}</p>
              </div>
            ))}

            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Your Response</p>
              <Textarea
                placeholder="Describe what you've done to address the feedback..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="min-h-[80px] text-sm"
                data-testid={`textarea-wizard-response-${sectionKey}`}
              />
              <Button
                size="sm"
                className="text-xs"
                onClick={() => feedbackMutation.mutate()}
                disabled={!message.trim() || feedbackMutation.isPending}
                data-testid={`button-wizard-submit-response-${sectionKey}`}
              >
                <Send className="h-3 w-3 mr-1" />
                {feedbackMutation.isPending ? "Sending..." : "Submit Response"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function ReviewStep({ formData, enabledVerticals, onSubmit, isSubmitting, canResubmit, onResubmit, isResubmitting }: {
  formData: WizardData;
  enabledVerticals: Array<{ key: string; name: string }>;
  onSubmit: () => void;
  isSubmitting: boolean;
  canResubmit?: boolean;
  onResubmit?: () => void;
  isResubmitting?: boolean;
}) {
  const [reviewConfirmed, setReviewConfirmed] = useState<"yes" | "no" | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" data-testid="text-review-title">Review & Complete</h2>
        <p className="text-xs text-muted-foreground">Review your responses before submitting</p>
      </div>

      <Separator />

      <div>
        <p className="text-sm font-semibold mb-2">Have you reviewed through your responses?</p>
        <p className="text-xs text-muted-foreground mb-4">Please review your responses before submitting</p>

        <div className="space-y-3">
          <label
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setReviewConfirmed("yes")}
            data-testid="radio-review-yes"
          >
            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              reviewConfirmed === "yes" ? "bg-primary border-primary" : "border-muted-foreground/40"
            }`}>
              {reviewConfirmed === "yes" && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
            </div>
            <span className="text-sm">Yes</span>
          </label>

          <label
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setReviewConfirmed("no")}
            data-testid="radio-review-no"
          >
            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              reviewConfirmed === "no" ? "bg-primary border-primary" : "border-muted-foreground/40"
            }`}>
              {reviewConfirmed === "no" && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
            </div>
            <span className="text-sm">No</span>
          </label>
        </div>
      </div>

      <div className="flex gap-3">
        {canResubmit ? (
          <Button
            className="mt-4"
            disabled={reviewConfirmed !== "yes" || isResubmitting}
            onClick={onResubmit}
            data-testid="button-resubmit-assessment"
          >
            <Send className="h-3 w-3 mr-1" />
            {isResubmitting ? "Re-submitting..." : "Re-Submit for Assessment"}
          </Button>
        ) : (
          <Button
            className="mt-4"
            disabled={reviewConfirmed !== "yes" || isSubmitting}
            onClick={onSubmit}
            data-testid="button-submit-capability"
          >
            {isSubmitting ? "Submitting..." : "Submit for Assessment"}
          </Button>
        )}
      </div>
    </div>
  );
}
