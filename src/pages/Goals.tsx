import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, ArrowLeft, Heart, Target, Edit, Trash2, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface Goal {
  _id: string;
  userId: string;
  title: string;
  description?: string;
  targetDate: string;
  isCompleted: boolean;
  createdAt: string;
}

const Goals = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadGoals();
      }
    });
    return () => unsubscribe();
  }, []);

  const loadGoals = async () => {
    try {
      const response = await api.get('/goals');
      setGoals(response.data.goals || []);
    } catch (error: any) {
      console.error('Failed to load goals:', error);
      toast({
        title: "Error",
        description: "Failed to load goals",
        variant: "destructive",
      });
    }
  };

  const handleCreateOrUpdate = async () => {
    if (!title || !targetDate) {
      toast({
        title: "Missing fields",
        description: "Please fill in title and target date",
        variant: "destructive",
      });
      return;
    }

    try {
      const goalData = {
        title,
        description,
        targetDate: new Date(targetDate).toISOString(),
      };

      if (editingGoal) {
        await api.put(`/goals/${editingGoal._id}`, goalData);
        toast({
          title: "Success! 🎉",
          description: "Goal updated successfully.",
        });
      } else {
        await api.post('/goals', goalData);
        toast({
          title: "Success! 🎉",
          description: "Goal added to your list.",
        });
      }

      setTitle("");
      setDescription("");
      setTargetDate("");
      setEditingGoal(null);
      loadGoals();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) {
      return;
    }

    try {
      await api.delete(`/goals/${goalId}`);
      toast({
        title: "Success!",
        description: "Goal deleted successfully.",
      });
      loadGoals();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleComplete = async (goal: Goal) => {
    try {
      await api.put(`/goals/${goal._id}`, {
        isCompleted: !goal.isCompleted,
      });
      toast({
        title: "Success!",
        description: `Goal marked as ${!goal.isCompleted ? 'complete' : 'incomplete'}.`,
      });
      loadGoals();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update goal status",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (goal: Goal) => {
    setEditingGoal(goal);
    setTitle(goal.title);
    setDescription(goal.description || "");
    setTargetDate(format(new Date(goal.targetDate), "yyyy-MM-dd"));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/10 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="hover:bg-secondary"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-serif font-bold gradient-text">Our Goals</h1>
              <p className="text-muted-foreground text-sm md:text-base">Achieve your dreams together</p>
            </div>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 shadow-[var(--shadow-soft)]" onClick={() => setEditingGoal(null)}>
                <Plus className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Add Goal</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">{editingGoal ? 'Edit Goal' : 'Create a Goal'}</DialogTitle>
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
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
                <Button
                  onClick={handleCreateOrUpdate}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {editingGoal ? 'Save Changes' : 'Create Goal'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          {goals.map((goal) => (
            <Card key={goal._id} className={`group hover:shadow-[var(--shadow-soft)] transition-all duration-300 animate-slide-up border-border/50 ${goal.isCompleted ? 'bg-green-50/50' : ''}`}>
              <CardContent className="p-4 md:p-6 flex items-start gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToggleComplete(goal)}
                  className={`h-8 w-8 md:h-10 md:w-10 rounded-full ${goal.isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
                >
                  {goal.isCompleted && <Check className="w-5 h-5" />}
                </Button>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className={`text-lg md:text-xl font-semibold ${goal.isCompleted ? 'line-through text-muted-foreground' : ''}`}>{goal.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        Target: {format(new Date(goal.targetDate), "MMMM dd, yyyy")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(goal)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(goal._id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                  {goal.description && <p className="text-sm text-muted-foreground">{goal.description}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {goals.length === 0 && (
          <div className="text-center py-20">
            <Target className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No goals yet. Start setting your goals together!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Goals;
