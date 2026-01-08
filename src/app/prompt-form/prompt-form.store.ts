import { Injectable, signal } from '@angular/core';

export type PresetType =
  | 'question'
  | 'error'
  | 'variableName'
  | 'refactor'
  | 'review'
  | 'organize'
  | 'analyze';

export type Field = {
  id: number;
  title: string;
  content: string;
  expanded: boolean;
};

@Injectable()
export class PromptFormStore {
  // 空のフィールドひな形を保持する。
  private readonly emptyField = {
    title: '',
    content: '',
    expanded: true,
  };

  // メイン質問の本文を保持する。
  readonly mainQuestion = signal('');
  // 入力フィールドの配列を保持する。
  readonly fields = signal([this.createField()]);
  // 選択中のプリセット種別を保持する。
  readonly selectedPreset = signal<PresetType | null>(null);

  // プリセットを選び、フォーム内容を適用する。
  selectPreset(type: PresetType): void {
    this.selectedPreset.set(type);
    this.applyPreset(type);
  }

  // メイン質問を更新する。
  setMainQuestion(value: string): void {
    this.mainQuestion.set(value);
  }

  // フィールド配列を丸ごと入れ替える。
  setFields(fields: Field[]): void {
    this.fields.set(fields);
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

  // フォームの入力内容を初期化する。
  resetForm(): void {
    this.mainQuestion.set('');
    this.fields.set([]);
  }

  // 新しいフィールドを作成する。
  private createField(title = '', content = ''): Field {
    return {
      id: Date.now(),
      title: title || this.emptyField.title,
      content: content || this.emptyField.content,
      expanded: this.emptyField.expanded,
    };
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
}
