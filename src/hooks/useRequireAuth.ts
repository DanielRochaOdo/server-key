import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const useRequireAuth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect if we're done loading and there's no user
    if (!loading && !user) {
      console.log('🔒 No authenticated user, redirecting to login');
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  return { user, loading };
};