"use client";

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';

const ForgotPassword = () => {
  const [step, setStep] = useState<'email' | 'code' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      showSuccess(`Instruções enviadas para ${email}`);
      setStep('code');
    } catch (error: any) {
      showError(error.message || "Erro ao enviar e-mail.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'recovery'
      });
      if (error) throw error;
      setStep('reset');
    } catch (error: any) {
      showError(error.message || "Código inválido ou expirado.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showSuccess("Senha redefinida com sucesso!");
      navigate('/login');
    } catch (error: any) {
      showError(error.message || "Erro ao redefinir senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Link to="/login" className="absolute top-8 left-8 flex items-center gap-2 text-slate-600 hover:text-amber-600 transition-colors">
        <ArrowLeft size={20} />
        Voltar para o login
      </Link>
      
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-amber-100 p-3 rounded-full">
              <KeyRound className="text-amber-600" size={32} />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {step === 'email' && "Recuperar Senha"}
            {step === 'code' && "Verificar Código"}
            {step === 'reset' && "Nova Senha"}
          </CardTitle>
          <CardDescription>
            {step === 'email' && "Informe seu e-mail para receber o código de recuperação."}
            {step === 'code' && "Insira o código enviado ao seu e-mail."}
            {step === 'reset' && "Crie uma nova senha segura para sua conta."}
          </CardDescription>
        </CardHeader>

        {step === 'email' && (
          <form onSubmit={handleSendCode}>
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
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : "Enviar Código"}
              </Button>
            </CardFooter>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerifyCode}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código de Verificação</Label>
                <Input 
                  id="code" 
                  placeholder="000000" 
                  className="text-center text-2xl tracking-[0.5em] font-bold"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required 
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : "Verificar Código"}
              </Button>
            </CardFooter>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleResetPassword}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input 
                  id="newPassword" 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required 
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : "Redefinir Senha"}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
};

export default ForgotPassword;