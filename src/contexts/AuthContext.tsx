import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'financeiro' | 'usuario';
  modules: string[];
  is_active: boolean;
  auth_uid: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasModuleAccess: (module: string) => boolean;
  isAdmin: () => boolean;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingProfile = useRef(false);
  const mounted = useRef(true);

  const fetchUserProfile = async (authUser: User): Promise<UserProfile | null> => {
    if (fetchingProfile.current) return null;
    
    fetchingProfile.current = true;
    try {
      console.log('Fetching profile for user:', authUser.id);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_uid', authUser.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        
        // Se o usuário não existe na tabela users, tentar criar
        if (error.code === 'PGRST116') {
          console.log('User not found in users table, checking if it\'s the admin...');
          
          // Verificar se é o usuário admin padrão
          if (authUser.email === 'admin@serverkey.com') {
            console.log('Creating admin user profile...');
            const { data: newUser, error: insertError } = await supabase
              .from('users')
              .insert([{
                auth_uid: authUser.id,
                email: authUser.email,
                name: 'Administrador',
                role: 'admin',
                is_active: true,
                pass: 'admin123'
              }])
              .select()
              .single();

            if (insertError) {
              console.error('Error creating admin user:', insertError);
              return null;
            }
            
            return newUser as UserProfile;
          }
        }
        return null;
      }

      console.log('User profile fetched:', data);
      return data as UserProfile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    } finally {
      fetchingProfile.current = false;
    }
  };

  const refreshUserProfile = async () => {
    if (user && !fetchingProfile.current && mounted.current) {
      const profile = await fetchUserProfile(user);
      if (mounted.current) {
        setUserProfile(profile);
      }
    }
  };

  useEffect(() => {
    mounted.current = true;
    
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          return;
        }

        console.log('Initial session:', session?.user?.email || 'No user');

        if (mounted.current) {
          setUser(session?.user ?? null);
        }
        
        if (session?.user && mounted.current) {
          const profile = await fetchUserProfile(session.user);
          if (mounted.current) {
            setUserProfile(profile);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        if (mounted.current) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted.current) return;

        console.log('Auth state changed:', event, session?.user?.email || 'No user');
        
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const profile = await fetchUserProfile(session.user);
          if (mounted.current) {
            setUserProfile(profile);
          }
        } else {
          if (mounted.current) {
            setUserProfile(null);
          }
        }
        
        if (mounted.current) {
          setLoading(false);
        }
      }
    );

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error };
    } finally {
      // O loading será definido como false pelo onAuthStateChange
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      if (mounted.current) {
        setUserProfile(null);
      }
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  };

  const hasModuleAccess = (module: string): boolean => {
    if (!userProfile || !userProfile.is_active) return false;
    return userProfile.modules.includes(module);
  };

  const isAdmin = (): boolean => {
    return userProfile?.role === 'admin' && userProfile?.is_active === true;
  };

  const value = {
    user,
    userProfile,
    loading,
    signIn,
    signOut,
    hasModuleAccess,
    isAdmin,
    refreshUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};