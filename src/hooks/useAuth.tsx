import { useState, useEffect, createContext, useContext } from "react";
import { AuthState } from "@/types/database";
import { authenticate, isAuthenticated, setAuthenticated, signOut as authSignOut } from "@/lib/auth";

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  signIn: (password: string) => Promise<boolean>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [authenticated, setAuthenticatedState] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication state on mount
    const authState = isAuthenticated();
    setAuthenticatedState(authState);
    setLoading(false);
  }, []);

  const signIn = async (password: string): Promise<boolean> => {
    const isValid = await authenticate(password);
    if (isValid) {
      setAuthenticated(true);
      setAuthenticatedState(true);
    }
    return isValid;
  };

  const signOut = () => {
    authSignOut();
    setAuthenticatedState(false);
    window.location.href = "/auth";
  };

  const value = {
    isAuthenticated: authenticated,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
