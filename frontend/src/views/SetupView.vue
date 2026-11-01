<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { getUser } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeftIcon, CheckIcon, SaveIcon, SettingsIcon } from "@lucide/vue";
import { getSavedPortNames, saveSavedPortNames } from "@/services/portConfig";

const router = useRouter();
const user = getUser();

// Reactive array holding display names for ports 0 through 7
const portNames = ref(Array.from({ length: 8 }, () => ""));
const savedSuccess = ref(false);

// Load persisted port names from localStorage
onMounted(() => {
  const saved = getSavedPortNames();
  for (let i = 0; i < 8; i++) {
    if (typeof saved[i] === "string") {
      portNames.value[i] = saved[i];
    }
  }
});

function onSave() {
  /**
   * NOTE: For now, these port display names are saved to localStorage.
   * Once backend / database integration is implemented, these names should be
   * stored in the database instead of client-side localStorage.
   */
  saveSavedPortNames(portNames.value);
  savedSuccess.value = true;
  setTimeout(() => {
    savedSuccess.value = false;
  }, 3000);
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-12 flex flex-col gap-6 w-full">
    <!-- Page Header -->
    <header class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <Button variant="outline" size="sm" @click="router.push('/')">
          <ArrowLeftIcon data-icon="inline-start" />
          Back to Dashboard
        </Button>
        <span v-if="user" class="text-sm text-muted-foreground">
          Logged in as <strong class="text-foreground">{{ user.username }}</strong>
        </span>
      </div>

      <div class="border-b border-border/50 pb-5">
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground m-0">
          Setup
        </h1>
        <p class="mt-1 text-sm text-muted-foreground m-0">
          Configure device connections, input ports, and system preferences.
        </p>
      </div>
    </header>

    <!-- System Setup Panel -->
    <main class="flex flex-col gap-6 w-full">
      <Card class="w-full">
        <CardHeader>
          <div class="flex items-center gap-2">
            <SettingsIcon class="size-5 text-muted-foreground" />
            <CardTitle>System Setup</CardTitle>
          </div>
          <CardDescription>
            Assign custom display names for each input port (ports 0–7).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div
              v-for="(name, index) in portNames"
              :key="index"
              class="flex flex-col gap-2 p-3.5 rounded-lg border border-border/50 bg-card/50 hover:bg-card transition-colors"
            >
              <Label :for="'port-' + index" class="flex items-center justify-between text-sm font-medium">
                <span class="flex items-center gap-2">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-muted text-foreground border border-border/60">
                    Port {{ index }}
                  </span>
                  <span>Display Name</span>
                </span>
              </Label>
              <Input
                :id="'port-' + index"
                v-model="portNames[index]"
                class="w-full"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter class="flex items-center justify-end gap-4 border-t border-border/50 pt-4">
          <transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 translate-x-1"
            enter-to-class="opacity-100 translate-x-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 translate-x-0"
            leave-to-class="opacity-0 translate-x-1"
          >
            <span
              v-if="savedSuccess"
              class="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1.5"
            >
              <CheckIcon class="size-4" />
              Port names saved!
            </span>
          </transition>
          <Button @click="onSave">
            <SaveIcon data-icon="inline-start" />
            Save Port Names
          </Button>
        </CardFooter>
      </Card>
    </main>
  </div>
</template>
