import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Heart, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

type Status = "loading" | "success" | "error" | "expired" | "login-required";

const AcceptInvitation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("loading");
  const [senderName, setSenderName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleInvitation = async () => {
      try {
        const token = searchParams.get("token");

        if (!token) {
          setStatus("error");
          setErrorMessage("Invalid invitation link");
          return;
        }

        // Check if user is authenticated
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (!user) {
            // Store token in sessionStorage for after login
            sessionStorage.setItem("pendingInvitationToken", token);
            setStatus("login-required");
            return;
          }

          try {
            const response = await api.post("/auth/accept-invitation", { invitationToken: token });
            
            setSenderName(response.data.partner?.displayName || "Your Partner");
            setStatus("success");
            toast({
              title: "Invitation Accepted! 💕",
              description: `You're now connected with ${response.data.partner?.displayName}!`,
            });

            // Redirect to chat after 2 seconds, user profile will be reloaded automatically
            setTimeout(() => {
              navigate("/chat");
            }, 2000);
          } catch (error: any) {
            console.error("Error accepting invitation:", error);
            
            if (error.response?.status === 400) {
              const message = error.response.data.message || error.response.data.error || "";
              if (message.includes("expired") || message.includes("Invalid")) {
                setStatus("expired");
                setErrorMessage("This invitation has expired. Please ask your partner to send a new one.");
              } else {
                setStatus("error");
                setErrorMessage(message || "Failed to accept invitation");
              }
            } else {
              setStatus("error");
              setErrorMessage("An error occurred while accepting the invitation");
            }
          }
        });

        return () => unsubscribe();
      } catch (error: any) {
        console.error("Error:", error);
        setStatus("error");
        setErrorMessage("An unexpected error occurred");
      }
    };

    handleInvitation();
  }, [searchParams, navigate, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm md:max-w-md shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <Heart className="w-10 h-10 md:w-12 md:h-12 text-rose-500 fill-rose-500" />
          </div>
          <CardTitle className="text-xl md:text-2xl">Forever Yours</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {status === "loading" && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
              </div>
              <p className="text-center text-gray-600">
                Processing your invitation...
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="w-12 h-12 md:w-16 md:h-16 text-green-500" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                  You're Connected! 💕
                </h2>
                <p className="text-sm md:text-base text-gray-600">
                  You're now connected with <strong>{senderName}</strong>
                </p>
                <p className="text-xs md:text-sm text-gray-500">
                  Redirecting you to chat in a moment...
                </p>
              </div>
              <Button
                onClick={() => navigate("/chat")}
                className="w-full bg-rose-500 hover:bg-rose-600"
              >
                Go to Chat Now
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <AlertCircle className="w-12 h-12 md:w-16 md:h-16 text-red-500" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-lg md:text-xl font-bold text-gray-900">
                  Oops! Something went wrong
                </h2>
                <p className="text-sm md:text-base text-gray-600">{errorMessage}</p>
              </div>
              <Button
                onClick={() => navigate("/auth")}
                className="w-full bg-rose-500 hover:bg-rose-600"
              >
                Back to Login
              </Button>
            </div>
          )}

          {status === "login-required" && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Heart className="w-12 h-12 md:w-16 md:h-16 text-rose-500 fill-rose-500" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-lg md:text-xl font-bold text-gray-900">
                  Login Required
                </h2>
                <p className="text-sm md:text-base text-gray-600">
                  Please log in to accept this invitation
                </p>
              </div>
              <Button
                onClick={() => navigate("/auth")}
                className="w-full bg-rose-500 hover:bg-rose-600"
              >
                Login to Accept Invitation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvitation;
