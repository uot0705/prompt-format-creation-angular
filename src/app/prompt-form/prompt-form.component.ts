import { afterNextRender, Component, inject, Injector, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PromptOutputComponent } from '../prompt-output/prompt-output.component';
import { PromptFormStore, type Field, type FieldAddPosition, type PresetType } from './prompt-form.store';

@Component({
  selector: 'app-prompt-form',
  standalone: true,
  imports: [FormsModule, PromptOutputComponent],
  templateUrl: './prompt-form.component.html',
  styleUrls: ['./prompt-form.component.scss'],
})
export class PromptFormComponent {
  private readonly formStore = inject(PromptFormStore);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  // メイン質問の入力値を共有ストアから参照する。
  protected readonly mainQuestion = this.formStore.mainQuestion;
  // 新規フィールドの追加位置。初期値は従来通り末尾。
  protected readonly addPosition = signal<FieldAddPosition>('bottom');
  // フィールド一覧を共有ストアから参照する。
  protected readonly fields = this.formStore.fields;
  // 選択中のプリセットを共有ストアから参照する。
  protected readonly selectedPreset = this.formStore.selectedPreset;

  // プリセット選択をストアに反映する。
  protected onPresetClick(type: PresetType): void {
    this.formStore.selectPreset(type);
  }

  // 入力イベントから値を取り出してストアへ反映する。
  protected handleFieldChange(
    event: Event,
    fieldId: number,
    fieldType: 'title' | 'content'
  ): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.formStore.updateField(fieldId, target.value, fieldType);
  }

  // 空のフィールドを追加する。
  protected addField(): void {
    const fieldId = this.formStore.addField('', '', this.addPosition());
    afterNextRender(() => {
      const input = this.document.getElementById(`field-title-${fieldId}`);
      if (!input) return;
      input.focus({ preventScroll: true });
      this.revealField(input);
    }, { injector: this.injector });
  }


  // PCでは右ペインだけを動かし、モバイルではページ内の最小限の移動にする。
  private revealField(input: HTMLElement): void {
    const panel = input.closest<HTMLElement>('.fields-section');
    if (!panel) return;
    if (getComputedStyle(panel).overflowY !== 'auto') {
      input.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return;
    }
    const panelRect = panel.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const toolbarHeight = panel.querySelector('.fields-toolbar')?.getBoundingClientRect().height ?? 0;
    const top = panelRect.top + toolbarHeight + 16;
    const bottom = panelRect.bottom - 16;
    if (inputRect.top < top) panel.scrollTop += inputRect.top - top;
    else if (inputRect.bottom > bottom) panel.scrollTop += inputRect.bottom - bottom;
  }

  // 指定フィールドを削除する。
  protected removeField(field: Field): void {
    this.formStore.removeField(field.id);
  }

  // 指定フィールドの折りたたみ状態を切り替える。
  protected toggleField(field: Field): void {
    this.formStore.toggleField(field.id);
  }

  // 指定フィールドを1つ上に移動する。
  protected moveFieldUp(field: Field): void {
    this.formStore.moveFieldUp(field.id);
  }

  // 指定フィールドを1つ下に移動する。
  protected moveFieldDown(field: Field): void {
    this.formStore.moveFieldDown(field.id);
  }

  // 共通ワードボタンでタイトルを更新する。
  protected setCommonTitleWord(fieldId: number, word: string): void {
    this.formStore.setCommonTitleWord(fieldId, word);
  }

}
