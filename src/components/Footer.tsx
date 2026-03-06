"use client";

import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-white py-12 border-t border-slate-100">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <img src="/logo.png" alt="Midas Log" className="h-8 w-auto mb-2 mx-auto md:mx-0" />
            <p className="text-sm text-slate-400">Midas Logística - Eficiência em Movimento.</p>
          </div>
          
          <div className="text-center md:text-right">
            <p className="text-xs text-slate-400">© {new Date().getFullYear()} Midas Logística. Todos os direitos reservados.</p>
            <p className="text-[10px] text-slate-300 mt-1 uppercase font-bold tracking-widest">Sistema de Gestão Logística v3.0</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;