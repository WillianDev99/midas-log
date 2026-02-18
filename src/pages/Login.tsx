"use client";

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowLeft, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const navigate = useNavigate();
  const ADMIN_EMAIL = "7por4oficial@gmail.com";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supabase) {
      showError("Sistema de autenticação não configurado.");
      return;
    }

    setLoading(true);

    try {
      if (email === ADMIN_EMAIL && !isFirstLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: 'temporary_password_placeholder'
        });

        if (signInError && signInError.message.includes("Invalid login credentials")) {
          setIsFirstLogin(true);
          setLoading(false);
          return;
        }
      }

      if (isFirstLogin) {
        if (password !== confirmPassword) {
          showError("As senhas não coincidem!");
          setLoading(false);
          return;
        }
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { account_type: 'admin', approved: true } }
        });

        if (error) throw error;
        showSuccess("Senha configurada! Verifique seu e-mail.");
        setIsFirstLogin(false);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const userType = data.user?.user_metadata?.account_type;
        const isApproved = data.user?.user_metadata?.approved;

        if (userType === 'admin' && !isApproved) {
          await supabase.auth.signOut();
          showError("Sua conta ADM aguarda aprovação.");
          return;
        }

        showSuccess("Bem-vindo!");
        navigate(userType === 'admin' ? '/admin' : '/');
      }
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
            <img src="/logo.jpg" alt="Midas Log" className="h-16 w-auto rounded-lg shadow-sm" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {isFirstLogin ? "Configurar Senha ADM" : "Acesso ao Sistema"}
          </CardTitle>
          <CardDescription>
            {isFirstLogin 
              ? "Defina uma senha segura para o administrador principal." 
              : "Entre com suas credenciais para acessar sua área exclusiva."}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {!isFirstLogin && (
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
            )}
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{isFirstLogin ? "Nova Senha" : "Senha"}</Label>
                {!isFirstLogin && (
                  <Link to="/forgot-password" size="sm" className="text-xs text-amber-600 hover:underline">
                    Esqueceu a senha?
                  </Link>
                )}
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

            {isFirstLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                  <Input 
                    id="confirmPassword" 
                    type="password" 
                    className="pl-10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required 
                  />
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white h-11" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : (isFirstLogin ? "Salvar e Entrar" : "Entrar no Sistema")}
            </Button>
            
            {!isFirstLogin && (
              <div className="text-center space-y-2">
                <p className="text-sm text-slate-500">Não tem uma conta?</p>
                <Link to="/register">
                  <Button variant="outline" className="w-full flex items-center gap-2">
                    <UserPlus size={18} />
                    Criar Conta
                  </Button>
                </Link>
              </div>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;