import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PromptFormStore, type Field, type PresetType } from './prompt-form.store';

@Component({
  selector: 'app-prompt-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './prompt-form.component.html',
  styleUrls: ['./prompt-form.component.scss'],
})
export class PromptFormComponent {
  private readonly formStore = inject(PromptFormStore);

  // メイン質問の入力値を共有ストアから参照する。
  protected readonly mainQuestion = this.formStore.mainQuestion;
  // ブラウザタブ用の任意タイトルを共有ストアから参照する。
  protected readonly browserTabTitle = this.formStore.browserTabTitle;
  // フィールド一覧を共有ストアから参照する。
  protected readonly fields = this.formStore.fields;
  // 選択中のプリセットを共有ストアから参照する。
  protected readonly selectedPreset = this.formStore.selectedPreset;
  // ブラウザタブ用入力欄の最大文字数を定義する。
  protected readonly browserTabTitleMaxLength = 120;
  // 編集対象のフィールドIDを保持する。
  protected readonly editingFieldId = signal<number | null>(null);
  // 編集中フィールドを導出する。
  protected readonly editingField = computed<Field | null>(() => {
    const id = this.editingFieldId();
    if (id === null) {
      return null;
    }
    return this.fields().find((field) => field.id === id) ?? null;
  });

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
    this.formStore.addField();
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

  // フィールド編集モーダルを開く。
  protected openFieldModal(field: Field): void {
    this.editingFieldId.set(field.id);
  }

  // 編集モーダルを閉じる。
  protected closeModal(): void {
    this.editingFieldId.set(null);
  }
}
