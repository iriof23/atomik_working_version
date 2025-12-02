import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import DropCursor from '@tiptap/extension-dropcursor';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { EditorBubbleMenu } from './EditorBubbleMenu';
import { EditorToolbar } from './EditorToolbar';
import { ResizableImage } from './ResizableImage';
import { Upload } from 'lucide-react';

interface EditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
    editable?: boolean;
    className?: string;
    variant?: 'default' | 'evidence';
}

export const Editor = ({
    content,
    onChange,
    placeholder = "Start typing...",
    editable = true,
    className,
    variant = 'default',
}: EditorProps) => {
    const isInternalChange = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Upload image to backend API
    const uploadImage = async (file: File): Promise<string> => {
        try {
            const formData = new FormData();
            formData.append('file', file);

            console.log('[Upload] Starting upload for file:', file.name, 'Size:', file.size);

            const response = await fetch('http://localhost:8000/api/uploads/screenshot', {
                method: 'POST',
                body: formData,
            });

            console.log('[Upload] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Upload] Error response:', errorText);
                alert(`Upload Failed (${response.status}): ${errorText}`);
                throw new Error(`Upload failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('[Upload] Success:', data);
            return `http://localhost:8000${data.url}`;
        } catch (error) {
            console.error('[Upload] Exception:', error);
            if (error instanceof Error) {
                alert(`Error uploading image: ${error.message}`);
            } else {
                alert('Error uploading image. Check console for details.');
            }
            throw error;
        }
    };

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
                codeBlock: {
                    HTMLAttributes: {
                        class: 'rounded-md bg-zinc-900 p-4 font-mono text-sm text-zinc-100',
                    },
                },
            }),
            Placeholder.configure({
                placeholder: variant === 'evidence' ? '' : placeholder,
                includeChildren: true,
            }),
            DropCursor.configure({
                color: '#10b981', // Primary green color
                width: 2,
            }),
            ResizableImage,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary underline underline-offset-4 hover:text-primary/80',
                },
            }),
        ],
        content,
        editable,
        onUpdate: ({ editor }) => {
            isInternalChange.current = true;
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: cn(
                    'prose prose-invert prose-sm max-w-none focus:outline-none space-y-4',

                    // Headings
                    'prose-headings:font-semibold prose-headings:text-zinc-100',
                    '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-white [&_h1]:mt-6 [&_h1]:mb-4',
                    '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-zinc-100 [&_h2]:mt-4 [&_h2]:mb-2',
                    '[&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-zinc-200',

                    // Text
                    'prose-p:text-zinc-300 prose-p:leading-7',
                    'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
                    'prose-strong:text-zinc-100 prose-strong:font-semibold',
                    'prose-ul:list-disc prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-6',
                    'prose-li:marker:text-zinc-500',

                    // Code Blocks (Terminal Style)
                    'prose-code:rounded prose-code:bg-zinc-900 prose-code:px-1 prose-code:py-0.5 prose-code:text-zinc-100 prose-code:before:content-none prose-code:after:content-none',
                    '[&_pre]:bg-[#1e1e1e] [&_pre]:border [&_pre]:border-zinc-700 [&_pre]:rounded-md [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-sm [&_pre]:text-zinc-300',
                    '[&_pre]:relative [&_pre]:pt-12', // Extra padding for "window" header
                    '[&_pre::before]:content-[""] [&_pre::before]:absolute [&_pre::before]:top-4 [&_pre::before]:left-4 [&_pre::before]:w-3 [&_pre::before]:h-3 [&_pre::before]:rounded-full [&_pre::before]:bg-[#ff5f56] [&_pre::before]:shadow-[1.2rem_0_0_#ffbd2e,2.4rem_0_0_#27c93f]', // Mac window dots

                    // Blockquotes (Callout Style)
                    '[&_blockquote]:bg-zinc-900/50 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-500 [&_blockquote]:py-2 [&_blockquote]:px-4 [&_blockquote]:not-italic [&_blockquote]:text-zinc-300 [&_blockquote]:rounded-r-md [&_blockquote]:my-4',

                    // Layout
                    'min-h-[400px] w-full h-auto [&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:h-auto'
                ),
            },
            handleDrop: (view, event, _slice, moved) => {
                if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
                    const file = event.dataTransfer.files[0];
                    if (file.type.startsWith('image/')) {
                        // STOP THE BROWSER NAVIGATING
                        event.preventDefault();
                        event.stopPropagation();

                        // Check file size
                        if (file.size > 5 * 1024 * 1024) {
                            alert('Image size must be less than 5MB');
                            return true;
                        }

                        // Upload and insert at drop position
                        uploadImage(file).then(url => {
                            const { schema } = view.state;
                            const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });

                            if (coordinates) {
                                // Insert at drop coordinates, don't replace selection
                                const node = schema.nodes.resizableImage.create({ src: url });
                                const transaction = view.state.tr.insert(coordinates.pos, node);
                                view.dispatch(transaction);
                            }
                        }).catch(error => {
                            console.error('Failed to upload image:', error);
                            alert('Failed to upload image. Please try again.');
                        });

                        return true; // Tell ProseMirror "We handled this."
                    }
                }
                return false;
            },
            handlePaste: (view, event, _slice) => {
                const items = event.clipboardData?.items;
                if (items) {
                    for (let i = 0; i < items.length; i++) {
                        if (items[i].type.startsWith('image/')) {
                            event.preventDefault();

                            const file = items[i].getAsFile();
                            if (file) {
                                // Check file size
                                if (file.size > 5 * 1024 * 1024) {
                                    alert('Image size must be less than 5MB');
                                    return true;
                                }

                                // Upload and insert at cursor position
                                uploadImage(file).then(url => {
                                    const { schema, selection } = view.state;
                                    const node = schema.nodes.resizableImage.create({ src: url });
                                    const transaction = view.state.tr.replaceSelectionWith(node);
                                    view.dispatch(transaction);
                                }).catch(error => {
                                    console.error('Failed to upload image:', error);
                                    alert('Failed to upload image. Please try again.');
                                });
                            }
                            return true;
                        }
                    }
                }
                return false;
            },
        },
    });

    // Update content if it changes externally
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            // If the change came from within the editor (user typing/pasting), don't reset
            if (isInternalChange.current) {
                isInternalChange.current = false;
                return;
            }

            // Only update if the content is truly different
            const currentContent = editor.getHTML();
            if (content !== currentContent) {
                editor.commands.setContent(content);
            }
        }
    }, [content, editor]);

    // Handle file input change
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && editor) {
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file');
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                alert('Image size must be less than 5MB');
                return;
            }

            uploadImage(file).then(url => {
                // Insert at end for evidence variant, at cursor for default
                if (variant === 'evidence') {
                    editor.chain().focus('end').setImage({ src: url }).run();
                } else {
                    editor.chain().focus().setImage({ src: url }).run();
                }
            }).catch(error => {
                console.error('Failed to upload image:', error);
                alert('Failed to upload image. Please try again.');
            });

            // Reset input
            e.target.value = '';
        }
    };

    // Handle drops in the "dead zone" (empty space in container)
    const handleWrapperDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Allow drop event to fire
    };

    const handleWrapperDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const files = Array.from(e.dataTransfer.files);
        const imageFile = files.find(file => file.type.startsWith('image/'));

        if (imageFile && editor) {
            // Check file size
            if (imageFile.size > 5 * 1024 * 1024) {
                alert('Image size must be less than 5MB');
                return;
            }

            uploadImage(imageFile).then(url => {
                // Append to end of document
                editor.chain().focus('end').setImage({ src: url }).run();
            }).catch(error => {
                console.error('Failed to upload image:', error);
                alert('Failed to upload image. Please try again.');
            });
        }
    };

    if (!editor) {
        return null;
    }

    const isEmpty = !content || content === '<p></p>' || content === '';
    const isEvidenceVariant = variant === 'evidence';
    const showDropZone = isEvidenceVariant && isEmpty;

    // Focus editor on single click anywhere in the container
    const handleContainerClick = (e: React.MouseEvent) => {
        // Don't focus if clicking on toolbar or other interactive elements
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('[role="toolbar"]')) {
            return;
        }
        editor?.commands.focus();
    };

    return (
        <div
            className={cn(
                'relative w-full rounded-md border bg-transparent transition-all duration-200 cursor-text',
                showDropZone
                    ? 'min-h-[400px] border-dashed border-2 border-zinc-700 hover:border-zinc-600'
                    : 'min-h-[400px] h-auto border-zinc-800/50 focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-600',
                'p-0', // Removed padding to let toolbar sit flush if desired, or manage padding in toolbar/content
                className
            )}
            onClick={handleContainerClick}
            onDrop={handleWrapperDrop}
            onDragOver={handleWrapperDragOver}
        >
            {showDropZone && (
                <div
                    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload className="w-12 h-12 text-zinc-600 mb-3" />
                    <p className="text-zinc-500 text-sm font-medium">
                        Drag & drop proof, screenshots, or code snippets here
                    </p>
                    <p className="text-zinc-600 text-xs mt-1">
                        or paste from clipboard
                    </p>
                </div>
            )}
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileInputChange}
            />
            {editable && <EditorToolbar editor={editor} />}
            {editable && <EditorBubbleMenu editor={editor} />}
            <div className="p-4">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};
