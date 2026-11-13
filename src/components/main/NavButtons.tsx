import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { ArrowLeftIcon, ArrowRightIcon } from '../icons';

/** Back / forward through visited folders. */
export function NavButtons() {
  const canBack = useUi((s) => s.backStack.length > 0);
  const canForward = useUi((s) => s.forwardStack.length > 0);
  const goBack = useUi((s) => s.goBack);
  const goForward = useUi((s) => s.goForward);
  const state = useBookmarks();
  const backTitle = useUi((s) => state.nodes.get(s.backStack.at(-1) ?? '')?.title);
  const forwardTitle = useUi((s) => state.nodes.get(s.forwardStack.at(-1) ?? '')?.title);

  const button = (
    label: string,
    enabled: boolean,
    onClick: () => void,
    icon: React.ReactNode,
  ) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!enabled}
      onClick={onClick}
      className="text-ink-muted enabled:hover:bg-hover enabled:hover:text-ink grid size-8 place-items-center rounded-lg transition-colors duration-150 disabled:opacity-35"
    >
      {icon}
    </button>
  );

  return (
    <div className="flex shrink-0 items-center" role="group" aria-label="History">
      {button(
        backTitle ? `Back to ${backTitle} ([)` : 'Back ([)',
        canBack,
        goBack,
        <ArrowLeftIcon />,
      )}
      {button(
        forwardTitle ? `Forward to ${forwardTitle} (])` : 'Forward (])',
        canForward,
        goForward,
        <ArrowRightIcon />,
      )}
    </div>
  );
}
