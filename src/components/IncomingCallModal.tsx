import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCall } from "@/contexts/CallContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, PhoneOff, Video } from "lucide-react";

const IncomingCallModal = () => {
  const navigate = useNavigate();
  const { incomingCall, acceptCall, rejectCall, clearIncomingCall } = useCall();

  useEffect(() => {
    if (incomingCall) {
      // Play ringtone or notification sound
      const audio = new Audio("data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==");
      audio.play().catch(() => {
        // Sound might fail in some contexts, that's ok
      });
    }
  }, [incomingCall]);

  if (!incomingCall) {
    return null;
  }

  const handleAccept = async () => {
    try {
      console.log("✅ Accepting call from:", incomingCall.fromUserName);

      // Accept the call - this emits the accept-call socket event
      acceptCall(incomingCall.offer);

      // Dispatch the WebRTC offer event so VideoCall can process it
      window.dispatchEvent(
        new CustomEvent("webrtc-offer", {
          detail: {
            offer: incomingCall.offer,
            fromUserId: incomingCall.fromUserId,
            callType: incomingCall.callType,
          },
        })
      );

      // Clear the modal immediately
      clearIncomingCall();

      // Navigate to video call page
      console.log("📍 Navigating to /video");
      navigate("/video");
    } catch (error) {
      console.error("Error accepting call:", error);
    }
  };

  const handleReject = () => {
    console.log("❌ Rejecting call from:", incomingCall.fromUserId);
    rejectCall(incomingCall.fromUserId);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[101] p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-t-lg py-6">
          <CardTitle className="text-2xl">Incoming Call</CardTitle>
        </CardHeader>
        <CardContent className="pt-8 space-y-8 pb-8">
          {/* Caller Info */}
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="w-20 h-20 border-4 border-rose-200">
              <AvatarFallback className="bg-gradient-to-br from-rose-400 to-pink-400 text-white text-2xl font-bold">
                {getInitials(incomingCall.fromUserName)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center space-y-2">
              <p className="text-2xl font-bold text-gray-800">{incomingCall.fromUserName}</p>
              <p className="text-gray-600 text-sm animate-pulse">{incomingCall.callType === 'voice' ? 'Voice calling...' : 'Video calling...'}</p>
            </div>
          </div>

          {/* Call Controls */}
          <div className="flex gap-4 justify-center">
            {/* Reject Button */}
            <Button
              onClick={handleReject}
              variant="destructive"
              size="lg"
              className="w-16 h-16 rounded-full flex items-center justify-center"
            >
              <PhoneOff className="w-8 h-8" />
            </Button>

            {/* Accept Button */}
            <Button
              onClick={handleAccept}
              className="w-16 h-16 rounded-full flex items-center justify-center bg-green-500 hover:bg-green-600 text-white"
            >
              {incomingCall.callType === 'voice' ? (
                <Phone className="w-8 h-8" />
              ) : (
                <Video className="w-8 h-8" />
              )}
            </Button>
          </div>

          {/* Info Text */}
          <div className="text-center text-sm text-gray-600">
            <p>Click the green button to accept or red to decline</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IncomingCallModal;
