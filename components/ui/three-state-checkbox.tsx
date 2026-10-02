import { Pressable, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { IconSymbol } from './icon-symbol';

export type CheckboxState = 'checked' | 'indeterminate' | 'unchecked';

/**
 * Cross-platform 3-state checkbox.
 *
 * React Native has no native indeterminate checkbox — `expo-checkbox`'s
 * `indeterminate` prop only works on iOS. This component renders a custom
 * 20×20 box using View + IconSymbol:
 *   checked       → filled tint box + checkmark icon
 *   indeterminate → filled tint box + minus icon
 *   unchecked     → transparent box with gray border
 *
 * Touch target is 28×28 pt; hitSlop={8} covers the required 44×44 pt minimum.
 */
export function ThreeStateCheckbox({
  state,
  onPress,
  accessibilityLabel,
}: {
  state: CheckboxState;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const isActive = state !== 'unchecked';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="checkbox"
      // RN expresses an indeterminate checkbox as `checked: 'mixed'` — there is
      // no separate `mixed` key, so screen readers never announced it.
      accessibilityState={{
        checked: state === 'indeterminate' ? 'mixed' : state === 'checked',
      }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.box, isActive ? styles.boxActive : styles.boxInactive]}
    >
      {state === 'checked' && (
        <IconSymbol name="checkmark" size={12} color="#fff" />
      )}
      {state === 'indeterminate' && (
        <IconSymbol name="minus" size={12} color="#fff" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  boxInactive: {
    backgroundColor: 'transparent',
    borderColor: '#D1D5DB',
  },
});
