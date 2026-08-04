// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  firebaseConfig: {
    apiKey: "AIzaSyDwdp0E8BA5bLXad5-rPRXymTHFTuPJ-RU",
    authDomain: "adg-ui.firebaseapp.com",
    projectId: "adg-ui",
    storageBucket: "adg-ui.appspot.com",
    messagingSenderId: "600192451808",
    appId: "1:600192451808:web:e45db6262c59047047fc85"
  },
  /**
   * URL base del backend (incluye `/api` porque Express monta las rutas ahí).
   * Puerto por defecto: 3010 (publicado por `adg-api/docker-compose.yml` como `API_HOST_PORT` en `.env`).
   */
  urlApi: "http://localhost:3010/api"

};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
