import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { api } from "@/lib/api";
import { Heart, MessageCircle, Image, Calendar, Video } from "lucide-react";

interface Feature {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  gradient: string;
}

const Home = () => {
  const [userName, setUserName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/auth");
        return;
      }

      try {
        const response = await api.get('/auth/profile');
        setUserName(response.data.user.displayName || response.data.user.email);
      } catch (error) {
        console.error('Failed to load profile:', error);
        setUserName(user.displayName || user.email?.split('@')[0] || 'Love');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const features = [
    {
      title: "Chat",
      description: "Whisper sweet nothings to your love 💕",
      icon: MessageCircle,
      route: "/chat",
      gradient: "from-rose-400 to-pink-500",
    },
    {
      title: "Gallery",
      description: "Cherish your beautiful memories together 📸",
      icon: Image,
      route: "/gallery",
      gradient: "from-pink-400 to-rose-500",
    },
    {
      title: "Moments",
      description: "Relive your journey of love 📅",
      icon: Calendar,
      route: "/moments",
      gradient: "from-purple-400 to-pink-500",
    },
    {
      title: "Video Call",
      description: "See each other's smiles face-to-face 📹",
      icon: Video,
      route: "/video",
      gradient: "from-pink-500 to-purple-500",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-rose-900/20 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome Header */}
        <div className="text-center space-y-4 animate-fade-in">
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 bg-clip-text text-transparent leading-tight">
              Welcome back, {userName}! 💕
            </h1>
            <p className="text-md sm:text-lg text-rose-600 dark:text-pink-400 font-medium">
              Let's create more beautiful memories together
            </p>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group cursor-pointer"
                onClick={() => navigate(feature.route)}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="h-full bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 hover:-translate-y-1 border-2 border-rose-100 dark:border-purple-700 hover:border-rose-300 dark:hover:border-purple-600 overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br opacity-10 rounded-full blur-3xl" style={{ background: `linear-gradient(135deg, var(--color-${feature.gradient}))` }}></div>
                  
                  <div className="relative space-y-3">
                    <div className={`bg-gradient-to-br ${feature.gradient} p-3 rounded-2xl w-fit shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    
                    <div className="space-y-1">
                      <h3 className="text-xl font-serif font-bold text-gray-800 dark:text-white group-hover:text-rose-600 dark:group-hover:text-pink-400 transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors leading-relaxed">
                        {feature.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-rose-500 font-semibold opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-300 pt-2">
                      <span>Explore</span>
                      <Heart className="w-4 h-4" fill="currentColor" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-8">
          <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all">
            <div className="text-2xl font-bold">∞</div>
            <p className="text-xs opacity-90 mt-1">Memories Together</p>
          </div>
          <div className="bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all">
            <div className="text-2xl font-bold">24/7</div>
            <p className="text-xs opacity-90 mt-1">Always Connected</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-rose-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all col-span-2 md:col-span-1">
            <div className="text-2xl font-bold">❤️</div>
            <p className="text-xs opacity-90 mt-1">Forever Yours</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;