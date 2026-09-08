import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import LoginModal from "../auth/LoginModal";
import { useAuth } from '../../context/AuthContext';
import Footer from "./Footer";
import Header from "./Header";

export default function MainLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  useEffect(() => {
    if (isAdmin && location.pathname !== '/admin') navigate('/admin', { replace: true });
  }, [isAdmin, location.pathname, navigate]);

  return (
    <div>
      <Header />
      <Outlet />
      {!isAdmin && <Footer />}
      <LoginModal />
    </div>
  );
}
