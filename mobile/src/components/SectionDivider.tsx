import { View, StyleSheet, ViewStyle } from "react-native";
import { colors, spacing } from "../constants/theme";

type Props = {
  style?: ViewStyle;
};

export default function SectionDivider({ style }: Props) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: colors.border.divider,
    marginVertical: spacing.md,
  },
});
