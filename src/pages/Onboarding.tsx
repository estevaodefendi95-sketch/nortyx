import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/context/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Onboarding = () => {
  const { user } = useAuth();
  const { refreshOrganization } = useOrganization();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const generateSlug = (value: string) => {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(generateSlug(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || !slug.trim()) return;

    setLoading(true);
    try {
      const { data: orgId, error } = await supabase.rpc("create_organization_with_owner", {
        _name: name.trim(),
        _slug: slug.trim(),
        _user_id: user.id,
      });

      if (error) {
        if (error.message.includes("duplicate") || error.message.includes("unique")) {
          toast({ title: "Erro", description: "Este identificador já está em uso. Escolha outro.", variant: "destructive" });
          setLoading(false);
          return;
        }
        throw error;
      }

      await refreshOrganization();
      toast({ title: "Organização criada!", description: `${name} está pronta para uso.` });
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Error creating organization:", err);
      toast({ title: "Erro", description: err.message || "Erro ao criar organização.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Configure sua empresa</h1>
          <p className="text-muted-foreground text-sm">
            Crie sua organização para começar a usar o sistema.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="orgName">Nome da empresa</Label>
            <Input
              id="orgName"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex: Restaurante Sabor & Arte"
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="orgSlug">Identificador único</Label>
            <Input
              id="orgSlug"
              value={slug}
              onChange={(e) => setSlug(generateSlug(e.target.value))}
              placeholder="ex: restaurante-sabor-arte"
              required
              maxLength={40}
              pattern="[a-z0-9\-]+"
              title="Apenas letras minúsculas, números e hífens"
            />
            <p className="text-xs text-muted-foreground">
              Usado para identificar sua empresa no sistema.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading || !name.trim() || !slug.trim()}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar organização
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;
