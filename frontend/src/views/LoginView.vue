<script setup>
import { ref, reactive, computed, watch } from "vue";
import { useRouter, useRoute, RouterLink } from "vue-router";
import { login, register, loginWithGoogle } from "../services/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircleIcon, CheckCircle2Icon } from "@lucide/vue";

const router = useRouter();
const route = useRoute();

// Determine view mode: 'login' vs 'register' based on current path or query param
const isRegister = computed(() => route?.path === "/register" || route?.query?.mode === "register");

// --- Login State ---
const loginUsername = ref("demo");
const loginPassword = ref("demo123");
const loginError = ref("");
const loginLoading = ref(false);

// --- Registration State ---
const regUsername = ref("");
const regEmail = ref("");
const regPassword = ref("");
const regConfirmPassword = ref("");
const regErrors = reactive({
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
});
const regGeneralError = ref("");
const regSuccessMessage = ref("");
const regLoading = ref(false);

// --- Google Auth State ---
const googleLoading = ref(false);
const googleError = ref("");

// Clear alerts when switching modes
watch(
  () => isRegister.value,
  () => {
    loginError.value = "";
    regGeneralError.value = "";
    regSuccessMessage.value = "";
    googleError.value = "";
    clearRegFieldErrors();
  }
);

function clearRegFieldErrors() {
  regErrors.username = "";
  regErrors.email = "";
  regErrors.password = "";
  regErrors.confirmPassword = "";
}

// Client-side validation for registration form conforming to accessibility standards
function validateRegistration() {
  clearRegFieldErrors();
  let isValid = true;

  if (!regUsername.value.trim()) {
    regErrors.username = "Username is required.";
    isValid = false;
  } else if (regUsername.value.trim().length < 3) {
    regErrors.username = "Username must be at least 3 characters.";
    isValid = false;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regEmail.value.trim()) {
    regErrors.email = "Email address is required.";
    isValid = false;
  } else if (!emailPattern.test(regEmail.value.trim())) {
    regErrors.email = "Please enter a valid email address.";
    isValid = false;
  }

  if (!regPassword.value) {
    regErrors.password = "Password is required.";
    isValid = false;
  } else if (regPassword.value.length < 8) {
    regErrors.password = "Password must be at least 8 characters.";
    isValid = false;
  }

  if (!regConfirmPassword.value) {
    regErrors.confirmPassword = "Confirm password is required.";
    isValid = false;
  } else if (regConfirmPassword.value !== regPassword.value) {
    regErrors.confirmPassword = "Passwords do not match.";
    isValid = false;
  }

  return isValid;
}

// --- Login Submission Handler ---
async function onLogin() {
  loginError.value = "";
  googleError.value = "";
  loginLoading.value = true;
  try {
    await login(loginUsername.value, loginPassword.value);
    router.push("/");
  } catch (err) {
    loginError.value = err.message || "Failed to sign in. Please check your credentials.";
  } finally {
    loginLoading.value = false;
  }
}

// --- Registration Submission Handler ---
/**
 * BACKEND NOTE:
 * When wiring up backend registration:
 * 1. Implement POST /api/auth/register endpoint in backend/src/auth/routes.js
 * 2. Hash password with bcrypt before storing
 * 3. Store username, email, password_hash in database
 * 4. Issue JWT token upon successful user creation
 */
async function onRegister() {
  regGeneralError.value = "";
  regSuccessMessage.value = "";
  googleError.value = "";

  if (!validateRegistration()) {
    return;
  }

  regLoading.value = true;
  try {
    await register(regUsername.value.trim(), regEmail.value.trim(), regPassword.value);
    regSuccessMessage.value = "Account created successfully! Redirecting to dashboard…";
    setTimeout(() => {
      router.push("/");
    }, 1200);
  } catch (err) {
    regGeneralError.value =
      err.message ||
      "Unable to register. Backend endpoint POST /api/auth/register needs to be implemented.";
  } finally {
    regLoading.value = false;
  }
}

// --- Google Sign-in Handler ---
/**
 * BACKEND NOTE:
 * When wiring up Google OAuth:
 * 1. Setup Google OAuth 2.0 Client ID in Google Cloud Console
 * 2. Configure Passport Google Strategy in backend/src/auth/passport.js
 * 3. Add routes:
 *    - GET /api/auth/google
 *    - GET /api/auth/google/callback
 * 4. Issue JWT upon Google profile verification and redirect back with token
 */
async function onGoogleSignIn() {
  googleLoading.value = true;
  googleError.value = "";
  loginError.value = "";
  regGeneralError.value = "";

  try {
    await loginWithGoogle();
  } catch (err) {
    googleError.value =
      err.message ||
      "Google Sign-In is not yet implemented on the backend (GET /api/auth/google).";
  } finally {
    googleLoading.value = false;
  }
}
</script>

