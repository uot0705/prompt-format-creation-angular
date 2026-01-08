import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { marked } from 'marked';
import {
  type CopyHistoryItem,
  type HistorySnapshot,
  copyHistoryCache,
} from './copy-history-cache';

interface Field {
  id: number;
  title: string;
  content: string;
  expanded: boolean;
}

type PresetType =
  | 'question'
  | 'error'
  | 'variableName'
  | 'refactor'
  | 'review'
  | 'organize'
  | 'analyze';

type HistoryPreview = {
  text: string;
  top: number;
  left: number;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  private readonly fieldTemplate: Field = {
    id: Date.now(),
    title: '',
    content: '',
    expanded: true,
  };

  // メイン質問とフィールド群（Signalで管理）
  protected readonly mainQuestion = signal('');
  protected readonly fields = signal<Field[]>([this.fieldTemplate]);

  // 選択中のプリセット
  protected readonly selectedPreset = signal<PresetType | null>(null);

  // コピペボタンの状態
  protected readonly copySuccess = signal(false);

  protected readonly historyOpen = signal(false);
  protected readonly historyItems = signal<CopyHistoryItem[]>(
    copyHistoryCache.getHistory()
  );
  protected readonly historyPreview = signal<HistoryPreview | null>(null);

  // 右パネル表示用
  protected readonly mainQuestionOutput = computed(() =>
    marked.parse(this.mainQuestion())
  );

  protected readonly fieldsOutputForDisplay = computed(() =>
    this.fields()
      .map(
        (field) =>
          `<section class="preview-field">
             <h2>${field.title}</h2>
             <pre><code>${field.content}</code></pre>
           </section>`
      )
      .join('')
  );

  protected onPresetClick(type: PresetType): void {
    // すでに選択されている場合も含め、常に「そのプリセット1つだけON」にする
    this.selectedPreset.set(type);
    this.applyPreset(type);
  }

  private applyPreset(type: PresetType): void {
    this.resetForm();

    switch (type) {
      case 'question': {
        this.mainQuestion.set('以下の質問に回答してください');
        this.addField('質問内容');
        break;
      }
      case 'error': {
        this.mainQuestion.set('以下のエラー内容を解決してください');
        this.addField('エラー内容');
        this.addField(
          '出力内容',
          '以下の内容を全て「エンジニア初心者でもわかりやすいように」丁寧に教えてください\n' +
            '・エラーの概要:\n' +
            '・エラーの原因:\n' +
            '・エラーの解決策:\n' +
            '・解決策する為の具体的な方法(コードの修正の場合はコードを書く):'
        );
        break;
      }
      case 'variableName': {
        this.mainQuestion.set(
          '以下の変数の使い道に合う変数名を5個提案してください。\n' +
            '提案する変数名は「シンプルな単語を使い」「意味が理解ができる」、「長くなりすぎない簡潔」な命名にしてください'
        );
        this.addField('変数の使い道');
        this.addField(
          '出力内容(以下の内容で5個)',
          '・変数名:\n・おすすめの理由：'
        );
        break;
      }
      case 'refactor': {
        this.mainQuestion.set('以下のリファクタをしてください');
        this.addField(
          '出力内容',
          'リファクタしたほうが良い箇所を「3箇所」選んでください。その3箇所の現在のコードを出力して、以下を「エンジニア初心者でもわかりやすいように」教えてください。\n' +
            '・なぜリファクタしたほうが良いか\n' +
            '・どのようなリファクタをすればいいのか\n' +
            '・リファクタしたコード'
        );
        break;
      }
      case 'review': {
        this.mainQuestion.set(
          '上司からのレビュー指摘内容を以下の「出力内容」に沿って回答してください'
        );
        this.addField(
          '出力内容',
          '以下の内容を全て「エンジニア初心者でもわかりやすいように」丁寧に教えてください\n' +
            '・上司からのレビュー指摘内容の概要\n' +
            '・レビュー内容に「なぜ」修正した方がいいのかの詳細\n' +
            '・現状のコードの修正箇所を箇条書きで書き出す\n' +
            '・上記の修正箇所の修正コードを提供してください'
        );
        this.addField('上司からのレビュー指摘内容');
        this.addField('対象コード');
        break;
      }
      case 'organize': {
        this.mainQuestion.set(
          '以下のやりとりを出力回答に沿って回答してください'
        );
        this.addField(
          '出力内容',
          '以下の内容を全て「エンジニア初心者でもわかりやすいように」丁寧に教えてください\n' +
            '・やりとりの概要\n' +
            '・結果どうなったのか\n' +
            '・上記の結果に至るまでの経緯を説明してください'
        );
        this.addField('やりとり');
        break;
      }
      case 'analyze': {
        this.mainQuestion.set(
          '以下の出力回答に沿ってコードの解析をしてください'
        );
        this.addField(
          '出力内容',
          '以下の内容を全て「エンジニア初心者でもわかりやすいように」丁寧に教えてください\n' +
            '・対象コードの全体的な概要\n' +
            '・対象コードの変数や関数ごとに処理を全て時系列で詳細におしえて\n' +
            '・対象コードの押さえておくべきホポイント3つ'
        );
        this.addField('対象のコード');
        break;
      }
    }
  }

  protected handleFieldChange(
    event: Event,
    fieldId: number,
    fieldType: 'title' | 'content'
  ): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const newValue = target.value;

    this.updateField(fieldId, newValue, fieldType);
  }

  private updateField(
    fieldId: number,
    newValue: string,
    fieldType: 'title' | 'content'
  ): void {
    this.fields.update((fields) =>
      fields.map((field) =>
        field.id === fieldId ? { ...field, [fieldType]: newValue } : field
      )
    );
  }

  protected addField(title = '', content = ''): void {
    const newField: Field = {
      ...this.fieldTemplate,
      id: Date.now(),
      title: title || this.fieldTemplate.title,
      content: content || this.fieldTemplate.content,
    };

    this.fields.update((fields) => [...fields, newField]);
  }

  protected removeField(field: Field): void {
    this.fields.update((fields) => fields.filter((f) => f.id !== field.id));
  }

  protected toggleField(field: Field): void {
    field.expanded = !field.expanded;
    this.fields.update((fields) => [...fields]);
  }

  protected moveFieldUp(field: Field): void {
    const index = this.fields().indexOf(field);
    if (index > 0) {
      const fields = [...this.fields()];
      [fields[index], fields[index - 1]] = [fields[index - 1], fields[index]];
      this.fields.set(fields);
    }
  }

  protected moveFieldDown(field: Field): void {
    const index = this.fields().indexOf(field);
    if (index < this.fields().length - 1) {
      const fields = [...this.fields()];
      [fields[index], fields[index + 1]] = [fields[index + 1], fields[index]];
      this.fields.set(fields);
    }
  }

  protected copyToClipboard(): void {
    const mainQuestionFormatted = this.mainQuestion().trim();

    const fieldsFormatted = this.fields()
      .map((field) => `## ${field.title}\n\`\`\`\n${field.content}\n\`\`\``)
      .join('\n\n');

    const outputText = `${mainQuestionFormatted}\n\n${fieldsFormatted}`;

    const snapshot: HistorySnapshot = {
      mainQuestion: this.mainQuestion(),
      fields: this.fields().map((field) => ({ ...field })),
    };

    navigator.clipboard
      .writeText(outputText)
      .then(() => {
        this.copySuccess.set(true);
        setTimeout(() => this.copySuccess.set(false), 2000);
      })
      .catch(() => undefined)
      .finally(() => {
        const next = copyHistoryCache.addHistory(outputText, snapshot);
        this.historyItems.set(next);
      });
  }

  protected setCommonTitleWord(fieldId: number, word: string): void {
    this.updateField(fieldId, word, 'title');
  }

  private resetForm(): void {
    this.mainQuestion.set('');
    this.fields.set([]);
  }

  protected openHistoryModal(): void {
    this.historyOpen.set(true);
    this.historyPreview.set(null);
    this.historyItems.set(copyHistoryCache.getHistory());
  }

  protected closeHistoryModal(): void {
    this.historyOpen.set(false);
    this.historyPreview.set(null);
  }

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

  protected showHistoryPreview(item: CopyHistoryItem, event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (!target) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const maxWidth = 260;
    const maxHeight = 180;
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

  protected hideHistoryPreview(): void {
    this.historyPreview.set(null);
  }

  protected applyHistory(item: CopyHistoryItem): void {
    this.resetForm();

    if (item.snapshot) {
      this.mainQuestion.set(item.snapshot.mainQuestion);
      this.fields.set(item.snapshot.fields.map((field) => ({ ...field })));
    } else {
      this.mainQuestion.set(item.text);
      this.fields.set([]);
    }

    this.closeHistoryModal();
  }

  private getHistorySnippet(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) {
      return '（空）';
    }

    return trimmed.slice(0, 15);
  }
}
