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

    const errorCheckbox = screen.getByLabelText('エラー相談') as HTMLInputElement;
    fireEvent.click(errorCheckbox);
    fixture.detectChanges();
    await fixture.whenStable();

    const mainQuestion = getMainQuestionTextarea(container);
    expect(mainQuestion.value).toBe('以下のエラー内容を解決してください');
    expect(errorCheckbox.checked).toBeTrue();

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

    const addButton = screen.getByText('追加');
    fireEvent.click(addButton);
    fixture.detectChanges();

    expect(getFieldContainers(container).length).toBe(2);
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

    fireEvent.click(screen.getByText('追加'));
    fixture.detectChanges();

    const titleInputs = getTitleInputs(container);
    fireEvent.input(titleInputs[0], { target: { value: 'First' } });
    fireEvent.input(titleInputs[1], { target: { value: 'Second' } });

    let headerButtons = container.querySelectorAll<HTMLButtonElement>(
      '.field .header-buttons button'
    );
    fireEvent.click(headerButtons[1]);
    fixture.detectChanges();

    const titlesAfterDown = getTitleInputs(container).map((input) => input.value);
    expect(titlesAfterDown).toEqual(['Second', 'First']);

    headerButtons = container.querySelectorAll<HTMLButtonElement>(
      '.field .header-buttons button'
    );
    fireEvent.click(headerButtons[3]);
    fixture.detectChanges();

    const titlesAfterUp = getTitleInputs(container).map((input) => input.value);
    expect(titlesAfterUp).toEqual(['First', 'Second']);
  });
});
