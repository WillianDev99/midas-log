"use client";

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Truck, Lock, Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { showSuccess } from '@/utils/toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulação de login
    if (email.includes('admin')) {
      showSuccess("Bem-vindo, Administrador!");
      navigate('/admin');
    } else {
      showSuccess("Login realizado com sucesso!");
      navigate('/');
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
            <div className="bg-amber-500 p-3 rounded-2xl">
              <Truck className="text-white" size={32} />
            </div>
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
                <a href="#" className="text-xs text-amber-600 hover:underline">Esqueceu a senha?</a>
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
            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white h-11">
              Entrar no Sistema
            </Button>
            <p className="text-sm text-center text-slate-500">
              Dica: Use um e-mail com "admin" para acessar a área ADM.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;