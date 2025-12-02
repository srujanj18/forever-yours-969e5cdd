import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Video, Phone, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const VideoCall = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleStartCall = () => {
    toast({
      title: "Video calling coming soon! 📹",
      description: "We're integrating video calling with Daily.co. Stay tuned!",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/10 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
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
            <h1 className="text-3xl font-serif font-bold gradient-text">Video Call</h1>
            <p className="text-muted-foreground">Connect face-to-face with your partner</p>
          </div>
        </div>

        <Card className="shadow-[var(--shadow-soft)] border-border/50 animate-scale-in">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-romantic p-6 rounded-full shadow-[var(--shadow-glow)]">
                <Video className="w-12 h-12 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-serif">Video Calling</CardTitle>
            <CardDescription>
              High-quality video calls powered by Daily.co
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-secondary/50 p-6 rounded-lg border border-border space-y-4">
              <h3 className="font-semibold text-lg">Features:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  HD video quality
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  Crystal clear audio
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  Screen sharing capability
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  Camera and microphone controls
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  Works on all devices
                </li>
              </ul>
            </div>

            <Button
              onClick={handleStartCall}
              className="w-full bg-primary hover:bg-primary/90 shadow-[var(--shadow-soft)] transition-all duration-300 hover:scale-105 h-14 text-lg"
            >
              <Phone className="w-5 h-5 mr-2" />
              Start Video Call
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              <p>Video calling will be integrated with Daily.co</p>
              <a
                href="https://daily.co"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1 mt-2"
              >
                Learn more about Daily.co
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-soft)] border-border/50">
          <CardHeader>
            <CardTitle className="font-serif">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Step 1:</strong> Click "Start Video Call" to create a room
            </p>
            <p>
              <strong className="text-foreground">Step 2:</strong> Share the room link with your partner
            </p>
            <p>
              <strong className="text-foreground">Step 3:</strong> Both join the room and start your call
            </p>
            <p className="pt-4 border-t border-border">
              All calls are end-to-end encrypted and completely private between you two.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VideoCall;