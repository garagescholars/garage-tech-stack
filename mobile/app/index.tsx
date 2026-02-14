import { useEffect } from "react";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/hooks/useAuth";

export default function Index() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/(auth)/login");
      return;
    }

    if (profile?.role === "admin") {
      router.replace("/(admin)/jobs");
    } else if (profile?.role === "scholar" && profile.onboardingComplete !== true) {
      router.replace("/(auth)/onboarding");
    } else {
      router.replace("/(scholar)/jobs");
    }
  }, [user, profile, loading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#14b8a6" />
      <Text style={styles.text}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f1b2d",
  },
  text: {
    marginTop: 16,
    color: "#94a3b8",
    fontSize: 16,
  },
});
