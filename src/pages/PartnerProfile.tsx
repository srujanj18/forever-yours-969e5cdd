import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Mail, User, Heart, MessageCircle, Calendar, Image, Edit2, Save, X } from "lucide-react";

interface UserProfile {
  _id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  customPartnerName?: string;
  partnerId?: {
    _id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
}

const PartnerProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingPartnerName, setIsEditingPartnerName] = useState(false);
  const [customPartnerName, setCustomPartnerName] = useState("");
  const [isSavingPartnerName, setIsSavingPartnerName] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (!authUser) {
        navigate("/auth");
      } else {
        loadProfile();
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const loadProfile = async () => {
    try {
      const response = await api.get("/auth/profile");
      // Add timestamp to avatar URLs to prevent caching issues
      const userWithTimestamp = {
        ...response.data.user,
        avatarUrl: response.data.user.avatarUrl ? `${response.data.user.avatarUrl}?t=${Date.now()}` : undefined,
        partnerId: response.data.user.partnerId ? {
          ...response.data.user.partnerId,
          avatarUrl: response.data.user.partnerId.avatarUrl ? `${response.data.user.partnerId.avatarUrl}?t=${Date.now()}` : undefined
        } : undefined
      };
      setUser(userWithTimestamp);
    } catch (error) {
      console.error("Failed to load profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSaveCustomPartnerName = async () => {
    if (!customPartnerName.trim()) {
      toast({
        title: "Invalid Name",
        description: "Please enter a valid name",
        variant: "destructive",
      });
      return;
    }

    setIsSavingPartnerName(true);
    try {
      const response = await api.put('/auth/custom-partner-name', {
        customPartnerName: customPartnerName.trim()
      });

      setUser(response.data.user);
      setIsEditingPartnerName(false);

      toast({
        title: "Success! 💕",
        description: "Your custom name for your partner has been updated",
      });
    } catch (error) {
      console.error("Failed to update custom partner name:", error);
      toast({
        title: "Error",
        description: "Failed to update custom partner name",
        variant: "destructive",
      });
    } finally {
      setIsSavingPartnerName(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 flex items-center justify-center">
        <div className="animate-spin">
          <Heart className="w-12 h-12 text-rose-500 fill-rose-500" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 mb-4">Failed to load profile</p>
            <Button onClick={() => navigate("/")} className="w-full">
              Go Back Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user.partnerId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 mb-4">You don't have a partner connected yet</p>
            <Button onClick={() => navigate("/chat")} className="w-full">
              Connect with Partner
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/chat")}
            className="hover:bg-rose-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-rose-600">
            {user.customPartnerName ? `${user.customPartnerName}'s Profile` : `${user.partnerId.displayName}'s Profile`}
          </h1>
          <div className="w-10" />
        </div>

        {/* Partner Profile Card */}
        <Card className="mb-6 shadow-lg border-rose-200">
          <CardHeader className="pb-4 bg-gradient-to-r from-rose-50 to-pink-50">
            <CardTitle className="flex items-center gap-2 text-rose-600">
              <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
              Your Partner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-3">
              <Avatar className="w-24 h-24 md:w-28 md:h-28 border-4 border-rose-200">
                <AvatarImage src={user.partnerId.avatarUrl ? `http://localhost:5000${user.partnerId.avatarUrl.split('?')[0]}?t=${Date.now()}` : undefined} />
                <AvatarFallback className="bg-gradient-to-br from-rose-400 to-pink-400 text-white text-xl md:text-2xl font-bold">
                  {getInitials(user.customPartnerName || user.partnerId.displayName)}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <User className="w-4 h-4" />
                Name
              </label>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-lg md:text-xl font-medium text-gray-800">{user.partnerId.displayName}</p>
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </label>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-800 text-sm md:text-base">{user.partnerId.email}</p>
              </div>
            </div>

            {/* Connection Status */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Connection Status</label>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800 font-medium">💕 Connected & In Love</p>
              </div>
            </div>

            {/* Custom Partner Name */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Your Custom Name for {user.partnerId.displayName}
              </label>
              {!isEditingPartnerName ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-3 bg-gray-50 rounded-lg">
                    <p className="text-lg md:text-xl font-medium text-gray-800">
                      {user.customPartnerName || "No custom name set"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setCustomPartnerName(user.customPartnerName || "");
                      setIsEditingPartnerName(true);
                    }}
                    className="hover:bg-rose-50 border-rose-200"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    value={customPartnerName}
                    onChange={(e) => setCustomPartnerName(e.target.value)}
                    placeholder="Enter a custom name for your partner"
                    className="flex-1"
                    disabled={isSavingPartnerName}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSaveCustomPartnerName}
                    disabled={isSavingPartnerName}
                    className="hover:bg-green-50 border-green-200"
                  >
                    {isSavingPartnerName ? (
                      <div className="animate-spin w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setIsEditingPartnerName(false);
                      setCustomPartnerName("");
                    }}
                    disabled={isSavingPartnerName}
                    className="hover:bg-red-50 border-red-200"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-gray-500">
                This is how you'll see your partner referred to throughout the app. Only you can see this name.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="mb-6 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              className="w-full bg-rose-500 hover:bg-rose-600 text-white"
              onClick={() => navigate("/chat")}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Send Message
            </Button>
            <Button
              variant="outline"
              className="w-full border-rose-200 hover:bg-rose-50"
              onClick={() => navigate("/moments")}
            >
              <Calendar className="w-4 h-4 mr-2" />
              View Timeline
            </Button>
            <Button
              variant="outline"
              className="w-full border-rose-200 hover:bg-rose-50"
              onClick={() => navigate("/gallery")}
            >
              <Image className="w-4 h-4 mr-2" />
              Shared Photos
            </Button>
            <Button
              variant="outline"
              className="w-full border-rose-200 hover:bg-rose-50"
              onClick={() => navigate("/video")}
            >
              📹 Video Call
            </Button>
          </CardContent>
        </Card>

        {/* Love Message */}
        <Card className="shadow-lg border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50">
          <CardContent className="pt-6 text-center">
            <Heart className="w-8 h-8 text-rose-500 fill-rose-500 mx-auto mb-3" />
            <p className="text-rose-700 font-medium">
              Every moment with {user.customPartnerName || user.partnerId.displayName} is a treasure 💕
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PartnerProfile;
