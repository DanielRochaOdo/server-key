import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PersistenceState {
  [key: string]: any;
}

interface PersistenceContextData {
  getState: (key: string) => any;
  setState: (key: string, value: any) => void;
  clearState: (key: string) => void;
  clearAllStates: () => void;
}

const PersistenceContext = createContext<PersistenceContextData | null>(null);

export const PersistenceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PersistenceState>({});

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('app-persistence-state');
    if (savedState) {
      try {
        setState(JSON.parse(savedState));
      } catch (error) {
        console.error('Error loading persistence state:', error);
      }
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('app-persistence-state', JSON.stringify(state));
  }, [state]);

  const getState = (key: string) => {
    return state[key];
  };

  const setStateValue = (key: string, value: any) => {
    setState(prev => ({ ...prev, [key]: value }));
  };

  const clearState = (key: string) => {
    setState(prev => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  };

  const clearAllStates = () => {
    setState({});
    localStorage.removeItem('app-persistence-state');
  };

  return (
    <PersistenceContext.Provider value={{
      getState,
      setState: setStateValue,
      clearState,
      clearAllStates
    }}>
      {children}
    </PersistenceContext.Provider>
  );
};

export const usePersistence = () => {
  const context = useContext(PersistenceContext);
  if (!context) {
    throw new Error('usePersistence must be used within a PersistenceProvider');
  }
  return context;
};