import { copyHistoryCache } from './copy-history-cache';

describe('copyHistoryCache', () => {
  let previous: string | null;
  beforeEach(() => {
    previous = localStorage.getItem('copyHistoryCache');
    copyHistoryCache.clearHistory();
  });
  afterEach(() => {
    if (previous === null) localStorage.removeItem('copyHistoryCache');
    else localStorage.setItem('copyHistoryCache', previous);
  });

  it('20件までは保持し、21件目では最古の1件だけを削除する', () => {
    for (let index = 1; index <= 20; index++) copyHistoryCache.addHistory(`履歴${index}`);
    expect(copyHistoryCache.getHistory().length).toBe(20);
    expect(copyHistoryCache.getHistory()[19].text).toBe('履歴1');
    copyHistoryCache.addHistory('履歴21');
    const restored = copyHistoryCache.getHistory();
    expect(restored.length).toBe(20);
    expect(restored[0].text).toBe('履歴21');
    expect(restored[19].text).toBe('履歴2');
    expect(JSON.parse(localStorage.getItem('copyHistoryCache')!).length).toBe(20);
  });

  it('既存の10件を保持したまま20件まで追加できる', () => {
    localStorage.setItem('copyHistoryCache', JSON.stringify(
      Array.from({ length: 10 }, (_, index) => ({ text: `旧履歴${index}`, createdAt: index }))
    ));
    for (let index = 0; index < 10; index++) copyHistoryCache.addHistory(`新履歴${index}`);
    expect(copyHistoryCache.getHistory().length).toBe(20);
    expect(copyHistoryCache.getHistory()[19].text).toBe('旧履歴9');
  });
});
