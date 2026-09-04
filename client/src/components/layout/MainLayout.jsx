import { Outlet, useLocation } from "react-router-dom";
import LoginModal from "../auth/LoginModal";
import Footer from "./Footer";
import Header from "./Header";

export default function MainLayout() {
  const { pathname } = useLocation();
  const isRoomStudio = pathname.replace(/\/+$/, "") === "/room-studio";

  return (
    <div className={isRoomStudio ? "studio-app-shell" : undefined}>
      <Header />
      <Outlet />
      {!isRoomStudio && <Footer />}
      <LoginModal />
    </div>
  );
}
