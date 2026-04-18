import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, User, Mail, Phone, Building2, MapPin, Flag } from "lucide-react";
import { useLoginMutation, useRegisterMutation as useRegisterMutationHook } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import soldierBg from "@assets/image_1773916984498.png";
import iweLogo from "@assets/image_1773917058075.png";

const countries = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany", "France",
  "India", "Japan", "South Korea", "Israel", "Saudi Arabia", "UAE",
  "Italy", "Spain", "Brazil", "Mexico", "Singapore", "Netherlands",
];

function IconInput({ icon: Icon, ...props }: { icon: any } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <Input {...props} className={`pl-10 h-12 bg-background border-border text-foreground text-sm placeholder:text-muted-foreground focus:border-primary/60 ${props.className || ""}`} />
    </div>
  );
}

function VerifyCodePanel({ email, formData, onBack, onBackToSignIn }: { email: string; formData: any; onBack: () => void; onBackToSignIn: () => void }) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");

  const inputRefs = Array.from({ length: 6 }, () => ({ current: null as HTMLInputElement | null }));

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) value = value[value.length - 1];
    if (value && !/^\d$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    if (value && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const [doRegister, { isLoading: registerLoading }] = useRegisterMutationHook();

  const registerMutation = {
    isPending: registerLoading,
    mutate: () => {
      doRegister({
        username: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        email: formData.email,
        companyName: formData.preferredName || formData.firstName,
      }).unwrap().then(() => {
        setError("");
        onBackToSignIn();
      }).catch((err: any) => {
        setError(err?.data?.message || err?.message || "Registration failed");
      });
    },
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = code.join("");
    if (entered.length < 4) {
      setError("Please enter the verification code");
      return;
    }
    if (entered !== "123400" && entered.substring(0, 4) !== "1234") {
      setError("Invalid verification code. Demo code is 1234.");
      return;
    }
    setError("");
    registerMutation.mutate();
  };

  const codeInputStyle = {
    width: 48, height: 52, textAlign: 'center' as const, fontSize: '1.25rem', fontWeight: 600,
    borderRadius: 8, outline: 'none',
  };

  return (
    <div style={{ width: '100%', maxWidth: 460, padding: '2rem 1.5rem' }}>
      <button type="button" onClick={onBack} className="flex items-center gap-1 bg-transparent border-none cursor-pointer text-primary text-sm font-semibold mb-8" data-testid="button-2fa-back">
        ← Back
      </button>

      <h2 className="text-xl font-bold text-foreground mb-4" data-testid="text-2fa-title">Please verify your account</h2>

      <p className="text-sm text-muted-foreground leading-relaxed mb-6">
        We sent a verification code to {email}.<br />
        Please check your inbox and enter the six digit code to verify your account.
      </p>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/30 mb-4" data-testid="text-2fa-error">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs[i].current = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="bg-background text-foreground border border-border focus:border-muted-foreground"
              style={codeInputStyle}
              data-testid={`input-2fa-digit-${i}`}
            />
          ))}
        </div>

        <button type="button" className="bg-transparent border-none cursor-pointer text-primary text-sm font-semibold underline mb-8" data-testid="button-resend-code">
          Resend Code
        </button>

        <div>
          <Button
            type="submit"
            disabled={registerMutation.isPending}
            className="px-9 py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-md flex items-center gap-2"
            data-testid="button-2fa-submit"
          >
            {registerMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit
          </Button>
        </div>
      </form>
    </div>
  );
}

