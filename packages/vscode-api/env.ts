export const appName = "NPSharp";
export const appHost = "desktop";
export const language = "en";
export const machineId = "npsharp-placeholder";
export const sessionId = "npsharp-placeholder-session";
export const uriScheme = "npsharp";

export async function openExternal(target: string): Promise<boolean> {
  console.info(`[NPSharp extension] openExternal ${target}`);
  return false;
}
