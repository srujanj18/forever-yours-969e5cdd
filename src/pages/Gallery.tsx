import { useState, useEffect, useRef } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Image as ImageIcon, Trash2, ArrowLeft, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface MediaItem {
  _id: string;
  senderId: string;
  mediaUrl: string;
  mediaType: string;
  caption?: string;
  createdAt: string;
}

const Gallery = () => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedImage, setSelectedImage] = useState<MediaItem | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadMedia();
      }
    });
    return () => unsubscribe();
  }, []);

  const loadMedia = async () => {
    try {
      const response = await api.get('/gallery');
      setMedia(response.data.media || []);
    } catch (error: any) {
      console.error('Failed to load media:', error);
      toast({
        title: "Error",
        description: "Failed to load gallery",
        variant: "destructive",
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (caption) {
        formData.append('caption', caption);
      }

      const response = await api.post('/gallery/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast({
        title: "Success! 📸",
        description: "Your photo has been uploaded.",
      });

      setSelectedFile(null);
      setCaption("");
      loadMedia();
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

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/gallery/${id}`);

      toast({
        title: "Deleted",
        description: "Photo removed from gallery.",
      });

      loadMedia();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-rose-900/20 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="hover:bg-rose-100 dark:hover:bg-purple-900/50"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl md:text-5xl font-serif font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
                Our Gallery 📸
              </h1>
              <p className="text-rose-600 dark:text-pink-400 font-medium">
                Cherish your beautiful memories together
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <Upload className="w-5 h-5 mr-2" />
                Upload Photo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Upload Photo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedFile(file);
                      }
                    }}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    {selectedFile ? `Selected: ${selectedFile.name}` : "Choose File"}
                  </Button>
                </div>
                <Input
                  placeholder="Add a caption (optional)"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map((item) => (
            <Card
              key={item._id}
              className="group relative overflow-hidden hover:shadow-[var(--shadow-soft)] transition-all duration-300 hover:scale-105 animate-scale-in cursor-pointer"
              onClick={() => item.mediaType.startsWith("image/") && setSelectedImage(item)}
            >
              <div className="aspect-square overflow-hidden">
                {item.mediaType.startsWith("image/") ? (
                  <img
                    src={`http://localhost:5000${item.mediaUrl}`}
                    alt={item.caption || ""}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    src={`http://localhost:5000${item.mediaUrl}`}
                    className="w-full h-full object-cover"
                    controls
                  />
                )}
              </div>
              {item.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 text-sm">
                  {item.caption}
                </div>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Photo</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this photo? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(item._id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Card>
          ))}
        </div>

        {media.length === 0 && (
          <div className="text-center py-20">
            <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No photos yet. Start creating memories!</p>
          </div>
        )}
      </div>

      {/* Fullscreen Image Viewer */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
          <div className="relative w-full h-full flex items-center justify-center">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
            >
              <X className="w-8 h-8" />
            </button>

            <div className="flex flex-col items-center gap-4 max-w-4xl w-full">
              <img
                src={`http://localhost:5000${selectedImage.mediaUrl}`}
                alt={selectedImage.caption || ""}
                className="max-h-[80vh] max-w-full object-contain"
              />
              {selectedImage.caption && (
                <p className="text-white text-center text-lg">{selectedImage.caption}</p>
              )}
              <p className="text-gray-400 text-sm">
                {format(new Date(selectedImage.createdAt), "MMM d, yyyy")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;