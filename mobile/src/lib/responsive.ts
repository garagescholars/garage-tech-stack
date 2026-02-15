import { Platform, useWindowDimensions } from "react-native";

export const isWeb = Platform.OS === "web";

export function useResponsive() {
  const { width } = useWindowDimensions();
  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    width,
  };
}
