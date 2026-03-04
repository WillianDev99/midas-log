"use client";

import React from 'react';
import { ArrowLeft, FileText, Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const HidracorRomaneioExterno = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
          <FileText className="text-blue-600" size={40} />
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Romaneio Carga Externa</h1>
        <p className="text-slate-500">Em breve você poderá gerar romaneios profissionais para suas cargas externas diretamente por aqui.</p>
        <div className="flex items-center justify-center gap-2 text-blue-600 font-bold animate-pulse">
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

export default HidracorRomaneioExterno;