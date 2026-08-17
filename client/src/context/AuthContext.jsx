import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);
const STORAGE_KEY = 'furneehome-demo-user';

function readUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);
  const [isLoginOpen, setLoginOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const value = useMemo(() => ({
    user,
    isLoginOpen,
    authMode,
    openLogin(mode = 'login') {
      setAuthMode(mode);
      setLoginOpen(true);
    },
    openRegister() {
      setAuthMode('register');
      setLoginOpen(true);
    },
    switchAuthMode(mode) {
      setAuthMode(mode);
    },
    closeLogin: () => setLoginOpen(false),
    login(credentials) {
      const isAdmin = credentials.email.trim().toLowerCase() === 'admin@furneehome.vn'
        && credentials.password === 'admin123';
      const nextUser = {
        name: isAdmin ? 'Quản trị viên' : credentials.email.split('@')[0] || 'Khách hàng',
        email: credentials.email,
        role: isAdmin ? 'admin' : 'customer',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
      setLoginOpen(false);
      return nextUser;
    },
    register(profile) {
      const nextUser = {
        name: profile.name.trim() || profile.email.split('@')[0],
        email: profile.email,
        role: 'customer',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
      setLoginOpen(false);
      return nextUser;
    },
    loginDemo(role) {
      const nextUser = role === 'admin'
        ? { name: 'Quản trị viên', email: 'admin@furneehome.vn', role: 'admin' }
        : { name: 'Khách hàng dùng thử', email: 'customer@furneehome.vn', role: 'customer' };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
      setLoginOpen(false);
    },
    logout() {
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
    },
  }), [user, isLoginOpen, authMode]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
