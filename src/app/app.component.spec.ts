import { render, screen } from '@testing-library/angular';
import { AppComponent } from './app.component';
import {
  DEFAULT_BROWSER_TAB_TITLE,
  MAX_BROWSER_TAB_TITLE_LENGTH,
  PromptFormStore,
} from './prompt-form/prompt-form.store';

describe('AppComponent', () => {
  it('フォームとプレビュー領域が表示される', async () => {
    const { container } = await render(AppComponent);

    expect(container.querySelector('app-prompt-form')).not.toBeNull();
    expect(container.querySelector('app-prompt-output')).not.toBeNull();
    expect(screen.getByText('質問フォーム')).toBeTruthy();
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
});
