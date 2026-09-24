import { fireEvent, render, screen, within } from '@testing-library/angular';
import { copyHistoryCache, type CopyHistoryItem } from '../copy-history-cache';
import { PromptFormStore } from '../prompt-form/prompt-form.store';
import { PromptOutputComponent } from './prompt-output.component';

describe('PromptOutputComponent', () => {
  it('未入力時は空状態を表示し、空のフィールドをプレビューしない', async () => {
    const { fixture } = await render(PromptOutputComponent, {
      providers: [PromptFormStore],
    });
    const component = fixture.componentInstance as PromptOutputComponent;

    expect(screen.getByText('ここにプレビューが表示されます')).toBeTruthy();
    expect((component as any).fieldsOutputForDisplay()).toBe('');
  });

  it('入力内容の変更がプレビュー出力に反映される', async () => {
    const { fixture } = await render(PromptOutputComponent, {
      providers: [PromptFormStore],
    });
    const store = fixture.debugElement.injector.get(PromptFormStore);

    store.setMainQuestion('Hello');
    store.setFields([
      { id: 1, title: 'Title 1', content: 'Body 1', expanded: true },
    ]);
    fixture.detectChanges();

    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.getByText('Title 1')).toBeTruthy();
    expect(screen.getByText('Body 1')).toBeTruthy();
  });

  it('コピー時にフォーマット済み文字列と履歴状態が更新される', async () => {
    const addHistorySpy = spyOn(copyHistoryCache, 'addHistory').and.returnValue(
      []
    );
    const writeText = jasmine
      .createSpy('writeText')
      .and.returnValue(Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const { fixture } = await render(PromptOutputComponent, {
      providers: [PromptFormStore],
    });
    const component = fixture.componentInstance as PromptOutputComponent;
    const store = fixture.debugElement.injector.get(PromptFormStore);

    store.setMainQuestion('Question');
    store.setBrowserTabTitle('Explicit Tab');
    store.setFields([
      { id: 1, title: 'Title', content: 'Content', expanded: true },
    ]);

    await (component as any).copyToClipboard();

    const expectedOutput = 'Question\n\n## Title\n```\nContent\n```';
    expect(writeText).toHaveBeenCalledWith(expectedOutput);
    expect(addHistorySpy).toHaveBeenCalledWith(
      expectedOutput,
      jasmine.objectContaining({
        mainQuestion: 'Question',
        browserTabTitle: 'Explicit Tab',
        fields: [jasmine.objectContaining({ title: 'Title', content: 'Content' })],
      })
    );
    expect((component as any).copySuccess()).toBeTrue();
    expect((component as any).historyItems()).toEqual([]);
  });

  it('履歴モーダルの開閉で履歴が更新される', async () => {
    const initialHistory: CopyHistoryItem[] = [];
    const updatedHistory: CopyHistoryItem[] = [
      { text: 'sample text', createdAt: 1700000000000 },
    ];
    spyOn(copyHistoryCache, 'getHistory').and.returnValues(
      initialHistory,
      updatedHistory
    );

    const { container, fixture } = await render(PromptOutputComponent, {
      providers: [PromptFormStore],
    });
    const component = fixture.componentInstance as PromptOutputComponent;

    const historyButton =
      container.querySelector<HTMLButtonElement>('#history-btn');
    if (!historyButton) {
      throw new Error('history button not found');
    }
    fireEvent.click(historyButton);

    expect((component as any).historyOpen()).toBeTrue();
    expect((component as any).historyItems()).toEqual(updatedHistory);
    expect(container.querySelector('.history-overlay')).not.toBeNull();

    const overlay = container.querySelector<HTMLDivElement>('.history-overlay');
    if (!overlay) {
      throw new Error('history overlay not found');
    }
    fireEvent.click(overlay);
    fixture.detectChanges();

    expect((component as any).historyOpen()).toBeFalse();
    expect(container.querySelector('.history-overlay')).toBeNull();
  });

  it('履歴ダイアログはEscapeで閉じて起点へフォーカスを戻す', async () => {
    spyOn(copyHistoryCache, 'getHistory').and.returnValue([]);
    const { container, fixture } = await render(PromptOutputComponent, {
      providers: [PromptFormStore],
    });

    const historyButton =
      container.querySelector<HTMLButtonElement>('#history-btn');
    if (!historyButton) {
      throw new Error('history button not found');
    }

    fireEvent.click(historyButton);
    fixture.detectChanges();
    await fixture.whenStable();

    const dialog = screen.getByRole('dialog', {
      name: '以前の内容を復元',
    });
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    fireEvent.keyDown(document, { key: 'Escape' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(historyButton);
  });

  it('履歴適用でスナップショット有無の復元が行われる', async () => {
    const { fixture } = await render(PromptOutputComponent, {
      providers: [PromptFormStore],
    });
    const component = fixture.componentInstance as PromptOutputComponent;
    const store = fixture.debugElement.injector.get(PromptFormStore);

    const snapshotItem: CopyHistoryItem = {
      text: 'snapshot text',
      createdAt: 1700000000000,
      snapshot: {
        mainQuestion: 'Snapshot Question',
        browserTabTitle: 'Snapshot Tab',
        fields: [
          {
            id: 1,
            title: 'Snapshot Title',
            content: 'Snapshot Body',
            expanded: true,
          },
        ],
      },
    };

    (component as any).applyHistory(snapshotItem);
    expect(store.mainQuestion()).toBe('Snapshot Question');
    expect(store.browserTabTitle()).toBe('Snapshot Tab');
    expect(store.fields().length).toBe(1);
    expect(store.fields()[0].title).toBe('Snapshot Title');
    expect((component as any).historyOpen()).toBeFalse();

    const textOnlyItem: CopyHistoryItem = {
      text: 'Text Only',
      createdAt: 1700000000001,
    };
    (component as any).applyHistory(textOnlyItem);
    expect(store.mainQuestion()).toBe('Text Only');
    expect(store.browserTabTitle()).toBe('');
    expect(store.fields().length).toBe(0);
  });

  it('古い履歴スナップショットにタブタイトルがなくても復元できる', async () => {
    const { fixture } = await render(PromptOutputComponent, {
      providers: [PromptFormStore],
    });
    const component = fixture.componentInstance as PromptOutputComponent;
    const store = fixture.debugElement.injector.get(PromptFormStore);

    (component as any).applyHistory({
      text: 'legacy text',
      createdAt: 1700000000002,
      snapshot: {
        mainQuestion: 'Legacy Question',
        fields: [
          {
            id: 1,
            title: 'Legacy Title',
            content: 'Legacy Body',
            expanded: true,
          },
        ],
      } as any,
    });

    expect(store.mainQuestion()).toBe('Legacy Question');
    expect(store.browserTabTitle()).toBe('');
    expect(store.fields()[0].title).toBe('Legacy Title');
  });

  it('エクスポートとインポートでブラウザタブタイトルを保持する', async () => {
    const { fixture } = await render(PromptOutputComponent, {
      providers: [PromptFormStore],
    });
    const component = fixture.componentInstance as PromptOutputComponent;
    const store = fixture.debugElement.injector.get(PromptFormStore);

    store.setMainQuestion('Question');
    store.setBrowserTabTitle('Saved Tab');
    store.setFields([
      { id: 1, title: 'Title', content: 'Body', expanded: true },
    ]);
    store.setSelectedPreset('question');

    const envelope = (component as any).buildExportEnvelope();
    const parsed = (component as any).parseImportPayload(JSON.stringify(envelope));

    expect(parsed).toEqual(
      jasmine.objectContaining({
        mainQuestion: 'Question',
        browserTabTitle: 'Saved Tab',
        selectedPreset: 'question',
      })
    );
  });

  it('履歴ラベル整形とプレビュー位置計算が行われる', async () => {
    const { fixture } = await render(PromptOutputComponent, {
      providers: [PromptFormStore],
    });
    const component = fixture.componentInstance as PromptOutputComponent;

    const emptyLabel = (component as any).formatHistoryLabel({
      text: '   ',
      createdAt: new Date(2024, 0, 2, 3, 4).getTime(),
    });
    expect(emptyLabel).toMatch(/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2} \/ （空）/);

    const longLabel = (component as any).formatHistoryLabel({
      text: '1234567890123456789',
      createdAt: new Date(2024, 0, 2, 3, 4).getTime(),
    });
    expect(longLabel).toContain(' / 123456789012345');

    Object.defineProperty(window, 'innerWidth', {
      value: 320,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 240,
      configurable: true,
    });

    const previewItem: CopyHistoryItem = {
      text: 'Preview text',
      createdAt: 1700000000002,
    };
    const target = {
      getBoundingClientRect: () => ({
        top: 24,
        left: 24,
        right: 80,
        height: 24,
      }),
    } as HTMLElement;

    (component as any).showHistoryPreview(previewItem, {
      currentTarget: target,
    } as unknown as MouseEvent);

    const preview = (component as any).historyPreview();
    expect(preview).toEqual(jasmine.objectContaining({ text: 'Preview text' }));
    expect(preview.top).toBeGreaterThanOrEqual(12);
    expect(preview.left).toBeGreaterThanOrEqual(12);

    (component as any).hideHistoryPreview();
    expect((component as any).historyPreview()).toBeNull();
  });

  it('全入力欄の一致数と現在位置を画面順で表示する', async () => {
    const { fixture } = await render(PromptOutputComponent, {
      providers: [PromptFormStore],
    });
    const store = fixture.debugElement.injector.get(PromptFormStore);
    store.setMainQuestion('foo foo');
    store.setBrowserTabTitle('foo');
    store.setFields([
      { id: 1, title: 'foo', content: 'foo foo', expanded: false },
    ]);
    fixture.detectChanges();

    fireEvent.click(screen.getByRole('button', { name: '置換' }));
    fixture.detectChanges();
    fireEvent.input(screen.getByLabelText('変換する文字'), {
      target: { value: 'foo' },
    });
    fixture.detectChanges();

    const dialog = screen.getByRole('dialog', {
      name: 'プロンプト全体を置換',
    });
    expect(within(dialog).getByText('一致 1 / 6')).toBeTruthy();
    expect(within(dialog).getByText('質問内容')).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: '次の一致' }));
    fixture.detectChanges();
    expect(within(dialog).getByText('一致 2 / 6')).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: '次の一致' }));
    fixture.detectChanges();
    expect(within(dialog).getByText('ブラウザタブのタイトル')).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: '前の一致' }));
    fixture.detectChanges();
    expect(within(dialog).getByText('一致 2 / 6')).toBeTruthy();
  });

  it('1件置換で現在箇所だけを変更して次の一致へ進む', async () => {
    const { fixture } = await render(PromptOutputComponent, {
      providers: [PromptFormStore],
    });
    const store = fixture.debugElement.injector.get(PromptFormStore);
    store.setMainQuestion('foo foo');
    store.setBrowserTabTitle('foo');
    fixture.detectChanges();

    fireEvent.click(screen.getByRole('button', { name: '置換' }));
    fixture.detectChanges();
    const dialog = screen.getByRole('dialog', {
      name: 'プロンプト全体を置換',
    });
    fireEvent.input(within(dialog).getByLabelText('変換する文字'), {
      target: { value: 'foo' },
    });
    fireEvent.input(within(dialog).getByLabelText('変換後の文字'), {
      target: { value: 'bar' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '置換' }));
    fixture.detectChanges();

    expect(store.mainQuestion()).toBe('bar foo');
    expect(store.browserTabTitle()).toBe('foo');
    expect(within(dialog).getByText('1件置換しました。残り2件です')).toBeTruthy();
    expect(within(dialog).getByText('一致 1 / 2')).toBeTruthy();
  });

  it('すべて置換は開始時点の一致だけを変更する', async () => {
    const { fixture } = await render(PromptOutputComponent, {
      providers: [PromptFormStore],
    });
    const store = fixture.debugElement.injector.get(PromptFormStore);
    store.setMainQuestion('a a');
    store.setBrowserTabTitle('a');
    store.setFields([
      { id: 1, title: 'a', content: 'a a', expanded: false },
    ]);
    fixture.detectChanges();

    fireEvent.click(screen.getByRole('button', { name: '置換' }));
    fixture.detectChanges();
    const dialog = screen.getByRole('dialog', {
      name: 'プロンプト全体を置換',
    });
    fireEvent.input(within(dialog).getByLabelText('変換する文字'), {
      target: { value: 'a' },
    });
    fireEvent.input(within(dialog).getByLabelText('変換後の文字'), {
      target: { value: 'aa' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'すべて置換' }));
    fixture.detectChanges();

    expect(within(dialog).getByText('6件置換しました')).toBeTruthy();
    expect(store.mainQuestion()).toBe('aa aa');
    expect(store.browserTabTitle()).toBe('aa');
    expect(store.fields()[0].content).toBe('aa aa');
  });

  it('空検索と0件では置換操作を無効化する', async () => {
    const { fixture } = await render(PromptOutputComponent, {
      providers: [PromptFormStore],
    });
    const store = fixture.debugElement.injector.get(PromptFormStore);
    store.setMainQuestion('sample');
    fixture.detectChanges();

    fireEvent.click(screen.getByRole('button', { name: '置換' }));
    fixture.detectChanges();
    const dialog = screen.getByRole('dialog', {
      name: 'プロンプト全体を置換',
    });
    const replaceButton = within(dialog).getByRole('button', { name: '置換' });
    const replaceAllButton = within(dialog).getByRole('button', {
      name: 'すべて置換',
    });
    expect((replaceButton as HTMLButtonElement).disabled).toBeTrue();
    expect((replaceAllButton as HTMLButtonElement).disabled).toBeTrue();

    fireEvent.input(within(dialog).getByLabelText('変換する文字'), {
      target: { value: 'missing' },
    });
    fixture.detectChanges();
    expect(within(dialog).getByText('一致 0 / 0')).toBeTruthy();
    expect((replaceButton as HTMLButtonElement).disabled).toBeTrue();
    expect((replaceAllButton as HTMLButtonElement).disabled).toBeTrue();
  });

  it('置換ダイアログはEscapeで閉じて起点へフォーカスを戻す', async () => {
    const { container, fixture } = await render(PromptOutputComponent, {
      providers: [PromptFormStore],
    });
    const replaceButton = container.querySelector<HTMLButtonElement>('#replace-btn');
    if (!replaceButton) {
      throw new Error('replace button not found');
    }

    fireEvent.click(replaceButton);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(screen.getByLabelText('変換する文字'));

    fireEvent.keyDown(document, { key: 'Escape' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(replaceButton);
  });
});
