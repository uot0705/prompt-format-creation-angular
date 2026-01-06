import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { COMPOSITION_BUFFER_MODE } from '@angular/forms';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    { provide: COMPOSITION_BUFFER_MODE, useValue: false },
  ]
};
