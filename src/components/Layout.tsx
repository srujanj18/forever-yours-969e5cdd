import Sidebar from "./Sidebar";
import BottomBar from "./BottomBar";
import { useLocation } from "react-router-dom";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  
  // Don't show sidebar on auth and accept-invitation pages
  const hideSidebarRoutes = ["/auth", "/accept-invitation"];
  const showSidebar = !hideSidebarRoutes.includes(location.pathname);

  return (
    <div className="flex">
      {showSidebar && <Sidebar />}
      <main className={`flex-1 w-full ${showSidebar ? "md:ml-72" : ""} pb-16 md:pb-0`}>
        {children}
      </main>
      {showSidebar && <BottomBar />}
    </div>
  );
};

export default Layout;
