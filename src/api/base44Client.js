import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const localBase44Stub = {
  auth: {
    me: async () => null,
    logout: () => {},
    redirectToLogin: () => {},
  },
};

//Create a client with authentication required
export const base44 = appId
  ? createClient({
      appId,
      token,
      functionsVersion,
      serverUrl: '',
      requiresAuth: false,
      appBaseUrl,
    })
  : localBase44Stub;
