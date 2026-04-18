import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { useGetPartnersQuery, useCreatePartnerMutation, useLinkPartnerMutation, api, apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";
import soldierBg from "@assets/image_1773916984498.png";
import iweLogo from "@assets/image_1773917058075.png";

type OrgType = "liaison" | "business" | null;
type SamRegistered = "yes" | "no" | null;
type SearchBy = "ueid" | "cage" | "company";
type CompanyClassification = "small" | "other";

interface CompanyData {
  name: string;
  website: string;
  ueid: string;
  cage: string;
  ein: string;
  founderName: string;
  yearFounded: string;
  stateOfRegistration: string;
  registrationCode: string;
  state: string;
  address: string;
  city: string;
  zipCode: string;
  classification: CompanyClassification;
  programs: string[];
  linkedin: string;
  facebook: string;
  youtube: string;
  instagram: string;
}

const INDUSTRY_PROGRAMS = [
  "Manufacturing Innovation Institute (MII)",
  "Manufacturing Extension Partnership (MEP)",
  "SBIR/STTR",
  "Mentor Protege Program (MPP)",
  "RISE",
  "APEX Accelerator",
  "None",
  "Other",
];

function Step1({ orgType, setOrgType, onContinue, onBack }: {
  orgType: OrgType; setOrgType: (t: OrgType) => void; onContinue: () => void; onBack: () => void;
}) {
  return (
    <div style={{ width: '100%', maxWidth: 460, padding: '2rem 1.5rem' }}>
      <button type="button" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(55,30%,43%)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 24 }} data-testid="button-wizard-back">
        ← Back
      </button>

      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827', marginBottom: 24 }} data-testid="text-wizard-step1-title">Who are you representing?</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        <button
          type="button"
          onClick={() => setOrgType("liaison")}
          style={{
            padding: '24px 16px', borderRadius: 8, cursor: 'pointer',
            border: orgType === "liaison" ? '2px solid hsl(55,30%,43%)' : '1px solid #d1d5db',
            background: orgType === "liaison" ? '#fafaf5' : '#ffffff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}
          data-testid="button-org-liaison"
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18M4 21V10l8-6 8 6v11M9 21v-6h6v6" />
            <path d="M9 6h6M12 3v3" />
          </svg>
          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#111827', textAlign: 'center', lineHeight: 1.4 }}>
            I am representing a<br />Liaison Organization
          </span>
        </button>

        <button
          type="button"
          onClick={() => setOrgType("business")}
          style={{
            padding: '24px 16px', borderRadius: 8, cursor: 'pointer',
            border: orgType === "business" ? '2px solid hsl(55,30%,43%)' : '1px solid #d1d5db',
            background: orgType === "business" ? '#fafaf5' : '#ffffff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}
          data-testid="button-org-business"
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M9 4v16M15 4v16M4 9h16M4 15h16" />
          </svg>
          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#111827', textAlign: 'center', lineHeight: 1.4 }}>
            I am representing<br />a Business
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!orgType}
        style={{
          padding: '12px 36px', borderRadius: 6,
          background: orgType ? 'hsl(55,30%,43%)' : '#d1d5db',
          color: '#fff', fontWeight: 600, fontSize: '0.9rem', border: 'none',
          cursor: orgType ? 'pointer' : 'not-allowed',
        }}
        data-testid="button-step1-continue"
      >
        Continue
      </button>
    </div>
  );
}

function Step2({ samRegistered, setSamRegistered, onContinue, onBack }: {
  samRegistered: SamRegistered; setSamRegistered: (v: SamRegistered) => void; onContinue: () => void; onBack: () => void;
}) {
  return (
    <div style={{ width: '100%', maxWidth: 460, padding: '2rem 1.5rem' }}>
      <button type="button" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(55,30%,43%)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 24 }} data-testid="button-step2-back">
        ← Back
      </button>

      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827', marginBottom: 4 }} data-testid="text-wizard-step2-title">Company Registration Info</h2>
      <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 32 }}>Let's find your company or create it in our system.</p>

      <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827', marginBottom: 16 }}>Is your company registered with SAM.gov?</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem', color: '#374151' }}>
          <input type="radio" name="sam" checked={samRegistered === "yes"} onChange={() => setSamRegistered("yes")}
            style={{ width: 18, height: 18, accentColor: 'hsl(55,30%,43%)' }} data-testid="radio-sam-yes" />
          Yes
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem', color: '#374151' }}>
          <input type="radio" name="sam" checked={samRegistered === "no"} onChange={() => setSamRegistered("no")}
            style={{ width: 18, height: 18, accentColor: 'hsl(55,30%,43%)' }} data-testid="radio-sam-no" />
          No
        </label>
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!samRegistered}
        style={{
          padding: '12px 36px', borderRadius: 6,
          background: samRegistered ? 'hsl(55,30%,43%)' : '#d1d5db',
          color: '#fff', fontWeight: 600, fontSize: '0.9rem', border: 'none',
          cursor: samRegistered ? 'pointer' : 'not-allowed',
        }}
        data-testid="button-step2-continue"
      >
        Continue
      </button>
    </div>
  );
}

