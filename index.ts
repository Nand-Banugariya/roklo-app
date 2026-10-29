// Notification button presses can start the app in the background with no screen
// mounted, so their handlers must be registered before Expo Router loads.
import "./src/features/notifications/services/notification-actions-setup";
import "expo-router/entry";
