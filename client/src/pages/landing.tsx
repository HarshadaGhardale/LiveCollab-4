import { Link } from "wouter";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Users,
  Pencil,
  Code2,
  Video,
  Zap,
  Shield,
  ArrowRight,
  Check,
  Globe,
  Monitor
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuthStore } from "@/lib/stores";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 50 } },
};

const features = [
  {
    icon: Pencil,
    title: "Infinite Canvas",
    description: "A free-form whiteboard for brainstorming, sketching, and diagrams.",
    colSpan: "md:col-span-2",
    bg: "bg-blue-500/10",
  },
  {
    icon: Code2,
    title: "Polyglot Editor",
    description: " collaborative code editor supporting JS, Python, more.",
    colSpan: "md:col-span-1",
    bg: "bg-purple-500/10",
  },
  {
    icon: Video,
    title: "HD Video Calls",
    description: "Built-in WebRTC video chat for seamless face-to-face comms.",
    colSpan: "md:col-span-1",
    bg: "bg-green-500/10",
  },
  {
    icon: Zap,
    title: "Real-time Sync",
    description: "Sub-millisecond latency updates across all connected clients.",
    colSpan: "md:col-span-2",
    bg: "bg-orange-500/10",
  },
];

export default function Landing() {
  const { isAuthenticated } = useAuthStore();
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);
  const scale = useTransform(scrollY, [0, 300], [1, 0.95]);

  return (
    <div className="min-h-screen bg-background selection:bg-primary/20">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/20 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b border-border/40 bg-background/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <span className="font-bold text-lg tracking-tight">LiveCollab</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {isAuthenticated ? (
              <Button asChild size="sm" className="rounded-full px-6 font-medium">
                <Link href="/dashboard">
                  Dashboard <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="hidden md:flex" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm" className="rounded-full px-6 shadow-lg shadow-primary/20">
                  <Link href="/register">Get Started</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-32 pb-20 px-6">
        {/* Hero Section */}
        <section className="max-w-5xl mx-auto text-center mb-32">
          <motion.div
            style={{ opacity, scale }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/60 leading-[1.1]">
              Collaboration <br />
              <span className="text-primary">Redefined.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              The all-in-one workspace where teams build, design, and ship together.
              Real-time whiteboards, code editors, and video chat in one powerful tab.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="h-12 px-8 rounded-full text-base shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-all" asChild>
                <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                  Start Collaborating Free
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 rounded-full text-base bg-background/50 backdrop-blur-sm border-border/50 hover:bg-background/80"
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                View Features
              </Button>
            </div>
          </motion.div>

          {/* Hero Visual */}
          <motion.div
            initial={{ opacity: 0, y: 60, rotateX: 20 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 1, delay: 0.4, type: "spring" }}
            className="mt-20 relative perspective-[1000px]"
          >
            <div className="border border-border/50 rounded-xl overflow-hidden shadow-2xl shadow-indigo-500/10 bg-card/50 backdrop-blur-sm">
              <div className="h-12 border-b border-border/50 flex items-center px-4 gap-2 bg-muted/20">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="bg-background/50 px-4 py-1 rounded-md text-xs text-muted-foreground ml-4 flex items-center gap-2 border border-border/30">
                  <Shield className="w-3 h-3" /> livecollab-secure-room-8xw9
                </div>
              </div>
              <div className="aspect-[16/9] bg-gradient-to-br from-background to-muted/30 flex items-center justify-center relative overflow-hidden group">
                {/* Abstract UI Representation */}
                <div className="absolute inset-0 grid grid-cols-2">
                  <div className="border-r border-border/30 p-8 flex items-center justify-center relative">
                    <Code2 className="w-24 h-24 text-primary/20" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-b from-transparent via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  </div>
                  <div className="p-8 flex items-center justify-center relative">
                    <Pencil className="w-24 h-24 text-purple-500/20" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-b from-transparent via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100" />
                  </div>
                </div>
                {/* Floating cursors */}
                <motion.div
                  animate={{ x: [0, 100, 0], y: [0, -50, 0] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute top-1/4 left-1/4 flex flex-col items-start gap-1 z-10"
                >
                  <div className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-sm shadow-sm">Alex</div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#3B82F6" className="-mt-1 block"><path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19177L11.4841 12.3673H5.65376Z" /></svg>
                </motion.div>
                <motion.div
                  animate={{ x: [0, -80, 0], y: [0, 40, 0] }}
                  transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  className="absolute bottom-1/3 right-1/3 flex flex-col items-start gap-1 z-10"
                >
                  <div className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-sm shadow-sm">Sarah</div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#F59E0B" className="-mt-1 block"><path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19177L11.4841 12.3673H5.65376Z" /></svg>
                </motion.div>
              </div>
            </div>
            {/* Glow effect under image */}
            <div className="absolute -inset-4 bg-primary/20 blur-3xl -z-10 rounded-[50px] opacity-40" />
          </motion.div>
        </section>

        {/* Features Bento Grid */}
        <section id="features" className="max-w-6xl mx-auto mb-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Power packed features</h2>
            <p className="text-muted-foreground text-lg"> everything you need to build the next big thing.</p>
          </div>

          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={item}
                className={`${feature.colSpan} group relative overflow-hidden rounded-2xl border border-border/50 bg-card hover:bg-card/80 transition-colors`}
              >
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${feature.bg} blur-3xl`} />

                <div className="relative p-8 h-full flex flex-col items-start">
                  <div className="w-12 h-12 rounded-lg bg-background/50 border border-border/50 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="h-6 w-6 text-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Global Access / Social Proof */}
        <section className="max-w-4xl mx-auto text-center mb-32">
          <Card className="bg-gradient-to-br from-card to-card/50 border-primary/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -ml-32 -mb-32" />

            <CardContent className="p-12 relative z-10">
              <h3 className="text-3xl font-bold mb-6">Built for teams of all sizes</h3>
              <div className="flex flex-wrap justify-center gap-x-12 gap-y-8 grayscale opacity-70">
                <div className="flex items-center gap-2 text-xl font-bold"><Monitor className="w-6 h-6" /> TechCorp</div>
                <div className="flex items-center gap-2 text-xl font-bold"><Globe className="w-6 h-6" /> EduGlobal</div>
                <div className="flex items-center gap-2 text-xl font-bold"><Zap className="w-6 h-6" /> FastStartup</div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA Footer */}
        <section className="text-center pb-20">
          <h2 className="text-4xl font-bold mb-8">Ready to sync up?</h2>
          <Button size="lg" className="h-14 px-10 rounded-full text-lg shadow-2xl shadow-primary/30" asChild>
            <Link href="/register">Get Started Now</Link>
          </Button>
          <p className="mt-6 text-sm text-muted-foreground">No credit card required. Free for personal use.</p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/30 backdrop-blur-md py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
            <Users className="h-5 w-5" />
            <span className="font-bold">LiveCollab</span>
          </div>
          <div className="flex gap-8 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
          </div>
          <div className="text-sm text-muted-foreground/60">
            © 2024 LiveCollab. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
