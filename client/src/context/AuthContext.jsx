import { createContext, useContext, useState } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);
const USER_KEY = 'furneehome-user';
const TOKEN_KEY = 'accessToken';

function readUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || 'Không thể kết nối đến máy chủ.';
}

function saveSession(session) {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);
  const [isLoginOpen, setLoginOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const login = async (credentials) => {
    try {
      const session = await authService.login(credentials);
      saveSession(session);
      setUser(session.user);
      setLoginOpen(false);
      return session.user;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const register = async (profile) => {
    try {
      const session = await authService.register({
        name: profile.name,
        email: profile.email,
        password: profile.password,
      });
      saveSession(session);
      setUser(session.user);
      setLoginOpen(false);
      return session.user;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  const value = {
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
    switchAuthMode: setAuthMode,
    closeLogin: () => setLoginOpen(false),
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
