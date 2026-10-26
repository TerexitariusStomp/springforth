import { displayNameText } from '../../../src/portal/ui.ts';

/** Humanized actor id — visible label, raw id on hover. */
export function ActorName({ id }: { id: string }) {
	return <span title={id}>{displayNameText(id)}</span>;
}
