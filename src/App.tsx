import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CallProvider } from "@/contexts/CallContext";
import IncomingCallModal from "@/components/IncomingCallModal";
import Layout from "@/components/Layout";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Gallery from "./pages/Gallery";
import Moments from "./pages/Moments";
import VideoCall from "./pages/VideoCall";
import Profile from "./pages/Profile";
import PartnerProfile from "./pages/PartnerProfile";
import AcceptInvitation from "./pages/AcceptInvitation";
import Goals from "./pages/Goals";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <CallProvider>
          <Toaster />
          <Sonner />
          <IncomingCallModal />
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/moments" element={<Moments />} />
              <Route path="/video" element={<VideoCall />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/partner-profile" element={<PartnerProfile />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/accept-invitation" element={<AcceptInvitation />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </CallProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
