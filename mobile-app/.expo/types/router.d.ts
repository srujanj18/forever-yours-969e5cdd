/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/_sitemap` | `/accept-invitation` | `/auth` | `/chat` | `/gallery` | `/goals` | `/moments` | `/partner-profile` | `/profile` | `/video`;
      DynamicRoutes: never;
      DynamicRouteTemplate: never;
    }
  }
}
