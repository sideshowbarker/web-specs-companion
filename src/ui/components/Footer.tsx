export function Footer({ surface, windowId }: { surface: 'popup' | 'sidepanel'; windowId?: number }) {
  const side = (browser as unknown as { sidePanel?: { open?: (o: { windowId: number }) => Promise<void> } }).sidePanel;
  const bar = (browser as unknown as { sidebarAction?: { open?: () => Promise<void> } }).sidebarAction;
  const canOpen = surface === 'popup' && (!!side?.open || !!bar?.open);
  // Both open() calls need the user gesture, so each is the first thing the click handler does.
  function openBeside() {
    const p = side?.open && windowId !== undefined ? side.open({ windowId }) : bar?.open?.();
    p?.then(() => window.close(), () => {});
  }
  return (
    <footer>
      {canOpen && (
        <button type="button" onClick={openBeside}>
          Keep this open beside the page
        </button>
      )}
    </footer>
  );
}
