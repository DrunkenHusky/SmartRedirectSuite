import React, { createContext, useContext, useState, useEffect } from 'react';

interface EditModeContextType {
  isEditMode: boolean;
  toggleEditMode: () => void;
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
}

const EditModeContext = createContext<EditModeContextType | undefined>(undefined);

export function EditModeProvider({ children }: { children: React.ReactNode }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Auto-disable edit mode if admin access is lost
  useEffect(() => {
    if (!isAdmin) {
      setIsEditMode(false);
    }
  }, [isAdmin]);

  const toggleEditMode = () => {
    if (isAdmin) {
      setIsEditMode(prev => !prev);
    }
  };

  return (
    <EditModeContext.Provider value={{ isEditMode, toggleEditMode, isAdmin, setIsAdmin }}>
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  const context = useContext(EditModeContext);
  if (context === undefined) {
    throw new Error('useEditMode must be used within an EditModeProvider');
  }
  return context;
}
