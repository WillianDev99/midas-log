"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        setSession(null);
        setUser(null);
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(user);
      }
      setLoading(false);
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);

      // Só redireciona automaticamente se o usuário estiver nas páginas de Auth
      const isAuthPage = ['/login', '/register', '/forgot-password'].includes(window.location.pathname);

      if (event === 'SIGNED_IN' && currentSession && isAuthPage) {
        const userType = currentSession.user?.user_metadata?.account_type;
        if (userType === 'admin') {
          navigate('/admin');
        } else {
          navigate('/');
        }
      }

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        if (!window.location.pathname.includes('/login')) {
          navigate('/login');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    setSession(null);
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};