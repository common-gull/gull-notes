import Image from '@tiptap/extension-image';

export interface SpoilerImageOptions {
	inline: boolean;
	allowBase64: boolean;
	HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		spoilerImage: {
			/**
			 * Toggle spoiler on selected image
			 */
			toggleImageSpoiler: () => ReturnType;
		};
	}
}

export const SpoilerImage = Image.extend<SpoilerImageOptions>({
	name: 'image',

	addAttributes() {
		return {
			...this.parent?.(),
			'data-spoiler': {
				default: null,
				parseHTML: (element) => element.getAttribute('data-spoiler'),
				renderHTML: (attributes) => {
					if (!attributes['data-spoiler']) {
						return {};
					}
					return { 'data-spoiler': attributes['data-spoiler'] };
				}
			},
			'data-revealed': {
				default: null,
				parseHTML: (element) => element.getAttribute('data-revealed'),
				renderHTML: (attributes) => {
					if (!attributes['data-revealed']) {
						return {};
					}
					return { 'data-revealed': attributes['data-revealed'] };
				}
			}
		};
	},

	addCommands() {
		return {
			...this.parent?.(),
			toggleImageSpoiler:
				() =>
				({ tr, state, dispatch }) => {
					const { selection } = state;
					const node = state.doc.nodeAt(selection.from);

					if (!node || node.type.name !== 'image') {
						return false;
					}

					if (dispatch) {
						const isSpoiler = node.attrs['data-spoiler'] === 'true';
						const attrs = {
							...node.attrs,
							'data-spoiler': isSpoiler ? null : 'true',
							'data-revealed': isSpoiler ? null : 'false'
						};
						tr.setNodeMarkup(selection.from, undefined, attrs);
						dispatch(tr);
					}

					return true;
				}
		};
	}
});

export default SpoilerImage;
