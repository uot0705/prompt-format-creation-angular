import { fireEvent, render, screen } from '@testing-library/angular';
import { PromptFormComponent } from './prompt-form.component';
import { PromptFormStore } from './prompt-form.store';

const getMainQuestionTextarea = (container: Element): HTMLTextAreaElement => {
  const element = container.querySelector<HTMLTextAreaElement>('#main-question');
  if (!element) {
    throw new Error('main question textarea not found');
  }
  return element;
};

const getBrowserTabTitleInput = (container: Element): HTMLInputElement => {
  const element = container.querySelector<HTMLInputElement>('#browser-tab-title');
  if (!element) {
    throw new Error('browser tab title input not found');
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

describe('PromptFormComponent', () => {
  it('エラー相談プリセットで質問とフィールドが置き換わる', async () => {
    stubDateNow();
    const { container, fixture } = await render(PromptFormComponent, {
      providers: [PromptFormStore],
    });

    const errorPreset = screen.getByRole('button', {
      name: 'エラー相談',
    }) as HTMLButtonElement;
    fireEvent.click(errorPreset);
    fixture.detectChanges();
    await fixture.whenStable();

    const mainQuestion = getMainQuestionTextarea(container);
    expect(mainQuestion.value).toBe('以下のエラー内容を解決してください');
    expect(errorPreset.getAttribute('aria-pressed')).toBe('true');

    const titleInputs = getTitleInputs(container);
    expect(titleInputs.length).toBe(2);
    expect(titleInputs[0].value).toBe('エラー内容');
    expect(titleInputs[1].value).toBe('出力内容');

    const contentTextareas = getContentTextareas(container);
    expect(contentTextareas[1].value).toContain('エラーの概要');
  });

  it('フィールドを追加すると行が増える', async () => {
    stubDateNow();
    const { container, fixture } = await render(PromptFormComponent, {
      providers: [PromptFormStore],
    });

    const addButton = screen.getByRole('button', {
      name: 'フィールドを追加',
    });
    fireEvent.click(addButton);
    fixture.detectChanges();

    expect(getFieldContainers(container).length).toBe(2);
  });

  it('ブラウザタブタイトル入力がストアに反映される', async () => {
    const { container, fixture } = await render(PromptFormComponent, {
      providers: [PromptFormStore],
    });
    const store = fixture.debugElement.injector.get(PromptFormStore);

    const browserTabTitleInput = getBrowserTabTitleInput(container);
    fireEvent.input(browserTabTitleInput, {
      target: { value: '確認用のタブタイトル' },
    });
    fixture.detectChanges();

    expect(store.browserTabTitle()).toBe('確認用のタブタイトル');
    expect(browserTabTitleInput.getAttribute('aria-describedby')).toBe(
      'browser-tab-title-help'
    );
  });

  it('大型編集モーダルのボタンと表示領域は存在しない', async () => {
    const { container } = await render(PromptFormComponent, {
      providers: [PromptFormStore],
    });

    expect(screen.queryByLabelText('フォームを編集')).toBeNull();
    expect(container.querySelector('.modal-backdrop')).toBeNull();
    expect(container.textContent).not.toContain('フォーム編集');
  });

  it('フィールドを折りたたむと内容が非表示になる', async () => {
    const { container, fixture } = await render(PromptFormComponent, {
      providers: [PromptFormStore],
    });

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
    fixture.detectChanges();
    const firstField = getFieldContainers(container)[0];
    expect(firstField.querySelector('.field-content')).toBeNull();
    expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('フィールドを削除すると行が減る', async () => {
    const { container, fixture } = await render(PromptFormComponent, {
      providers: [PromptFormStore],
    });

    const deleteButton = container.querySelector<HTMLButtonElement>(
      '.field .delete-btn'
    );
    if (!deleteButton) {
      throw new Error('delete button not found');
    }
    fireEvent.click(deleteButton);
    fixture.detectChanges();
    expect(getFieldContainers(container).length).toBe(0);
  });

  it('上下ボタンでフィールドの順序が入れ替わる', async () => {
    stubDateNow();
    const { container, fixture } = await render(PromptFormComponent, {
      providers: [PromptFormStore],
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'フィールドを追加' })
    );
    fixture.detectChanges();

    const titleInputs = getTitleInputs(container);
    fireEvent.input(titleInputs[0], { target: { value: 'First' } });
    fireEvent.input(titleInputs[1], { target: { value: 'Second' } });

    let moveDownButtons = screen.getAllByRole('button', {
      name: '1つ下へ移動',
    });
    fireEvent.click(moveDownButtons[0]);
    fixture.detectChanges();

    const titlesAfterDown = getTitleInputs(container).map((input) => input.value);
    expect(titlesAfterDown).toEqual(['Second', 'First']);

    const moveUpButtons = screen.getAllByRole('button', {
      name: '1つ上へ移動',
    });
    fireEvent.click(moveUpButtons[1]);
    fixture.detectChanges();

    const titlesAfterUp = getTitleInputs(container).map((input) => input.value);
    expect(titlesAfterUp).toEqual(['First', 'Second']);
  });
});
