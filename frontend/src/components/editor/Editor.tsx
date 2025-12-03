import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import DropCursor from '@tiptap/extension-dropcursor';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
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
                    'prose prose-sm max-w-none focus:outline-none w-full',

                    // Headings - Light theme
                    'prose-headings:font-semibold prose-headings:text-slate-900',
                    '[&_h1]:text-base [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-slate-900 [&_h1]:mt-4 [&_h1]:mb-2',
                    '[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-slate-800 [&_h2]:mt-3 [&_h2]:mb-2',
                    '[&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-slate-700 [&_h3]:mt-2 [&_h3]:mb-1',

                    // Text - Full width, justified text for better readability - Light theme
                    'prose-p:text-slate-600 prose-p:leading-relaxed prose-p:my-2',
                    '[&_p]:text-sm [&_p]:leading-relaxed [&_p]:my-2 [&_p]:text-justify',
                    'prose-a:text-violet-600 prose-a:no-underline hover:prose-a:underline',
                    'prose-strong:text-slate-900 prose-strong:font-semibold',
                    'prose-em:text-slate-700 prose-em:italic',
                    'prose-ul:list-disc prose-ul:pl-5 prose-ul:my-2 prose-ol:list-decimal prose-ol:pl-5 prose-ol:my-2',
                    'prose-li:marker:text-slate-400 prose-li:my-1 [&_li]:text-sm',

                    // Code Blocks - Light theme with dark code block
                    'prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-slate-800 prose-code:before:content-none prose-code:after:content-none prose-code:text-xs',
                    '[&_pre]:bg-slate-900 [&_pre]:border [&_pre]:border-slate-200 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:text-slate-100 [&_pre]:my-2',
                    '[&_pre]:relative [&_pre]:pt-8',
                    '[&_pre::before]:content-[""] [&_pre::before]:absolute [&_pre::before]:top-3 [&_pre::before]:left-3 [&_pre::before]:w-2 [&_pre::before]:h-2 [&_pre::before]:rounded-full [&_pre::before]:bg-[#ff5f56] [&_pre::before]:shadow-[0.75rem_0_0_#ffbd2e,1.5rem_0_0_#27c93f]',

                    // Blockquotes (Callout Style) - Light theme
                    '[&_blockquote]:bg-slate-50 [&_blockquote]:border-l-4 [&_blockquote]:border-violet-500 [&_blockquote]:py-2 [&_blockquote]:px-4 [&_blockquote]:not-italic [&_blockquote]:text-slate-600 [&_blockquote]:rounded-r-md [&_blockquote]:my-2 [&_blockquote]:text-sm',

                    // Layout - Full width
                    'min-h-[150px] w-full h-auto [&_.ProseMirror]:min-h-[150px] [&_.ProseMirror]:h-auto [&_.ProseMirror]:w-full'
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
                'relative w-full rounded-lg border bg-white transition-all duration-200 cursor-text',
                showDropZone
                    ? 'min-h-[200px] border-dashed border-2 border-slate-300 hover:border-slate-400'
                    : 'min-h-[150px] h-auto border-slate-200 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500/20',
                'p-0',
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
                    <Upload className="w-10 h-10 text-slate-400 mb-3" />
                    <p className="text-slate-500 text-sm font-medium">
                        Drag & drop proof, screenshots, or code snippets here
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
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
            <div className="p-4 w-full">
                <EditorContent editor={editor} className="w-full" />
            </div>
        </div>
    );
};