function SignUpPanel({ onBack }: { onBack: () => void }) {
  const [formData, setFormData] = useState({
    username: "", password: "", confirmPassword: "", firstName: "", lastName: "",
    preferredName: "", title: "", phone: "", email: "",
  });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState("");
  const [show2FA, setShow2FA] = useState(false);

  const update = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError("First and last name are required");
      return;
    }
    if (!formData.email.trim()) {
      setError("Email address is required");
      return;
    }
    if (!formData.password.trim()) {
      setError("Password is required");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (!agreeTerms) {
      setError("You must agree to the Terms of Use");
      return;
    }
    setError("");
    setShow2FA(true);
  };

  if (show2FA) {
    return <VerifyCodePanel email={formData.email} formData={formData} onBack={() => setShow2FA(false)} onBackToSignIn={onBack} />;
  }

  const inputStyle = {
    height: 44, width: '100%', padding: '0 12px', fontSize: '0.85rem',
    borderRadius: 6, outline: 'none',
  } as React.CSSProperties;

  return (
    <div style={{ width: '100%', maxWidth: 460, padding: '2rem 1.5rem' }}>
      <h2 className="text-2xl font-bold text-foreground mb-1" data-testid="text-signup-title">Sign Up</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Already have an account?{" "}
        <button type="button" onClick={onBack} className="text-foreground underline bg-transparent border-none cursor-pointer text-sm font-medium" data-testid="link-back-signin">
          Sign in
        </button>
      </p>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/30 mb-4" data-testid="text-signup-error">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">First Name <span className="text-destructive">*</span></label>
            <input type="text" value={formData.firstName} onChange={(e) => update("firstName", e.target.value)} className="bg-background text-foreground border border-border focus:border-muted-foreground" style={inputStyle} data-testid="input-signup-first-name" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Last Name <span className="text-destructive">*</span></label>
            <input type="text" value={formData.lastName} onChange={(e) => update("lastName", e.target.value)} className="bg-background text-foreground border border-border focus:border-muted-foreground" style={inputStyle} data-testid="input-signup-last-name" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Preferred Name <span className="text-destructive">*</span></label>
            <input type="text" value={formData.preferredName} onChange={(e) => update("preferredName", e.target.value)} className="bg-background text-foreground border border-border focus:border-muted-foreground" style={inputStyle} data-testid="input-signup-preferred-name" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Title <span className="text-destructive">*</span></label>
            <input type="text" value={formData.title} onChange={(e) => update("title", e.target.value)} className="bg-background text-foreground border border-border focus:border-muted-foreground" style={inputStyle} data-testid="input-signup-title" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Email Address <span className="text-destructive">*</span></label>
            <input type="email" value={formData.email} onChange={(e) => update("email", e.target.value)} className="bg-background text-foreground border border-border focus:border-muted-foreground" style={inputStyle} data-testid="input-signup-email" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Phone Number <span className="text-destructive">*</span></label>
            <input type="tel" value={formData.phone} onChange={(e) => update("phone", e.target.value)} className="bg-background text-foreground border border-border focus:border-muted-foreground" style={inputStyle} data-testid="input-signup-phone" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Password <span className="text-destructive">*</span></label>
            <input type="password" value={formData.password} onChange={(e) => update("password", e.target.value)} className="bg-background text-foreground border border-border focus:border-muted-foreground" style={inputStyle} data-testid="input-signup-password" autoComplete="new-password" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Confirm Password <span className="text-destructive">*</span></label>
            <input type="password" value={formData.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} className="bg-background text-foreground border border-border focus:border-muted-foreground" style={inputStyle} data-testid="input-signup-confirm-password" autoComplete="new-password" />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'hsl(55,30%,43%)', cursor: 'pointer' }}
            data-testid="checkbox-agree-terms"
          />
          <label className="text-xs text-foreground/80">I agree to the Terms of Use and consent to receive updates via email and SMS</label>
        </div>

        <Button
          type="submit"
          className="px-9 py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-md"
          data-testid="button-signup-submit"
        >
          Submit
        </Button>
      </form>
    </div>
  );
}

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const [doLogin, { isLoading: loginLoading }] = useLoginMutation();

  const loginMutation = {
    isPending: loginLoading,
    mutate: () => {
      doLogin({ username, password }).unwrap().then(() => {
        setError("");
        window.location.href = "/";
      }).catch((err: any) => {
        const msg = err?.data?.message || err?.message || "";
        setError(msg.includes("401") ? "Invalid credentials" : (msg || "Login failed"));
      });
    },
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required");
      return;
    }
    setError("");
    loginMutation.mutate();
  };

  return (
    <div className="fixed inset-0 flex" style={{ zIndex: 9999 }} data-testid="login-page">
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

      <div className="flex-1 flex items-center justify-center overflow-y-auto bg-background">
        {showSignup ? (
          <SignUpPanel onBack={() => setShowSignup(false)} />
        ) : showPrivacy ? (
          <div style={{ width: '100%', maxWidth: 520, padding: '0px 0px' }}>
            <h2 className="text-2xl font-normal text-foreground mb-5" data-testid="text-terms-title">Terms of Use</h2>

            <div className="text-[0.8rem] text-foreground/80 leading-relaxed">
              <p style={{ fontWeight: 700, marginBottom: 2 }}>Use of the Site</p>
              <p style={{ marginBottom: 12 }}>You agree to use the Site only for lawful purposes and in a manner that does not violate applicable laws or infringe on the rights of others. You may not attempt to interfere with the operation, security, or functionality of the Site.</p>

              <p style={{ fontWeight: 700, marginBottom: 2 }}>Intellectual Property</p>
              <p style={{ marginBottom: 12 }}>All content on the Site, including text, graphics, logos, and other materials, is owned by or licensed to the Site owner and is protected by intellectual property laws. You may not copy, distribute, modify, or reuse any content without prior written permission unless expressly allowed.</p>

              <p style={{ fontWeight: 700, marginBottom: 2 }}>User Content</p>
              <p style={{ marginBottom: 12 }}>If you submit content through the Site, you represent that you have the right to do so. By submitting content, you grant the Site owner a non-exclusive, royalty-free license to use, display, and reproduce such content in connection with the Site.</p>

              <p style={{ fontWeight: 700, marginBottom: 2 }}>Third-Party Links</p>
              <p style={{ marginBottom: 12 }}>The Site may include links to third-party websites for convenience. The Site owner is not responsible for the content, policies, or practices of third-party sites and does not endorse them.</p>

              <p style={{ fontWeight: 700, marginBottom: 2 }}>Disclaimer and Limitation of Liability</p>
              <p style={{ marginBottom: 12 }}>The Site is provided "as is" and without warranties of any kind. The Site owner does not guarantee the accuracy, completeness, or availability of the Site and is not liable for any damages arising from its use or inability to use the Site.</p>

              <p style={{ fontWeight: 700, marginBottom: 2 }}>Changes and Termination</p>
              <p style={{ marginBottom: 12 }}>The Site owner may update these Terms at any time without notice. Continued use of the Site constitutes acceptance of any changes. Access to the Site may be suspended or terminated at any time for any reason.</p>

              <p style={{ fontWeight: 700, marginBottom: 2 }}>Governing Law</p>
              <p style={{ marginBottom: 16 }}>These Terms are governed by the laws of [Jurisdiction].</p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <Button
                type="button"
                onClick={() => setShowPrivacy(false)}
                className="px-7 py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded-md"
                data-testid="button-accept-terms"
              >
                Accept
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPrivacy(false)}
                className="px-7 py-2.5 font-semibold text-sm rounded-md"
                data-testid="button-decline-terms"
              >
                Decline
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 420, padding: '3rem 2rem' }}>
            <div className="lg:hidden" style={{ marginBottom: '2rem' }}>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full border-2 border-foreground flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-foreground" />
                </div>
                <h1 className="text-lg font-bold tracking-[0.2em] text-foreground" data-testid="text-brand-logo-mobile">
                  CENCORE
                </h1>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-foreground text-center leading-snug mb-10 font-serif" data-testid="text-login-title">
              Integrated Warfighter<br />Ecosystem
            </h2>

            <h3 className="text-2xl font-bold text-foreground mb-6">Sign in</h3>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30" data-testid="text-login-error">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">
                  Email Address <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="h-12 bg-background border-border text-foreground text-sm"
                  data-testid="input-username"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">
                  Password <span className="text-destructive">*</span>
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-12 bg-background border-border text-foreground text-sm"
                  data-testid="input-password"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRememberMe(!rememberMe)}
                    style={{
                      width: 40,
                      height: 22,
                      borderRadius: 11,
                      background: rememberMe ? '#2dd4bf' : '#d1d5db',
                      position: 'relative',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      flexShrink: 0,
                    }}
                    data-testid="switch-remember"
                  >
                    <span style={{
                      position: 'absolute',
                      top: 2,
                      left: rememberMe ? 20 : 2,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#ffffff',
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                  <label style={{ fontSize: '0.875rem', color: '#6b7280', cursor: 'pointer' }} onClick={() => setRememberMe(!rememberMe)}>
                    Remember Password ?
                  </label>
                </div>
                <button type="button" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-forgot-password">
                  Forgot Password ?
                </button>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold tracking-[0.15em] text-sm rounded-md"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  LOGIN
                </Button>
              </div>
            </form>

            <div className="mt-10 space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                By continuing, you agree to our{" "}
                <button type="button" className="text-foreground/70 underline hover:text-foreground transition-colors" onClick={() => setShowPrivacy(true)} data-testid="link-privacy">
                  Privacy Policy
                </button>.
              </p>
              <p className="text-sm text-muted-foreground font-medium">
                Don't have an account?{" "}
                <button type="button" className="text-primary hover:text-primary/80 font-semibold underline transition-colors" onClick={() => setShowSignup(true)} data-testid="link-sign-up">
                  Register
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
