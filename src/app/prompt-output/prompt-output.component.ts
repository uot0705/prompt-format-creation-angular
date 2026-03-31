import { Component, computed, inject, signal } from '@angular/core';
import { marked } from 'marked';
import {
  type CopyHistoryItem,
  type HistorySnapshot,
  copyHistoryCache,
} from '../copy-history-cache';
import {
  PromptFormStore,
  type Field,
  type PresetType,
} from '../prompt-form/prompt-form.store';

type HistoryPreview = {
  text: string;
  top: number;
  left: number;
};

type PromptExportPayload = {
  mainQuestion: string;
  browserTabTitle: string;
  fields: Field[];
  selectedPreset: PresetType | null;
};

type PromptExportEnvelope = {
  schemaVersion: number;
  exportedAt: string;
  payload: PromptExportPayload;
};

const CURRENT_SCHEMA_VERSION = 1;

@Component({
  selector: 'app-prompt-output',
  standalone: true,
  templateUrl: './prompt-output.component.html',
  styleUrls: ['./prompt-output.component.scss'],
})
export class PromptOutputComponent {
  private readonly formStore = inject(PromptFormStore);

  protected readonly schemaVersionLabel = `ver${CURRENT_SCHEMA_VERSION}`;

  // 入力済みの質問テキストを共有ストアから参照する。
  protected readonly mainQuestion = this.formStore.mainQuestion;
  // 任意のブラウザタブタイトルを共有ストアから参照する。
  protected readonly browserTabTitle = this.formStore.browserTabTitle;
  // 入力フィールドの一覧を共有ストアから参照する。
  protected readonly fields = this.formStore.fields;
  // 選択中プリセットを共有ストアから参照する。
  protected readonly selectedPreset = this.formStore.selectedPreset;

