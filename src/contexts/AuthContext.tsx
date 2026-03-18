import React, { createContext, useContext, useEffect, useState } from 'react';
import { MODULE_PERMISSION_CACHE_KEY, supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { normalizeRole } from '../utils/roles';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'owner' | 'financeiro' | 'usuario';
  modules: string[];
  edit_modules: string[];
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
  hasModuleEditAccess: (module: string) => boolean;
  isAdmin: () => boolean;
  isOwner: () => boolean;
  isFinanceiro: () => boolean;
  isUsuario: () => boolean;
}

const AuthContext = createContext<AuthContextData | null>(null);

const persistModulePermissionCache = (profile: UserProfile | null) => {
  if (typeof window === 'undefined') return;

  try {
    if (!profile) {
      window.localStorage.removeItem(MODULE_PERMISSION_CACHE_KEY);
      return;
    }

    const payload = {
      role: normalizeRole(profile.role) || profile.role,
      modules: Array.isArray(profile.modules) ? profile.modules : [],
      edit_modules: Array.isArray(profile.edit_modules) ? profile.edit_modules : [],
      is_active: profile.is_active === true,
    };

    window.localStorage.setItem(MODULE_PERMISSION_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore local cache errors
  }
};

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
          persistModulePermissionCache(null);
        } else if (mounted) {
          setUser(session?.user ?? null);
          if (!session?.user) {
            persistModulePermissionCache(null);
          }
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error);
        // Clear potentially corrupted session
        try {
          await supabase.auth.signOut();
          persistModulePermissionCache(null);
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
            persistModulePermissionCache(null);
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
          persistModulePermissionCache(null);
        }
        return;
      }

      try {
        setLoadingProfile(true);

        let profile: UserProfile | null = null;
        let error: { code?: string; message?: string } | null = null;

        const withEditModules = await supabase
          .from('users')
          .select('id, email, name, role, modules, edit_modules, is_active, auth_uid')
          .eq('auth_uid', user.id)
          .single();

        if (
          withEditModules.error &&
          (withEditModules.error.code === '42703' ||
            withEditModules.error.message?.toLowerCase().includes('edit_modules'))
        ) {
          const legacyProfile = await supabase
            .from('users')
            .select('id, email, name, role, modules, is_active, auth_uid')
            .eq('auth_uid', user.id)
            .single();

          error = legacyProfile.error;
          profile = legacyProfile.data
            ? {
                ...legacyProfile.data,
                edit_modules: legacyProfile.data.modules || [],
              }
            : null;
        } else {
          error = withEditModules.error;
          profile = withEditModules.data as UserProfile | null;
        }

        if (error) {
          console.error('Error fetching user profile:', error);
          
          if (error.code === 'PGRST116') {
            // User doesn't exist in public.users
            await supabase.auth.signOut();
            persistModulePermissionCache(null);
            window.location.href = '/login?error=usuario_nao_encontrado';
            return;
          } else {
            // Other database errors
            console.error('❌ Database error:', error);
            await supabase.auth.signOut();
            persistModulePermissionCache(null);
            window.location.href = '/login';
            return;
          }
        } else if (profile && mounted) {
          const normalizedRole = normalizeRole(profile.role);
          const normalizedProfile = {
            ...profile,
            role: normalizedRole || profile.role,
            edit_modules: Array.isArray(profile.edit_modules) ? profile.edit_modules : profile.modules || [],
          };

          setUserProfile(normalizedProfile);
          persistModulePermissionCache(normalizedProfile);
        }
      } catch (error) {
        console.error('❌ Unexpected error fetching user profile:', error);
        if (mounted) {
          await supabase.auth.signOut();
          persistModulePermissionCache(null);
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
      persistModulePermissionCache(null);
      
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
      persistModulePermissionCache(null);
      
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
    const role = normalizeRole(userProfile.role);
    if (role === 'owner') {
      return true;
    }
    return userProfile.modules?.includes(module) || false;
  };

  const hasModuleEditAccess = (module: string): boolean => {
    if (!userProfile || !userProfile.is_active) {
      return false;
    }
    const role = normalizeRole(userProfile.role);
    if (role === 'owner') {
      return true;
    }
    const hasRead = userProfile.modules?.includes(module) || false;
    const hasEdit = userProfile.edit_modules?.includes(module) || false;
    return hasRead && hasEdit;
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
    hasModuleEditAccess,
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
