import { PromptFormStore } from './prompt-form.store';

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
});
