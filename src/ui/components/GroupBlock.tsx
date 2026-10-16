import { groupPageUrl } from '../../data/groups.ts';
import type { SlimGroup, TpacEvent } from '../../shared/types.ts';
import { send } from '../api.ts';
import { charterWarning, formatTpacTime } from '../format.ts';
import { useAsync } from '../hooks.ts';
import { A } from './A.tsx';

export function GroupBlock({ group, slots, now = Date.now() }: { group: SlimGroup; slots?: TpacEvent[]; now?: number }) {
  const d = useAsync(() => send('get-group-details', { identifier: group.identifier }), [group.identifier]);
  const details = d.value?.details;
  const warn = charterWarning(details?.endDate ?? group.endDate, now);
  return (
    <div class="group">
      <h2><A href={groupPageUrl(group)}>{group.name}</A></h2>
      {details && details.chairs.length > 0 && <p>Chairs: {details.chairs.join(', ')}</p>}
      {details && details.teamContacts.length > 0 && <p>Team contacts: {details.teamContacts.join(', ')}</p>}
      {warn && <p class="warn">{warn}</p>}
      {slots && slots.length > 0 && (
        <div class="slots">
          <p>Meets at TPAC 2026:</p>
          <ul>
            {slots.map((e) => (
              <li key={e.uid}>
                {formatTpacTime(e.start)}{e.room ? `, ${e.room}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
