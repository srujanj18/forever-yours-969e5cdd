import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Send, Image as ImageIcon, Mic, Heart } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  is_read: boolean;
  created_at: string;
}

interface Profile {
  user_id: string;
  display_name: string;
  avatar_url?: string;
}

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    getCurrentUser();
    loadMessages();
    loadProfiles();
    subscribeToMessages();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser(user.id);
    }
  };

  const loadProfiles = async () => {
    const { data, error } = await supabase.from("profiles").select("*");
    if (data) {
      const profileMap = data.reduce((acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {} as Record<string, Profile>);
      setProfiles(profileMap);
    }
  };

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });

    if (data) {
      setMessages(data);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMessages((prev) => [...prev, payload.new as Message]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    const { error } = await supabase.from("messages").insert({
      sender_id: currentUser,
      content: newMessage,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
      return;
    }

    setNewMessage("");
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-romantic p-2 rounded-full">
            <Heart className="w-5 h-5 text-white" fill="white" />
          </div>
          <div>
            <h1 className="text-xl font-serif font-semibold">Our Chat</h1>
            <p className="text-sm text-muted-foreground">
              {Object.keys(profiles).length === 2 ? "Together forever 💕" : "Waiting for partner..."}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isOwnMessage = message.sender_id === currentUser;
          const profile = profiles[message.sender_id];

          return (
            <div
              key={message.id}
              className={`flex items-end gap-2 animate-slide-up ${
                isOwnMessage ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <Avatar className="w-8 h-8 border-2 border-primary/20">
                <AvatarFallback className="bg-gradient-romantic text-white text-xs">
                  {profile ? getInitials(profile.display_name) : "?"}
                </AvatarFallback>
              </Avatar>
              <div
                className={`max-w-[70%] ${
                  isOwnMessage ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-2 shadow-sm ${
                    isOwnMessage
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-card-foreground border border-border"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1 px-2">
                  {format(new Date(message.created_at), "HH:mm")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 bg-card">
        <form onSubmit={sendMessage} className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 hover:bg-secondary transition-colors"
          >
            <ImageIcon className="w-5 h-5" />
          </Button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 transition-all duration-300 focus:ring-primary/50"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!newMessage.trim()}
            className="shrink-0 bg-primary hover:bg-primary/90 transition-all duration-300 hover:scale-105"
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat;