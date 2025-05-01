import { Redirect } from 'expo-router';

// Redirect from the root to the dashboard tab
export default function Index() {
  return <Redirect href="/dashboard" />;
}