import { Outlet } from 'react-router-dom';
import LoginModal from '../auth/LoginModal';
import Footer from './Footer';
import Header from './Header';

export default function MainLayout() {
  return <><Header /><Outlet /><Footer /><LoginModal /></>;
}