function Step3({ searchBy, setSearchBy, onContinue, onBack, onAddNew, onSelectPartner }: {
  searchBy: SearchBy; setSearchBy: (v: SearchBy) => void; onContinue: () => void; onBack: () => void; onAddNew: () => void;
  onSelectPartner: (partner: any) => void;
}) {
  const [searchValue, setSearchValue] = useState("");

  const { data: partners } = useGetPartnersQuery();

  const inputStyle = {
    height: 44, width: '100%', padding: '0 12px', fontSize: '0.85rem',
    background: '#ffffff', color: '#111827', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none',
  } as React.CSSProperties;

  return (
    <div style={{ width: '100%', maxWidth: 460, padding: '2rem 1.5rem' }}>
      <button type="button" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(55,30%,43%)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 24 }} data-testid="button-step3-back">
        ← Back
      </button>

      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827', marginBottom: 4 }} data-testid="text-wizard-step3-title">Find your company</h2>
      <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 24 }}>
        Search for your company below. If it's not found, please{" "}
        <button type="button" onClick={onAddNew} style={{ color: '#111827', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }} data-testid="link-add-new">
          Add it now
        </button>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem', color: '#374151' }}>
          <input type="radio" name="searchBy" checked={searchBy === "ueid"} onChange={() => setSearchBy("ueid")}
            style={{ width: 18, height: 18, accentColor: 'hsl(55,30%,43%)' }} data-testid="radio-search-ueid" />
          Unique Entity ID (UEID)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem', color: '#374151' }}>
          <input type="radio" name="searchBy" checked={searchBy === "cage"} onChange={() => setSearchBy("cage")}
            style={{ width: 18, height: 18, accentColor: 'hsl(55,30%,43%)' }} data-testid="radio-search-cage" />
          CAGE Code
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem', color: '#374151' }}>
          <input type="radio" name="searchBy" checked={searchBy === "company"} onChange={() => setSearchBy("company")}
            style={{ width: 18, height: 18, accentColor: 'hsl(55,30%,43%)' }} data-testid="radio-search-company" />
          Company Name
        </label>
      </div>

      {searchBy === "company" ? (
        <div style={{ marginBottom: 32 }}>
          <select
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            style={{ ...inputStyle, appearance: 'auto' }}
            data-testid="select-company"
          >
            <option value="">Choose from list</option>
            {partners?.map((p: any) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <div style={{ marginBottom: 32 }}>
          <input
            type="text"
            placeholder={searchBy === "ueid" ? "Enter UEID" : "Enter CAGE Code"}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            style={inputStyle}
            data-testid="input-search-value"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (searchValue && partners) {
            const found = partners.find((p: any) => {
              if (searchBy === "company") return p.name === searchValue;
              if (searchBy === "ueid") return p.uei?.toLowerCase() === searchValue.toLowerCase();
              if (searchBy === "cage") return p.cage?.toLowerCase() === searchValue.toLowerCase();
              return false;
            });
            if (found) {
              onSelectPartner(found);
              return;
            }
          }
          onContinue();
        }}
        style={{
          padding: '12px 36px', borderRadius: 6,
          background: 'hsl(55,30%,43%)',
          color: '#fff', fontWeight: 600, fontSize: '0.9rem', border: 'none', cursor: 'pointer',
        }}
        data-testid="button-step3-continue"
      >
        Continue
      </button>
    </div>
  );
}

