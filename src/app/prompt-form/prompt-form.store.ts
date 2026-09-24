import { Injectable, computed, signal } from '@angular/core';

export const DEFAULT_BROWSER_TAB_TITLE = 'プロンプト作成ツール';
export const MAX_BROWSER_TAB_TITLE_LENGTH = 80;

export type PresetType =
  | 'question'
  | 'error'
  | 'review'
  | 'organize';

export type Field = {
  id: number;
  title: string;
  content: string;
  expanded: boolean;
};

export type ReplaceTextTarget =
  | { kind: 'mainQuestion' }
  | { kind: 'browserTabTitle' }
  | { kind: 'fieldTitle'; fieldId: number }
  | { kind: 'fieldContent'; fieldId: number };

@Injectable()
export class PromptFormStore {
  // 空のフィールドひな形を保持する。
  private readonly emptyField = {
    title: '',
    content: '',
    expanded: true,
  };
  // フィールドIDの採番を行う。
  private nextFieldId = 1;

  // メイン質問の本文を保持する。
  readonly mainQuestion = signal('');
  // ブラウザタブに表示する任意タイトルを保持する。
  readonly browserTabTitle = signal('');
  // 入力フィールドの配列を保持する。
  readonly fields = signal([this.createField()]);
  // 選択中のプリセット種別を保持する。
  readonly selectedPreset = signal<PresetType | null>(null);
  // ブラウザタブに実際に表示するタイトルを導出する。
  readonly resolvedBrowserTabTitle = computed(() =>
    this.buildResolvedBrowserTabTitle()
  );

  // プリセットを選び、フォーム内容を適用する。
  selectPreset(type: PresetType): void {
    this.selectedPreset.set(type);
    this.applyPreset(type);
  }

  // メイン質問を更新する。
  setMainQuestion(value: string): void {
    this.mainQuestion.set(value);
  }

  // ブラウザタブ用の任意タイトルを更新する。
  setBrowserTabTitle(value: string): void {
    this.browserTabTitle.set(typeof value === 'string' ? value : '');
  }

  // フィールド配列を丸ごと入れ替える。
  setFields(fields: Field[]): void {
    this.fields.set(fields);
    this.updateNextFieldId(fields);
  }

  // 選択中のプリセットだけを更新する（フォーム内容は変更しない）。
  setSelectedPreset(value: PresetType | null): void {
    this.selectedPreset.set(value);
  }

