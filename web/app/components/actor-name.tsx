import { displayNameText } from '../../../src/portal/index';

/** Humanized actor id — visible label, raw id on hover. */
export function ActorName({ id }: { id: string }) {
	return <span title={id}>{displayNameText(id)}</span>;
}
