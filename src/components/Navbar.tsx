"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Navbar = () => {
  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.jpg" alt="Midas Log" className="h-10 w-auto rounded shadow-sm" />
          <span className="text-xl font-bold tracking-tight text-slate-900 hidden sm:inline-block">
            MIDAS <span className="text-amber-600">LOGÍSTICA</span>
          </span>
        </Link>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#historia" className="hover:text-amber-600 transition-colors">História</a>
          <a href="#servicos" className="hover:text-amber-600 transition-colors">Serviços</a>
          <Link to="/login">
            <Button variant="outline" className="flex items-center gap-2 border-amber-200 hover:bg-amber-50">
              <User size={16} />
              Área do Cliente / ADM
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;