  // コピーボタンの成功状態を表示する。
  protected readonly copySuccess = signal(false);
  // 履歴モーダルの開閉状態を管理する。
  protected readonly historyOpen = signal(false);
  // 表示する履歴一覧を保持する。
  protected readonly historyItems = signal(copyHistoryCache.getHistory());
  // 履歴プレビューの座標と本文を保持する。
  protected readonly historyPreview = signal<HistoryPreview | null>(null);
  // インポート/エクスポートのメニュー表示を管理する。
  protected readonly importExportOpen = signal(false);

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
    this.importExportOpen.set(false);
  }

  // 履歴モーダルを閉じてプレビューを解除する。
  protected closeHistoryModal(): void {
    this.historyOpen.set(false);
    this.historyPreview.set(null);
  }

  // インポート/エクスポートメニューの開閉を切り替える。
  protected toggleImportExportMenu(): void {
    this.importExportOpen.update((open) => !open);
  }

  // ファイル選択ダイアログを開く。
  protected triggerImport(input: HTMLInputElement): void {
    this.importExportOpen.set(false);
    input.value = '';
    input.click();
  }

  // 選択されたファイルを読み取り、フォームへ反映する。
  protected handleImport(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    this.importExportOpen.set(false);

    void this.importFromFile(file)
      .catch(() => {
        window.alert(
          'インポートに失敗しました。ファイル形式を確認してください。'
        );
      })
      .finally(() => {
        if (input) {
          input.value = '';
        }
      });
  }

  // フォーム内容をJSONとしてダウンロードする。
  protected exportForm(): void {
    const envelope = this.buildExportEnvelope();
    const json = JSON.stringify(envelope, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.schemaVersionLabel}_prompt-form-${this.buildTimestampLabel(
      new Date()
    )}.json`;
    anchor.click();

    URL.revokeObjectURL(url);
    this.importExportOpen.set(false);
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
      this.formStore.setBrowserTabTitle(item.snapshot.browserTabTitle ?? '');
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
      browserTabTitle: this.browserTabTitle(),
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

  // エクスポート用のパッケージを作成する。
  private buildExportEnvelope(): PromptExportEnvelope {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      payload: {
        mainQuestion: this.mainQuestion(),
        browserTabTitle: this.browserTabTitle(),
        fields: this.fields().map((field) => ({ ...field })),
        selectedPreset: this.selectedPreset(),
      },
    };
  }

  // ファイルを読み込んでフォームに反映する。
  private async importFromFile(file: File): Promise<void> {
    const text = await file.text();
    const payload = this.parseImportPayload(text);
    if (!payload) {
      throw new Error('Invalid import file');
    }

    this.formStore.setMainQuestion(payload.mainQuestion);
    this.formStore.setBrowserTabTitle(payload.browserTabTitle);
    this.formStore.setFields(payload.fields.map((field) => ({ ...field })));
    this.formStore.setSelectedPreset(payload.selectedPreset);
  }

  // JSON文字列からペイロードを抽出・整形する。
  private parseImportPayload(text: string): PromptExportPayload | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const envelope = parsed as Record<string, unknown>;
    const schemaVersion = Number.isInteger(envelope['schemaVersion'])
      ? (envelope['schemaVersion'] as number)
      : 0;

    if (schemaVersion === CURRENT_SCHEMA_VERSION) {
      return this.normalizePayload(envelope['payload']);
    }

    const migrated = this.migratePayload(envelope, schemaVersion);
    return this.normalizePayload(migrated);
  }

  // 古いスキーマのデータを現在の形へ変換する。
  private migratePayload(
    envelope: Record<string, unknown>,
    schemaVersion: number
  ): unknown {
    const migrations: Record<number, (payload: unknown) => unknown> = {
      0: (payload) => payload,
    };

    let payload: unknown =
      'payload' in envelope ? envelope['payload'] : (envelope as unknown);

    for (let version = schemaVersion; version < CURRENT_SCHEMA_VERSION; version += 1) {
      const migrate = migrations[version];
      if (!migrate) {
        return null;
      }
      payload = migrate(payload);
    }

    return payload;
  }

  // ペイロードを安全な形へ正規化する。
  private normalizePayload(payload: unknown): PromptExportPayload | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const data = payload as Record<string, unknown>;
    const mainQuestion =
      typeof data['mainQuestion'] === 'string' ? (data['mainQuestion'] as string) : '';
    const browserTabTitle =
      typeof data['browserTabTitle'] === 'string'
        ? (data['browserTabTitle'] as string)
        : '';
    const fieldsSource = Array.isArray(data['fields']) ? (data['fields'] as unknown[]) : [];

    const usedIds = new Set<number>();
    let nextId = 1;

    const resolveId = (candidate: unknown): number => {
      if (
        typeof candidate === 'number' &&
        Number.isFinite(candidate) &&
        candidate > 0 &&
        !usedIds.has(candidate)
      ) {
        usedIds.add(candidate);
        nextId = Math.max(nextId, candidate + 1);
        return candidate;
      }

      while (usedIds.has(nextId)) {
        nextId += 1;
      }
      const assigned = nextId;
      usedIds.add(assigned);
      nextId += 1;
      return assigned;
    };

    const fields = fieldsSource.map((field) => {
      const entry = field as Record<string, unknown>;
      return {
        id: resolveId(entry['id']),
        title: typeof entry['title'] === 'string' ? (entry['title'] as string) : '',
        content: typeof entry['content'] === 'string' ? (entry['content'] as string) : '',
        expanded:
          typeof entry['expanded'] === 'boolean' ? (entry['expanded'] as boolean) : true,
      };
    });

    return {
      mainQuestion,
      browserTabTitle,
      fields,
      selectedPreset: this.normalizePreset(data['selectedPreset']),
    };
  }

  // 不正なプリセット値を弾く。
  private normalizePreset(value: unknown): PresetType | null {
    if (
      value === 'question' ||
      value === 'error' ||
      value === 'review' ||
      value === 'organize'
    ) {
      return value;
    }
    return null;
  }

  // ファイル名用のタイムスタンプを生成する。
  private buildTimestampLabel(date: Date): string {
    const pad = (value: number): string => String(value).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
      date.getDate()
    )}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(
      date.getSeconds()
    )}`;
  }
}
