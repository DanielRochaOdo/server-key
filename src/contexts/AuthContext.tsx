import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface UserProfile {
  id: string;
  name: string;
  role: string;
  modules: string[];
  is_active: boolean;
}

interface AuthContextData {
  user: any | null;
  userProfile: UserProfile | null;
  loadingProfile: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  hasModuleAccess: (module: string) => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextData | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    console.log('🔐 Initializing auth...');
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
    };
    init();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('⚡ Auth state changed:', event, session?.user?.email || null);
      setUser(session?.user ?? null);
    });

    return () => authListener?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setUserProfile(null);
        setLoadingProfile(false);
        return;
      }

      setLoadingProfile(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_uid', user.id)
        .single();

      if (error) {
        console.warn('❌ Failed to load user profile:', error.message);
        setUserProfile(null);
      } else {
        console.log('✅ User profile loaded:', data);
        setUserProfile(data);
      }

      setLoadingProfile(false);
    };

    fetchProfile();
  }, [user]);

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
  };

  const hasModuleAccess = (module: string) =>
    userProfile?.modules?.includes(module) ?? false;

  const isAdmin = () => userProfile?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loadingProfile,
        signIn,
        signOut,
        hasModuleAccess,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