function Step4({ companyData, setCompanyData, onSubmit, onBack, isPending, error, samRegistered }: {
  companyData: CompanyData; setCompanyData: (d: CompanyData) => void; onSubmit: () => void; onBack: () => void;
  isPending: boolean; error: string; samRegistered: boolean;
}) {
  const update = (field: keyof CompanyData, value: string) => setCompanyData({ ...companyData, [field]: value });
  const toggleProgram = (program: string) => {
    const programs = companyData.programs.includes(program)
      ? companyData.programs.filter(p => p !== program)
      : [...companyData.programs, program];
    setCompanyData({ ...companyData, programs });
  };

  const [samLoading, setSamLoading] = useState(false);
  const [samMessage, setSamMessage] = useState("");

  const handleRefreshSam = async () => {
    if (!companyData.ueid && !companyData.cage && !companyData.ein) {
      setSamMessage("Enter a UEID, CAGE Code, or EIN/TIN first");
      return;
    }
    setSamLoading(true);
    setSamMessage("");
    try {
      const res = await apiRequest("POST", "/api/sam-lookup", {
        uei: companyData.ueid || undefined,
        cage: companyData.cage || undefined,
        ein: companyData.ein || undefined,
      });
      const data = await res.json();
      if (data.found) {
        setCompanyData(prev => ({
          ...prev,
          name: data.name || prev.name,
          ueid: data.uei || prev.ueid,
          cage: data.cage || prev.cage,
          website: prev.website,
          address: data.address?.city ? `${data.address.city}, ${data.address.state}` : prev.address,
          city: data.address?.city || prev.city,
          state: data.address?.state || prev.state,
        }));
        setSamMessage("SAM.gov data loaded successfully");
      }
    } catch (err: any) {
      setSamMessage(err.message || "No matching entity found in SAM.gov");
    } finally {
      setSamLoading(false);
    }
  };

  const inputStyle = {
    height: 38, width: '100%', padding: '0 10px', fontSize: '0.8rem',
    background: '#ffffff', color: '#111827', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none',
  } as React.CSSProperties;

  const labelStyle = { fontSize: '0.75rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 2 } as React.CSSProperties;

  return (
    <div style={{ width: '100%', maxWidth: 520, padding: '1rem 1.5rem' }}>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#111827', marginBottom: 16 }} data-testid="text-wizard-step4-title">About your company</h2>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 16 }} data-testid="text-wizard-error">
          <AlertCircle style={{ width: 16, height: 16, color: '#dc2626', flexShrink: 0 }} />
          <p style={{ fontSize: '0.8rem', color: '#dc2626' }}>{error}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Company Name <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="text" value={companyData.name} onChange={(e) => update("name", e.target.value)} style={inputStyle} data-testid="input-company-name" />
          <p style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: 1, fontStyle: 'italic' }}>This data cannot be changed as it came from SAM.gov</p>
        </div>
        <div>
          <label style={labelStyle}>Company Website <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="text" value={companyData.website} onChange={(e) => update("website", e.target.value)} style={inputStyle} data-testid="input-company-website" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Unique Entity ID (UEID) <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="text" value={companyData.ueid} onChange={(e) => update("ueid", e.target.value)} style={inputStyle} data-testid="input-company-ueid" />
        </div>
        <div>
          <label style={labelStyle}>Cage Code <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="text" value={companyData.cage} onChange={(e) => update("cage", e.target.value)} style={inputStyle} data-testid="input-company-cage" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 6 }}>
        <div>
          <label style={labelStyle}>EIN/TIN <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="text" value={companyData.ein} onChange={(e) => update("ein", e.target.value)} style={inputStyle} data-testid="input-company-ein" />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            type="button"
            onClick={handleRefreshSam}
            disabled={samLoading}
            style={{ padding: '8px 16px', borderRadius: 6, background: 'hsl(55,30%,43%)', color: '#fff', fontWeight: 600, fontSize: '0.75rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, height: 38, opacity: samLoading ? 0.7 : 1 }}
            data-testid="button-refresh-sam"
          >
            {samLoading ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : "↻"}
            Refresh SAM.gov Data
          </button>
        </div>
      </div>
      {samMessage && (
        <p style={{ fontSize: '0.7rem', color: samMessage.includes('success') ? '#16a34a' : '#dc2626', marginBottom: 8 }} data-testid="text-sam-message">{samMessage}</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Founder Name <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="text" value={companyData.founderName} onChange={(e) => update("founderName", e.target.value)} style={inputStyle} data-testid="input-company-founder" />
        </div>
        <div>
          <label style={labelStyle}>Year Founded <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="text" value={companyData.yearFounded} onChange={(e) => update("yearFounded", e.target.value)} style={inputStyle} data-testid="input-company-year" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>State of Registration <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="text" value={companyData.stateOfRegistration} onChange={(e) => update("stateOfRegistration", e.target.value)} style={inputStyle} data-testid="input-company-reg-state" />
        </div>
        <div>
          <label style={labelStyle}>Registration Code <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="text" value={companyData.registrationCode} onChange={(e) => update("registrationCode", e.target.value)} style={inputStyle} data-testid="input-company-reg-code" />
        </div>
        <div>
          <label style={labelStyle}>State <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="text" value={companyData.state} onChange={(e) => update("state", e.target.value)} style={inputStyle} data-testid="input-company-state" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Company Address <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="text" value={companyData.address} onChange={(e) => update("address", e.target.value)} style={inputStyle} data-testid="input-company-address" />
        </div>
        <div>
          <label style={labelStyle}>City <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="text" value={companyData.city} onChange={(e) => update("city", e.target.value)} style={inputStyle} data-testid="input-company-city" />
        </div>
        <div>
          <label style={labelStyle}>Zip Code <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="text" value={companyData.zipCode} onChange={(e) => update("zipCode", e.target.value)} style={inputStyle} data-testid="input-company-zip" />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827', marginBottom: 8 }}>How is your Company Classified?</p>
        <div style={{ display: 'flex', gap: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem', color: '#374151' }}>
            <input type="radio" name="classification" checked={companyData.classification === "small"} onChange={() => update("classification", "small")}
              style={{ width: 16, height: 16, accentColor: 'hsl(55,30%,43%)' }} data-testid="radio-small-business" />
            Small Business
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem', color: '#374151' }}>
            <input type="radio" name="classification" checked={companyData.classification === "other"} onChange={() => update("classification", "other")}
              style={{ width: 16, height: 16, accentColor: 'hsl(55,30%,43%)' }} data-testid="radio-other-business" />
            Other than a small Business
          </label>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827', marginBottom: 4 }}>
          Are you currently participating in any industry programs, small business programs, or associations? Select all that apply
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
          {INDUSTRY_PROGRAMS.map((program) => (
            <label key={program} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.78rem', color: '#374151' }}>
              <div
                onClick={() => toggleProgram(program)}
                style={{
                  width: 18, height: 18, borderRadius: 3, border: '1.5px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                  background: companyData.programs.includes(program) ? 'hsl(55,30%,43%)' : '#fff',
                  borderColor: companyData.programs.includes(program) ? 'hsl(55,30%,43%)' : '#d1d5db',
                }}
                data-testid={`checkbox-program-${program.replace(/[^a-zA-Z]/g, '-').toLowerCase()}`}
              >
                {companyData.programs.includes(program) && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </div>
              {program}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827', marginBottom: 3 }}>Upload Company Materials (Max file size-500mb)</p>
        <p style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: 10 }}>
          Use the Upload are to share completed projects, past performance details, testimonials, case studies, videos, capability statement. (Max file size - 500MB)
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            style={{ padding: '8px 16px', borderRadius: 6, background: 'hsl(55,30%,43%)', color: '#fff', fontWeight: 600, fontSize: '0.75rem', border: 'none', cursor: 'pointer' }}
            data-testid="button-upload-file"
          >
            Upload File
          </button>
          <select style={{ ...inputStyle, flex: 1, height: 36 }} data-testid="select-upload-option">
            <option value="">Select Option</option>
            <option value="capability">Capability Statement</option>
            <option value="performance">Past Performance</option>
            <option value="testimonial">Testimonial</option>
            <option value="case-study">Case Study</option>
            <option value="video">Video</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button
          type="button"
          style={{ marginTop: 8, background: 'none', border: 'none', color: 'hsl(55,30%,43%)', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', padding: 0 }}
          data-testid="button-add-more-materials"
        >
          + Add more materials
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827', marginBottom: 10 }}>Company social media links</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>Linkedin</label>
            <input type="text" value={companyData.linkedin} onChange={(e) => update("linkedin", e.target.value)} style={inputStyle} data-testid="input-company-linkedin" />
          </div>
          <div>
            <label style={labelStyle}>Facebook</label>
            <input type="text" value={companyData.facebook} onChange={(e) => update("facebook", e.target.value)} style={inputStyle} data-testid="input-company-facebook" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Youtube</label>
            <input type="text" value={companyData.youtube} onChange={(e) => update("youtube", e.target.value)} style={inputStyle} data-testid="input-company-youtube" />
          </div>
          <div>
            <label style={labelStyle}>Instagram</label>
            <input type="text" value={companyData.instagram} onChange={(e) => update("instagram", e.target.value)} style={inputStyle} data-testid="input-company-instagram" />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isPending}
        style={{ padding: '10px 32px', borderRadius: 6, background: 'hsl(55,30%,43%)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        data-testid="button-step4-submit"
      >
        {isPending && <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />}
        Continue
      </button>
    </div>
  );
}

function ConfirmModal({ companyData, onConfirm, onGoBack, isPending }: {
  companyData: CompanyData; onConfirm: () => void; onGoBack: () => void; isPending: boolean;
}) {
  const fullAddress = [companyData.address, companyData.city, companyData.state, companyData.zipCode]
    .filter(Boolean).join(", ");

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onGoBack} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'relative', background: '#ffffff', borderRadius: 12, padding: '32px 36px', maxWidth: 480, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} data-testid="confirm-modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: 0 }}>Confirm your company</h2>
          <button type="button" onClick={onGoBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: '1.2rem', color: '#6b7280', lineHeight: 1 }} data-testid="button-confirm-close">×</button>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 24px 0' }}>Please confirm this is the correct company you're associated with.</p>

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 4px 0' }}>Your Company:</p>
          <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', margin: 0 }} data-testid="text-confirm-company">{companyData.name || "—"}</p>
        </div>

        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 4px 0' }}>Company Address:</p>
          <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.5 }} data-testid="text-confirm-address">{fullAddress || "—"}</p>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onGoBack}
            style={{ padding: '10px 28px', borderRadius: 6, background: '#ffffff', color: '#374151', fontWeight: 600, fontSize: '0.85rem', border: '1px solid #d1d5db', cursor: 'pointer' }}
            data-testid="button-confirm-goback">
            Go back
          </button>
          <button type="button" onClick={onConfirm} disabled={isPending}
            style={{ padding: '10px 28px', borderRadius: 6, background: 'hsl(55,30%,43%)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            data-testid="button-confirm-submit">
            {isPending && <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PartnerWizard() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [orgType, setOrgType] = useState<OrgType>(null);
  const [samRegistered, setSamRegistered] = useState<SamRegistered>(null);
  const [searchBy, setSearchBy] = useState<SearchBy>("company");
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [companyData, setCompanyData] = useState<CompanyData>({
    name: "", website: "", ueid: "", cage: "", ein: "",
    founderName: "", yearFounded: "", stateOfRegistration: "",
    registrationCode: "", state: "", address: "", city: "", zipCode: "",
    classification: "small", programs: [],
    linkedin: "", facebook: "", youtube: "", instagram: "",
  });

  const dispatch = useAppDispatch();
  const [createPartner, { isLoading: createPending }] = useCreatePartnerMutation();
  const [linkPartner] = useLinkPartnerMutation();
  const { logout } = useAuth();

  const handleCreatePartner = async () => {
    try {
      const partner = await createPartner({
        name: companyData.name,
        uei: companyData.ueid || `UEI-${Date.now()}`,
        cage: companyData.cage || null,
        entityType: orgType === "liaison" ? "Liaison Organization" : "Business",
        samRegistered: samRegistered === "yes",
      }).unwrap();
      await linkPartner({ partnerId: partner.id }).unwrap();
      setShowConfirm(false);
      dispatch(api.util.invalidateTags(["User"]));
    } catch (err: any) {
      setShowConfirm(false);
      setError(err.data || err.message || "Failed to create partner");
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleStep4Submit = () => {
    if (!companyData.name.trim()) {
      setError("Company name is required");
      return;
    }
    setError("");
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    handleCreatePartner();
  };

  return (
    <div className="fixed inset-0 flex" style={{ zIndex: 9999 }}>
      <div className="hidden lg:block flex-shrink-0" style={{ width: '45%', background: '#000000', position: 'relative', overflow: 'hidden' }}>
        <img
          src={soldierBg}
          alt="Warfighter wireframe"
          style={{ position: 'absolute', top: 30, left: 0, right: 0, bottom: 0, width: '100%', height: 'calc(100% - 30px)', objectFit: 'cover', objectPosition: 'center top' }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, padding: '1.5rem 2rem', zIndex: 10 }}>
          <img src={iweLogo} alt="IWE Logo" style={{ height: 32 }} />
        </div>
      </div>

      <div style={{ flex: 1, background: '#ffffff', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '2rem 0' }}>
        {step === 1 && (
          <Step1 orgType={orgType} setOrgType={setOrgType} onContinue={() => setStep(2)} onBack={handleLogout} />
        )}
        {step === 2 && (
          <Step2 samRegistered={samRegistered} setSamRegistered={setSamRegistered} onContinue={() => setStep(3)} onBack={() => setStep(1)} />
        )}
        {step === 3 && (
          <Step3 searchBy={searchBy} setSearchBy={setSearchBy} onContinue={() => setStep(4)} onBack={() => setStep(2)} onAddNew={() => setStep(4)}
            onSelectPartner={(partner: any) => {
              setCompanyData(prev => ({
                ...prev,
                name: partner.name || "",
                ueid: partner.uei || "",
                cage: partner.cage || "",
              }));
              setStep(4);
            }} />
        )}
        {step === 4 && (
          <Step4 companyData={companyData} setCompanyData={setCompanyData} onSubmit={handleStep4Submit} onBack={() => setStep(3)}
            isPending={createPending} error={error} samRegistered={samRegistered === "yes"} />
        )}
      </div>

      {showConfirm && (
        <ConfirmModal companyData={companyData} onConfirm={handleConfirm} onGoBack={() => setShowConfirm(false)} isPending={createPending} />
      )}
    </div>
  );
}
