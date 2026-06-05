import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, User, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { hexToHSL } from "@/utils/color";

type AuthMode = "login" | "signup" | "reset";

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

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    supabase.rpc("get_login_branding").then(({ data }) => {
      if (data && data.length > 0) setBranding(data[0]);
    });
  }, []);

  // Apply primary color from branding
  useEffect(() => {
    if (!branding?.primary_color) return;
    const hsl = hexToHSL(branding.primary_color);
    if (!hsl) return;
    document.documentElement.style.setProperty("--primary", hsl);
    document.documentElement.style.setProperty("--ring", hsl);
    return () => {
      document.documentElement.style.removeProperty("--primary");
      document.documentElement.style.removeProperty("--ring");
    };
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

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const translateError = (msg: string) => {
    if (msg.includes("Invalid login credentials")) return "Email ou senha incorretos.";
    if (msg.includes("Email not confirmed")) return "Confirme seu email antes de entrar.";
    if (msg.includes("User already registered")) return "Este email já está cadastrado.";
    if (msg.includes("Password should be")) return "A senha deve ter pelo menos 6 caracteres.";
    if (msg.includes("rate limit")) return "Muitas tentativas. Aguarde alguns minutos.";
    return msg;
  };

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
