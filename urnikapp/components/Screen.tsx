import React from "react";
import { View, ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function Screen({ style, ...props }: ViewProps) {
  const insets = useSafeAreaInsets();

  const TAB_HEIGHT = 62;
  const TAB_BOTTOM_GAP = 8;
  const TAB_SIDE_MARGIN = 12;

  // prostor, da nič ni pod floating tab barom
  const bottomPadding = insets.bottom + TAB_BOTTOM_GAP + TAB_HEIGHT + 12;

  return (
    <View
      {...props}
      style={[
        { flex: 1, paddingBottom: bottomPadding },
        style,
      ]}
    />
  );
}
