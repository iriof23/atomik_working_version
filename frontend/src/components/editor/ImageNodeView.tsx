import { NodeViewWrapper } from '@tiptap/react';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Editor } from '@tiptap/core';
import { useState, useRef, useEffect } from 'react';
import { AlignLeft, AlignCenter, AlignRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageNodeViewProps {
    node: ProseMirrorNode;
    updateAttributes: (attrs: Record<string, any>) => void;
    editor: Editor;
    selected: boolean;
    deleteNode: () => void;
}

export const ImageNodeView = ({ node, updateAttributes, selected, deleteNode }: ImageNodeViewProps) => {
    const [caption, setCaption] = useState(node.attrs.caption || '');
    const [isEditingCaption, setIsEditingCaption] = useState(false);
    const captionInputRef = useRef<HTMLInputElement>(null);

    // Sync caption from node attrs when they change externally
    useEffect(() => {
        if (node.attrs.caption !== caption && !isEditingCaption) {
            setCaption(node.attrs.caption || '');
        }
    }, [node.attrs.caption]);

    const handleCaptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newCaption = e.target.value;
        setCaption(newCaption);
        updateAttributes({ caption: newCaption });
    };

    const handleCaptionFocus = () => {
        setIsEditingCaption(true);
    };

    const handleCaptionBlur = () => {
        setIsEditingCaption(false);
    };

    // Prevent keyboard events from bubbling to TipTap editor
    const handleCaptionKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
        // Allow Enter to blur the input (optional UX improvement)
        if (e.key === 'Enter') {
            captionInputRef.current?.blur();
        }
    };

    const handleWidthChange = (width: string) => {
        updateAttributes({ width });
    };

    const handleAlignChange = (align: 'left' | 'center' | 'right') => {
        updateAttributes({ align });
    };

    const justifyContent =
        node.attrs.align === 'left'
            ? 'flex-start'
            : node.attrs.align === 'right'
                ? 'flex-end'
                : 'center';

    const currentAlign = node.attrs.align || 'center';

    return (
        <NodeViewWrapper className="my-4 flex group/node" style={{ justifyContent }}>
            <div
                className="relative transition-all"
                style={{ width: node.attrs.width || '75%' }}
            >
                {/* Image */}
                <div className={cn(
                    "relative rounded-lg overflow-hidden transition-all duration-200",
                    selected ? "ring-2 ring-emerald-500 ring-offset-2" : "hover:ring-1 hover:ring-slate-300"
                )}>
                    <img
                        src={node.attrs.src}
                        alt={node.attrs.alt || ''}
                        className="w-full h-auto rounded-lg shadow-md"
                        draggable={false}
                    />
                </div>

                {/* Glassmorphic Toolbar - Visible on hover or selection */}
                <div className={cn(
                    "absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 backdrop-blur-md bg-slate-900/80 border border-slate-700 rounded-lg px-2 py-1.5 z-50 transition-all duration-200 shadow-lg",
                    selected || "opacity-0 group-hover/node:opacity-100"
                )}>
                    {/* Alignment Controls */}
                    <div className="flex items-center gap-0.5 pr-2 border-r border-slate-600">
                        <button
                            onClick={() => handleAlignChange('left')}
                            className={cn(
                                "p-1.5 rounded transition-colors",
                                currentAlign === 'left' 
                                    ? "bg-emerald-500/20 text-emerald-400" 
                                    : "text-slate-400 hover:text-white hover:bg-white/10"
                            )}
                            title="Align Left"
                        >
                            <AlignLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => handleAlignChange('center')}
                            className={cn(
                                "p-1.5 rounded transition-colors",
                                currentAlign === 'center' 
                                    ? "bg-emerald-500/20 text-emerald-400" 
                                    : "text-slate-400 hover:text-white hover:bg-white/10"
                            )}
                            title="Align Center"
                        >
                            <AlignCenter className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => handleAlignChange('right')}
                            className={cn(
                                "p-1.5 rounded transition-colors",
                                currentAlign === 'right' 
                                    ? "bg-emerald-500/20 text-emerald-400" 
                                    : "text-slate-400 hover:text-white hover:bg-white/10"
                            )}
                            title="Align Right"
                        >
                            <AlignRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Size Controls */}
                    <div className="flex items-center gap-0.5 px-1">
                        <button
                            onClick={() => handleWidthChange('25%')}
                            className={cn(
                                "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                                node.attrs.width === '25%' 
                                    ? "bg-emerald-500/20 text-emerald-400" 
                                    : "text-slate-400 hover:text-white hover:bg-white/10"
                            )}
                        >
                            25%
                        </button>
                        <button
                            onClick={() => handleWidthChange('50%')}
                            className={cn(
                                "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                                node.attrs.width === '50%' 
                                    ? "bg-emerald-500/20 text-emerald-400" 
                                    : "text-slate-400 hover:text-white hover:bg-white/10"
                            )}
                        >
                            50%
                        </button>
                        <button
                            onClick={() => handleWidthChange('75%')}
                            className={cn(
                                "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                                node.attrs.width === '75%' 
                                    ? "bg-emerald-500/20 text-emerald-400" 
                                    : "text-slate-400 hover:text-white hover:bg-white/10"
                            )}
                        >
                            75%
                        </button>
                        <button
                            onClick={() => handleWidthChange('100%')}
                            className={cn(
                                "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                                node.attrs.width === '100%' 
                                    ? "bg-emerald-500/20 text-emerald-400" 
                                    : "text-slate-400 hover:text-white hover:bg-white/10"
                            )}
                        >
                            100%
                        </button>
                    </div>

                    {/* Delete Button */}
                    <div className="pl-2 border-l border-slate-600">
                        <button
                            onClick={deleteNode}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            title="Delete Image"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Caption Input - Always visible, styled to be clearly editable */}
                <div 
                    className="mt-2 px-1"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <input
                        ref={captionInputRef}
                        type="text"
                        value={caption}
                        onChange={handleCaptionChange}
                        onFocus={handleCaptionFocus}
                        onBlur={handleCaptionBlur}
                        onKeyDown={handleCaptionKeyDown}
                        onKeyUp={(e) => e.stopPropagation()}
                        onKeyPress={(e) => e.stopPropagation()}
                        placeholder="Add a caption..."
                        className={cn(
                            "w-full bg-transparent text-center text-xs transition-all duration-200 rounded px-2 py-1",
                            "border border-transparent",
                            "placeholder:text-slate-400 text-slate-600",
                            "hover:border-slate-200 hover:bg-slate-50",
                            "focus:outline-none focus:border-emerald-300 focus:bg-white focus:text-slate-700 focus:ring-1 focus:ring-emerald-200",
                            caption ? "italic" : ""
                        )}
                    />
                </div>
            </div>
        </NodeViewWrapper>
    );
};
