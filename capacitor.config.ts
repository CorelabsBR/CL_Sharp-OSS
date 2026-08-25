/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.corelabs.sharp',
  appName: 'Sharp-OSS',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
