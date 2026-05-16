import { type PropsWithChildren } from 'react';
import { usePushRegistration } from './push-notifications';

/**
 * Mounted inside the Clerk + Query providers so `usePushRegistration` can
 * read `isSignedIn` + call `useApiClient`. Pure side-effect component.
 */
export function PushRegistrationBootstrap({ children }: PropsWithChildren) {
  usePushRegistration();
  return <>{children}</>;
}
