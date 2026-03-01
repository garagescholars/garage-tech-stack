import React from "react";
import { ScrollView, View, StyleSheet, Platform } from "react-native";
import { useResponsive } from "../lib/responsive";
import { colors, layout } from "../constants/theme";

type Props = {
  children: React.ReactNode;
  scrollable?: boolean;
};

export default function AdminPageWrapper({
  children,
  scrollable = true,
}: Props) {
  const { isDesktop } = useResponsive();

  const content = (
    <View style={[styles.inner, isDesktop && styles.innerDesktop]}>
      {children}
    </View>
  );

  if (!scrollable) {
    return <View style={styles.container}>{content}</View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={Platform.OS === "web"}
    >
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
    padding: layout.screenPadding,
    paddingBottom: 40,
  },
  innerDesktop: {
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
    width: "100%" as any,
    paddingHorizontal: 40,
  },
});
