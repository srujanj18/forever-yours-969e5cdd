import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, ArrowLeft, Heart, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface Moment {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  date: string;
  image_url?: string;
  created_at: string;
}

const Moments = () => {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadMoments();
  }, []);

  const loadMoments = async () => {
    const { data, error } = await supabase
      .from("moments")
      .select("*")
      .order("date", { ascending: false });

    if (data) {
      setMoments(data);
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

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("moments").insert({
        user_id: user.id,
        title,
        description: description || null,
        date: new Date(date).toISOString(),
      });

      if (error) throw error;

      toast({
        title: "Success! 🎉",
        description: "Moment added to your timeline.",
      });

      setTitle("");
      setDescription("");
      setDate("");
      loadMoments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
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
                <Plus className="w-4 h-4 mr-2" />
                Add Moment
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
                <Button
                  onClick={handleCreate}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  Create Moment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-6 relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-accent to-transparent" />

          {moments.map((moment, index) => (
            <Card
              key={moment.id}
              className="ml-20 hover:shadow-[var(--shadow-soft)] transition-all duration-300 animate-slide-up border-border/50"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-6 relative">
                {/* Timeline dot */}
                <div className="absolute -left-[4.5rem] top-8 w-10 h-10 bg-gradient-romantic rounded-full flex items-center justify-center shadow-[var(--shadow-glow)]">
                  <Heart className="w-5 h-5 text-white" fill="white" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(moment.date), "MMMM dd, yyyy")}
                  </div>
                  <h3 className="text-2xl font-serif font-semibold">
                    {moment.title}
                  </h3>
                  {moment.description && (
                    <p className="text-muted-foreground">{moment.description}</p>
                  )}
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