import { Redirect } from 'expo-router';

export default function NotificationClick() {
  console.log('[Notification] Handling click redirect...');
  return <Redirect href="/" />;
}
