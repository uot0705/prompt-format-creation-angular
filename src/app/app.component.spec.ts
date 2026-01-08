import { render, screen } from '@testing-library/angular';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('フォームとプレビュー領域が表示される', async () => {
    const { container } = await render(AppComponent);

    expect(container.querySelector('app-prompt-form')).not.toBeNull();
    expect(container.querySelector('app-prompt-output')).not.toBeNull();
    expect(screen.getByText('質問フォーム')).toBeTruthy();
  });
});
