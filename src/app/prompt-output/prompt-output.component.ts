import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
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
  type ReplaceTextTarget,
} from '../prompt-form/prompt-form.store';

type HistoryPreview = {
  text: string;
  top: number;
  left: number;
};

type ReplaceMatch = {
  target: ReplaceTextTarget;
  entryIndex: number;
  label: string;
  text: string;
  start: number;
  end: number;
};

type MatchPreview = {
  before: string;
  match: string;
  after: string;
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
  private historyTrigger: HTMLElement | null = null;
  private replaceTrigger: HTMLElement | null = null;

  @ViewChild('historyModal')
  private historyModal?: ElementRef<HTMLElement>;

  @ViewChild('replaceModal')
  private replaceModal?: ElementRef<HTMLElement>;

  @ViewChild('replaceSearchInput')
  private replaceSearchInput?: ElementRef<HTMLInputElement>;

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
  // 置換ダイアログと入力値、現在位置を管理する。
  protected readonly replaceOpen = signal(false);
  protected readonly replaceSearchText = signal('');
  protected readonly replacementText = signal('');
  protected readonly selectedMatchIndex = signal(0);
  protected readonly replaceStatus = signal('');

  // 現在のフォーム全体から、検索文字に一致する箇所を画面順で抽出する。
  protected readonly replaceMatches = computed(() =>
    this.findReplaceMatches(this.replaceSearchText())
  );
  protected readonly normalizedMatchIndex = computed(() => {
    const count = this.replaceMatches().length;
    return count === 0 ? 0 : this.selectedMatchIndex() % count;
  });
  protected readonly currentReplaceMatch = computed(
    () => this.replaceMatches()[this.normalizedMatchIndex()] ?? null
  );
  protected readonly matchPositionLabel = computed(() => {
    const count = this.replaceMatches().length;
    return count === 0 ? '0 / 0' : `${this.normalizedMatchIndex() + 1} / ${count}`;
  });
  protected readonly currentMatchPreview = computed<MatchPreview | null>(() => {
    const match = this.currentReplaceMatch();
    if (!match) {
      return null;
    }

    const contextLength = 42;
    const beforeStart = Math.max(0, match.start - contextLength);
    const afterEnd = Math.min(match.text.length, match.end + contextLength);
    return {
      before: `${beforeStart > 0 ? '…' : ''}${match.text.slice(
        beforeStart,
        match.start
      )}`,
      match: match.text.slice(match.start, match.end),
      after: `${match.text.slice(match.end, afterEnd)}${
        afterEnd < match.text.length ? '…' : ''
      }`,
    };
  });

  // Markdown から右ペインの表示用HTMLを生成する。
  protected readonly mainQuestionOutput = computed(() =>
    marked.parse(this.mainQuestion())
  );

  // フィールド入力をプレビュー用HTMLに整形する。
  protected readonly fieldsOutputForDisplay = computed(() =>
    this.buildFieldsOutput(this.fields())
  );
  // 入力済みの内容があるときだけドキュメントプレビューを表示する。
  protected readonly hasPreviewContent = computed(
    () =>
      this.mainQuestion().trim().length > 0 ||
      this.fields().some(
        (field) => field.title.trim().length > 0 || field.content.trim().length > 0
      )
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
  protected openHistoryModal(event?: Event): void {
    this.historyTrigger = event?.currentTarget as HTMLElement | null;
    this.historyOpen.set(true);
    this.historyPreview.set(null);
    this.historyItems.set(copyHistoryCache.getHistory());
    this.importExportOpen.set(false);
    queueMicrotask(() => this.historyModal?.nativeElement.focus());
  }

  // 履歴モーダルを閉じてプレビューを解除する。
  protected closeHistoryModal(): void {
    this.historyOpen.set(false);
    this.historyPreview.set(null);
    queueMicrotask(() => this.historyTrigger?.focus());
  }

  // 置換ダイアログを初期状態で開く。
  protected openReplaceModal(event?: Event): void {
    this.replaceTrigger = event?.currentTarget as HTMLElement | null;
    this.replaceSearchText.set('');
    this.replacementText.set('');
    this.selectedMatchIndex.set(0);
    this.replaceStatus.set('');
    this.replaceOpen.set(true);
    this.historyOpen.set(false);
    this.importExportOpen.set(false);
    queueMicrotask(() => this.replaceSearchInput?.nativeElement.focus());
  }

  // 置換ダイアログを閉じ、起点のボタンへフォーカスを戻す。
  protected closeReplaceModal(): void {
    this.replaceOpen.set(false);
    queueMicrotask(() => this.replaceTrigger?.focus());
  }

  // 検索文字の変更時は最初の一致へ戻る。
  protected handleReplaceSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.replaceSearchText.set(input.value);
    this.selectedMatchIndex.set(0);
    this.replaceStatus.set('');
  }

  // 置換後の文字を更新する。
  protected handleReplacementInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.replacementText.set(input.value);
    this.replaceStatus.set('');
  }

  // 一致箇所を前後に循環移動する。
  protected selectPreviousMatch(): void {
    const count = this.replaceMatches().length;
    if (count === 0) {
      return;
    }
    this.selectedMatchIndex.set((this.normalizedMatchIndex() - 1 + count) % count);
  }

  protected selectNextMatch(): void {
    const count = this.replaceMatches().length;
    if (count === 0) {
      return;
    }
    this.selectedMatchIndex.set((this.normalizedMatchIndex() + 1) % count);
  }

  // 現在選択されている一致だけを置換し、次の一致へ進む。
  protected replaceCurrentMatch(): void {
    const match = this.currentReplaceMatch();
    const searchText = this.replaceSearchText();
    if (!match || !searchText) {
      return;
    }

    const resumeOffset = match.start + this.replacementText().length;
    const replaced = this.formStore.replaceTextOccurrence(
      match.target,
      match.start,
      searchText,
      this.replacementText()
    );
    if (!replaced) {
      this.selectedMatchIndex.set(0);
      this.replaceStatus.set('一致箇所が変更されたため、再検索しました');
      return;
    }

    const nextMatches = this.replaceMatches();
    const nextIndex = nextMatches.findIndex(
      (candidate) =>
        candidate.entryIndex > match.entryIndex ||
        (candidate.entryIndex === match.entryIndex && candidate.start >= resumeOffset)
    );
    this.selectedMatchIndex.set(nextIndex >= 0 ? nextIndex : 0);
    this.replaceStatus.set(
      `1件置換しました。残り${nextMatches.length}件です`
    );
  }

  // フォーム全体にある開始時点の一致を一括置換する。
  protected replaceAllMatches(): void {
    const searchText = this.replaceSearchText();
    if (!searchText || this.replaceMatches().length === 0) {
      return;
    }

    const count = this.formStore.replaceAllText(
      searchText,
      this.replacementText()
    );
    this.selectedMatchIndex.set(0);
    this.replaceStatus.set(`${count}件置換しました`);
  }

  // ダイアログをEscapeで閉じ、Tab移動をダイアログ内に保つ。
  @HostListener('document:keydown', ['$event'])
  protected handleDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.replaceOpen()) {
        event.preventDefault();
        this.closeReplaceModal();
        return;
      }
      if (this.historyOpen()) {
        event.preventDefault();
        this.closeHistoryModal();
        return;
      }
      this.importExportOpen.set(false);
    }

    if (event.key === 'Tab' && this.replaceOpen()) {
      this.trapDialogFocus(event, this.replaceModal?.nativeElement);
    } else if (event.key === 'Tab' && this.historyOpen()) {
      this.trapDialogFocus(event, this.historyModal?.nativeElement);
    }
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
  protected showHistoryPreview(item: CopyHistoryItem, event: Event): void {
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

  // 履歴ダイアログからキーボードフォーカスが抜けないようにする。
  private trapDialogFocus(
    event: KeyboardEvent,
    modal: HTMLElement | undefined
  ): void {
    if (!modal) {
      return;
    }

    const focusable = Array.from(
      modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusable.length === 0) {
      event.preventDefault();
      modal.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === modal)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // 検索対象を画面上の入力順に並べ、一致位置を列挙する。
  private findReplaceMatches(searchText: string): ReplaceMatch[] {
    if (!searchText) {
      return [];
    }

    const entries: Array<{
      target: ReplaceTextTarget;
      label: string;
      text: string;
    }> = [
      {
        target: { kind: 'mainQuestion' },
        label: '質問内容',
        text: this.mainQuestion(),
      },
      {
        target: { kind: 'browserTabTitle' },
        label: 'ブラウザタブのタイトル',
        text: this.browserTabTitle(),
      },
      ...this.fields().flatMap((field, index) => [
        {
          target: { kind: 'fieldTitle', fieldId: field.id } as ReplaceTextTarget,
          label: `フィールド${index + 1}のタイトル`,
          text: field.title,
        },
        {
          target: { kind: 'fieldContent', fieldId: field.id } as ReplaceTextTarget,
          label: `フィールド${index + 1}の内容`,
          text: field.content,
        },
      ]),
    ];

    return entries.flatMap((entry, entryIndex) => {
      const matches: ReplaceMatch[] = [];
      let start = entry.text.indexOf(searchText);
      while (start !== -1) {
        matches.push({
          ...entry,
          entryIndex,
          start,
          end: start + searchText.length,
        });
        start = entry.text.indexOf(searchText, start + searchText.length);
      }
      return matches;
    });
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
      .filter(
        (field) => field.title.trim().length > 0 || field.content.trim().length > 0
      )
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
