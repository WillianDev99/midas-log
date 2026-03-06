"use client";

import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-white py-12 border-t border-slate-100">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-slate-900 font-black text-xl tracking-tighter">LUZARTE</h3>
            <p className="text-sm text-slate-400 mt-1">Excelência em Louças Sanitárias.</p>
          </div>
          
          <div className="text-center md:text-right">
            <p className="text-xs text-slate-400">© {new Date().getFullYear()} Luzarte. Todos os direitos reservados.</p>
            <p className="text-[10px] text-slate-300 mt-1 uppercase font-bold tracking-widest">Sistema de Orçamentos v2.0</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;