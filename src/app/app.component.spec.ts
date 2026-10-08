import { fireEvent, render, screen, within } from '@testing-library/angular';
import { AppComponent } from './app.component';
import {
  DEFAULT_BROWSER_TAB_TITLE,
  MAX_BROWSER_TAB_TITLE_LENGTH,
  PromptFormStore,
} from './prompt-form/prompt-form.store';

describe('AppComponent', () => {
  it('ヘッダーに操作を集約し、タブタイトル入力とプレビューが同期する', async () => {
    const { container, fixture } = await render(AppComponent);
    const header = container.querySelector('header.app-header')!;
    const store = fixture.debugElement.injector.get(PromptFormStore);
    const titleInput = within(header as HTMLElement).getByLabelText('ブラウザタブのタイトル');
    fireEvent.input(titleInput, { target: { value: '確認用のタブタイトル' } });
    fixture.detectChanges();
    expect(store.browserTabTitle()).toBe('確認用のタブタイトル');
    expect(document.title).toBe('確認用のタブタイトル');
    for (const name of ['履歴', '置換', 'インポートとエクスポート', 'コピー']) {
      expect(within(header as HTMLElement).getByRole('button', { name })).toBeTruthy();
      expect(screen.getAllByRole('button', { name }).length).toBe(1);
    }
    fireEvent.click(within(header as HTMLElement).getByRole('button', { name: 'インポートとエクスポート' }));
    expect(screen.getByRole('menuitem', { name: 'インポート' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'エクスポート' })).toBeTruthy();
  });


  it('フォームとプレビュー領域が表示される', async () => {
    const { container } = await render(AppComponent);

    expect(container.querySelector('app-prompt-form')).not.toBeNull();
    expect(container.querySelector('app-prompt-output')).not.toBeNull();
    expect(screen.getByText('作成する内容')).toBeTruthy();
  });

  it('ブラウザタブタイトルは専用入力を優先し空欄なら質問内容を使う', async () => {
    const { fixture } = await render(AppComponent);
    const store = fixture.debugElement.injector.get(PromptFormStore);

    expect(document.title).toBe(DEFAULT_BROWSER_TAB_TITLE);

    store.setMainQuestion('  フォールバック \n タイトル  ');
    fixture.detectChanges();
    expect(document.title).toBe('フォールバック タイトル');

    store.setBrowserTabTitle('  明示タイトル  ');
    fixture.detectChanges();
    expect(document.title).toBe('明示タイトル');
  });

  it('ブラウザタブタイトルが長すぎる場合は省略される', async () => {
    const { fixture } = await render(AppComponent);
    const store = fixture.debugElement.injector.get(PromptFormStore);

    store.setBrowserTabTitle('あ'.repeat(MAX_BROWSER_TAB_TITLE_LENGTH + 20));
    fixture.detectChanges();

    expect(Array.from(document.title).length).toBe(MAX_BROWSER_TAB_TITLE_LENGTH);
    expect(document.title.endsWith('…')).toBeTrue();
  });

  it('置換したブラウザタブタイトルがdocument.titleに反映される', async () => {
    const { fixture } = await render(AppComponent);
    const store = fixture.debugElement.injector.get(PromptFormStore);
    store.setBrowserTabTitle('old title');
    fixture.detectChanges();

    fireEvent.click(screen.getByRole('button', { name: '置換' }));
    fixture.detectChanges();
    const dialog = screen.getByRole('dialog', {
      name: 'プロンプト全体を置換',
    });
    fireEvent.input(within(dialog).getByLabelText('変換する文字'), {
      target: { value: 'old' },
    });
    fireEvent.input(within(dialog).getByLabelText('変換後の文字'), {
      target: { value: 'new' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'すべて置換' }));
    fixture.detectChanges();

    expect(document.title).toBe('new title');
  });
});
