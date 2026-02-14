import { useEffect, useState } from "react";
import { Text, StyleSheet } from "react-native";
import { Timestamp } from "firebase/firestore";

type Props = {
  deadline: Timestamp | undefined;
  prefix?: string;
};

export default function CountdownTimer({ deadline, prefix = "Claim closes in" }: Props) {
  const [remaining, setRemaining] = useState("");
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    if (!deadline) return;

    const update = () => {
      const now = Date.now();
      const end = deadline.toMillis();
      const diff = end - now;

      if (diff <= 0) {
        setRemaining("Expired");
        setUrgent(true);
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (hours > 0) {
        setRemaining(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setRemaining(`${minutes}m ${seconds}s`);
      } else {
        setRemaining(`${seconds}s`);
      }

      setUrgent(diff < 3600000); // urgent when < 1 hour
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;

  return (
    <Text style={[styles.text, urgent && styles.urgent]}>
      {prefix} {remaining}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  urgent: {
    color: "#ef4444",
  },
});
