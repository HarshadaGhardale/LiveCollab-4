import { Link } from "wouter";
import { motion } from "framer-motion";
import { 
  Users, 
  Pencil, 
  Code2, 
  Video, 
  Zap, 
  Shield,
  ArrowRight,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuthStore } from "@/lib/stores";

const features = [
  {
    icon: Pencil,
    title: "Shared Whiteboard",
    description: "Draw, sketch, and brainstorm together in real-time with powerful drawing tools",
  },
  {
    icon: Code2,
    title: "Code Editor",
    description: "Write code collaboratively with syntax highlighting and live cursor tracking",
  },
  {
    icon: Video,
    title: "Video Chat",
    description: "Face-to-face communication with WebRTC peer-to-peer video calls",
  },
  {
    icon: Zap,
    title: "Real-time Sync",
    description: "See changes instantly as your team works together on the same canvas",
  },
  {
    icon: Shield,
    title: "Secure Rooms",
    description: "Create private rooms with unique links for your team",
  },
  {
    icon: Users,
    title: "Live Presence",
    description: "See who's online and track cursors of your collaborators",
  },
];

const benefits = [
  "Unlimited collaboration rooms",
  "Real-time whiteboard with export",
  "Code editor with 6+ languages",
  "Video chat built-in",
  "Live cursor tracking",
  "Works on any device",
];

export default function Landing() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 px-4 flex items-center justify-between border-b sticky top-0 bg-background/95 backdrop-blur z-50">
        <Link href="/" className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <span className="font-semibold text-lg">CollabSpace</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isAuthenticated ? (
            <Button asChild data-testid="button-go-dashboard">
              <Link href="/dashboard">
                Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild data-testid="button-login">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild data-testid="button-register">
                <Link href="/register">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="max-w-6xl mx-auto px-4 py-20 md:py-32 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Collaborate in
              <span className="text-primary"> Real-Time</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              A powerful workspace for teams to draw, code, and video chat together.
              Create a room and start collaborating in seconds.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild data-testid="button-hero-start">
                <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                  Start Collaborating
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild data-testid="button-hero-learn">
                <Link href="#features">Learn More</Link>
              </Button>
            </div>
          </motion.div>

          {/* Hero illustration */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-16 relative"
          >
            <div className="aspect-video max-w-4xl mx-auto rounded-lg border bg-card shadow-2xl overflow-hidden">
              <div className="h-10 px-4 flex items-center gap-2 border-b bg-muted/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-3 py-1 rounded-md bg-background text-xs text-muted-foreground">
                    collabspace.app/room/team-project
                  </div>
                </div>
              </div>
              <div className="flex h-[calc(100%-2.5rem)]">
                <div className="flex-1 p-4 border-r">
                  <div className="h-full rounded-md bg-muted/30 flex items-center justify-center">
                    <Code2 className="h-16 w-16 text-muted-foreground/50" />
                  </div>
                </div>
                <div className="flex-1 p-4">
                  <div className="h-full rounded-md bg-muted/30 flex items-center justify-center">
                    <Pencil className="h-16 w-16 text-muted-foreground/50" />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg">
              Live collaboration for teams
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 border-t">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold mb-4">Everything you need</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              All the tools your team needs to collaborate effectively, all in one place.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full hover-elevate">
                  <CardContent className="p-6">
                    <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold mb-4">
                Built for modern teams
              </h2>
              <p className="text-muted-foreground mb-8">
                Whether you're brainstorming ideas, reviewing code, or having a quick sync,
                CollabSpace brings your team together in one seamless experience.
              </p>
              <ul className="space-y-3">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm">{benefit}</span>
                  </li>
                ))}
              </ul>
              <Button className="mt-8" asChild data-testid="button-benefits-start">
                <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                  Get Started Free
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-square max-w-md mx-auto rounded-lg border bg-card p-6">
                <div className="h-full flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {["#3B82F6", "#10B981", "#F59E0B", "#EF4444"].map((color, i) => (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full border-2 border-background"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">4 collaborating</span>
                  </div>
                  <div className="flex-1 rounded-md bg-muted/50 flex items-center justify-center">
                    <div className="text-center">
                      <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Your team here</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold mb-4">
              Ready to start collaborating?
            </h2>
            <p className="text-muted-foreground mb-8">
              Create your first room in seconds. No credit card required.
            </p>
            <Button size="lg" asChild data-testid="button-cta-start">
              <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                Get Started Free
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span className="font-semibold">CollabSpace</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Real-time collaboration for modern teams
          </p>
        </div>
      </footer>
    </div>
  );
}
