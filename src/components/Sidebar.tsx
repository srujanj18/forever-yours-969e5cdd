import { useNavigate, useLocation } from "react-router-dom";
import { Heart, MessageCircle, Image, Calendar, LogOut, Video, User, Home, Target } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  color: string;
}

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [userName, setUserName] = useState("Love");

  useEffect(() => {
    const loadUserName = async () => {
      try {
        const storedName = localStorage.getItem('userDisplayName');
        if (storedName) {
          setUserName(storedName);
        } else {
          const response = await api.get('/auth/profile');
          setUserName(response.data.user.displayName || "Love");
        }
      } catch (error) {
        console.log('Failed to load user name');
      }
    };
    loadUserName();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'userDisplayName' && e.newValue) {
        setUserName(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const navItems: NavItem[] = [
    { label: "Home", icon: Home, route: "/", color: "from-blue-400 to-blue-600" },
    { label: "Chat", icon: MessageCircle, route: "/chat", color: "from-rose-400 to-pink-600" },
    { label: "Gallery", icon: Image, route: "/gallery", color: "from-pink-400 to-rose-600" },
    { label: "Moments", icon: Calendar, route: "/moments", color: "from-purple-400 to-pink-600" },
    { label: "Video Call", icon: Video, route: "/video", color: "from-pink-500 to-purple-600" },
    { label: "Goals", icon: Target, route: "/goals", color: "from-green-400 to-teal-500" },
  ];

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Goodbye! 👋",
        description: "You've been logged out successfully.",
      });
      navigate("/auth");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isActive = (route: string) => location.pathname === route;

  return (
    <div className="hidden md:block fixed left-0 top-0 h-screen w-72 bg-gradient-to-b from-rose-50 via-pink-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border-r-2 border-rose-200 dark:border-purple-700 shadow-2xl">
      <div className="p-8 border-b-2 border-rose-200 dark:border-purple-700 space-y-4">
        <div className="flex items-center justify-center">
          <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-4 rounded-full shadow-lg">
            <Heart className="w-8 h-8 text-white animate-pulse" fill="white" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-serif font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
            ForeverUs
          </h1>
          <p className="text-sm text-rose-600 dark:text-pink-400 font-medium">
            {userName}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-3 mt-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.route);
          return (
            <button
              key={item.route}
              onClick={() => navigate(item.route)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-semibold transition-all duration-300 group ${
                active
                  ? `bg-gradient-to-r ${item.color} text-white shadow-lg scale-105`
                  : "text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50 hover:scale-102"
              }`}
            >
              <Icon className={`w-6 h-6 ${active ? "animate-pulse" : "group-hover:animate-bounce"}`} />
              <span>{item.label}</span>
              {active && <Heart className="w-4 h-4 ml-auto" fill="white" />}
            </button>
          );
        })}
      </nav>

      <div className="border-t-2 border-rose-200 dark:border-purple-700 p-4 space-y-3">
        <Button
          onClick={() => navigate("/profile")}
          className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
        >
          <User className="w-5 h-5 mr-2" />
          Profile
        </Button>
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full border-2 border-rose-300 dark:border-purple-600 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-gray-700 font-semibold rounded-xl transition-all hover:scale-105"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
