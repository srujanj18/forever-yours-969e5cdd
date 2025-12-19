import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useToast } from "@/components/ui/use-toast";

interface IncomingCall {
  fromUserId: string;
  fromUserName: string;
  offer: any;
  callType?: 'voice' | 'video';
}

interface CallContextType {
  socket: Socket | null;
  isConnected: boolean;
  incomingCall: IncomingCall | null;
  isCallActive: boolean;
  partnerStatus: 'online' | 'offline' | 'inactive';
  acceptCall: (answer: any) => void;
  rejectCall: (fromUserId: string) => void;
  initiateCall: (toUserId: string, offer: any, callType?: 'voice' | 'video') => void;
  endCall: (toUserId: string) => void;
  sendOffer: (toUserId: string, offer: any) => void;
  sendAnswer: (toUserId: string, answer: any) => void;
  sendIceCandidate: (toUserId: string, candidate: any) => void;
  clearIncomingCall: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<'online' | 'offline' | 'inactive'>('offline');
  const { toast } = useToast();
  const userIdRef = useRef<string>("");

  useEffect(() => {
    // Get user ID from localStorage (set during auth)
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    userIdRef.current = userId;

    // Create socket connection
    const newSocket = io(import.meta.env.VITE_SERVER_URL || "http://localhost:5000", {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Connection events
    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id);
      setIsConnected(true);

      // Register user
      newSocket.emit("register-user", userId);
    });

    newSocket.on("disconnect", () => {
      console.log("❌ Socket disconnected");
      setIsConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    // Incoming call
    newSocket.on("incoming-call", (data: IncomingCall) => {
      console.log("📞 Incoming call from:", data.fromUserName);
      setIncomingCall(data);
      toast({
        title: "Incoming Call! 📞",
        description: `${data.fromUserName} is calling...`,
      });
    });

    // Call accepted
    newSocket.on("call-accepted", (data: { answer: any; acceptedByUserId: string }) => {
      console.log("✅ Call accepted by:", data.acceptedByUserId);
      setIsCallActive(true);
      toast({
        title: "Call Connected! 💕",
        description: "Your partner has accepted your call",
      });
    });

    // Call rejected
    newSocket.on("call-rejected", (data: { rejectedByUserId: string }) => {
      console.log("❌ Call rejected by:", data.rejectedByUserId);
      setIncomingCall(null);
      setIsCallActive(false); // Stop video/audio for the caller
      toast({
        title: "Call Rejected",
        description: "Your partner declined the call",
        variant: "destructive",
      });
    });

    // Call ended
    newSocket.on("call-ended", (data: { endedByUserId: string }) => {
      console.log("📴 Call ended by:", data.endedByUserId);
      setIsCallActive(false);
      setIncomingCall(null);
      toast({
        title: "Call Ended",
        description: "The call has been terminated",
      });
    });

    // Error events
    newSocket.on("call-error", (data: { message: string }) => {
      console.error("Call error:", data.message);
      toast({
        title: "Call Error",
        description: data.message,
        variant: "destructive",
      });
    });

    // Receive offer
    newSocket.on("receive-offer", (data: { offer: any; fromUserId: string }) => {
      console.log("📋 Received offer from:", data.fromUserId);
      // Emit custom event for VideoCall to listen to
      window.dispatchEvent(new CustomEvent("webrtc-offer", { detail: data }));
    });

    // Receive answer
    newSocket.on("receive-answer", (data: { answer: any; fromUserId: string }) => {
      console.log("✅ Received answer from:", data.fromUserId);
      // Emit custom event for VideoCall to listen to
      window.dispatchEvent(new CustomEvent("webrtc-answer", { detail: data }));
    });

    // Receive ICE candidate
    newSocket.on("ice-candidate", (data: { candidate: any; fromUserId: string }) => {
      console.log("❄️ Received ICE candidate from:", data.fromUserId);
      // Emit custom event for VideoCall to listen to
      window.dispatchEvent(new CustomEvent("webrtc-ice-candidate", { detail: data }));
    });

    // Partner online status
    newSocket.on("partner-online", (data: { userId: string }) => {
      console.log("✅ Partner is online");
      setPartnerStatus('online');
    });

    newSocket.on("partner-offline", (data: { userId: string }) => {
      console.log("❌ Partner is offline");
      setPartnerStatus('offline');
    });

    newSocket.on("partner-inactive", (data: { userId: string }) => {
      console.log("💤 Partner is inactive");
      setPartnerStatus('inactive');
    });

    newSocket.on("partner-active", (data: { userId: string }) => {
      console.log("✅ Partner is active");
      setPartnerStatus('online');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [toast]);

  const acceptCall = (answer: any) => {
    if (socket && incomingCall && userIdRef.current) {
      socket.emit("accept-call", {
        fromUserId: incomingCall.fromUserId,
        toUserId: userIdRef.current,
        answer,
      });
      setIsCallActive(true);
    }
  };

  const rejectCall = (fromUserId: string) => {
    if (socket && userIdRef.current) {
      socket.emit("reject-call", {
        fromUserId,
        toUserId: userIdRef.current,
      });
      setIncomingCall(null);
    }
  };

  const initiateCall = (toUserId: string, offer: any, callType?: 'voice' | 'video') => {
    if (socket && userIdRef.current) {
      socket.emit("initiate-call", {
        fromUserId: userIdRef.current,
        toUserId,
        offer,
        callType,
      });
      setIsCallActive(true);
    }
  };

  const endCall = (toUserId: string) => {
    if (socket && userIdRef.current) {
      socket.emit("end-call", {
        fromUserId: userIdRef.current,
        toUserId,
      });
      setIsCallActive(false);
      setIncomingCall(null);
    }
  };

  const sendOffer = (toUserId: string, offer: any) => {
    if (socket && userIdRef.current) {
      socket.emit("send-offer", {
        toUserId,
        offer,
      });
    }
  };

  const sendAnswer = (toUserId: string, answer: any) => {
    if (socket && userIdRef.current) {
      socket.emit("send-answer", {
        toUserId,
        answer,
      });
    }
  };

  const sendIceCandidate = (toUserId: string, candidate: any) => {
    if (socket && userIdRef.current) {
      socket.emit("ice-candidate", {
        toUserId,
        candidate,
      });
    }
  };

  const clearIncomingCall = () => {
    setIncomingCall(null);
  };

  const value: CallContextType = {
    socket,
    isConnected,
    incomingCall,
    isCallActive,
    partnerStatus,
    acceptCall,
    rejectCall,
    initiateCall,
    endCall,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    clearIncomingCall,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within CallProvider");
  }
  return context;
};
