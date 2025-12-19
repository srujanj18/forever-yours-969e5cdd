import { useNavigate, useLocation } from "react-router-dom";
import { Heart, MessageCircle, Image, Calendar, Video, Home, Target } from "lucide-react";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
}

const BottomBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    { label: "Home", icon: Home, route: "/" },
    { label: "Chat", icon: MessageCircle, route: "/chat" },
    { label: "Gallery", icon: Image, route: "/gallery" },
    { label: "Moments", icon: Calendar, route: "/moments" },
    { label: "Video", icon: Video, route: "/video" },
    { label: "Goals", icon: Target, route: "/goals" },
  ];

  const isActive = (route: string) => location.pathname === route;

  return (
    <div className="md:hidden fixed bottom-0 left-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around items-center p-2 z-40">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.route);
        return (
          <button
            key={item.route}
            onClick={() => navigate(item.route)}
            className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all duration-300 ${
              active ? "text-rose-500" : "text-gray-500 dark:text-gray-400"
            }`}
          >
            <Icon className={`w-6 h-6 ${active ? "animate-pulse" : ""}`} />
            <span className="text-xs font-semibold">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default BottomBar;
