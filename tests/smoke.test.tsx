describe('scaffold smoke', () => {
  it('exposes a fake browser API in tests', async () => {
    await browser.storage.local.set({ ping: 'pong' });
    expect(await browser.storage.local.get('ping')).toEqual({ ping: 'pong' });
  });
});
