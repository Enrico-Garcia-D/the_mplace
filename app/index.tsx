import { ActivityIndicator, View } from 'react-native';
import { useTheme } from './theme';

export default function Index() {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );
}
