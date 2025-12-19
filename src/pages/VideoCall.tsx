import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/api";
import { useCall } from "@/contexts/CallContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Copy,
  Share2,
  PhoneCall,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface User {
  _id: string;
  displayName: string;
  customPartnerName?: string;
  partnerId?: {
    _id: string;
    displayName: string;
  };
}

const VideoCall = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { initiateCall, endCall: endCallSocket, sendOffer, sendAnswer, sendIceCandidate, isCallActive } = useCall();
  
  const [user, setUser] = useState<User | null>(null);
  const [isLocalCallActive, setIsLocalCallActive] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callRoom, setCallRoom] = useState<string>("");
  const [isCalling, setIsCalling] = useState(false);
  const [isVoiceCall, setIsVoiceCall] = useState(false);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (!authUser) {
        navigate("/auth");
        return;
      }

      try {
        const response = await api.get("/auth/profile");
        setUser(response.data.user);
      } catch (error) {
        console.error("Failed to load user:", error);
        toast({
          title: "Error",
          description: "Failed to load user profile",
          variant: "destructive",
        });
      }
    });

    return () => unsubscribe();
  }, [navigate, toast]);

  // Load call history when user is ready
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      try {
        const res = await api.get('/calls/history');
        setCallHistory(res.data.history || []);
      } catch (err) {
        console.error('Failed to fetch call history', err);
      }
    };
    fetchHistory();
  }, [user]);

  // Listen to actual call status
  useEffect(() => {
    setIsLocalCallActive(isCallActive);
    if (!isCallActive) {
      setIsCalling(false);
      // Stop video and audio when call ends
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Refresh call history after a call ends
      (async () => {
        try {
          const res = await api.get('/calls/history');
          setCallHistory(res.data.history || []);
        } catch (err) {
          console.error('Failed to refresh call history', err);
        }
      })();
    }
  }, [isCallActive]);

  // Socket.io event listeners for WebRTC signaling
  useEffect(() => {
    // Handler for receiving answer
    const handleWebRTCAnswer = async (e: any) => {
      const { answer } = e.detail;
      if (peerConnectionRef.current && answer) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          console.log("✅ Remote description set from answer");
        } catch (error) {
          console.error("Failed to set remote description (answer):", error);
        }
      }
    };

    // Handler for receiving offer
    const handleWebRTCOffer = async (e: any) => {
      const { offer, fromUserId, callType } = e.detail;
      if (offer && !peerConnectionRef.current) {
        try {
          // Create peer connection
          const peerConnection = new RTCPeerConnection({
            iceServers: [
              { urls: ["stun:stun.l.google.com:19302"] },
              { urls: ["stun:stun1.l.google.com:19302"] },
            ],
          });

          peerConnectionRef.current = peerConnection;
          
          // Set voice/video mode for callee based on incoming call type
          setIsVoiceCall(callType === 'voice');

          // Try to get local stream (non-blocking)
          let stream: MediaStream | null = null;
          try {
            const streamPromise = navigator.mediaDevices.getUserMedia({
              video: callType === 'voice' ? false : { width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: true,
            });
            stream = await Promise.race([
              streamPromise,
              new Promise<MediaStream>((_, reject) =>
                setTimeout(() => reject(new Error("timeout")), 8000)
              ),
            ]);

            localStreamRef.current = stream;
            if (callType !== 'voice' && localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
              localVideoRef.current.play().catch(console.error);
            }

            // Add local stream tracks
            stream.getTracks().forEach((track) => {
              peerConnection.addTrack(track, stream!);
            });
          } catch (permissionError: any) {
            // Camera access failed, but continue anyway
            console.warn("Camera/microphone not available:", permissionError.message);
          }

          // Handle remote stream
          peerConnection.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
              remoteStreamRef.current.addTrack(track);
            });
            if (callType !== 'voice' && remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStreamRef.current;
              remoteVideoRef.current.play().catch(console.error);
            }
          };

          // Handle ICE candidates
          peerConnection.onicecandidate = (event) => {
            if (event.candidate && user?.partnerId?._id) {
              sendIceCandidate(user.partnerId._id, event.candidate);
            }
          };

          // Set remote description
          await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

          // Create and send answer
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          // Send answer through socket
          sendAnswer(fromUserId, answer);
          setIsLocalCallActive(true);
          console.log("✅ Answer created and sent");
        } catch (error) {
          console.error("Failed to handle incoming offer:", error);
          // Clean up on error
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
          }
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
          }
        }
      }
    };

    // Handler for receiving ICE candidate
    const handleWebRTCIceCandidate = async (e: any) => {
      const { candidate } = e.detail;
      if (peerConnectionRef.current && candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("Failed to add ICE candidate:", error);
        }
      }
    };

    // Add event listeners
    window.addEventListener("webrtc-answer", handleWebRTCAnswer);
    window.addEventListener("webrtc-offer", handleWebRTCOffer);
    window.addEventListener("webrtc-ice-candidate", handleWebRTCIceCandidate);

    return () => {
      window.removeEventListener("webrtc-answer", handleWebRTCAnswer);
      window.removeEventListener("webrtc-offer", handleWebRTCOffer);
      window.removeEventListener("webrtc-ice-candidate", handleWebRTCIceCandidate);
    };
  }, [user?.partnerId?._id, sendIceCandidate, sendAnswer]);

  const startCall = async (isVoiceOnly = false) => {
    if (!user?.partnerId) {
      toast({
        title: "No Partner Connected",
        description: "Please connect with your partner first",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCalling(true);
      setIsVoiceCall(isVoiceOnly);

      // Create RTCPeerConnection first (doesn't need camera)
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: ["stun:stun.l.google.com:19302"] },
          { urls: ["stun:stun1.l.google.com:19302"] },
        ],
      });

      peerConnectionRef.current = peerConnection;

      // Try to get camera/microphone (non-blocking)
      let stream: MediaStream | null = null;
      try {
        const streamPromise = navigator.mediaDevices.getUserMedia({
          video: isVoiceOnly ? false : { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        stream = await Promise.race([
          streamPromise,
          new Promise<MediaStream>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 8000)
          ),
        ]);

        // Successfully got stream
        localStreamRef.current = stream;
        if (!isVoiceOnly && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(console.error);
        }

        // Add local stream tracks to peer connection
        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream!);
        });
      } catch (permissionError: any) {
        // Camera access failed, but continue with call anyway
        console.warn("Camera/microphone not available:", permissionError.message);
        toast({
          title: "Camera/Mic Not Available",
          description: "Call starting without video/audio. You can enable them later.",
          variant: "default",
        });
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStreamRef.current.addTrack(track);
        });
        if (!isVoiceOnly && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          sendIceCandidate(user.partnerId!._id, event.candidate);
        }
      };

      // Create and send offer (works even without stream)
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Send offer through socket - THIS IS THE KEY PART
      initiateCall(user.partnerId._id, offer, isVoiceOnly ? 'voice' : 'video');

      toast({
        title: "Calling... 📞",
        description: `Calling ${user.customPartnerName || user.partnerId.displayName}`,
      });

      setIsLocalCallActive(true);
    } catch (error: any) {
      console.error("Failed to start call:", error);
      toast({
        title: "Error Starting Call",
        description: error.message || "Failed to initiate call",
        variant: "destructive",
      });
      setIsCalling(false);

      // Clean up on error
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    }
  };

  const startVoiceCall = () => startCall(true);

  const handleEndCall = () => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    // Clear streams
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Emit socket event to notify partner
    if (user?.partnerId?._id) {
      endCallSocket(user.partnerId._id);
    }

    setIsLocalCallActive(false);
    setIsCalling(false);
    setIsVideoEnabled(true);
    setIsAudioEnabled(true);

    toast({
      title: "Call Ended",
      description: "Video call has been terminated",
    });
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const copyRoomId = () => {
    if (callRoom) {
      navigator.clipboard.writeText(callRoom);
      toast({
        title: "Copied!",
        description: "Room ID copied to clipboard",
      });
    }
  };

  const shareRoomId = async () => {
    if (callRoom && user?.partnerId) {
      try {
        const shareText = `Let's have a video call! Join me in room: ${callRoom}`;
        if (navigator.share) {
          await navigator.share({
            title: "ForeverUs Video Call",
            text: shareText,
          });
        } else {
          // Fallback: copy to clipboard
          navigator.clipboard.writeText(shareText);
          toast({
            title: "Share Message Copied",
            description: "Share this with your partner: " + shareText,
          });
        }
      } catch (error) {
        console.error("Failed to share:", error);
      }
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 flex items-center justify-center">
        <div className="animate-spin">
          <Video className="w-12 h-12 text-rose-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="hover:bg-rose-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-rose-600">Video Call</h1>
            <p className="text-sm md:text-base text-gray-600">
              Connect with {user.customPartnerName || user.partnerId?.displayName || "your partner"}
            </p>
          </div>
        </div>

        {!isCallActive ? (
          // Pre-Call Screen
          <Card className="shadow-lg">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="bg-gradient-to-br from-rose-400 to-pink-500 p-6 rounded-full">
                  <PhoneCall className="w-12 h-12 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Call History */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Call History</CardTitle>
                </CardHeader>
                <CardContent>
                  {callHistory.length === 0 ? (
                    <p className="text-sm text-gray-600">No calls yet.</p>
                  ) : (
                    <ScrollArea className="h-48 md:h-64">
                      <ul className="space-y-2 pr-2">
                        {callHistory.map((item: any, idx: number) => {
                          const started = new Date(item.startedAt);
                          const ended = item.endedAt ? new Date(item.endedAt) : null;
                          const durationMinutes = item.duration ? Math.max(1, Math.round(item.duration / 60)) : 0;
                          const partnerName = item.callerId && item.receiverId && user ? (
                            item.callerId._id === user._id ? item.receiverId.displayName : item.callerId.displayName
                          ) : 'Partner';
                          return (
                            <li key={idx} className="flex items-center justify-between p-2 md:p-3 bg-gray-50 rounded-md border">
                              <div>
                                <p className="text-sm font-medium text-gray-800">
                                  {partnerName} • {item.callType === 'voice' ? 'Voice' : 'Video'}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {started.toLocaleDateString()} {started.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {ended ? ` — ${durationMinutes} min` : ' — ongoing'}
                                </p>
                              </div>
                              <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700">
                                {item.status}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
              {user?.partnerId ? (
                <div className="space-y-4 text-center">
                  <p className="text-gray-600">
                    You are connected with <strong>{user.customPartnerName || user.partnerId.displayName}</strong>
                  </p>
                  <div className="grid grid-cols-1 gap-4">
                    <Button
                      onClick={startVoiceCall}
                      disabled={isCalling}
                      variant="outline"
                      className="h-14 md:h-16 text-lg border-2 hover:bg-green-50 hover:border-green-300"
                    >
                      <PhoneCall className="w-6 h-6 mr-2 text-green-600" />
                      Voice Call
                    </Button>
                  
                    <Button
                      onClick={() => startCall(false)}
                      disabled={isCalling}
                      className="h-14 md:h-16 text-lg bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white"
                    >
                      <Video className="w-6 h-6 mr-2" />
                      Video Call
                    </Button>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4 text-center">
                    <p className="text-xs md:text-sm text-blue-800">
                      💡 <strong>Tip:</strong> Make sure your microphone is working before starting a voice call, and both camera and microphone for video calls.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <Button
                    onClick={() => navigate("/chat")}
                    className="w-full bg-rose-500 hover:bg-rose-600"
                  >
                    Send Partner Invitation
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          // Active Call Screen
          <div className="space-y-4">
            {/* Voice Call Display */}
            {isVoiceCall ? (
              <Card className="shadow-lg">
                <CardContent className="pt-12 pb-12 text-center">
                  <div className="flex justify-center mb-6">
                    <div className="bg-gradient-to-br from-green-400 to-green-600 p-8 rounded-full">
                      <PhoneCall className="w-16 h-16 text-white" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Voice Call in Progress</h2>
                  <p className="text-gray-600 mb-4">Connected with {user.customPartnerName || user.partnerId?.displayName}</p>
                  <div className="flex justify-center items-center space-x-4">
                    <div className="text-sm text-gray-500">
                      <Mic className="w-4 h-4 inline mr-1" />
                      {isAudioEnabled ? "Microphone On" : "Microphone Off"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Video Grid */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Local Video */}
                <Card className="shadow-lg overflow-hidden">
                  <CardHeader className="bg-gray-900 text-white py-2">
                    <CardTitle className="text-sm">You</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-64 sm:h-80 lg:h-96 bg-gray-900 object-cover rounded-b-lg"
                    />
                  </CardContent>
                </Card>

                {/* Remote Video */}
                <Card className="shadow-lg overflow-hidden">
                  <CardHeader className="bg-gray-900 text-white py-2">
                    <CardTitle className="text-sm">{user.customPartnerName || user.partnerId?.displayName}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-64 sm:h-80 lg:h-96 bg-gray-900 object-cover rounded-b-lg"
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Call Controls */}
            <Card className="shadow-lg">
              <CardContent className="pt-4 pb-4 flex flex-wrap gap-3 justify-center">
                {!isVoiceCall && (
                  <Button
                    onClick={toggleVideo}
                    variant={isVideoEnabled ? "default" : "destructive"}
                    className="gap-2 w-full sm:w-auto"
                  >
                    {isVideoEnabled ? (
                      <>
                        <Video className="w-4 h-4" />
                        Video On
                      </>
                    ) : (
                      <>
                        <VideoOff className="w-4 h-4" />
                        Video Off
                      </>
                    )}
                  </Button>
                )}

                <Button
                  onClick={toggleAudio}
                  variant={isAudioEnabled ? "default" : "destructive"}
                  className="gap-2 w-full sm:w-auto"
                >
                  {isAudioEnabled ? (
                    <>
                      <Mic className="w-4 h-4" />
                      Audio On
                    </>
                  ) : (
                    <>
                      <MicOff className="w-4 h-4" />
                      Audio Off
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleEndCall}
                  variant="destructive"
                  className="gap-2 w-full sm:w-auto"
                >
                  <PhoneOff className="w-4 h-4" />
                  End Call
                </Button>
              </CardContent>
            </Card>

            {/* Room Info */}
            {callRoom && (
              <Card className="shadow-lg border-rose-200 bg-rose-50">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      Room ID: <span className="font-mono font-bold text-gray-900">{callRoom}</span>
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={copyRoomId}
                        size="sm"
                        variant="outline"
                        className="gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        Copy Room ID
                      </Button>
                      <Button
                        onClick={shareRoomId}
                        size="sm"
                        variant="outline"
                        className="gap-2"
                      >
                        <Share2 className="w-4 h-4" />
                        Share
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCall;