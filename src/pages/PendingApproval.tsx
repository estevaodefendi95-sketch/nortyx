import { Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const PendingApproval = () => {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Clock className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-display font-bold text-foreground">Acesso não liberado</h1>
          <p className="text-muted-foreground text-sm">
            Sua conta ainda não está vinculada a uma empresa ou não foi aprovada. Entre em contato com o administrador para liberar o acesso.
          </p>
        </div>
        <Button variant="outline" onClick={signOut} className="w-full">
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </div>
    </div>
  );
};

export default PendingApproval;
