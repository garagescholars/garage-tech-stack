import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, ViewProps, ViewStyle, StyleProp } from 'react-native';

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
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]} {...props}>
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
    <FadeInView delay={index * 80} duration={350} style={style} {...props}>
      {children}
    </FadeInView>
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
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPressIn={() => { Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start(); }}
        onPressOut={() => { Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start(); }}
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
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: '#2a3545',
          opacity,
        },
        style,
      ]}
    />
  );
}
