import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UiService } from './core/ui.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <router-outlet />
    <div class="toasts" aria-live="polite">
      @for (t of ui.toasts(); track t.id) {
        <div class="toast" [class]="t.kind" (click)="ui.dismiss(t.id)">{{ t.text }}</div>
      }
    </div>
  `,
})
export class App {
  protected ui = inject(UiService);
}