  // 指定フィールドのタイトル/本文を更新する。
  updateField(
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

  // 新しいフィールドを末尾に追加する。
  addField(title = '', content = ''): void {
    const newField = this.createField(title, content);
    this.fields.update((fields) => [...fields, newField]);
  }

  // 指定したフィールドを削除する。
  removeField(fieldId: number): void {
    this.fields.update((fields) =>
      fields.filter((field) => field.id !== fieldId)
    );
  }

  // 指定フィールドの開閉状態を反転する。
  toggleField(fieldId: number): void {
    this.fields.update((fields) =>
      fields.map((field) =>
        field.id === fieldId
          ? { ...field, expanded: !field.expanded }
          : field
      )
    );
  }

  // 指定フィールドを1つ上に移動する。
  moveFieldUp(fieldId: number): void {
    this.fields.update((fields) => {
      const index = fields.findIndex((field) => field.id === fieldId);
      if (index <= 0) {
        return fields;
      }
      const next = [...fields];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  // 指定フィールドを1つ下に移動する。
  moveFieldDown(fieldId: number): void {
    this.fields.update((fields) => {
      const index = fields.findIndex((field) => field.id === fieldId);
      if (index === -1 || index >= fields.length - 1) {
        return fields;
      }
      const next = [...fields];
      [next[index + 1], next[index]] = [next[index], next[index + 1]];
      return next;
    });
  }

  // 共通ワードボタンからタイトルをセットする。
  setCommonTitleWord(fieldId: number, word: string): void {
    this.updateField(fieldId, word, 'title');
  }

  // 指定された入力欄の一致箇所だけを置換する。
  replaceTextOccurrence(
    target: ReplaceTextTarget,
    start: number,
    searchText: string,
    replacementText: string
  ): boolean {
    if (!searchText || start < 0) {
      return false;
    }

    const replaceAt = (value: string): string | null => {
      if (value.slice(start, start + searchText.length) !== searchText) {
        return null;
      }
      return `${value.slice(0, start)}${replacementText}${value.slice(
        start + searchText.length
      )}`;
    };

    if (target.kind === 'mainQuestion') {
      const next = replaceAt(this.mainQuestion());
      if (next === null) {
        return false;
      }
      this.mainQuestion.set(next);
      return true;
    }

    if (target.kind === 'browserTabTitle') {
      const next = replaceAt(this.browserTabTitle());
      if (next === null) {
        return false;
      }
      this.browserTabTitle.set(next);
      return true;
    }

    let replaced = false;
    this.fields.update((fields) =>
      fields.map((field) => {
        if (field.id !== target.fieldId) {
          return field;
        }

        const fieldType = target.kind === 'fieldTitle' ? 'title' : 'content';
        const next = replaceAt(field[fieldType]);
        if (next === null) {
          return field;
        }

        replaced = true;
        return { ...field, [fieldType]: next };
      })
    );
    return replaced;
  }

  // すべての入力欄にある一致を、開始時点の件数分まとめて置換する。
  replaceAllText(searchText: string, replacementText: string): number {
    if (!searchText) {
      return 0;
    }

    let replacedCount = 0;
    const replaceAllInValue = (value: string): string => {
      const parts = value.split(searchText);
      const count = parts.length - 1;
      if (count === 0) {
        return value;
      }
      replacedCount += count;
      return parts.join(replacementText);
    };

    this.mainQuestion.update(replaceAllInValue);
    this.browserTabTitle.update(replaceAllInValue);
    this.fields.update((fields) =>
      fields.map((field) => ({
        ...field,
        title: replaceAllInValue(field.title),
        content: replaceAllInValue(field.content),
      }))
    );

    return replacedCount;
  }

  // フォームの入力内容を初期化する。
  resetForm(): void {
    this.mainQuestion.set('');
    this.browserTabTitle.set('');
    this.fields.set([]);
  }

  // 新しいフィールドを作成する。
  private createField(title = '', content = ''): Field {
    return {
      id: this.nextFieldId++,
      title: title || this.emptyField.title,
      content: content || this.emptyField.content,
      expanded: this.emptyField.expanded,
    };
  }

  // 既存フィールドから次のIDを更新する。
  private updateNextFieldId(fields: Field[]): void {
    const maxId = fields.reduce((max, field) => Math.max(max, field.id), 0);
    this.nextFieldId = Math.max(this.nextFieldId, maxId + 1);
  }

  // 選択プリセットに応じた入力内容を流し込む。
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
    }
  }

  // 専用入力、メイン質問、既定値の順でタブタイトルを決める。
  private buildResolvedBrowserTabTitle(): string {
    const explicitTitle = this.normalizeBrowserTabTitle(this.browserTabTitle());
    if (explicitTitle) {
      return explicitTitle;
    }

    const fallbackTitle = this.normalizeBrowserTabTitle(this.mainQuestion());
    if (fallbackTitle) {
      return fallbackTitle;
    }

    return DEFAULT_BROWSER_TAB_TITLE;
  }

  // タブ表示向けに空白を整え、長すぎる場合だけ末尾を省略する。
  private normalizeBrowserTabTitle(value: string | null | undefined): string {
    const safeValue = typeof value === 'string' ? value : '';

    const normalized = safeValue.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }

    const characters = Array.from(normalized);
    if (characters.length <= MAX_BROWSER_TAB_TITLE_LENGTH) {
      return normalized;
    }

    return `${characters
      .slice(0, MAX_BROWSER_TAB_TITLE_LENGTH - 1)
      .join('')}…`;
  }
}
