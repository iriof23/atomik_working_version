import Image from '@tiptap/extension-image';
import { mergeAttributes, ReactNodeViewRenderer } from '@tiptap/react';
import { ImageNodeView } from './ImageNodeView';

export const ResizableImage = Image.extend({
    name: 'resizableImage',

    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: '75%',
                renderHTML: (attributes) => {
                    return {
                        width: attributes.width,
                    };
                },
            },
            align: {
                default: 'center',
                renderHTML: (attributes) => {
                    return {
                        'data-align': attributes.align,
                    };
                },
            },
            caption: {
                default: '',
                renderHTML: (attributes) => {
                    return {
                        'data-caption': attributes.caption,
                    };
                },
            },
        };
    },

    addNodeView() {
        return ReactNodeViewRenderer(ImageNodeView);
    },

    renderHTML({ HTMLAttributes }) {
        const { style, 'data-caption': caption, ...rest } = HTMLAttributes;
        const align = HTMLAttributes['data-align'] || 'center';
        const justifyContent = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
        
        const children: any[] = [
            ['img', mergeAttributes(this.options.HTMLAttributes, rest)],
        ];
        
        // Add caption as a figcaption if it exists
        if (caption) {
            children.push(['figcaption', { style: 'text-align: center; font-size: 0.875rem; color: #64748b; margin-top: 0.5rem; font-style: italic;' }, caption]);
        }
        
        return [
            'figure',
            {
                style: `display: flex; flex-direction: column; align-items: ${align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'}; margin: 1rem 0;`,
                'data-align': align,
            },
            ...children,
        ];
    },
});
