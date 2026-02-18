"use client";

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, ArrowLeft, ShieldCheck, Users, Loader2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: 'client',
    avatarUrl: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      showError("As senhas não coincidem!");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            account_type: formData.accountType,
            avatar_url: formData.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.email}`
          }
        }
      });

      if (error) throw error;

      showSuccess("Cadastro realizado! Verifique seu e-mail para confirmar.");
      navigate('/login');
    } catch (error: any) {
      showError(error.message || "Erro ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 py-12">
      <Link to="/login" className="absolute top-8 left-8 flex items-center gap-2 text-slate-600 hover:text-amber-600 transition-colors">
        <ArrowLeft size={20} />
        Voltar
      </Link>
      
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img src="/logo.jpg" alt="Midas Log" className="h-12 w-auto rounded-lg" />
          </div>
          <CardTitle className="text-2xl font-bold">Criar Conta</CardTitle>
          <CardDescription>Escolha seu perfil e preencha os dados.</CardDescription>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            <div className="flex justify-center mb-6">
              <div className="relative group">
                <Avatar className="h-24 w-24 border-4 border-white shadow-md">
                  <AvatarImage src={formData.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.email || 'default'}`} />
                  <AvatarFallback><User size={40} /></AvatarFallback>
                </Avatar>
                <label className="absolute bottom-0 right-0 bg-amber-600 p-2 rounded-full text-white cursor-pointer hover:bg-amber-700 transition-colors shadow-lg">
                  <Camera size={16} />
                  <input 
                    type="text" 
                    className="hidden" 
                    placeholder="URL da imagem"
                    onChange={(e) => setFormData({...formData, avatarUrl: e.target.value})}
                  />
                </label>
              </div>
            </div>

            <RadioGroup 
              defaultValue="client" 
              className="grid grid-cols-2 gap-4"
              onValueChange={(value) => setFormData({...formData, accountType: value})}
            >
              <Label htmlFor="client" className="flex flex-col items-center justify-between rounded-md border-2 border-muted p-4 hover:bg-accent cursor-pointer [&:has([data-state=checked])]:border-amber-500">
                <RadioGroupItem value="client" id="client" className="sr-only" />
                <Users className="mb-2 h-6 w-6" />
                Cliente
              </Label>
              <Label htmlFor="admin" className="flex flex-col items-center justify-between rounded-md border-2 border-muted p-4 hover:bg-accent cursor-pointer [&:has([data-state=checked])]:border-amber-500">
                <RadioGroupItem value="admin" id="admin" className="sr-only" />
                <ShieldCheck className="mb-2 h-6 w-6" />
                ADM
              </Label>
            </RadioGroup>

            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input 
                placeholder="Seu nome" 
                required 
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input 
                type="email" 
                placeholder="seu@email.com" 
                required 
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input 
                  type="password" 
                  required 
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Confirmar</Label>
                <Input 
                  type="password" 
                  required 
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white h-11" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : "Criar Conta"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Register;