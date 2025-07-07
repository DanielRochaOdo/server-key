import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
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
        setUserProfile(data);
      }

      setLoadingProfile(false);
    };

    fetchProfile();
  }, [user]);

  const hasModuleAccess = (module) =>
    userProfile?.modules?.includes(module) || false;

  const isAdmin = () => userProfile?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{ user, userProfile, hasModuleAccess, isAdmin, loadingProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
