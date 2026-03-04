"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowLeft, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();

  const ADMIN_EMAIL = '7por4oficial@gmail.com';

  useEffect(() => {
    if (session) {
      const userType = session.user?.user_metadata?.account_type;
      navigate(userType === 'admin' ? '/admin' : '/');
    }
  }, [session, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const userType = data.user?.user_metadata?.account_type;
      const isApproved = data.user?.user_metadata?.approved;
      const isMainAdmin = data.user?.email === ADMIN_EMAIL;

      // Se for ADM mas não estiver aprovado E não for o ADM principal
      if (userType === 'admin' && !isApproved && !isMainAdmin) {
        await supabase.auth.signOut();
        showError("Sua conta ADM aguarda aprovação.");
        return;
      }

      showSuccess("Bem-vindo!");
    } catch (error: any) {
      showError(error.message || "Erro ao realizar login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Link to="/" className="absolute top-8 left-8 flex items-center gap-2 text-slate-600 hover:text-amber-600 transition-colors">
        <ArrowLeft size={20} />
        Voltar para o site
      </Link>
      
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Midas Log" className="h-6 w-auto" />
          </div>
          <CardTitle className="text-2xl font-bold">Acesso ao Sistema</CardTitle>
          <CardDescription>
            Entre com suas credenciais para acessar sua área exclusiva.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link to="/forgot-password" size="sm" className="text-xs text-amber-600 hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                <Input 
                  id="password" 
                  type="password" 
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white h-11" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : "Entrar no Sistema"}
            </Button>
            
            <div className="text-center space-y-2">
              <p className="text-sm text-slate-500">Não tem uma conta?</p>
              <Link to="/register">
                <Button variant="outline" className="w-full flex items-center gap-2">
                  <UserPlus size={18} />
                  Criar Conta
                </Button>
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;