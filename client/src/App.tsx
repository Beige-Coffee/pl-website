import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePageTracking } from "@/hooks/use-page-tracking";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import About from "@/pages/about";
import Blog from "@/pages/blog";
import NoiseTutorialPage from "@/pages/noise-tutorial";
import LightningTutorialPage from "@/pages/lightning-tutorial";
import AdminPage from "@/pages/admin";
import VisualLightningPage from "@/pages/visual-lightning";
import Learn from "@/pages/learn";


function Router() {
  usePageTracking();
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/learn" component={Learn} />
      <Route path="/noise-tutorial" component={NoiseTutorialPage} />
      <Route path="/noise-tutorial/:chapterId" component={NoiseTutorialPage} />
      <Route path="/lightning-tutorial" component={LightningTutorialPage} />
      <Route path="/lightning-tutorial/:chapterId" component={LightningTutorialPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/visual-lightning" component={VisualLightningPage} />
      <Route path="/visual-lightning/:sectionId" component={VisualLightningPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
