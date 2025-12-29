import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, VolunteerProfile, UserRole } from '@/types';
import { mockUsers, mockVolunteers } from '@/data/mockData';

interface AuthContextType {
  user: User | VolunteerProfile | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | VolunteerProfile | null>(null);

  const login = useCallback(async (email: string, _password: string): Promise<boolean> => {
    // Mock authentication - in real app, this would call an API
    const allUsers = [...mockUsers, ...mockVolunteers];
    const foundUser = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (foundUser) {
      setUser(foundUser);
      return true;
    }
    
    // For demo: allow any email to login as volunteer
    if (email.includes('@')) {
      setUser(mockVolunteers[0]);
      return true;
    }
    
    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const switchRole = useCallback((role: UserRole) => {
    // For demo purposes - switch between user types
    switch (role) {
      case 'admin':
        setUser(mockUsers[0]);
        break;
      case 'supervisor':
        setUser(mockUsers[1]);
        break;
      case 'committee_leader':
        // Use the committee leader user (index 4 in mockUsers)
        setUser(mockUsers[4]);
        break;
      case 'volunteer':
      default:
        setUser(mockVolunteers[0]);
        break;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, switchRole }}>
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
