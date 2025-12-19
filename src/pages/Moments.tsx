import { useState, useEffect, useRef } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, ArrowLeft, Heart, Calendar, Upload, X, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface Moment {
  _id: string;
  senderId: string;
  title: string;
  description?: string;
  mediaUrl?: string;
  mediaType?: string;
  date: string;
  createdAt: string;
}

const Moments = () => {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const response = await api.get('/auth/profile');
          setCurrentUserId(response.data.user._id);
        } catch (error) {
          console.error('Failed to load user profile:', error);
        }
        loadMoments();
      }
    });
    return () => unsubscribe();
  }, []);

  const loadMoments = async () => {
    try {
      const response = await api.get('/moments');
      setMoments(response.data.moments || []);
    } catch (error: any) {
      console.error('Failed to load moments:', error);
      toast({
        title: "Error",
        description: "Failed to load moments",
        variant: "destructive",
      });
    }
  };

  const handleCreate = async () => {
    if (!title || !date) {
      toast({
        title: "Missing fields",
        description: "Please fill in title and date",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description || '');
      formData.append('date', new Date(date).toISOString());

      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      await api.post('/moments', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast({
        title: "Success! 🎉",
        description: "Moment added to your timeline.",
      });

      setTitle("");
      setDescription("");
      setDate("");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      loadMoments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (momentId: string) => {
    if (!confirm('Are you sure you want to delete this moment? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/moments/${momentId}`);

      toast({
        title: "Success!",
        description: "Moment deleted successfully.",
      });

      loadMoments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/10 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="hover:bg-secondary"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-serif font-bold gradient-text">Our Moments</h1>
              <p className="text-muted-foreground">Your journey together</p>
            </div>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 shadow-[var(--shadow-soft)]">
                <Plus className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Add Moment</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Create a Moment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />

                {/* File Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Add Photo/Video (optional)</label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {selectedFile ? selectedFile.name : "Choose File"}
                    </Button>
                    {selectedFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedFile(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {selectedFile && (
                    <p className="text-xs text-muted-foreground">
                      {selectedFile.type.startsWith('image/') ? '📸 Image' : '🎥 Video'} selected
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleCreate}
                  disabled={uploading}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {uploading ? "Creating..." : "Create Moment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-6 relative">
          {/* Timeline line */}
          <div className="absolute left-4 md:left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-accent to-transparent" />

          {moments.map((moment, index) => (
            <Card
              key={moment._id}
              className="ml-10 md:ml-20 group hover:shadow-[var(--shadow-soft)] transition-all duration-300 animate-slide-up border-border/50"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-4 md:p-6 relative">
                {/* Timeline dot */}
                <div className="absolute -left-8 md:-left-[4.5rem] top-8 w-8 h-8 md:w-10 md:h-10 bg-gradient-romantic rounded-full flex items-center justify-center shadow-[var(--shadow-glow)]">
                  <Heart className="w-4 h-4 md:w-5 md:h-5 text-white" fill="white" />
                </div>

                {/* Delete Button - Only show for moments created by current user */}
                {currentUserId === moment.senderId && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 md:h-9 md:w-9 hover:bg-destructive/90 transition-colors shadow-md"
                    onClick={() => handleDelete(moment._id)}
                    title="Delete moment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(moment.date), "MMMM dd, yyyy")}
                  </div>

                  {/* Media Display */}
                  {moment.mediaUrl && (
                    <div className="rounded-lg overflow-hidden border border-border/50">
                      {moment.mediaType?.startsWith('image/') ? (
                        <img
                          src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${moment.mediaUrl}`}
                          alt={moment.title}
                          className="w-full h-40 md:h-48 object-cover"
                        />
                      ) : moment.mediaType?.startsWith('video/') ? (
                        <video
                          src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${moment.mediaUrl}`}
                          controls
                          className="w-full h-40 md:h-48 object-cover"
                        />
                      ) : null}
                    </div>
                  )}

                  <div className="space-y-1">
                    <h3 className="text-xl md:text-2xl font-serif font-semibold">
                      {moment.title}
                    </h3>
                    {moment.description && (
                      <p className="text-sm md:text-base text-muted-foreground">{moment.description}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {moments.length === 0 && (
          <div className="text-center py-20">
            <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No moments yet. Start documenting your journey!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Moments;