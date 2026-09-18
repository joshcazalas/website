/** Every request from an open tab stays on the build it originally loaded. */
export const assetUrl = (path: string): string => `${import.meta.env.BASE_URL}${path}`;
