import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Landing from "./pages/Landing.tsx";
import SetlistPicker from "./pages/SetlistPicker.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const AUTH_KEY = "gigsprompter-authed";

// Always starts on the setlist picker after auth, rather than jumping
// straight into whichever setlist happens to be first — the band can have
// more than one, and none of them should be a fixed "home" screen.
const Home = () => {
  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(null);

  if (!activeSetlistId) {
    return <SetlistPicker onSelectSetlist={setActiveSetlistId} />;
  }
  return <Index setlistId={activeSetlistId} onExitSetlist={() => setActiveSetlistId(null)} />;
};

const App = () => {
  const [authed, setAuthed] = useState(() => localStorage.getItem(AUTH_KEY) === "true");

  const handleAuthenticated = () => {
    localStorage.setItem(AUTH_KEY, "true");
    setAuthed(true);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {authed ? (
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        ) : (
          <Landing onAuthenticated={handleAuthenticated} />
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
