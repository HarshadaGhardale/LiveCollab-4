import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";

const forgotPasswordSchema = z.object({
    email: z.string().email("Invalid email address"),
});

export default function ForgotPassword() {
    const { toast } = useToast();
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof forgotPasswordSchema>>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: {
            email: "",
        },
    });

    async function onSubmit(values: z.infer<typeof forgotPasswordSchema>) {
        setIsLoading(true);
        try {
            const res = await apiRequest("POST", "/api/auth/forgot-password", values);
            const data = await res.json();

            setIsSuccess(true);
            toast({
                title: "Reset link sent",
                description: data.message,
            });

            if (data.devToken) {
                console.log("DEV: Reset Link:", `${window.location.origin}/auth/reset-password/${data.devToken}`);
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to send reset link",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Reset Password</CardTitle>
                    <CardDescription>
                        Enter your email address and we'll send you a link to reset your password.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isSuccess ? (
                        <div className="text-center py-4 space-y-4">
                            <div className="p-3 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-md">
                                If an account exists with that email, we've sent instructions to reset your password.
                            </div>
                            <p className="text-sm text-muted-foreground">
                                (Check the server console or browser console if running locally)
                            </p>
                        </div>
                    ) : (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter your email" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Send Reset Link
                                </Button>
                            </form>
                        </Form>
                    )}
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Link href="/login" className="flex items-center text-sm text-muted-foreground hover:text-primary">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Login
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}
