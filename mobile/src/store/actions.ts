import { createAction } from '@reduxjs/toolkit';

/**
 * A master logout action that can be dispatched from anywhere in the app to trigger a global state reset.
 */
export const logout = createAction('user/logout');