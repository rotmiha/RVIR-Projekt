import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function EventsScreen() {

      const insets = useSafeAreaInsets();
    
        const TAB_HEIGHT = 62;
        const GAP = 8;
        const topPad = insets.top + GAP + TAB_HEIGHT + 12;
  return (
    <View style={{ flex: 1, padding: 16, paddingTop: topPad }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Events</Text>
    </View>
  );
}
