import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Mail, User, Heart, LogOut, Edit2, Save, X, Camera, Upload, Trash2, MoreVertical } from "lucide-react";

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

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarKey, setAvatarKey] = useState(0);

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
      setEditName(response.data.user.displayName);
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

  const handleSaveName = async () => {
    if (!editName.trim()) {
      toast({
        title: "Invalid Name",
        description: "Please enter a valid name",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Update display name in our backend
      const response = await api.put('/auth/profile', { displayName: editName.trim() });

      // Update local state with the response data
      setUser(response.data.user);
      setEditName(response.data.user.displayName);
      setIsEditing(false);

      // Store updated name in localStorage for other components
      localStorage.setItem('userDisplayName', response.data.user.displayName);

      toast({
        title: "Success! 💕",
        description: "Your name has been updated",
      });
    } catch (error) {
      console.error("Failed to update name:", error);
      toast({
        title: "Error",
        description: "Failed to update name",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Goodbye! 👋",
        description: "You've been logged out successfully.",
      });
      navigate("/auth");
    } catch (error) {
      console.error("Logout failed:", error);
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);

      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadAvatar = async () => {
    if (!selectedFile) return;

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', selectedFile);

      const response = await api.post('/auth/upload-avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Update user state with new avatar and add timestamp to prevent caching
      const updatedUser = {
        ...response.data.user,
        avatarUrl: response.data.user.avatarUrl ? `${response.data.user.avatarUrl}?t=${Date.now()}` : undefined
      };
      setUser(updatedUser);

      // Store updated avatar URL in localStorage for other components
      localStorage.setItem('userAvatarUrl', response.data.user.avatarUrl || '');

      // Clear selection and preview
      setSelectedFile(null);
      setPreviewUrl(null);

      toast({
        title: "Success! 📸",
        description: "Your profile picture has been updated",
      });
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCancelUpload = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="hover:bg-rose-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-rose-600">My Profile</h1>
          <div className="w-10" />
        </div>

        {/* Main Profile Card */}
        <Card className="mb-6 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-rose-500" />
              Your Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar className="w-20 h-20 md:w-24 md:h-24 border-4 border-rose-200">
                  <AvatarImage
                    key={avatarKey}
                    src={previewUrl || (user.avatarUrl ? `http://localhost:5000${user.avatarUrl.split('?')[0]}?t=${Date.now()}` : undefined)}
                  />
                  <AvatarFallback className="bg-gradient-to-br from-rose-400 to-pink-400 text-white text-lg md:text-xl font-bold">
                    {getInitials(user.displayName)}
                  </AvatarFallback>
                </Avatar>
                <label
                  htmlFor="avatar-upload"
                  className="absolute -bottom-1 -right-1 bg-rose-500 hover:bg-rose-600 text-white p-2 rounded-full cursor-pointer shadow-lg transition-colors"
                >
                  <Camera className="w-3 h-3 md:w-4 md:h-4" />
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Upload Controls */}
              {selectedFile && (
                <div className="flex gap-2 items-center">
                  <Button
                    size="sm"
                    onClick={handleUploadAvatar}
                    disabled={isUploadingAvatar}
                    className="bg-rose-500 hover:bg-rose-600 text-xs"
                  >
                    {isUploadingAvatar ? (
                      <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Upload className="w-3 h-3 mr-1" />
                    )}
                    {isUploadingAvatar ? "Uploading..." : "Upload"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelUpload}
                    disabled={isUploadingAvatar}
                    className="h-8 w-8 p-0"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}

              <p className="text-xs text-gray-500 text-center max-w-xs">
                Click the camera icon to change your profile picture (max 5MB).
              </p>
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <User className="w-4 h-4" />
                Display Name
              </label>
              {isEditing ? (
                <div className="flex gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter your name"
                    className="flex-1 text-sm"
                  />
                  <Button
                    size="icon"
                    onClick={handleSaveName}
                    disabled={isSaving}
                    className="bg-rose-500 hover:bg-rose-600 h-9 w-9"
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setEditName(user.displayName);
                    }}
                    className="h-9 w-9"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <p className="text-base md:text-lg font-medium text-gray-800">{user.displayName}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditing(true)}
                    className="text-rose-500 hover:text-rose-600"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </label>
              <p className="p-3 bg-gray-50 rounded-lg text-gray-800 text-sm md:text-base">{user.email}</p>
            </div>

            {/* Account Status */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Account Status</label>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800 font-medium">✅ Account Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Partner Section */}
        {user.partnerId ? (
          <Card className="mb-6 shadow-lg border-rose-200">
            <CardHeader className="pb-4 bg-gradient-to-r from-rose-50 to-pink-50">
              <CardTitle className="flex items-center gap-2 text-rose-600">
                <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
                Connected With
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Avatar className="w-16 h-16 border-4 border-rose-200">
                  <AvatarImage src={user.partnerId.avatarUrl ? `http://localhost:5000${user.partnerId.avatarUrl.split('?')[0]}?t=${Date.now()}` : undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-rose-400 to-pink-400 text-white text-lg font-bold">
                    {getInitials(user.customPartnerName || user.partnerId.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-lg font-bold text-gray-800">
                    {user.customPartnerName || user.partnerId.displayName}
                  </p>
                  <p className="text-sm text-gray-600">{user.partnerId.email}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-rose-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white"
                  onClick={() => navigate("/chat")}
                >
                  💬 Message
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-rose-200 hover:bg-rose-50"
                  onClick={() => navigate("/moments")}
                >
                  📅 View Timeline
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-6 shadow-lg border-amber-200">
            <CardHeader className="pb-4 bg-gradient-to-r from-amber-50 to-yellow-50">
              <CardTitle className="text-amber-600">💔 Not Connected</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-gray-600 mb-4">
                You're not connected with a partner yet. Go to the chat page to send an invitation!
              </p>
              <Button
                className="w-full bg-amber-500 hover:bg-amber-600"
                onClick={() => navigate("/chat")}
              >
                Send Invitation
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Links */}
        <Card className="mb-6 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="border-rose-200 hover:bg-rose-50"
              onClick={() => navigate("/gallery")}
            >
              📸 Gallery
            </Button>
            <Button
              variant="outline"
              className="border-rose-200 hover:bg-rose-50"
              onClick={() => navigate("/video")}
            >
              📹 Video Call
            </Button>
          </CardContent>
        </Card>

        {/* Logout Button */}
        <Button
          onClick={handleLogout}
          variant="destructive"
          className="w-full mb-8"
          size="lg"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
};

export default Profile;
