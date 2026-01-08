import { fireEvent, render, screen } from '@testing-library/angular';
import { AppComponent } from './app.component';
import { copyHistoryCache, type CopyHistoryItem } from './copy-history-cache';

const getMainQuestionTextarea = (container: Element): HTMLTextAreaElement => {
  const element = container.querySelector<HTMLTextAreaElement>('#main-question');
  if (!element) {
    throw new Error('main question textarea not found');
  }
  return element;
};

const getTitleInputs = (container: Element): HTMLInputElement[] =>
  Array.from(container.querySelectorAll<HTMLInputElement>('.title-input'));

const getContentTextareas = (container: Element): HTMLTextAreaElement[] =>
  Array.from(
    container.querySelectorAll<HTMLTextAreaElement>('.field-content-textarea')
  );

const getFieldContainers = (container: Element): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>('.field'));

const stubDateNow = (): void => {
  let now = 1_700_000_000_000;
  spyOn(Date, 'now').and.callFake(() => {
    now += 1;
    return now;
  });
};

describe('AppComponent', () => {
  it('エラー相談プリセットで質問とフィールドが置き換わる', async () => {
    stubDateNow();
    const { fixture } = await render(AppComponent);
    const component = fixture.componentInstance as AppComponent;

    (component as any).onPresetClick('error');
    fixture.detectChanges();
    await fixture.whenStable();

    expect((component as any).mainQuestion()).toBe(
      '以下のエラー内容を解決してください'
    );
    expect((component as any).selectedPreset()).toBe('error');

    const fields = (component as any).fields();
    expect(fields.length).toBe(2);
    expect(fields[0].title).toBe('エラー内容');
    expect(fields[1].title).toBe('出力内容');
    expect(fields[1].content).toContain('エラーの概要');
  });

  it('フィールドを追加すると行が増える', async () => {
    stubDateNow();
    const { container } = await render(AppComponent);

    const addButton = screen.getByText('追加');
    fireEvent.click(addButton);
    expect(getFieldContainers(container).length).toBe(2);
  });

  it('フィールドを折りたたむと内容が非表示になる', async () => {
    const { container } = await render(AppComponent);

    const toggleButton = container.querySelector<HTMLButtonElement>(
      '.field .toggle-btn'
    );
    if (!toggleButton) {
      throw new Error('toggle button not found');
    }
    expect(
      getFieldContainers(container)[0].querySelector('.field-content')
    ).not.toBeNull();
    fireEvent.click(toggleButton);
    const firstField = getFieldContainers(container)[0];
    expect(firstField.querySelector('.field-content')).toBeNull();
  });

  it('フィールドを削除すると行が減る', async () => {
    const { container } = await render(AppComponent);

    const deleteButton = container.querySelector<HTMLButtonElement>(
      '.field .delete-btn'
    );
    if (!deleteButton) {
      throw new Error('delete button not found');
    }
    fireEvent.click(deleteButton);
    expect(getFieldContainers(container).length).toBe(0);
  });

  it('上下ボタンでフィールドの順序が入れ替わる', async () => {
    stubDateNow();
    const { container } = await render(AppComponent);

    fireEvent.click(screen.getByText('追加'));

    const titleInputs = getTitleInputs(container);
    fireEvent.input(titleInputs[0], { target: { value: 'First' } });
    fireEvent.input(titleInputs[1], { target: { value: 'Second' } });

    let headerButtons = container.querySelectorAll<HTMLButtonElement>(
      '.field .header-buttons button'
    );
    fireEvent.click(headerButtons[1]);

    const titlesAfterDown = getTitleInputs(container).map((input) => input.value);
    expect(titlesAfterDown).toEqual(['Second', 'First']);

    headerButtons = container.querySelectorAll<HTMLButtonElement>(
      '.field .header-buttons button'
    );
    fireEvent.click(headerButtons[3]);

    const titlesAfterUp = getTitleInputs(container).map((input) => input.value);
    expect(titlesAfterUp).toEqual(['First', 'Second']);
  });

  it('入力内容の変更がプレビュー出力に反映される', async () => {
    const { container } = await render(AppComponent);

    fireEvent.input(getMainQuestionTextarea(container), {
      target: { value: 'Hello' },
    });

    const titleInputs = getTitleInputs(container);
    fireEvent.input(titleInputs[0], { target: { value: 'Title 1' } });

    const contentTextareas = getContentTextareas(container);
    fireEvent.input(contentTextareas[0], { target: { value: 'Body 1' } });

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

    const { fixture } = await render(AppComponent);
    const component = fixture.componentInstance as AppComponent;

    (component as any).mainQuestion.set('Question');
    (component as any).fields.set([
      { id: 1, title: 'Title', content: 'Content', expanded: true },
    ]);

    (component as any).copyToClipboard();

    await fixture.whenStable();
    await Promise.resolve();

    const expectedOutput = 'Question\n\n## Title\n```\nContent\n```';
    expect(writeText).toHaveBeenCalledWith(expectedOutput);
    expect(addHistorySpy).toHaveBeenCalledWith(
      expectedOutput,
      jasmine.objectContaining({
        mainQuestion: 'Question',
        fields: [jasmine.objectContaining({ title: 'Title', content: 'Content' })],
      })
    );
    expect((component as any).copySuccess()).toBeTrue();
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

    const { container, fixture } = await render(AppComponent);
    const component = fixture.componentInstance as AppComponent;

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

  it('履歴適用でスナップショット有無の復元が行われる', async () => {
    const { fixture } = await render(AppComponent);
    const component = fixture.componentInstance as AppComponent;

    const snapshotItem: CopyHistoryItem = {
      text: 'snapshot text',
      createdAt: 1700000000000,
      snapshot: {
        mainQuestion: 'Snapshot Question',
        fields: [
          { id: 1, title: 'Snapshot Title', content: 'Snapshot Body', expanded: true },
        ],
      },
    };

    (component as any).applyHistory(snapshotItem);
    expect((component as any).mainQuestion()).toBe('Snapshot Question');
    expect((component as any).fields().length).toBe(1);
    expect((component as any).fields()[0].title).toBe('Snapshot Title');
    expect((component as any).historyOpen()).toBeFalse();

    const textOnlyItem: CopyHistoryItem = {
      text: 'Text Only',
      createdAt: 1700000000001,
    };
    (component as any).applyHistory(textOnlyItem);
    expect((component as any).mainQuestion()).toBe('Text Only');
    expect((component as any).fields().length).toBe(0);
  });

  it('履歴ラベル整形とプレビュー位置計算が行われる', async () => {
    const { fixture } = await render(AppComponent);
    const component = fixture.componentInstance as AppComponent;

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
});
