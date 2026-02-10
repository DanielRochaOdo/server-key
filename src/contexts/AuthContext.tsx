import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { normalizeRole } from '../utils/roles';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'owner' | 'financeiro' | 'usuario';
  modules: string[];
  is_active: boolean;
  auth_uid: string;
}

interface AuthContextData {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  loadingProfile: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  hasModuleAccess: (module: string) => boolean;
  isAdmin: () => boolean;
  isOwner: () => boolean;
  isFinanceiro: () => boolean;
  isUsuario: () => boolean;
}

const AuthContext = createContext<AuthContextData | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error getting session:', error);
          // Clear potentially corrupted session
          await supabase.auth.signOut();
        } else if (mounted) {
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error);
        // Clear potentially corrupted session
        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.error('❌ Error clearing session:', signOutError);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          setUser(session?.user ?? null);
          
          // Clear profile when user logs out
          if (!session?.user) {
            setUserProfile(null);
            setLoadingProfile(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch user profile when user changes
  useEffect(() => {
    let mounted = true;

    const fetchUserProfile = async () => {
      if (!user) {
        if (mounted) {
          setUserProfile(null);
          setLoadingProfile(false);
        }
        return;
      }

      try {
        setLoadingProfile(true);

        const { data: profile, error } = await supabase
          .from('users')
          .select('id, email, name, role, modules, is_active, auth_uid')
          .eq('auth_uid', user.id)
          .single();

        if (error) {
          console.error('Error fetching user profile:', error);
          
          if (error.code === 'PGRST116') {
            // User doesn't exist in public.users
            await supabase.auth.signOut();
            window.location.href = '/login?error=usuario_nao_encontrado';
            return;
          } else {
            // Other database errors
            console.error('❌ Database error:', error);
            await supabase.auth.signOut();
            window.location.href = '/login';
            return;
          }
        } else if (profile && mounted) {
          const normalizedRole = normalizeRole(profile.role);
          const modules = profile.modules || [];
          const needsContasModule =
            normalizedRole === 'admin' && !modules.includes('contas_a_pagar');

          if (needsContasModule) {
            const updatedModules = Array.from(new Set([...modules, 'contas_a_pagar']));
            const { error: updateError } = await supabase
              .from('users')
              .update({
                modules: updatedModules,
                updated_at: new Date().toISOString(),
              })
              .eq('id', profile.id);

            if (updateError) {
              console.error('Error updating user modules:', updateError);
            } else {
              profile.modules = updatedModules;
            }
          }

          const normalizedProfile = {
            ...profile,
            role: normalizedRole || profile.role,
          };

          setUserProfile(normalizedProfile);
        }
      } catch (error) {
        console.error('❌ Unexpected error fetching user profile:', error);
        if (mounted) {
          await supabase.auth.signOut();
          window.location.href = '/login';
        }
      } finally {
        if (mounted) {
          setLoadingProfile(false);
        }
      }
    };

    fetchUserProfile();

    return () => {
      mounted = false;
    };
  }, [user]);

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      // Clear any existing session first
      await supabase.auth.signOut();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        console.error('❌ Sign in error:', error);
        
        // Handle specific error cases
        if (error.message?.includes('Invalid login credentials')) {
          return { error: 'Email ou senha incorretos. Verifique suas credenciais.' };
        } else if (error.message?.includes('Email not confirmed')) {
          return { error: 'Email não confirmado. Verifique sua caixa de entrada.' };
        } else if (error.message?.includes('Too many requests')) {
          return { error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' };
        } else {
          return { error: `Erro de autenticação: ${error.message}` };
        }
      }

      if (!data.user) {
        return { error: 'Falha na autenticação. Tente novamente.' };
      }

      return {};
    } catch (error) {
      console.error('❌ Unexpected sign in error:', error);
      return { error: 'Erro inesperado ao fazer login. Tente novamente.' };
    }
  };

  const signOut = async () => {
    try {
      // Clear profile first
      setUserProfile(null);
      setLoadingProfile(false);
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Handle session-related errors gracefully
        if (error.message?.includes('Auth session missing!') || 
            error.message?.includes('Session from session_id claim in JWT does not exist')) {
          console.warn('⚠️ Session already expired or missing during sign out:', error.message);
        } else {
          console.error('❌ Sign out error:', error);
        }
      }
      
      // Clear state
      setUser(null);
    } catch (error) {
      console.error('❌ Unexpected sign out error:', error);
    }
  };

  const hasModuleAccess = (module: string): boolean => {
    if (!userProfile || !userProfile.is_active) {
      return false;
    }
    if (normalizeRole(userProfile.role) === 'owner') {
      return true;
    }
    return userProfile.modules?.includes(module) || false;
  };

  const isAdmin = (): boolean => {
    const role = normalizeRole(userProfile?.role);
    return (role === 'admin' || role === 'owner') && userProfile?.is_active === true;
  };

  const isOwner = (): boolean => {
    return normalizeRole(userProfile?.role) === 'owner' && userProfile?.is_active === true;
  };

  const isFinanceiro = (): boolean => {
    return normalizeRole(userProfile?.role) === 'financeiro' && userProfile?.is_active === true;
  };

  const isUsuario = (): boolean => {
    return normalizeRole(userProfile?.role) === 'usuario' && userProfile?.is_active === true;
  };

  const contextValue: AuthContextData = {
    user,
    userProfile,
    loading,
    loadingProfile,
    signIn,
    signOut,
    hasModuleAccess,
    isAdmin,
    isOwner,
    isFinanceiro,
    isUsuario,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
