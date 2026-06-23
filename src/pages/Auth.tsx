import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, User, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { applyBrandVars, clearBrandVars } from "@/hooks/useWhiteLabel";

type AuthMode = "login" | "signup" | "reset";

/**
 * If the hostname is a subdomain of a known platform domain (e.g.
 * "acme.nortyx.dev"), return the subdomain slug so we can load that
 * company's branding on the login page.
 */
function detectSubdomainSlug(): string | null {
  try {
    const { hostname } = window.location;
    // Skip localhost and raw IP addresses
    if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;
    const parts = hostname.split(".");
    // e.g. ["acme", "nortyx", "dev"] → slug = "acme"
    if (parts.length >= 3) return parts[0];
  } catch { /* ignore */ }
  return null;
}

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [branding, setBranding] = useState<{ name: string; logo_url: string | null; primary_color: string } | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  // True while we're returning from an OAuth provider (?code=... in the URL)
  // and the session is still being exchanged. Shows a loader instead of the form.
  const [oauthReturning, setOauthReturning] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has("code") || params.has("error");
  });

  useEffect(() => {
    document.title = branding?.name ? `${branding.name} — Login` : "Nortyx — Login";
  }, [branding?.name]);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  // If the OAuth exchange fails (e.g. user denied), stop showing the loader
  // after a short grace period so the login form returns.
  useEffect(() => {
    if (!oauthReturning) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("error")) {
      toast({
        title: "Login com Google cancelado",
        description: "Tente novamente ou use email e senha.",
        variant: "destructive",
      });
      setOauthReturning(false);
      return;
    }
    const t = setTimeout(() => setOauthReturning(false), 8000);
    return () => clearTimeout(t);
  }, [oauthReturning, toast]);

  useEffect(() => {
    // 1. Try to detect a company from ?org=slug or subdomain
    const params = new URLSearchParams(window.location.search);
    const orgSlug = params.get("org") ?? detectSubdomainSlug();

    if (orgSlug) {
      supabase
        .from("organizations")
        .select("name, logo_url, primary_color")
        .eq("slug", orgSlug)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setBranding({ name: data.name, logo_url: data.logo_url ?? null, primary_color: data.primary_color });
        });
      return;
    }

    // 2. Fall back to platform-level branding
    supabase.rpc("get_login_branding").then(({ data }) => {
      if (data && data.length > 0) setBranding(data[0]);
    });
  }, []);

  // Apply all brand CSS variables whenever branding changes.
  useEffect(() => {
    if (!branding?.primary_color) return;
    applyBrandVars(branding.primary_color);
    return () => clearBrandVars();
  }, [branding?.primary_color]);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirm(false);
  };

  // ── Login ───────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/");
    } catch (err: any) {
      toast({
        title: "Erro ao entrar",
        description: translateError(err.message),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Sign up ─────────────────────────────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Senhas diferentes", description: "As senhas precisam ser iguais.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Use pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName.trim() || email.split("@")[0] },
        },
      });
      if (error) throw error;
      setSignupDone(true);
    } catch (err: any) {
      toast({
        title: "Erro ao cadastrar",
        description: translateError(err.message),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Reset password ──────────────────────────────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: "Email enviado!", description: "Verifique sua caixa de entrada." });
      switchMode("login");
    } catch (err: any) {
      toast({ title: "Erro", description: translateError(err.message), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth (Supabase native) ──────────────────────────────────────────
  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Return to /auth (public route) so the PKCE ?code= isn't stripped by
          // a protected-route redirect before the session is established.
          redirectTo: `${window.location.origin}/auth`,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
      // On success the browser redirects to Google, then back to the app.
    } catch (err: any) {
      const errorMsg = err.message || "Erro ao conectar com Google";
      const isMissingSecret = errorMsg.includes("missing OAuth secret") || errorMsg.includes("Unsupported provider");

      toast({
        title: isMissingSecret ? "Google não está configurado" : "Erro ao entrar com Google",
        description: isMissingSecret
          ? "Google OAuth ainda não está ativado. Use email/senha por enquanto ou entre em contato com o suporte."
          : "Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const translateError = (msg: string) => {
    if (msg.includes("Invalid login credentials")) return "Email ou senha incorretos.";
    if (msg.includes("Email not confirmed")) return "Confirme seu email antes de entrar.";
    if (msg.includes("User already registered")) return "Este email já está cadastrado.";
    if (msg.includes("Password should be")) return "A senha deve ter pelo menos 6 caracteres.";
    if (msg.includes("rate limit")) return "Muitas tentativas. Aguarde alguns minutos.";
    return msg;
  };

  // ── OAuth return loader (while exchanging Google code for a session) ─────────
  if (oauthReturning && !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 animate-fade-in">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Entrando na sua conta…</p>
        </div>
      </div>
    );
  }

  // ── Signup confirmation screen ──────────────────────────────────────────────
  if (signupDone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-6 animate-fade-in">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-display font-bold">Verifique seu email</h1>
            <p className="text-muted-foreground text-sm">
              Enviamos um link de confirmação para{" "}
              <span className="font-semibold text-foreground">{email}</span>.
              <br />
              Clique no link para ativar sua conta.
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground">
            Não recebeu? Verifique a pasta de spam ou{" "}
            <button
              className="text-primary hover:underline font-medium"
              onClick={() => { setSignupDone(false); switchMode("signup"); }}
            >
              tente novamente
            </button>.
          </div>
          <Button variant="outline" className="w-full" onClick={() => switchMode("login")}>
            Voltar para o login
          </Button>
        </div>
      </div>
    );
  }

  // ── Auth form ───────────────────────────────────────────────────────────────
  const isLogin = mode === "login";
  const isSignup = mode === "signup";
  const isReset = mode === "reset";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 animate-fade-in">

        {/* Logo / Brand */}
        <div className="text-center space-y-2">
          {branding?.logo_url && (
            <img src={branding.logo_url} alt={branding.name} className="w-14 h-14 mx-auto rounded-xl object-cover" />
          )}
          <h1 className="text-3xl font-display font-bold text-foreground">
            {branding?.name || "nortyx"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isReset
              ? "Recuperar senha"
              : isSignup
              ? "Crie sua conta gratuitamente"
              : "Entre na sua conta"}
          </p>
        </div>

        {/* Tab switcher (login / signup) */}
        {!isReset && (
          <div className="flex bg-secondary/50 rounded-lg p-1 gap-1">
            <button
              onClick={() => switchMode("login")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                isLogin
                  ? "bg-card shadow-soft-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => switchMode("signup")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                isSignup
                  ? "bg-card shadow-soft-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Cadastrar
            </button>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={isReset ? handleReset : isSignup ? handleSignup : handleLogin}
          className="space-y-4"
        >
          {/* Display name — signup only */}
          {isSignup && (
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Seu nome</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Como quer ser chamado?"
                  className="pl-10 h-11"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="pl-10 h-11"
                required
                autoFocus={!isSignup}
              />
            </div>
          </div>

          {/* Password */}
          {!isReset && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? "Mínimo 6 caracteres" : "••••••••"}
                  className="pl-10 pr-10 h-11"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Confirm password — signup only */}
          {isSignup && (
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className={`pl-10 pr-10 h-11 transition-colors ${
                    confirmPassword && password !== confirmPassword
                      ? "border-destructive focus-visible:ring-destructive"
                      : confirmPassword && password === confirmPassword
                      ? "border-primary focus-visible:ring-primary"
                      : ""
                  }`}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não conferem.</p>
              )}
            </div>
          )}

          {/* Forgot password link */}
          {isLogin && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => switchMode("reset")}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Esqueceu a senha?
              </button>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-11 gap-2 font-semibold"
            disabled={loading || (isSignup && !!confirmPassword && password !== confirmPassword)}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            {isReset ? "Enviar link de recuperação" : isSignup ? "Criar conta" : "Entrar"}
          </Button>
        </form>

        {/* Social login (login / signup only) */}
        {!isReset && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou continue com</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full h-11 gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Entrar com Google
            </Button>
          </>
        )}

        {/* Back link for reset mode */}
        {isReset && (
          <p className="text-center text-sm">
            <button onClick={() => switchMode("login")} className="text-primary hover:underline">
              ← Voltar para o login
            </button>
          </p>
        )}

        {/* Footer */}
        {!isReset && (
          <p className="text-center text-xs text-muted-foreground">
            Ao {isSignup ? "criar sua conta" : "entrar"}, você concorda com nossos{" "}
            <span className="text-primary">Termos de Uso</span>.
          </p>
        )}
      </div>
    </div>
  );
};

export default Auth;
