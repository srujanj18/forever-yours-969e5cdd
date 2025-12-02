import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Heart, Loader2 } from "lucide-react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [canSignUp, setCanSignUp] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUserLimit();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      navigate("/");
    }
  };

  const checkUserLimit = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "user_count")
      .single();

    if (data) {
      const count = parseInt(data.setting_value as string);
      setCanSignUp(count < 2);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Welcome back! 💕",
          description: "You've successfully logged in.",
        });

        navigate("/");
      } else {
        if (!canSignUp) {
          toast({
            title: "Registration Closed",
            description: "This app is only for two people. Registration is now closed.",
            variant: "destructive",
          });
          return;
        }

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (signUpError) throw signUpError;

        if (authData.user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              user_id: authData.user.id,
              display_name: displayName,
            });

          if (profileError) throw profileError;

          // Update user count
          const { data: settingsData } = await supabase
            .from("app_settings")
            .select("setting_value")
            .eq("setting_key", "user_count")
            .single();

          if (settingsData) {
            const currentCount = parseInt(settingsData.setting_value as string);
            await supabase
              .from("app_settings")
              .update({ setting_value: (currentCount + 1).toString() })
              .eq("setting_key", "user_count");
          }

          toast({
            title: "Welcome to ForeverUs! 💝",
            description: "Your account has been created successfully.",
          });

          navigate("/");
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-accent/10 p-4 animate-fade-in">
      <Card className="w-full max-w-md shadow-[var(--shadow-soft)] border-border/50 animate-scale-in">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-romantic p-4 rounded-full shadow-[var(--shadow-glow)]">
              <Heart className="w-8 h-8 text-white" fill="white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-serif gradient-text">
            ForeverUs
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {isLogin ? "Welcome back! 💕" : "Join your partner in love 💝"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Your Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Enter your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required={!isLogin}
                  className="transition-all duration-300 focus:ring-primary/50"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="transition-all duration-300 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="transition-all duration-300 focus:ring-primary/50"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || (!isLogin && !canSignUp)}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-[var(--shadow-soft)] transition-all duration-300 hover:scale-105"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Please wait...
                </>
              ) : isLogin ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              onClick={() => setIsLogin(!isLogin)}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin
                ? "Need an account? Sign up"
                : "Already have an account? Sign in"}
            </Button>
          </div>
          {!canSignUp && !isLogin && (
            <p className="text-sm text-center text-destructive mt-4">
              Registration is closed. This app is exclusively for two people.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;