<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { login } from "../services/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircleIcon } from "@lucide/vue";

const router = useRouter();
const username = ref("demo");
const password = ref("demo123");
const error = ref("");
const loading = ref(false);

async function onSubmit() {
  error.value = "";
  loading.value = true;
  try {
    await login(username.value, password.value);
    router.push("/");
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen flex items-center justify-center p-6 bg-background">
    <Card class="w-full max-w-sm shadow-lg">
      <CardHeader>
        <CardTitle class="text-2xl font-bold">Energy Monitor</CardTitle>
        <CardDescription>Sign in to view live meter data</CardDescription>
      </CardHeader>

      <form @submit.prevent="onSubmit">
        <CardContent class="flex flex-col gap-4 pb-4">
          <Alert v-if="error" variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Authentication Failed</AlertTitle>
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>

          <FieldGroup>
            <Field :data-invalid="Boolean(error)">
              <FieldLabel for="username">Username</FieldLabel>
              <Input
                id="username"
                v-model="username"
                type="text"
                autocomplete="username"
                required
                :aria-invalid="Boolean(error)"
              />
            </Field>

            <Field :data-invalid="Boolean(error)">
              <FieldLabel for="password">Password</FieldLabel>
              <Input
                id="password"
                v-model="password"
                type="password"
                autocomplete="current-password"
                required
                :aria-invalid="Boolean(error)"
              />
            </Field>
          </FieldGroup>

          <p class="text-xs text-muted-foreground">
            Demo account:
            <code
              class="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground"
              >demo</code
            >
            /
            <code
              class="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground"
              >demo123</code
            >
          </p>
        </CardContent>

        <CardFooter class="pt-4">
          <Button type="submit" class="w-full" :disabled="loading">
            <Spinner v-if="loading" data-icon="inline-start" />
            {{ loading ? "Signing in…" : "Sign in" }}
          </Button>
        </CardFooter>
      </form>
    </Card>
  </main>
</template>
