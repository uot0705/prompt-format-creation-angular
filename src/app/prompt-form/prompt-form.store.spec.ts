import {
  DEFAULT_BROWSER_TAB_TITLE,
  MAX_BROWSER_TAB_TITLE_LENGTH,
  PromptFormStore,
} from './prompt-form.store';

const stubDateNow = (): void => {
  let now = 1_700_000_000_000;
  spyOn(Date, 'now').and.callFake(() => {
    now += 1;
    return now;
  });
};

describe('PromptFormStore', () => {
  it('プリセット選択で質問とフィールドが更新される', () => {
    stubDateNow();
    const store = new PromptFormStore();

    store.selectPreset('error');

    expect(store.selectedPreset()).toBe('error');
    expect(store.mainQuestion()).toBe('以下のエラー内容を解決してください');
    expect(store.fields().length).toBe(2);
    expect(store.fields()[0].title).toBe('エラー内容');
  });

  it('フィールドの上下移動で順序が入れ替わる', () => {
    const store = new PromptFormStore();

    store.setFields([
      { id: 1, title: 'A', content: '', expanded: true },
      { id: 2, title: 'B', content: '', expanded: true },
    ]);

    store.moveFieldDown(1);
    expect(store.fields().map((field) => field.title)).toEqual(['B', 'A']);

    store.moveFieldUp(1);
    expect(store.fields().map((field) => field.title)).toEqual(['A', 'B']);
  });

  it('ブラウザタブタイトルは専用入力を優先し未入力なら質問内容へフォールバックする', () => {
    const store = new PromptFormStore();

    expect(store.resolvedBrowserTabTitle()).toBe(DEFAULT_BROWSER_TAB_TITLE);

    store.setMainQuestion('  最初の質問タイトル \n の候補  ');
    expect(store.resolvedBrowserTabTitle()).toBe('最初の質問タイトル の候補');

    store.setBrowserTabTitle('  明示したタブ名  ');
    expect(store.resolvedBrowserTabTitle()).toBe('明示したタブ名');

    store.resetForm();
    expect(store.browserTabTitle()).toBe('');
    expect(store.resolvedBrowserTabTitle()).toBe(DEFAULT_BROWSER_TAB_TITLE);
  });

  it('ブラウザタブタイトルが長すぎる場合は末尾を省略する', () => {
    const store = new PromptFormStore();

    store.setBrowserTabTitle('あ'.repeat(MAX_BROWSER_TAB_TITLE_LENGTH + 10));

    expect(Array.from(store.resolvedBrowserTabTitle()).length).toBe(
      MAX_BROWSER_TAB_TITLE_LENGTH
    );
    expect(store.resolvedBrowserTabTitle().endsWith('…')).toBeTrue();
  });
});
