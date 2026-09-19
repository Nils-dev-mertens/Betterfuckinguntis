import { Feather } from '@expo/vector-icons';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';
import * as React from 'react';
import { cssInterop } from 'nativewind';

type FeatherProps = ComponentProps<typeof Feather>;

function IconImpl({ as, ...props }: { as: string } & Omit<FeatherProps, 'name'>) {
  return <Feather name={as as FeatherProps['name']} {...props} />;
}

cssInterop(IconImpl, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      height: 'size',
      width: 'size',
    },
  },
});

/**
 * A wrapper component for icons with NativeWind `className` support via
 * `cssInterop`.
 *
 * Icons previously used `lucide-react-native`, which renders SVG paths via
 * `react-native-svg` — fine in Expo Go, but the SVG native module failed to
 * render in release APKs on some devices. Feather (via `@expo/vector-icons`)
 * is **font-based**: glyphs render as text, so there is no native SVG
 * dependency at all. Visually it's nearly identical — Lucide is a fork of
 * Feather.
 *
 * @component
 * @example
 * ```tsx
 * import { Icon } from '@/components/ui/icon';
 *
 * <Icon as="chevron-right" className="text-red-500" size={16} />
 * ```
 *
 * @param {string} as - Feather glyph name
 * @param {string} className - Utility classes to style the icon using Nativewind
 * @param {number} size - Icon size (defaults to 14)
 * @param {...FeatherProps} ...props - All remaining props (color, style, …) pass through
 */
function Icon({ as, className, size = 14, ...props }: { as: string } & Omit<FeatherProps, 'name'>) {
  const textClass = React.useContext(TextClassContext);
  return (
    <IconImpl
      as={as}
      className={cn('text-foreground', textClass, className)}
      size={size}
      {...props}
    />
  );
}

export { Icon };
