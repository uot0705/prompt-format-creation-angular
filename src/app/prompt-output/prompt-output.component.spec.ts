import { fireEvent, render, screen } from '@testing-library/angular';
import { copyHistoryCache, type CopyHistoryItem } from '../copy-history-cache';
import { PromptFormStore } from '../prompt-form/prompt-form.store';
import { PromptOutputComponent } from './prompt-output.component';

describe('PromptOutputComponent', () => {
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
    expect(store.fields().length).toBe(1);
    expect(store.fields()[0].title).toBe('Snapshot Title');
    expect((component as any).historyOpen()).toBeFalse();

    const textOnlyItem: CopyHistoryItem = {
      text: 'Text Only',
      createdAt: 1700000000001,
    };
    (component as any).applyHistory(textOnlyItem);
    expect(store.mainQuestion()).toBe('Text Only');
    expect(store.fields().length).toBe(0);
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
});
