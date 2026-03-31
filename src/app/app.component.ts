import { DOCUMENT } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { PromptFormComponent } from './prompt-form/prompt-form.component';
import { PromptFormStore } from './prompt-form/prompt-form.store';
import { PromptOutputComponent } from './prompt-output/prompt-output.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [PromptFormComponent, PromptOutputComponent],
  providers: [PromptFormStore],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  private readonly document = inject(DOCUMENT);
  private readonly formStore = inject(PromptFormStore);

  // ストアの状態に合わせてブラウザタブタイトルを同期する。
  private readonly syncBrowserTabTitle = effect(() => {
    this.document.title = this.formStore.resolvedBrowserTabTitle();
  });
}
