import { Component } from '@angular/core';
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
  // ルートではフォームと出力コンポーネントを並べて表示するだけにする。
}
