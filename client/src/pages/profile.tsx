import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { z } from "zod";
import {
    Users,
    Loader2,
    ArrowLeft,
    AlertTriangle,
    Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/stores";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiRequest } from "@/lib/queryClient";

const usernameSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
});

const passwordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

const deleteSchema = z.object({
    password: z.string().min(1, "Password is required"),
});

export default function Profile() {
    const [, setLocation] = useLocation();
    const { user, setAuth, logout } = useAuthStore();
    const { toast } = useToast();
    const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

    const usernameForm = useForm({
        resolver: zodResolver(usernameSchema),
        defaultValues: {
            username: user?.username || "",
        },
    });

    const passwordForm = useForm({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    });

    const deleteForm = useForm({
        resolver: zodResolver(deleteSchema),
        defaultValues: {
            password: "",
        },
    });

    async function onUpdateUsername(values: z.infer<typeof usernameSchema>) {
        setIsUpdatingUsername(true);
        try {
            const response = await apiRequest("PATCH", "/api/user/profile", values);
            const data = await response.json();

            // Update auth store with new user data
            const currentTokens = useAuthStore.getState();
            if (data.user && currentTokens.accessToken && currentTokens.refreshToken) {
                setAuth(data.user, currentTokens.accessToken, currentTokens.refreshToken);
            }

            toast({
                title: "Success",
                description: "Username updated successfully",
            });
        } catch (error: any) {
            toast({
                title: "Failed to update username",
                description: error.message || "Please try again",
                variant: "destructive",
            });
        } finally {
            setIsUpdatingUsername(false);
        }
    }

    async function onChangePassword(values: z.infer<typeof passwordSchema>) {
        setIsChangingPassword(true);
        try {
            await apiRequest("PATCH", "/api/user/password", {
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
            });

            toast({
                title: "Success",
                description: "Password changed successfully",
            });

            passwordForm.reset();
        } catch (error: any) {
            toast({
                title: "Failed to change password",
                description: error.message || "Please try again",
                variant: "destructive",
            });
        } finally {
            setIsChangingPassword(false);
        }
    }

    async function onDeleteAccount(values: z.infer<typeof deleteSchema>) {
        setIsDeletingAccount(true);
        try {
            await apiRequest("DELETE", "/api/user/account", values);

            toast({
                title: "Account deleted",
                description: "Your account has been permanently deleted",
            });

            // Logout and redirect
            logout();
            setLocation("/");
        } catch (error: any) {
            toast({
                title: "Failed to delete account",
                description: error.message || "Please try again",
                variant: "destructive",
            });
            setIsDeletingAccount(false);
        }
    }

    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            {/* Background gradient blobs */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[100px]" />
            </div>

            <header className="relative z-10 h-16 px-6 flex items-center justify-between border-b border-border/40 bg-background/60 backdrop-blur-md sticky top-0">
                <Link href="/dashboard" className="flex items-center gap-2 group">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">LiveCollab</span>
                </Link>
                <ThemeToggle />
            </header>

            <main className="relative z-10 flex-1 p-6 md:p-8 max-w-4xl mx-auto w-full">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <div className="mb-8">
                        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Dashboard
                        </Link>
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Account Settings</h1>
                        <p className="text-muted-foreground mt-2">Manage your profile and account preferences</p>
                    </div>

                    <div className="space-y-6">
                        {/* Account Information */}
                        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle>Account Information</CardTitle>
                                <CardDescription>Update your username and profile details</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form {...usernameForm}>
                                    <form onSubmit={usernameForm.handleSubmit(onUpdateUsername)} className="space-y-4">
                                        <FormField
                                            control={usernameForm.control}
                                            name="username"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Username</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Enter username"
                                                            className="h-11"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormDescription>
                                                        This is your public display name
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <div className="flex items-center gap-3">
                                            <Button
                                                type="submit"
                                                disabled={isUpdatingUsername || !usernameForm.formState.isDirty}
                                                className="shadow-sm"
                                            >
                                                {isUpdatingUsername ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Check className="h-4 w-4 mr-2" />
                                                        Save Changes
                                                    </>
                                                )}
                                            </Button>
                                            {usernameForm.formState.isDirty && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => usernameForm.reset()}
                                                >
                                                    Cancel
                                                </Button>
                                            )}
                                        </div>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>

                        {/* Security */}
                        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle>Security</CardTitle>
                                <CardDescription>Change your password to keep your account secure</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form {...passwordForm}>
                                    <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
                                        <FormField
                                            control={passwordForm.control}
                                            name="currentPassword"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Current Password</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="password"
                                                            placeholder="Enter current password"
                                                            className="h-11"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={passwordForm.control}
                                            name="newPassword"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>New Password</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="password"
                                                            placeholder="Enter new password (min. 6 characters)"
                                                            className="h-11"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={passwordForm.control}
                                            name="confirmPassword"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Confirm New Password</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="password"
                                                            placeholder="Confirm new password"
                                                            className="h-11"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button
                                            type="submit"
                                            disabled={isChangingPassword}
                                            className="shadow-sm"
                                        >
                                            {isChangingPassword ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                "Change Password"
                                            )}
                                        </Button>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>

                        {/* Danger Zone */}
                        <Card className="border-destructive/50 bg-destructive/5">
                            <CardHeader>
                                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                                <CardDescription>Permanently delete your account and all data</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" className="shadow-sm">
                                            <AlertTriangle className="h-4 w-4 mr-2" />
                                            Delete Account
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete your account,
                                                all rooms you own, and remove all your data from our servers.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <Form {...deleteForm}>
                                            <form onSubmit={deleteForm.handleSubmit(onDeleteAccount)} className="space-y-4">
                                                <FormField
                                                    control={deleteForm.control}
                                                    name="password"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Confirm with your password</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="password"
                                                                    placeholder="Enter your password"
                                                                    className="h-11"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel onClick={() => deleteForm.reset()}>
                                                        Cancel
                                                    </AlertDialogCancel>
                                                    <AlertDialogAction
                                                        type="submit"
                                                        disabled={isDeletingAccount}
                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            deleteForm.handleSubmit(onDeleteAccount)();
                                                        }}
                                                    >
                                                        {isDeletingAccount ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            "Delete Account"
                                                        )}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </form>
                                        </Form>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardContent>
                        </Card>
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
