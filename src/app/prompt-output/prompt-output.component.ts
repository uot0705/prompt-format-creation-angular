import { Component, computed, inject, signal } from '@angular/core';
import { marked } from 'marked';
import {
  type CopyHistoryItem,
  type HistorySnapshot,
  copyHistoryCache,
} from '../copy-history-cache';
import { PromptFormStore, type Field } from '../prompt-form/prompt-form.store';

type HistoryPreview = {
  text: string;
  top: number;
  left: number;
};

@Component({
  selector: 'app-prompt-output',
  standalone: true,
  templateUrl: './prompt-output.component.html',
  styleUrls: ['./prompt-output.component.scss'],
})
export class PromptOutputComponent {
  private readonly formStore = inject(PromptFormStore);

  // 入力済みの質問テキストを共有ストアから参照する。
  protected readonly mainQuestion = this.formStore.mainQuestion;
  // 入力フィールドの一覧を共有ストアから参照する。
  protected readonly fields = this.formStore.fields;

  // コピーボタンの成功状態を表示する。
  protected readonly copySuccess = signal(false);
  // 履歴モーダルの開閉状態を管理する。
  protected readonly historyOpen = signal(false);
  // 表示する履歴一覧を保持する。
  protected readonly historyItems = signal(copyHistoryCache.getHistory());
  // 履歴プレビューの座標と本文を保持する。
  protected readonly historyPreview = signal<HistoryPreview | null>(null);

  // Markdown から右ペインの表示用HTMLを生成する。
  protected readonly mainQuestionOutput = computed(() =>
    marked.parse(this.mainQuestion())
  );

  // フィールド入力をプレビュー用HTMLに整形する。
  protected readonly fieldsOutputForDisplay = computed(() =>
    this.buildFieldsOutput(this.fields())
  );

  // 画面内容をクリップボードへコピーし、履歴へ保存する。
  protected copyToClipboard(): Promise<void> {
    const mainQuestionFormatted = this.mainQuestion().trim();
    const outputText = this.buildOutputText(mainQuestionFormatted, this.fields());
    const snapshot = this.createSnapshot();

    return navigator.clipboard
      .writeText(outputText)
      .then(() => {
        this.copySuccess.set(true);
        setTimeout(() => this.copySuccess.set(false), 2000);
      })
      .catch(() => undefined)
      .finally(() => {
        const next = copyHistoryCache.addHistory(outputText, snapshot);
        this.historyItems.set(next);
      })
      .then(() => undefined);
  }

  // 履歴モーダルを開き、最新の履歴を読み込む。
  protected openHistoryModal(): void {
    this.historyOpen.set(true);
    this.historyPreview.set(null);
    this.historyItems.set(copyHistoryCache.getHistory());
  }

  // 履歴モーダルを閉じてプレビューを解除する。
  protected closeHistoryModal(): void {
    this.historyOpen.set(false);
    this.historyPreview.set(null);
  }

  // 履歴表示用のラベルを整形する。
  protected formatHistoryLabel(item: CopyHistoryItem): string {
    const date = new Date(item.createdAt);
    const dateLabel = `${date.getFullYear()}/${String(
      date.getMonth() + 1
    ).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(
      date.getHours()
    ).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const snippet = this.getHistorySnippet(item.text);
    return `${dateLabel} / ${snippet}`;
  }

  // ホバー位置に合わせて履歴プレビューを表示する。
  protected showHistoryPreview(item: CopyHistoryItem, event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (!target) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const maxWidth = 260;
    const maxHeight = 180;

    // ボタンが画面端にあってもプレビューがはみ出さないように位置を調整する。
    let left = rect.right + 12;
    if (left + maxWidth > window.innerWidth - 12) {
      left = Math.max(12, rect.left - maxWidth - 12);
    }

    let top = rect.top + rect.height / 2 - maxHeight / 2;
    top = Math.max(12, Math.min(top, window.innerHeight - maxHeight - 12));

    this.historyPreview.set({
      text: item.text,
      top,
      left,
    });
  }

  // 履歴プレビューの表示を消す。
  protected hideHistoryPreview(): void {
    this.historyPreview.set(null);
  }

  // 履歴の内容をフォームへ反映し、モーダルを閉じる。
  protected applyHistory(item: CopyHistoryItem): void {
    this.formStore.resetForm();

    if (item.snapshot) {
      this.formStore.setMainQuestion(item.snapshot.mainQuestion);
      this.formStore.setFields(
        item.snapshot.fields.map((field) => ({ ...field }))
      );
    } else {
      this.formStore.setMainQuestion(item.text);
      this.formStore.setFields([]);
    }

    this.closeHistoryModal();
  }

  // 出力用のテキストをヘッダー付きで組み立てる。
  private buildOutputText(mainQuestion: string, fields: Field[]): string {
    const fieldsFormatted = fields
      .map((field) => `## ${field.title}\n\`\`\`\n${field.content}\n\`\`\``)
      .join('\n\n');

    return `${mainQuestion}\n\n${fieldsFormatted}`;
  }

  // プレビュー用のHTML断片を生成する。
  private buildFieldsOutput(fields: Field[]): string {
    return fields
      .map(
        (field) =>
          `<section class="preview-field">
             <h2>${field.title}</h2>
             <pre><code>${field.content}</code></pre>
           </section>`
      )
      .join('');
  }

  // 履歴に保存するための現在スナップショットを作る。
  private createSnapshot(): HistorySnapshot {
    return {
      mainQuestion: this.mainQuestion(),
      fields: this.fields().map((field) => ({ ...field })),
    };
  }

  // 履歴ラベルで使う短い本文を切り出す。
  private getHistorySnippet(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) {
      return '（空）';
    }

    return trimmed.slice(0, 15);
  }
}
