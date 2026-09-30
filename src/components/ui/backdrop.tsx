import { Pressable, StyleSheet } from 'react-native';

/**
 * One definition of the dimmed scrim behind every popover surface, so a sheet,
 * a modal and a select overlay can never drift apart.
 *
 * The value is intentionally an inline rgba() rather than a themed token: it
 * composites over whatever is behind it (including the dark and light
 * palettes), and modals render outside the themed root view where CSS
 * variables are not in scope.
 */
export const BACKDROP_COLOR = 'rgba(0, 0, 0, 0.65)';

/** Full-screen dismissable scrim. Put it before the content it dims. */
export function Backdrop({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      onPress={onPress}
      style={[StyleSheet.absoluteFill, { backgroundColor: BACKDROP_COLOR }]}
    />
  );
}