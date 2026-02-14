import React, { useEffect } from 'react';
import { Pressable, ViewProps, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  FadeInDown,
  Layout,
} from 'react-native-reanimated';

/**
 * FadeInView - Wrap any content for a fade + slide-up mount animation
 */
export function FadeInView({
  children,
  delay = 0,
  duration = 400,
  style,
  ...props
}: ViewProps & { delay?: number; duration?: number; children: React.ReactNode }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(duration).springify()}
      style={style}
      {...props}
    >
      {children}
    </Animated.View>
  );
}

/**
 * StaggeredItem - For FlatList items that stagger in sequentially
 */
export function StaggeredItem({
  children,
  index,
  style,
  ...props
}: ViewProps & { index: number; children: React.ReactNode }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).duration(350).springify()}
      layout={Layout.springify()}
      style={style}
      {...props}
    >
      {children}
    </Animated.View>
  );
}

/**
 * PressableScale - Button/touchable with spring scale on press
 */
export function PressableScale({
  children,
  onPress,
  style,
  disabled,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.96); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        onPress={onPress}
        disabled={disabled}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/**
 * SkeletonBox - Pulsing shimmer loading placeholder
 */
export function SkeletonBox({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 800 }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: '#334155',
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
