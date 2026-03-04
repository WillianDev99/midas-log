"use client";

import React from 'react';
import { ArrowLeft, AlertTriangle, Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const HidracorAvarias = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="bg-amber-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="text-amber-600" size={40} />
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Cálculo de Avarias Hidracor</h1>
        <p className="text-slate-500">Esta funcionalidade está em desenvolvimento e estará disponível em breve para facilitar a gestão de perdas e danos.</p>
        <div className="flex items-center justify-center gap-2 text-amber-600 font-bold animate-pulse">
          <Construction size={20} />
          <span>EM DESENVOLVIMENTO</span>
        </div>
        <Link to="/admin">
          <Button variant="outline" className="mt-8 gap-2">
            <ArrowLeft size={16} /> Voltar ao Painel
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default HidracorAvarias;