import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows, layout } from "../constants/theme";

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  size?: "default" | "large";
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
};

export default function FormButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  size = "default",
  icon,
  style,
}: Props) {
  const isDisabled = disabled || loading;

  const buttonStyle = [
    styles.button,
    { minHeight: size === "large" ? layout.buttonHeight.large : layout.buttonHeight.default },
    variant === "primary" && styles.primary,
    variant === "secondary" && styles.secondary,
    variant === "danger" && styles.danger,
    isDisabled && styles.disabled,
    style,
  ];

  const textStyle = [
    styles.text,
    variant === "secondary" && styles.textSecondary,
  ];

  const iconColor = variant === "secondary" ? colors.text.primary : "#ffffff";

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "secondary" ? colors.text.primary : "#ffffff"}
        />
      ) : (
        <View style={styles.content}>
          {icon && <Ionicons name={icon} size={18} color={iconColor} />}
          <Text style={textStyle}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primary: {
    backgroundColor: colors.brand.teal,
    ...shadows.button,
  },
  secondary: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  danger: {
    backgroundColor: colors.status.error,
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    letterSpacing: 0.1,
  },
  textSecondary: {
    color: colors.text.primary,
  },
});
