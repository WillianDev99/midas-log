import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary capturou um erro não tratado:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    try {
      localStorage.removeItem("midas_external_loads_cache");
    } catch (e) {}
    window.location.reload();
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-2xl border border-red-200 shadow-xl p-6 text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Algo inesperado aconteceu</h2>
              <p className="text-xs text-slate-500 mt-1">
                Ocorreu uma falha ao renderizar esta página. Seus dados estão seguros.
              </p>
            </div>
            {this.state.error && (
              <div className="bg-red-50 text-red-800 p-3 rounded-lg text-left text-xs font-mono overflow-auto max-h-40 border border-red-200">
                <strong>Erro:</strong> {this.state.error.message}
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReload}
                className="w-full sm:w-auto gap-1.5 h-9 text-xs font-semibold"
              >
                <RefreshCw size={14} /> Recarregar Página
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={this.handleReset}
                className="w-full sm:w-auto gap-1.5 h-9 text-xs font-semibold"
              >
                <Trash2 size={14} /> Limpar Cache e Reiniciar
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
