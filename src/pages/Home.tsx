import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, MessageCircle, Image, Calendar, LogOut, Video } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const Home = () => {
  const [userName, setUserName] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", session.user.id)
      .single();

    if (profile) {
      setUserName(profile.display_name);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Goodbye! 👋",
      description: "You've been logged out successfully.",
    });
    navigate("/auth");
  };

  const features = [
    {
      title: "Chat",
      description: "Send messages in real-time",
      icon: MessageCircle,
      route: "/chat",
      gradient: "from-primary to-accent",
    },
    {
      title: "Gallery",
      description: "Share your precious moments",
      icon: Image,
      route: "/gallery",
      gradient: "from-accent to-primary",
    },
    {
      title: "Moments",
      description: "Your timeline together",
      icon: Calendar,
      route: "/moments",
      gradient: "from-primary to-soft-peach",
    },
    {
      title: "Video Call",
      description: "Connect face-to-face",
      icon: Video,
      route: "/video",
      gradient: "from-soft-peach to-primary",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/10 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-gradient-romantic p-6 rounded-full shadow-[var(--shadow-glow)] animate-scale-in">
              <Heart className="w-12 h-12 text-white" fill="white" />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-serif font-bold gradient-text">
            ForeverUs
          </h1>
          <p className="text-xl text-muted-foreground">
            Welcome back, {userName}! 💝
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="group cursor-pointer hover:shadow-[var(--shadow-soft)] transition-all duration-300 hover:scale-105 border-border/50 overflow-hidden animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => navigate(feature.route)}
              >
                <CardContent className="p-6 space-y-4">
                  <div className={`bg-gradient-to-br ${feature.gradient} p-4 rounded-2xl w-fit shadow-md group-hover:shadow-lg transition-all duration-300`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-serif font-semibold mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Logout Button */}
        <div className="flex justify-center pt-8">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="group hover:bg-destructive hover:text-destructive-foreground transition-all duration-300"
          >
            <LogOut className="w-4 h-4 mr-2 group-hover:animate-pulse" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Home;