<template>
  <main
    class="min-h-screen flex items-center justify-center p-6 bg-background"
    role="main"
    aria-label="Authentication"
  >
    <!-- LOGIN VIEW -->
    <Card v-if="!isRegister" class="w-full max-w-sm shadow-lg">
      <CardHeader>
        <CardTitle class="text-2xl font-bold">Energy Monitor</CardTitle>
        <CardDescription>Sign in to view live meter data</CardDescription>
      </CardHeader>

      <form
        @submit.prevent="onLogin"
        novalidate
        aria-label="Sign in form"
      >
        <CardContent class="flex flex-col gap-4 pb-4">
          <!-- Login Failure Alert -->
          <Alert
            v-if="loginError"
            variant="destructive"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircleIcon class="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Authentication Failed</AlertTitle>
            <AlertDescription id="login-error-alert">{{ loginError }}</AlertDescription>
          </Alert>

          <!-- Google Auth Error Alert -->
          <Alert
            v-if="googleError"
            variant="destructive"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircleIcon class="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Google Sign-In Notice</AlertTitle>
            <AlertDescription>{{ googleError }}</AlertDescription>
          </Alert>

          <FieldGroup>
            <!-- Username Input -->
            <Field :data-invalid="Boolean(loginError)">
              <FieldLabel for="login-username">Username</FieldLabel>
              <Input
                id="login-username"
                name="username"
                v-model="loginUsername"
                type="text"
                autocomplete="username"
                required
                aria-required="true"
                :aria-invalid="Boolean(loginError)"
                :aria-describedby="loginError ? 'login-error-alert' : undefined"
              />
            </Field>

            <!-- Password Input -->
            <Field :data-invalid="Boolean(loginError)">
              <FieldLabel for="login-password">Password</FieldLabel>
              <Input
                id="login-password"
                name="password"
                v-model="loginPassword"
                type="password"
                autocomplete="current-password"
                required
                aria-required="true"
                :aria-invalid="Boolean(loginError)"
                :aria-describedby="loginError ? 'login-error-alert' : undefined"
              />
            </Field>
          </FieldGroup>

          <p class="text-xs text-muted-foreground">
            Demo account:
            <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">demo</code>
            /
            <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">demo123</code>
          </p>

          <!-- Sign In Submit Button -->
          <Button
            type="submit"
            class="w-full"
            :disabled="loginLoading || googleLoading"
          >
            <Spinner v-if="loginLoading" data-icon="inline-start" />
            {{ loginLoading ? "Signing in…" : "Sign in" }}
          </Button>

          <!-- Divider -->
          <div
            class="relative my-1 text-center text-xs after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border"
            aria-hidden="true"
          >
            <span class="relative z-10 bg-card px-2 text-muted-foreground uppercase tracking-wider">
              Or continue with
            </span>
          </div>

          <!-- Sign In with Google Button -->
          <Button
            type="button"
            variant="outline"
            class="w-full flex items-center justify-center gap-2"
            :disabled="loginLoading || googleLoading"
            @click="onGoogleSignIn"
            aria-label="Sign in with Google"
          >
            <Spinner v-if="googleLoading" data-icon="inline-start" />
            <svg
              v-else
              class="h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            <span>Sign in with Google</span>
          </Button>
        </CardContent>

        <CardFooter class="flex flex-col gap-2 pt-2 text-center text-sm text-muted-foreground">
          <p>
            Don't have an account?
            <RouterLink
              to="/register"
              class="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Create an account
            </RouterLink>
          </p>
        </CardFooter>
      </form>
    </Card>

    <!-- REGISTER VIEW -->
    <Card v-else class="w-full max-w-sm shadow-lg">
      <CardHeader>
        <CardTitle class="text-2xl font-bold">Create an Account</CardTitle>
        <CardDescription>Enter your details to sign up for Energy Monitor</CardDescription>
      </CardHeader>

      <form
        @submit.prevent="onRegister"
        novalidate
        aria-label="Create new account form"
      >
        <CardContent class="flex flex-col gap-4 pb-4">
          <!-- Success Alert -->
          <Alert
            v-if="regSuccessMessage"
            variant="default"
            class="border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2Icon class="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{{ regSuccessMessage }}</AlertDescription>
          </Alert>

          <!-- General Error Alert -->
          <Alert
            v-if="regGeneralError"
            variant="destructive"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircleIcon class="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Registration Notice</AlertTitle>
            <AlertDescription id="register-error-alert">{{ regGeneralError }}</AlertDescription>
          </Alert>

          <!-- Google Auth Error Alert -->
          <Alert
            v-if="googleError"
            variant="destructive"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircleIcon class="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Google Sign-In Notice</AlertTitle>
            <AlertDescription>{{ googleError }}</AlertDescription>
          </Alert>

          <FieldGroup>
            <!-- Username Input -->
            <Field :data-invalid="Boolean(regErrors.username)">
              <FieldLabel for="register-username">Username</FieldLabel>
              <Input
                id="register-username"
                name="username"
                v-model="regUsername"
                type="text"
                autocomplete="username"
                required
                aria-required="true"
                :aria-invalid="Boolean(regErrors.username)"
                :aria-describedby="regErrors.username ? 'reg-username-error' : undefined"
              />
              <FieldError
                id="reg-username-error"
                v-if="regErrors.username"
                role="alert"
                aria-live="polite"
              >
                {{ regErrors.username }}
              </FieldError>
            </Field>

            <!-- Email Address Input -->
            <Field :data-invalid="Boolean(regErrors.email)">
              <FieldLabel for="register-email">Email Address</FieldLabel>
              <Input
                id="register-email"
                name="email"
                v-model="regEmail"
                type="email"
                autocomplete="email"
                required
                aria-required="true"
                :aria-invalid="Boolean(regErrors.email)"
                :aria-describedby="regErrors.email ? 'reg-email-error' : undefined"
              />
              <FieldError
                id="reg-email-error"
                v-if="regErrors.email"
                role="alert"
                aria-live="polite"
              >
                {{ regErrors.email }}
              </FieldError>
            </Field>

            <!-- New Password Input -->
            <Field :data-invalid="Boolean(regErrors.password)">
              <FieldLabel for="register-password">Password</FieldLabel>
              <Input
                id="register-password"
                name="password"
                v-model="regPassword"
                type="password"
                autocomplete="new-password"
                required
                aria-required="true"
                :aria-invalid="Boolean(regErrors.password)"
                :aria-describedby="regErrors.password ? 'reg-password-error' : 'reg-password-desc'"
              />
              <FieldDescription
                id="reg-password-desc"
                v-if="!regErrors.password"
              >
                Must be at least 8 characters.
              </FieldDescription>
              <FieldError
                id="reg-password-error"
                v-if="regErrors.password"
                role="alert"
                aria-live="polite"
              >
                {{ regErrors.password }}
              </FieldError>
            </Field>

            <!-- Confirm Password Input -->
            <Field :data-invalid="Boolean(regErrors.confirmPassword)">
              <FieldLabel for="register-confirm-password">Confirm Password</FieldLabel>
              <Input
                id="register-confirm-password"
                name="confirm-password"
                v-model="regConfirmPassword"
                type="password"
                autocomplete="new-password"
                required
                aria-required="true"
                :aria-invalid="Boolean(regErrors.confirmPassword)"
                :aria-describedby="regErrors.confirmPassword ? 'reg-confirm-error' : undefined"
              />
              <FieldError
                id="reg-confirm-error"
                v-if="regErrors.confirmPassword"
                role="alert"
                aria-live="polite"
              >
                {{ regErrors.confirmPassword }}
              </FieldError>
            </Field>
          </FieldGroup>

          <!-- Create Account Submit Button -->
          <Button
            type="submit"
            class="w-full mt-2"
            :disabled="regLoading || googleLoading"
          >
            <Spinner v-if="regLoading" data-icon="inline-start" />
            {{ regLoading ? "Creating account…" : "Create account" }}
          </Button>

          <!-- Divider -->
          <div
            class="relative my-1 text-center text-xs after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border"
            aria-hidden="true"
          >
            <span class="relative z-10 bg-card px-2 text-muted-foreground uppercase tracking-wider">
              Or continue with
            </span>
          </div>

          <!-- Sign Up with Google Button -->
          <Button
            type="button"
            variant="outline"
            class="w-full flex items-center justify-center gap-2"
            :disabled="regLoading || googleLoading"
            @click="onGoogleSignIn"
            aria-label="Sign up with Google"
          >
            <Spinner v-if="googleLoading" data-icon="inline-start" />
            <svg
              v-else
              class="h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            <span>Sign up with Google</span>
          </Button>
        </CardContent>

        <CardFooter class="flex flex-col gap-2 pt-2 text-center text-sm text-muted-foreground">
          <p>
            Already have an account?
            <RouterLink
              to="/login"
              class="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Sign in
            </RouterLink>
          </p>
        </CardFooter>
      </form>
    </Card>
  </main>
</template>
